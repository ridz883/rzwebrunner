import { WebContainer } from 'https://cdn.jsdelivr.net/npm/@webcontainer/api@1.6.4/+esm';

// Struktur bebas dan dinamis (Persis seperti repo rzwa di screenshot)
const INITIAL_REPO_FILES = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: "rzwa",
        version: "1.0.0",
        type: "module",
        scripts: {
          "start": "node api/index.js"
        },
        dependencies: {
          "express": "^4.18.2",
          "cors": "^2.8.5"
        }
      }, null, 2)
    }
  },
  'api/index.js': {
    file: {
      contents: `import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/info', (req, res) => {
  res.json({
    status: true,
    message: 'Backend API aktif dari folder api/index.js!',
    timestamp: new Date().toLocaleTimeString()
  });
});

app.listen(PORT, () => {
  console.log('✅ Server berjalan di port ' + PORT);
});`
    }
  },
  'public/index.html': {
    file: {
      contents: `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Frontend App</title>
  <style>
    body {
      font-family: -apple-system, sans-serif;
      background: #0d1117;
      color: #f0f6fc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      margin: 0;
      padding: 20px;
    }
    .box {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 24px;
      max-width: 320px;
      text-align: center;
    }
    button {
      background: #238636;
      color: white;
      border: none;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 14px;
    }
    #res {
      margin-top: 14px;
      font-family: monospace;
      font-size: 12px;
      color: #58a6ff;
    }
  </style>
</head>
<body>
  <div class="box">
    <h3>Frontend Berhasil Dimuat</h3>
    <p style="font-size: 12px; color: #8b949e;">File dari folder public/index.html</p>
    <button id="btn">Tes Backend API</button>
    <div id="res"></div>
  </div>

  <script>
    document.getElementById('btn').onclick = async () => {
      const el = document.getElementById('res');
      el.innerText = 'Mengambil data...';
      try {
        const r = await fetch('/api/info');
        const data = await r.json();
        el.innerText = data.message;
      } catch (e) {
        el.innerText = 'Error: ' + e.message;
      }
    };
  <\/script>
</body>
</html>`
    }
  }
};

// State
let files = JSON.parse(localStorage.getItem('rz_github_files')) || INITIAL_REPO_FILES;
let currentPath = ''; // Root directory saat navigasi folder
let activeFile = 'api/index.js';
let currentTab = 'pane-files';
let webcontainerInstance = null;

// DOM Elements
const fileRowsEl = document.getElementById('file-rows');
const breadcrumbSubpath = document.getElementById('bc-subpath');
const bcRoot = document.getElementById('bc-root');
const totalFilesBadge = document.getElementById('total-files-badge');
const addFileBox = document.getElementById('add-file-box');
const btnToggleInput = document.getElementById('btn-toggle-input');
const inputItemPath = document.getElementById('input-item-path');
const btnSaveItem = document.getElementById('btn-save-item');
const codeEditor = document.getElementById('code-editor');
const editorLines = document.getElementById('editor-lines');
const activeFileTitle = document.getElementById('active-file-title');
const btnRun = document.getElementById('btn-run');
const previewFrame = document.getElementById('preview-frame');
const previewEmpty = document.getElementById('preview-empty');
const terminalStream = document.getElementById('terminal-stream');
const termStatus = document.getElementById('term-status');
const repoTitle = document.getElementById('repo-title');

function logTerminal(text) {
  terminalStream.textContent += '\n' + text;
  terminalStream.scrollTop = terminalStream.scrollHeight;
}

function saveToLocalStorage() {
  localStorage.setItem('rz_github_files', JSON.stringify(files));
}

// 1. Android Back Handling
history.replaceState({ tab: 'pane-files' }, '');
window.addEventListener('popstate', () => {
  if (currentTab !== 'pane-files') {
    switchTab('pane-files', false);
  } else if (currentPath !== '') {
    // Jika sedang di dalam subfolder, back akan kembali ke folder induk
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    currentPath = parts.join('/');
    renderGitHubTable();
    history.pushState({ tab: 'pane-files' }, '');
  } else {
    if (confirm('Keluar dari GitHub Runner?')) {
      history.back();
    } else {
      history.pushState({ tab: 'pane-files' }, '');
    }
  }
});

