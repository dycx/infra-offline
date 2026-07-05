// ============================================================
// 主界面逻辑 — Tab 切换 + 数据加载 + 动态交互
// ============================================================

// ── Tab 导航 ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadPage(tab.dataset.tab);
  });
});

// 退出
document.getElementById('btn-logout').addEventListener('click', () => {
  window.api.logout();
});

// ── 页面加载 ──────────────────────────────────────────────

async function loadPage(name) {
  const main = document.getElementById('content');

  switch (name) {
    case 'dashboard':
      main.innerHTML = await renderDashboard();
      break;
    case 'data':
      main.innerHTML = renderDataPage();
      await loadTableData();
      break;
    case 'settings':
      main.innerHTML = renderSettingsPage();
      break;
  }
}

// ── 仪表盘 ────────────────────────────────────────────────

async function renderDashboard() {
  const stats = await window.api.backend.get('/api/stats');
  return `
    <div class="dashboard">
      <div class="stat-card">
        <div class="stat-value">${stats.total || 0}</div>
        <div class="stat-label">总记录数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.active || 0}</div>
        <div class="stat-label">活跃数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.pending || 0}</div>
        <div class="stat-label">待处理</div>
      </div>
    </div>`;
}

// ── 数据管理（表格 + 分页 + 搜索）─────────────────────────

function renderDataPage() {
  return `
    <div class="data-page">
      <div class="toolbar">
        <input type="text" id="search-input" placeholder="搜索..." />
        <button id="btn-refresh">刷新</button>
        <button id="btn-add">+ 新增</button>
      </div>
      <table id="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>名称</th>
            <th>状态</th>
            <th>时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colspan="5" class="loading">加载中...</td></tr>
        </tbody>
      </table>
      <div class="pagination">
        <button id="btn-prev">上一页</button>
        <span id="page-info">第 1 页</span>
        <button id="btn-next">下一页</button>
      </div>
    </div>`;
}

let currentPage = 1;

async function loadTableData(search = '') {
  const tbody = document.querySelector('#data-table tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">加载中...</td></tr>';

  try {
    const data = await window.api.backend.get(
      `/api/data?page=${currentPage}&search=${encodeURIComponent(search)}`
    );
    tbody.innerHTML = data.items.map(item => `
      <tr>
        <td>${item.id}</td>
        <td>${item.name}</td>
        <td><span class="status ${item.status}">${item.status}</span></td>
        <td>${item.time}</td>
        <td>
          <button class="btn-sm" data-action="edit" data-id="${item.id}">编辑</button>
          <button class="btn-sm btn-danger" data-action="delete" data-id="${item.id}">删除</button>
        </td>
      </tr>
    `).join('');

    document.getElementById('page-info').textContent =
      `第 ${data.page} / ${data.totalPages} 页`;

    // 绑定操作按钮
    bindTableActions();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="error">加载失败</td></tr>';
  }
}

function bindTableActions() {
  document.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.onclick = () => editItem(btn.dataset.id);
  });
  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.onclick = () => deleteItem(btn.dataset.id);
  });
}

// 刷新按钮
document.addEventListener('click', e => {
  if (e.target.id === 'btn-refresh') loadTableData();
  if (e.target.id === 'btn-prev') { currentPage--; loadTableData(); }
  if (e.target.id === 'btn-next') { currentPage++; loadTableData(); }
  if (e.target.id === 'btn-add') showAddForm();
});

// 搜索（实时）
document.addEventListener('input', e => {
  if (e.target.id === 'search-input') {
    currentPage = 1;
    loadTableData(e.target.value);
  }
});

// ── 增删改 ────────────────────────────────────────────────

async function editItem(id) {
  const item = await window.api.backend.get(`/api/data/${id}`);
  const name = prompt('修改名称:', item.name);
  if (name) {
    await window.api.backend.put(`/api/data/${id}`, { name });
    loadTableData();
  }
}

async function deleteItem(id) {
  if (confirm('确认删除？')) {
    await window.api.backend.delete(`/api/data/${id}`);
    loadTableData();
  }
}

function showAddForm() {
  const name = prompt('输入名称:');
  if (name) {
    window.api.backend.post('/api/data', { name }).then(() => loadTableData());
  }
}

// ── 设置页 ────────────────────────────────────────────────

function renderSettingsPage() {
  return `
    <div class="settings-page">
      <h2>设置</h2>
      <fieldset>
        <legend>基本设置</legend>
        <label><input type="checkbox" id="auto-refresh" checked> 自动刷新</label>
        <p class="hint">每 30 秒自动刷新数据</p>
      </fieldset>
    </div>`;
}

// ── 自动刷新 ──────────────────────────────────────────────

let refreshTimer = null;
document.addEventListener('change', e => {
  if (e.target.id === 'auto-refresh') {
    if (e.target.checked) {
      refreshTimer = setInterval(loadTableData, 30000);
    } else {
      clearInterval(refreshTimer);
    }
  }
});

// ── 初始化 ────────────────────────────────────────────────

loadPage('dashboard');
