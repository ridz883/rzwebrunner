// URL SERVER PANEL PERMANEN (User tidak perlu tahu / isi manual)
const DEFAULT_PANEL_BACKEND = "https://rz-server-node.loca.lt";

// State
let files = JSON.parse(localStorage.getItem('my_project_files')) || {};
let currentFolder = '';
let activeFilePath = Object.keys(files)[0] || '';
let activeTab = 'pane-files';

// DOM Elements
const tableFileRows = document.getElementById('table-file-rows');
const bcRootLabel = document.getElementById('bc-root-label');
const bcDynamicPath = document.getElementById('bc-dynamic-path');
const itemCountBadge = document.getElementById('item-count-badge');
const boxAddItem = document.getElementById('box-add-item');
const btnToggleAdd = document.getElementById('btn-toggle-add');
const inputNewItem = document.getElementById('input-new-item');
const btnConfirmAdd = document.getElementById('btn-confirm-add');
const inputRepoTitle = document.getElementById('input-repo-title');
const codeEditor = document.getElementById('code-editor');
const editorGutter = document.getElementById('editor-gutter');
const editorActiveFilename = document.getElementById('editor-active-filename');
const btnRunAll = document.getElementById('btn-run-all');
const previewFrame = document.getElementById('preview-frame');
const previewEmpty = document.getElementById('preview-empty');
const terminalStream = document.getElementById('terminal-stream');
const terminalBadge = document.getElementById('terminal-badge');
const previewUrlLabel = document.getElementById('preview-url-label');
const btnOpenExternal = document.getElementById('btn-open-external');

function logTerminal(msg) {
  terminalStream.textContent += '\n' + msg;
  terminalStream.scrollTop = terminalStream.scrollHeight;
}

function saveState() {
  localStorage.setItem('my_project_files', JSON.stringify(files));
}

// Android Back
history.replaceState({ tab: 'pane-files' }, '');
window.addEventListener('popstate', () => {
  if (activeTab !== 'pane-files') {
    switchTab('pane-files', false);
  } else if (currentFolder !== '') {
    const parts = currentFolder.split('/').filter(Boolean);
    parts.pop();
    currentFolder = parts.join('/');
    renderTable();
    history.pushState({ tab: 'pane-files' }, '');
  } else {
    if (confirm('Keluar dari Project Runner?')) {
      history.back();
    } else {
      history.pushState({ tab: 'pane-files' }, '');
    }
  }
});

function switchTab(targetId, push = true) {
  if (activeTab === targetId) return;
  saveActiveEditorContent();

  activeTab = targetId;
  document.querySelectorAll('.view-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.dock-tab').forEach(btn => btn.classList.remove('active'));

  document.getElementById(targetId).classList.add('active');
  const nav = document.querySelector(`[data-target="${targetId}"]`);
  if (nav) nav.classList.add('active');

  if (push) history.pushState({ tab: targetId }, '');
}

document.querySelectorAll('.dock-tab').forEach(b => {
  b.onclick = () => switchTab(b.getAttribute('data-target'));
});

// Render Table
function renderTable() {
  tableFileRows.innerHTML = '';
  bcRootLabel.textContent = inputRepoTitle.value || 'workspace';
  bcDynamicPath.innerHTML = currentFolder 
    ? ' / ' + currentFolder.split('/').map(p => `<span>${p}</span>`).join(' / ')
    : '';

  const prefix = currentFolder ? currentFolder + '/' : '';
  const map = new Map();

  if (currentFolder !== '') {
    const backRow = document.createElement('div');
    backRow.className = 'gh-item-row';
    backRow.innerHTML = `
      <div class="gh-item-left">
        <div class="gh-item-icon icon-folder">
          <svg viewBox="0 0 16 16"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/></svg>
        </div>
        <span class="gh-item-name is-dir">..</span>
      </div>
    `;
    backRow.onclick = () => {
      const parts = currentFolder.split('/').filter(Boolean);
      parts.pop();
      currentFolder = parts.join('/');
      renderTable();
    };
    tableFileRows.appendChild(backRow);
  }

  Object.keys(files).forEach(path => {
    if (path.startsWith(prefix)) {
      const rest = path.slice(prefix.length);
      const parts = rest.split('/');
      if (parts.length > 1) {
        const dir = parts[0];
        if (!map.has(dir)) {
          map.set(dir, { type: 'dir', name: dir, fullPath: prefix + dir });
        }
      } else {
        map.set(parts[0], { type: 'file', name: parts[0], fullPath: path });
      }
    }
  });

  const sorted = Array.from(map.values()).sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  itemCountBadge.textContent = `${sorted.length} item`;

  sorted.forEach(item => {
    const row = document.createElement('div');
    row.className = 'gh-item-row';

    const isDir = item.type === 'dir';
    const iconSvg = isDir
      ? `<div class="gh-item-icon icon-folder"><svg viewBox="0 0 16 16"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/></svg></div>`
      : `<div class="gh-item-icon icon-file"><svg viewBox="0 0 16 16"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z"/></svg></div>`;

    row.innerHTML = `
      <div class="gh-item-left">
        ${iconSvg}
        <span class="gh-item-name ${isDir ? 'is-dir' : ''}">${item.name}</span>
      </div>
      <button class="gh-item-del" title="Hapus">✕</button>
    `;

    row.onclick = (e) => {
      if (e.target.classList.contains('gh-item-del')) return;
      if (isDir) {
        currentFolder = item.fullPath;
        renderTable();
      } else {
        saveActiveEditorContent();
        activeFilePath = item.fullPath;
        loadActiveFileToEditor();
        switchTab('pane-editor');
      }
    };

    row.querySelector('.gh-item-del').onclick = (e) => {
      e.stopPropagation();
      deleteFileOrDir(item);
    };

    tableFileRows.appendChild(row);
  });
}