function switchTab(targetId, push = true) {
  if (currentTab === targetId) return;
  saveActiveFile();

  currentTab = targetId;
  document.querySelectorAll('.view-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.dock-tab').forEach(b => b.classList.remove('active'));

  document.getElementById(targetId).classList.add('active');
  const nav = document.querySelector(`[data-target="${targetId}"]`);
  if (nav) nav.classList.add('active');

  if (push) history.pushState({ tab: targetId }, '');
}

document.querySelectorAll('.dock-tab').forEach(b => {
  b.onclick = () => switchTab(b.getAttribute('data-target'));
});

// 2. Navigasi & Render Tabel Persis Seperti GitHub
function renderGitHubTable() {
  fileRowsEl.innerHTML = '';

  // Update breadcrumb
  bcRoot.textContent = repoTitle.value || 'rzwa';
  breadcrumbSubpath.innerHTML = currentPath 
    ? ' / ' + currentPath.split('/').map(p => `<span>${p}</span>`).join(' / ')
    : '';

  // Kumpulkan item di direktori aktif
  const currentPrefix = currentPath ? currentPath + '/' : '';
  const entries = new Map(); // name -> { type: 'dir'|'file', fullPath }

  // Baris ".." untuk kembali ke folder sebelumnya jika di dalam subfolder
  if (currentPath !== '') {
    const parentRow = document.createElement('div');
    parentRow.className = 'gh-row';
    parentRow.innerHTML = `
      <div class="gh-row-left">
        <div class="gh-row-icon icon-folder">
          <svg viewBox="0 0 16 16"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/></svg>
        </div>
        <span class="gh-row-name folder">..</span>
      </div>
    `;
    parentRow.onclick = () => {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      currentPath = parts.join('/');
      renderGitHubTable();
    };
    fileRowsEl.appendChild(parentRow);
  }

  // Parse path
  Object.keys(files).forEach(path => {
    if (path.startsWith(currentPrefix)) {
      const rest = path.slice(currentPrefix.length);
      const parts = rest.split('/');
      if (parts.length > 1) {
        // Direktori
        const dirName = parts[0];
        if (!entries.has(dirName)) {
          entries.set(dirName, { type: 'dir', name: dirName, fullPath: currentPrefix + dirName });
        }
      } else {
        // File
        entries.set(parts[0], { type: 'file', name: parts[0], fullPath: path });
      }
    }
  });

  // Urutkan: folder duluan, baru file
  const sorted = Array.from(entries.values()).sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  totalFilesBadge.textContent = `${sorted.length} item`;

  sorted.forEach(item => {
    const row = document.createElement('div');
    row.className = 'gh-row';

    const isDir = item.type === 'dir';
    const iconSvg = isDir
      ? `<div class="gh-row-icon icon-folder"><svg viewBox="0 0 16 16"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/></svg></div>`
      : `<div class="gh-row-icon icon-file"><svg viewBox="0 0 16 16"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z"/></svg></div>`;

    row.innerHTML = `
      <div class="gh-row-left">
        ${iconSvg}
        <span class="gh-row-name ${isDir ? 'folder' : ''}">${item.name}</span>
      </div>
      <button class="gh-row-del" title="Hapus">✕</button>
    `;

    row.onclick = (e) => {
      if (e.target.classList.contains('gh-row-del')) return;
      if (isDir) {
        currentPath = item.fullPath;
        renderGitHubTable();
      } else {
        saveActiveFile();
        activeFile = item.fullPath;
        loadActiveFile();
        switchTab('pane-editor');
      }
    };

    row.querySelector('.gh-row-del').onclick = (e) => {
      e.stopPropagation();
      deleteEntry(item);
    };

    fileRowsEl.appendChild(row);
  });
}

bcRoot.onclick = () => {
  currentPath = '';
  renderGitHubTable();
};

btnToggleInput.onclick = () => {
  addFileBox.style.display = addFileBox.style.display === 'none' ? 'flex' : 'none';
  if (addFileBox.style.display === 'flex') inputItemPath.focus();
};

btnSaveItem.onclick = () => {
  let p = inputItemPath.value.trim().replace(/^\/+|\/+$/g, '');
  if (!p) return alert('Ketik nama file!');

  // Jika sedang di dalam subfolder dan user tidak mengetik folder di depan, tambahkan otomatis
  if (currentPath && !p.includes('/')) {
    p = currentPath + '/' + p;
  }

  if (files[p]) return alert('File ini sudah ada!');

  files[p] = { file: { contents: '' } };
  inputItemPath.value = '';
  addFileBox.style.display = 'none';
  saveActiveFile();
  activeFile = p;
  saveToLocalStorage();
  loadActiveFile();
  renderGitHubTable();
  switchTab('pane-editor');
};

