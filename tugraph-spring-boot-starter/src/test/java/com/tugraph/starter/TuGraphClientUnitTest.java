package com.tugraph.starter;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.http.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for TuGraphClient using Mockito to mock RestTemplate.
 *
 * <p>These tests verify retry logic, token management, and error handling
 * without requiring a running TuGraph instance.</p>
 */
@Tag("unit")
class TuGraphClientUnitTest {

    private TuGraphClient client;
    private RestTemplate mockRestTemplate;
    private TuGraphProperties props;

    @BeforeEach
    void setUp() {
        props = new TuGraphProperties();
        props.setUrl("http://localhost:7070");
        props.setUsername("admin");
        props.setPassword("secret");
        props.setDefaultGraph("default");
        props.setMaxRetries(2);
        props.setRetryBackoffMs(100);

        mockRestTemplate = mock(RestTemplate.class);
        client = new TuGraphClient(props, mockRestTemplate, new ObjectMapper());
    }

    // ═══════════════════════════════════════════════════
    // Login & Token
    // ═══════════════════════════════════════════════════

    @Test
    @DisplayName("Should login and cache JWT token")
    void shouldLoginAndCacheToken() {
        String mockJwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.fake";

        // Mock login response
        ResponseEntity<String> loginResp = new ResponseEntity<>(
                "{\"jwt\":\"" + mockJwt + "\",\"is_admin\":true}",
                HttpStatus.OK
        );
        when(mockRestTemplate.postForEntity(
                eq("http://localhost:7070/login"), any(), eq(String.class)))
                .thenReturn(loginResp);

        // Mock Cypher query response
        ResponseEntity<String> cypherResp = new ResponseEntity<>(
                "{\"result\":[{\"n\":{\"name\":\"test\"}}]}",
                HttpStatus.OK
        );
        when(mockRestTemplate.exchange(
                eq("http://localhost:7070/cypher"), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(cypherResp);

        // First call should trigger login
        var result = client.callCypher("RETURN 1");
        assertNotNull(result);

        // Verify login was called exactly once
        verify(mockRestTemplate, times(1)).postForEntity(
                eq("http://localhost:7070/login"), any(), eq(String.class));
    }

    @Test
    @DisplayName("Should reuse cached token on subsequent calls")
    void shouldReuseCachedToken() {
        String mockJwt = "eyJhbGciOiJIUzI1NiJ9.cached.fake";

        // Login
        ResponseEntity<String> loginResp = new ResponseEntity<>(
                "{\"jwt\":\"" + mockJwt + "\"}",
                HttpStatus.OK
        );
        when(mockRestTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenReturn(loginResp);

        // Cypher
        ResponseEntity<String> cypherResp = new ResponseEntity<>(
                "{\"result\":[]}", HttpStatus.OK
        );
        when(mockRestTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(cypherResp);

        // Two calls
        client.callCypher("RETURN 1");
        client.callCypher("RETURN 2");

        // Login should be called only once (token cached)
        verify(mockRestTemplate, times(1)).postForEntity(
                eq("http://localhost:7070/login"), any(), eq(String.class));
    }

    // ═══════════════════════════════════════════════════
    // Retry Logic
    // ═══════════════════════════════════════════════════

    @Test
    @DisplayName("Should retry on RestClientException and succeed")
    void shouldRetryOnTransientFailure() {
        String mockJwt = "eyJhbGciOiJIUzI1NiJ9.retry.fake";

        // Login succeeds
        ResponseEntity<String> loginResp = new ResponseEntity<>(
                "{\"jwt\":\"" + mockJwt + "\"}", HttpStatus.OK
        );
        when(mockRestTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenReturn(loginResp);

        // First 1 cypher calls fail, then succeed
        when(mockRestTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenThrow(new RestClientException("Connection refused"))
                .thenReturn(new ResponseEntity<>("{\"result\":[{\"ok\":true}]}", HttpStatus.OK));

        var result = client.callCypher("RETURN 1");
        assertNotNull(result);

        // Should have retried: 1 login + 2 cypher calls (1 fail + 1 success)
        verify(mockRestTemplate, times(2)).exchange(
                eq("http://localhost:7070/cypher"), eq(HttpMethod.POST), any(), eq(String.class));
    }

    @Test
    @DisplayName("Should throw TuGraphException after exhausting retries")
    void shouldThrowAfterMaxRetries() {
        String mockJwt = "eyJhbGciOiJIUzI1NiJ9.exhaust.fake";

        // Login
        when(mockRestTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"jwt\":\"" + mockJwt + "\"}", HttpStatus.OK));

        // All cypher calls fail
        when(mockRestTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenThrow(new RestClientException("Timeout"));

        // maxRetries=2 → 3 attempts total (initial + 2 retries)
        assertThrows(TuGraphClient.TuGraphException.class,
                () -> client.callCypher("RETURN 1"));

        // 1 login + 3 cypher attempts
        verify(mockRestTemplate, times(3)).exchange(
                eq("http://localhost:7070/cypher"), eq(HttpMethod.POST), any(), eq(String.class));
    }

    // ═══════════════════════════════════════════════════
    // Token Refresh on 401
    // ═══════════════════════════════════════════════════

    @Test
    @DisplayName("Should re-login when server returns 401")
    void shouldReLoginOn401() {
        String oldJwt = "eyJ.old.fake";
        String newJwt = "eyJ.new.fake";

        // First login
        when(mockRestTemplate.postForEntity(
                eq("http://localhost:7070/login"), any(), eq(String.class)))
                .thenReturn(
                        new ResponseEntity<>("{\"jwt\":\"" + oldJwt + "\"}", HttpStatus.OK),
                        new ResponseEntity<>("{\"jwt\":\"" + newJwt + "\"}", HttpStatus.OK)
                );

        // First cypher returns 401, after re-login succeeds
        when(mockRestTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{}", HttpStatus.UNAUTHORIZED))
                .thenReturn(new ResponseEntity<>("{\"result\":[{\"ok\":true}]}", HttpStatus.OK));

        var result = client.callCypher("RETURN 1");
        assertNotNull(result);

        // Login should be called twice (initial + re-login after 401)
        verify(mockRestTemplate, times(2)).postForEntity(
                eq("http://localhost:7070/login"), any(), eq(String.class));
    }

    // ═══════════════════════════════════════════════════
    // Auth header verification
    // ═══════════════════════════════════════════════════

    @Test
    @DisplayName("Should include Bearer token in Authorization header")
    void shouldIncludeBearerToken() {
        String mockJwt = "eyJhbGciOiJIUzI1NiJ9.bearer.fake";

        when(mockRestTemplate.postForEntity(
                eq("http://localhost:7070/login"), any(), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"jwt\":\"" + mockJwt + "\"}", HttpStatus.OK));

        when(mockRestTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"result\":[]}", HttpStatus.OK));

        client.callCypher("RETURN 1");

        // Capture the HttpEntity to verify the Authorization header
        ArgumentCaptor<HttpEntity<?>> captor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(mockRestTemplate).exchange(
                eq("http://localhost:7070/cypher"),
                eq(HttpMethod.POST),
                captor.capture(),
                eq(String.class));

        HttpHeaders headers = captor.getValue().getHeaders();
        String authHeader = headers.getFirst(HttpHeaders.AUTHORIZATION);
        assertNotNull(authHeader);
        assertTrue(authHeader.startsWith("Bearer "));
        assertEquals("Bearer " + mockJwt, authHeader);
    }

    // ═══════════════════════════════════════════════════
    // Properties defaults
    // ═══════════════════════════════════════════════════

    @Test
    @DisplayName("Properties should have sensible defaults")
    void shouldHaveSensibleDefaults() {
        TuGraphProperties defaults = new TuGraphProperties();
        assertEquals("http://tugraph-db:7070", defaults.getUrl());
        assertEquals("admin", defaults.getUsername());
        assertEquals("default", defaults.getDefaultGraph());
        assertEquals(3, defaults.getMaxRetries());
        assertEquals(5000, defaults.getConnectTimeout());
        assertEquals(30000, defaults.getReadTimeout());
        assertEquals(3300, defaults.getTokenCacheTtl());
    }

    // ═══════════════════════════════════════════════════
    // API method contracts
    // ═══════════════════════════════════════════════════

    @Test
    @DisplayName("listGraphs should parse response correctly")
    void shouldParseGraphListResponse() {
        String mockJwt = "jwt";
        when(mockRestTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenReturn(new ResponseEntity<>("{\"jwt\":\"" + mockJwt + "\"}", HttpStatus.OK));

        when(mockRestTemplate.exchange(
                eq("http://localhost:7070/db"), eq(HttpMethod.GET), any(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(
                        "{\"default\":{},\"test_graph\":{}}",
                        HttpStatus.OK));

        var graphs = client.listGraphs();
        assertEquals(2, graphs.size());
        assertTrue(graphs.contains("default"));
        assertTrue(graphs.contains("test_graph"));
    }
}
