// ============================================================
// C++ 后端进程管理
// ============================================================

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 开发模式 vs 打包后的路径
function getBackendPath() {
  // 开发模式：backend/build/backend.exe
  const dev = path.join(__dirname, '..', 'backend', 'build', 'backend.exe');
  if (fs.existsSync(dev)) return dev;

  // 打包后：resources/backend.exe
  // electron-builder 把 extraResources 放到 process.resourcesPath
  const prod = path.join(process.resourcesPath, 'backend.exe');
  if (fs.existsSync(prod)) return prod;

  throw new Error('Backend executable not found');
}

function startBackend() {
  const backendPath = getBackendPath();
  console.log('Starting backend:', backendPath);

  const proc = spawn(backendPath, ['--port', '3456'], {
    windowsHide: true,       // 不弹出控制台窗口
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout.on('data', (d) => console.log(`[backend] ${d}`));
  proc.stderr.on('data', (d) => console.error(`[backend:err] ${d}`));

  // 等待后端就绪（轮询 /health）
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(check);
      reject(new Error('Backend start timeout'));
    }, 10000);

    const check = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3456/health');
        if (res.ok) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve(proc);
        }
      } catch {}
    }, 300);
  });
}

function stopBackend(proc) {
  if (proc && !proc.killed) {
    // 优雅关闭
    fetch('http://localhost:3456/shutdown', { method: 'POST' }).catch(() => {});
    setTimeout(() => {
      if (!proc.killed) proc.kill();
    }, 3000);
  }
}

module.exports = { startBackend, stopBackend };