bcRootLabel.onclick = () => {
  currentFolder = '';
  renderTable();
};

btnToggleAdd.onclick = () => {
  boxAddItem.style.display = boxAddItem.style.display === 'none' ? 'flex' : 'none';
  if (boxAddItem.style.display === 'flex') inputNewItem.focus();
};

btnConfirmAdd.onclick = () => {
  let path = inputNewItem.value.trim().replace(/^\/+|\/+$/g, '');
  if (!path) return alert('Silakan masukkan nama file!');

  if (currentFolder && !path.includes('/')) {
    path = currentFolder + '/' + path;
  }

  if (files[path]) return alert('File atau path ini sudah ada!');

  files[path] = { file: { contents: '' } };
  inputNewItem.value = '';
  boxAddItem.style.display = 'none';
  
  saveActiveEditorContent();
  activeFilePath = path;
  saveState();
  loadActiveFileToEditor();
  renderTable();
  switchTab('pane-editor');
};

function deleteFileOrDir(item) {
  if (confirm(`Yakin ingin menghapus ${item.name}?`)) {
    if (item.type === 'dir') {
      const prefix = item.fullPath + '/';
      Object.keys(files).forEach(k => {
        if (k.startsWith(prefix)) delete files[k];
      });
    } else {
      delete files[item.fullPath];
    }

    if (!files[activeFilePath]) {
      activeFilePath = Object.keys(files)[0] || '';
    }
    saveState();
    loadActiveFileToEditor();
    renderTable();
  }
}

// Editor
function updateGutter() {
  const lines = codeEditor.value.split('\n').length;
  editorGutter.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
}

codeEditor.addEventListener('input', () => {
  saveActiveEditorContent();
  updateGutter();
  saveState();
});

codeEditor.addEventListener('scroll', () => {
  editorGutter.scrollTop = codeEditor.scrollTop;
});

function loadActiveFileToEditor() {
  if (activeFilePath && files[activeFilePath]) {
    codeEditor.value = files[activeFilePath].file.contents;
    editorActiveFilename.textContent = activeFilePath;
    codeEditor.disabled = false;
  } else {
    codeEditor.value = '';
    editorActiveFilename.textContent = 'None';
    codeEditor.disabled = true;
  }
  updateGutter();
}

function saveActiveEditorContent() {
  if (activeFilePath && files[activeFilePath]) {
    files[activeFilePath].file.contents = codeEditor.value;
  }
}

// RUN PROJECT KE SERVER PANEL SECARA OTOMATIS
btnRunAll.onclick = async () => {
  saveActiveEditorContent();
  saveState();

  const panelUrl = DEFAULT_PANEL_BACKEND;

  btnRunAll.disabled = true;
  btnRunAll.innerHTML = '<span>⏳</span> Deploying...';
  terminalBadge.textContent = 'Executing';
  terminalBadge.style.color = '#e3b341';

  switchTab('pane-preview');
  terminalStream.textContent = `[${inputRepoTitle.value}] Menghubungkan ke runner cloud server...`;

  try {
    // 1. Cek kesehatan
    const health = await fetch(`${panelUrl}/runner-health`, {
      method: 'GET',
      headers: { 'Bypass-Tunnel-Reminder': 'true' }
    });

    if (!health.ok) throw new Error('Server sedang offline atau restart.');

    logTerminal('✅ Server Cloud Terhubung!');
    logTerminal('Menyinkronkan file dan dependencies project...');

    // 2. Kirim kodingan
    const deploy = await fetch(`${panelUrl}/api/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true'
      },
      body: JSON.stringify({
        projectName: inputRepoTitle.value,
        files: files
      })
    });

    const resData = await deploy.json();
    if (!deploy.ok) throw new Error(resData.error || 'Gagal deploy');

    logTerminal('🚀 Sukses: ' + resData.message);
    logTerminal('Hasil web berhasil dirender secara live!');

    // 3. Muat di iframe
    previewUrlLabel.textContent = panelUrl;
    btnOpenExternal.href = panelUrl;
    btnOpenExternal.style.display = 'block';

    previewEmpty.style.display = 'none';
    previewFrame.style.display = 'block';
    previewFrame.src = `${panelUrl}?t=${Date.now()}`;

    terminalBadge.textContent = 'Online';
    terminalBadge.style.color = '#7ee787';

  } catch (err) {
    logTerminal('❌ ERROR: ' + err.message);
    terminalBadge.textContent = 'Failed';
    terminalBadge.style.color = '#f85149';
  } finally {
    btnRunAll.disabled = false;
    btnRunAll.innerHTML = '<span>▶</span> Run Project';
  }
};

// Initial Setup
renderTable();
loadActiveFileToEditor();
