package com.tugraph.starter;

import org.junit.jupiter.api.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests against a running TuGraph instance.
 *
 * <p>Requires TuGraph running on localhost:7070 with default credentials.
 * Start: lgraph_server -c /tmp/tugraph-config.json -d start</p>
 */
@Tag("integration")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class TuGraphClientIntegrationTest {

    private static TuGraphClient client;

    @BeforeAll
    static void setUp() {
        // Bypass system HTTP proxy for localhost
        System.setProperty("http.proxyHost", "");
        System.setProperty("http.proxyPort", "");
        System.setProperty("https.proxyHost", "");
        System.setProperty("https.proxyPort", "");
        System.setProperty("http.nonProxyHosts", "localhost|127.0.0.1");

        TuGraphProperties props = new TuGraphProperties();
        props.setUrl("http://127.0.0.1:7070");
        props.setUsername("admin");
        props.setPassword("73@TuGraph");
        props.setDefaultGraph("default");
        props.setMaxRetries(2);
        props.setRetryBackoffMs(500);

        RestTemplate restTemplate = new RestTemplate();
        client = new TuGraphClient(props, restTemplate, new com.fasterxml.jackson.databind.ObjectMapper());
    }

    // ──────── Auth ────────

    @Test
    @Order(1)
    @DisplayName("Should login and obtain JWT token")
    void shouldLoginAndGetToken() {
        String token = client.getOrRefreshToken();
        assertNotNull(token, "JWT token should not be null");
        assertFalse(token.isBlank(), "JWT token should not be blank");
    }

    @Test
    @Order(2)
    @DisplayName("Should cache token and reuse on subsequent calls")
    void shouldCacheToken() {
        String token1 = client.getOrRefreshToken();
        String token2 = client.getOrRefreshToken();
        assertEquals(token1, token2, "Token should be cached and reused");
    }

    // ──────── Server Info ────────

    @Test
    @Order(3)
    @DisplayName("Should get server info")
    void shouldGetServerInfo() {
        var info = client.getServerInfo();
        assertNotNull(info, "Server info should not be null");
        assertTrue(info.has("lgraph_version") || info.has("version"),
                "Server info should contain version info");
    }

    @Test
    @Order(4)
    @DisplayName("Should get HA state")
    void shouldGetHaState() {
        String state = client.getHaState();
        assertNotNull(state);
        assertTrue(state.equals("NO_HA") || state.equals("LEADER") || state.equals("FOLLOWER"),
                "HA state should be NO_HA, LEADER, or FOLLOWER, got: " + state);
    }

    // ──────── Graphs ────────

    @Test
    @Order(5)
    @DisplayName("Should list graphs (at least 'default')")
    void shouldListGraphs() {
        List<String> graphs = client.listGraphs();
        assertNotNull(graphs);
        assertFalse(graphs.isEmpty(), "Should return at least one graph");
        assertTrue(graphs.contains("default"), "Should contain 'default' graph, got: " + graphs);
    }

    // ──────── Schema ────────

    @Test
    @Order(6)
    @DisplayName("Should create vertex label and query the graph")
    void shouldCreateVertexLabelAndQuery() {
        // Create a vertex label via Cypher procedure
        Assertions.assertDoesNotThrow(() ->
            client.createVertexLabel("default", "Person", "name",
                    "age", "INT32", "true"),
            "Creating vertex label via Cypher should not throw");
    }

    // ──────── Cypher ────────

    @Test
    @Order(7)
    @DisplayName("Should execute Cypher RETURN query")
    void shouldExecuteCypher() {
        // Use RETURN query which needs no schema
        List<Map<String, Object>> result = client.callCypher(
                "RETURN 1 AS num, 'hello' AS text"
        );
        assertNotNull(result);
        assertFalse(result.isEmpty(), "RETURN query should return results");
    }

    @Test
    @Order(8)
    @DisplayName("Should handle empty result Cypher query gracefully")
    void shouldHandleEmptyCypherResult() {
        List<Map<String, Object>> result = client.callCypher(
                "MATCH (n:NonExistentLabel12345) RETURN n"
        );
        assertNotNull(result, "Empty result should not be null");
    }

    @Test
    @Order(9)
    @DisplayName("Should execute Cypher on specific graph")
    void shouldExecuteCypherOnSpecificGraph() {
        List<Map<String, Object>> result = client.callCypher(
                "RETURN 1 AS num", "default"
        );
        assertNotNull(result);
    }

    // ──────── Plugin operations ────────

    @Test
    @Order(10)
    @DisplayName("Should list C++ plugins (may be empty)")
    void shouldListPlugins() {
        var plugins = client.listPlugins("cpp", "default");
        assertNotNull(plugins, "Plugin list should not be null");
        // New graph may have no plugins — that's OK
    }

    // ──────── Token invalidation ────────

    @Test
    @Order(11)
    @DisplayName("Should re-login after token invalidation")
    void shouldReLoginAfterTokenInvalidation() {
        String tokenBefore = client.getOrRefreshToken();
        client.invalidateToken();
        String tokenAfter = client.getOrRefreshToken();
        assertNotNull(tokenAfter);
        // After invalidation, a new token should be obtained
        // (may or may not be same value depending on server)
    }
}