function deleteEntry(item) {
  if (confirm(`Hapus ${item.name}?`)) {
    if (item.type === 'dir') {
      const prefix = item.fullPath + '/';
      Object.keys(files).forEach(k => {
        if (k.startsWith(prefix)) delete files[k];
      });
    } else {
      delete files[item.fullPath];
    }

    if (!files[activeFile]) {
      activeFile = Object.keys(files)[0] || '';
    }
    saveToLocalStorage();
    loadActiveFile();
    renderGitHubTable();
  }
}

// 3. Editor Logic
function updateGutter() {
  const count = codeEditor.value.split('\n').length;
  editorLines.innerHTML = Array.from({ length: count }, (_, i) => i + 1).join('<br>');
}

codeEditor.addEventListener('input', () => {
  saveActiveFile();
  updateGutter();
  saveToLocalStorage();
});

codeEditor.addEventListener('scroll', () => {
  editorLines.scrollTop = codeEditor.scrollTop;
});

function loadActiveFile() {
  if (activeFile && files[activeFile]) {
    codeEditor.value = files[activeFile].file.contents;
    activeFileTitle.textContent = activeFile;
    codeEditor.disabled = false;
  } else {
    codeEditor.value = '';
    activeFileTitle.textContent = 'None';
    codeEditor.disabled = true;
  }
  updateGutter();
}

function saveActiveFile() {
  if (activeFile && files[activeFile]) {
    files[activeFile].file.contents = codeEditor.value;
  }
}

// 4. Transform Map to WebContainer Tree
function buildTree(map) {
  const tree = {};
  for (const [p, d] of Object.entries(map)) {
    const parts = p.split('/');
    let cur = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        cur[part] = { file: { contents: d.file.contents } };
      } else {
        if (!cur[part]) cur[part] = { directory: {} };
        cur = cur[part].directory;
      }
    }
  }
  return tree;
}

// 5. Eksekusi WebContainer (Native In-Browser Node.js)
btnRun.onclick = async () => {
  saveActiveFile();
  saveToLocalStorage();
  btnRun.disabled = true;
  btnRun.innerHTML = '<span>⏳</span> Running...';
  termStatus.textContent = 'Running';
  termStatus.style.color = '#e3b341';
  switchTab('pane-preview');
  terminalStream.textContent = `[${repoTitle.value}] Memulai instance container...`;

  try {
    if (!webcontainerInstance) {
      logTerminal('Booting WebContainer engine...');
      webcontainerInstance = await WebContainer.boot();

      webcontainerInstance.on('server-ready', (port, url) => {
        logTerminal(`🚀 Server backend Express aktif di port ${port}!`);
        previewEmpty.style.display = 'none';
        previewFrame.style.display = 'block';
        previewFrame.src = url;
        termStatus.textContent = 'Active :' + port;
        termStatus.style.color = '#7ee787';
      });
    }

    logTerminal('Mounting struktur folder & file...');
    const fsTree = buildTree(files);
    await webcontainerInstance.mount(fsTree);

    // Cek package.json untuk install otomatis
    if (files['package.json']) {
      logTerminal('Menjalankan npm install...');
      const install = await webcontainerInstance.spawn('npm', ['install']);
      install.output.pipeTo(new WritableStream({
        write(d) { logTerminal(d); }
      }));
      await install.exit;
    }

    // Deteksi entry point server backend secara cerdas
    let startCmd = ['npm', ['start']];
    if (!files['package.json']) {
      if (files['api/index.js']) startCmd = ['node', ['api/index.js']];
      else if (files['server.js']) startCmd = ['node', ['server.js']];
      else if (files['index.js']) startCmd = ['node', ['index.js']];
    }

    logTerminal(`Menjalankan backend (${startCmd[0]} ${startCmd[1].join(' ')})...`);
    const runProc = await webcontainerInstance.spawn(startCmd[0], startCmd[1]);
    runProc.output.pipeTo(new WritableStream({
      write(d) { logTerminal(d); }
    }));

  } catch (err) {
    logTerminal('Gagal mengeksekusi: ' + err.message);
    termStatus.textContent = 'Error';
    termStatus.style.color = '#f85149';
  } finally {
    btnRun.disabled = false;
    btnRun.innerHTML = '<span>🔄</span> Restart';
  }
};

// Initial Setup
renderGitHubTable();
loadActiveFile();
