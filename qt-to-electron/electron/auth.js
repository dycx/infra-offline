// ============================================================
// 企业 SSO 登录 (OAuth 2.0 + PKCE)
// ============================================================

const { shell, safeStorage } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 配置——按你的企业 SSO 修改
const SSO_CONFIG = {
  authUrl: 'https://sso.company.com/authorize',
  tokenUrl: 'https://sso.company.com/token',
  clientId: 'myapp',
  redirectUri: 'myapp://callback',
  scope: 'openid profile',
};

// Token 存储路径
const tokenPath = path.join(require('electron').app.getPath('userData'), '.token');

// PKCE verifier（内存中，登录完成前有效）
let pkceVerifier = null;

// ============================================================
// 登录——打开系统浏览器
// ============================================================

async function login() {
  // 生成 PKCE code_verifier
  pkceVerifier = crypto.randomBytes(32).toString('base64url');

  // SHA256 → code_challenge
  const challenge = crypto
    .createHash('sha256')
    .update(pkceVerifier)
    .digest('base64url');

  // 构造授权 URL
  const params = new URLSearchParams({
    client_id: SSO_CONFIG.clientId,
    redirect_uri: SSO_CONFIG.redirectUri,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: SSO_CONFIG.scope,
    state: crypto.randomBytes(16).toString('hex'),
  });

  const url = `${SSO_CONFIG.authUrl}?${params}`;

  // 用系统默认浏览器打开（不嵌入应用内）
  await shell.openExternal(url);

  return { status: 'pending' };
}

// ============================================================
// 处理回调——myapp://callback?code=xxx
// ============================================================

async function handleCallback(callbackUrl) {
  const urlObj = new URL(callbackUrl);
  const code = urlObj.searchParams.get('code');

  if (!code) throw new Error('No authorization code received');

  // 用 code + verifier 换 token
  const tokenResponse = await fetch(SSO_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SSO_CONFIG.redirectUri,
      client_id: SSO_CONFIG.clientId,
      code_verifier: pkceVerifier,
    }),
  });

  const tokens = await tokenResponse.json();
  pkceVerifier = null;  // 用完即弃

  // 加密存储
  const encrypted = safeStorage.encryptString(
    JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    })
  );

  fs.writeFileSync(tokenPath, encrypted);
  return tokens;
}

// ============================================================
// 获取 Token——自动刷新
// ============================================================

function getToken() {
  try {
    const encrypted = fs.readFileSync(tokenPath);
    const decrypted = safeStorage.decryptString(encrypted);
    const tokens = JSON.parse(decrypted);

    // 过期则尝试刷新
    if (Date.now() > tokens.expiresAt - 60000) {
      return refreshAccessToken(tokens.refreshToken);
    }

    return tokens.accessToken;
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(SSO_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: SSO_CONFIG.clientId,
    }),
  });

  const tokens = await res.json();
  const encrypted = safeStorage.encryptString(
    JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    })
  );
  fs.writeFileSync(tokenPath, encrypted);
  return tokens.access_token;
}

// ============================================================
// 登出
// ============================================================

function logout() {
  try { fs.unlinkSync(tokenPath); } catch {}
}

module.exports = { login, handleCallback, getToken, logout };
