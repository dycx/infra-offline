// ============================================================
// Preload 脚本 — 安全桥接，暴露给前端的安全 API
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ── 认证 ──
  login: () => ipcRenderer.invoke('auth:login'),
  getToken: () => ipcRenderer.invoke('auth:get-token'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // ── 后端 API ──
  backend: {
    get: (url) => ipcRenderer.invoke('backend:call', 'GET', url),
    post: (url, body) => ipcRenderer.invoke('backend:call', 'POST', url, body),
    put: (url, body) => ipcRenderer.invoke('backend:call', 'PUT', url, body),
    delete: (url) => ipcRenderer.invoke('backend:call', 'DELETE', url),
  },

  // ── 文件对话框 ──
  openFile: () => ipcRenderer.invoke('dialog:open-file'),

  // ── 导航 ──
  navigate: (page) => ipcRenderer.send('nav:go', page),
});
