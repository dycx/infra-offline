// ============================================================
// Electron 主进程 — 应用入口
// ============================================================

const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const { startBackend, stopBackend } = require('./backend');
const { login, handleCallback, getToken, logout } = require('./auth');

let mainWindow = null;
let backendProcess = null;

// ============================================================
// 窗口管理
// ============================================================

function createWindow(page = 'login') {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,     // 安全：隔离渲染进程
      nodeIntegration: false,     // 安全：禁用 Node.js
      sandbox: true,              // 安全：沙箱模式
    },
    // 无边框 + 自定义标题栏（可选）
    // frame: false,
  });

  mainWindow.loadFile(`src/${page}.html`);

  // 关闭窗口 → 隐藏到托盘而不是退出（可选）
  // mainWindow.on('close', (e) => { e.preventDefault(); mainWindow.hide(); });
}

// ============================================================
// IPC 处理 — 前端调用的所有后端功能
// ============================================================

function setupIPC() {
  // —— 认证 ——
  ipcMain.handle('auth:login', async () => {
    return await login();
  });

  ipcMain.handle('auth:get-token', async () => {
    return getToken();
  });

  ipcMain.handle('auth:logout', async () => {
    logout();
    mainWindow.loadFile('src/login.html');
  });

  // —— 后端 API 代理 ——
  ipcMain.handle('backend:call', async (event, method, url, body) => {
    const token = getToken();
    const fullUrl = `http://localhost:3456${url}`;

    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body && { body: JSON.stringify(body) }),
    };

    const res = await fetch(fullUrl, opts);
    return res.json();
  });

  // —— 文件对话框 ——
  ipcMain.handle('dialog:open-file', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // —— 切换页面 ——
  ipcMain.on('nav:go', (event, page) => {
    mainWindow.loadFile(`src/${page}.html`);
  });
}

// ============================================================
// 应用生命周期
// ============================================================

app.whenReady().then(async () => {
  setupIPC();

  // 启动 C++ 后端
  try {
    backendProcess = await startBackend();
    console.log('Backend started on port 3456');
  } catch (err) {
    console.error('Backend failed:', err.message);
  }

  // 注册自定义协议 (SSO 回调)
  app.setAsDefaultProtocolClient('myapp');

  createWindow('login');
});

// SSO 回调处理
app.on('open-url', async (event, url) => {
  event.preventDefault();
  await handleCallback(url);
  // 登录成功 → 跳转到主界面
  mainWindow.loadFile('src/app.html');
});

// macOS dock 点击
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 退出时清理
app.on('before-quit', () => {
  stopBackend(backendProcess);
});

// 第二个实例激活 → 聚焦已有窗口（单实例）
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();
