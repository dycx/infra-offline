// 登录页逻辑
const btn = document.getElementById('btn-login');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = '等待浏览器认证...';
  status.textContent = '请在弹出的浏览器中完成企业认证';

  try {
    await window.api.login();
    status.textContent = '认证中...';
    // SSO 回调后，main.js 自动跳转到 app.html
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '使用企业账号登录';
    status.textContent = '登录失败: ' + err.message;
  }
});

// 已有 token？直接跳主界面
(async () => {
  const token = await window.api.getToken();
  if (token) {
    window.api.navigate('app');
  }
})();
