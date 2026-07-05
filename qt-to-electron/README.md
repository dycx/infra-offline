# Qt6 → Electron 前端改造方案

## 背景

Qt6 WebEngine 依赖 MSVC 编译器，项目使用 MinGW 无法编译 WebEngine 模块。
改用 Electron 替代 Qt 前端层，C++ 后端保持不变（继续用 MinGW）。

## 架构

```
┌────────────────────────────────────────────┐
│              Electron 应用                  │
│  ┌──────────────┐   IPC   ┌──────────────┐ │
│  │  前端页面     │◄──────►│  主进程       │ │
│  │  HTML/CSS/JS  │        │  认证/后端管理 │ │
│  └──────────────┘        └──────┬───────┘ │
│                                 │         │
│                     localhost HTTP API     │
│                                 │         │
│  ┌──────────────────────────────▼───────┐  │
│  │   C++ 后端 (MinGW 编译，不变)        │  │
│  │   原 Qt 业务代码 → HTTP Server      │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

## 文件结构

```
qt-to-electron/
├── README.md                    ← 本文件
├── package.json                 ← Electron + 构建配置
├── electron/
│   ├── main.js                  ← 主进程：窗口管理、IPC、生命周期
│   ├── preload.js               ← 安全桥接：前端可调用的 API
│   ├── auth.js                  ← SSO 登录：OAuth 2.0 + PKCE
│   └── backend.js               ← C++ 后端进程管理
├── src/
│   ├── login.html               ← 登录页
│   ├── login.js                 ← 登录逻辑
│   ├── app.html                 ← 主界面
│   ├── app.js                   ← 主界面逻辑（表格/分页/搜索/CRUD）
│   └── style.css                ← 样式
└── backend/
    └── main.cpp                 ← C++ HTTP Server 模板
```

## 关键决策

| 项目 | 选择 | 原因 |
|------|------|------|
| 前端框架 | 原生 HTML/CSS/JS | 页面少，无需 React/Vue 的复杂度 |
| 登录方式 | 系统浏览器 + OAuth PKCE | 密码不经过应用，安全合规 |
| C++ HTTP 库 | cpp-httplib | 单头文件，MinGW 零配置兼容 |
| JSON 库 | nlohmann/json | 单头文件，语法简洁 |
| 打包工具 | electron-builder | 一体打包 exe，便携版无需安装 |
| 编译器 | 不涉及 C++ 编译 | npm install → electron . 即可运行 |

## 快速开始

```bash
# 1. 安装依赖（只需 Node.js）
npm install

# 2. 编译 C++ 后端（MinGW）
cd backend && mkdir build && cd build
cmake .. -G "MinGW Makefiles"
mingw32-make
cd ../..

# 3. 启动应用
npm start

# 4. 打包为便携版 exe
npm run build
# → dist/MyApp.exe  (双击运行，无需安装)
```

## SSO 登录流程

```
用户点击"登录" → 系统浏览器打开企业 SSO 页
→ 用户认证（密码不经过应用）
→ 回调 myapp://callback?code=xxx
→ 应用拦截 → 用 code + PKCE 换 token
→ token 加密存本地 (safeStorage)
→ 后续请求自动带 token
```

## C++ 后端改造要点

原 Qt 代码只需做两处改动：

1. **入口改造**：`main()` 从 `QApplication` 改为 `httplib::Server`
2. **接口暴露**：原有内部函数注册为 HTTP 路由

```cpp
// 以前：函数调用
auto result = queryData(1, "");
// 现在：HTTP 路由
svr.Get("/api/data", handler);
// handler 内部调用的还是原来的 queryData
```

## 安全性

- 密码不经过应用 → 系统浏览器完成
- PKCE 防授权码拦截
- IPC 隔离 → 前端无法直接访问文件系统
- Token 加密存储 → Electron safeStorage
- 单实例锁 → 防止多开
