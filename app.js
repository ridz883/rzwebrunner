import { WebContainer } from 'https://cdn.jsdelivr.net/npm/@webcontainer/api@1.6.4/+esm';

// Konfigurasi URL Panel Pterodactyl kamu
const PANEL_RUNNER_URL = "http://erine.jkt48node.id:3668";

// 1. STRUKTUR DEFAULT LENGKAP MIRIP GITHUB REPO
const DEFAULT_PROJECT_FILES = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: "my-fullstack-app",
        version: "1.0.0",
        type: "module",
        scripts: {
          "start": "node backend/server.js"
        },
        dependencies: {
          "express": "^4.18.2",
          "cors": "^2.8.5"
        }
      }, null, 2)
    }
  },
  'backend/server.js': {
    file: {
      contents: `import express from 'express';
import cors from 'cors';
import { apiRouter } from './api.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Hubungkan sub-routes backend
app.use('/api', apiRouter);

app.listen(PORT, () => {
  console.log('✅ Server Backend berjalan di port ' + PORT);
});`
    }
  },
  'backend/api.js': {
    file: {
      contents: `import { Router } from 'express';

export const apiRouter = Router();

apiRouter.get('/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Backend API terhubung realtime!',
    timestamp: new Date().toISOString()
  });
});

apiRouter.post('/echo', (req, res) => {
  res.json({
    received: req.body,
    serverNote: 'Data berhasil diproses oleh backend'
  });
});`
    }
  },
  'public/index.html': {
    file: {
      contents: `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Frontend App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <div class="badge">Live Fullstack Preview</div>
    <h1>RunnerBox Studio</h1>
    <p>Frontend terhubung dengan subfolder backend secara utuh.</p>
    
    <button id="btn-fetch">Panggil Backend API</button>
    <div id="output-box" class="output">Menunggu klik...</div>
  </div>

  <script src="script.js"></script>
</body>
</html>`
    }
  },
  'public/style.css': {
    file: {
      contents: `body {
  margin: 0;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0f172a;
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
}
.card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 24px;
  max-width: 340px;
  width: 100%;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0,0,0,0.3);
}
.badge {
  display: inline-block;
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
  margin-bottom: 12px;
}
h1 { font-size: 20px; margin-bottom: 8px; }
p { font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 16px; }
button {
  background: #8b5cf6;
  color: white;
  border: none;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  width: 100%;
}
.output {
  margin-top: 14px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px;
  font-family: monospace;
  font-size: 11px;
  color: #38bdf8;
  word-break: break-all;
}`
    }
  },
  'public/script.js': {
    file: {
      contents: `document.getElementById('btn-fetch').onclick = async () => {
  const out = document.getElementById('output-box');
  out.innerText = 'Mengambil data backend...';
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    out.innerText = JSON.stringify(data, null, 2);
  } catch (err) {
    out.innerText = 'Gagal request: ' + err.message;
  }
};`
    }
  }
};

// 2. STATE PERSISTENCE DENGAN LOCALSTORAGE
let files = JSON.parse(localStorage.getItem('runner_project_files')) || DEFAULT_PROJECT_FILES;
let activeFile = 'public/index.html';
let currentTab = 'pane-files';
let webcontainerInstance = null;

// DOM Elements
const treeList = document.getElementById('tree-list');
const codeEditor = document.getElementById('code-editor');
const lineGutter = document.getElementById('line-gutter');
const currentFileLabel = document.getElementById('current-file-label');
const inputNewPath = document.getElementById('input-new-path');
const btnAddFile = document.getElementById('btn-add-file');
const btnRun = document.getElementById('btn-run');
const btnReset = document.getElementById('btn-reset');
const btnExport = document.getElementById('btn-export');
const btnClearTerm = document.getElementById('btn-clear-term');
const previewFrame = document.getElementById('preview-frame');
const previewEmpty = document.getElementById('preview-empty');
const terminalStream = document.getElementById('terminal-stream');
const fileCounter = document.getElementById('file-counter');
const repoName = document.getElementById('repo-name');

function logTerminal(text) {
  terminalStream.textContent += '\n' + text;
  terminalStream.scrollTop = terminalStream.scrollHeight;
}

btnClearTerm.onclick = () => {
  terminalStream.textContent = 'Terminal cleared.';
};

function saveToLocalStorage() {
  localStorage.setItem('runner_project_files', JSON.stringify(files));
}

// 3. ANDROID BACK BUTTON HANDLING
history.replaceState({ tab: 'pane-files' }, '');
window.addEventListener('popstate', () => {
  if (currentTab !== 'pane-files') {
    switchTab('pane-files', false);
  } else {
    if (confirm('Keluar dari Runner Studio?')) {
      history.back();
    } else {
      history.pushState({ tab: 'pane-files' }, '');
    }
  }
});

function switchTab(targetPaneId, push = true) {
  if (currentTab === targetPaneId) return;
  saveActiveFile();

  currentTab = targetPaneId;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.dock-btn').forEach(btn => btn.classList.remove('active'));

  document.getElementById(targetPaneId).classList.add('active');
  const targetNav = document.querySelector(`[data-target="${targetPaneId}"]`);
  if (targetNav) targetNav.classList.add('active');

  if (push) history.pushState({ tab: targetPaneId }, '');
}

document.querySelectorAll('.dock-btn').forEach(btn => {
  btn.onclick = () => switchTab(btn.getAttribute('data-target'));
});

// 4. EDITOR LINE NUMBERS & AUTOSAVE
function updateGutter() {
  const lines = codeEditor.value.split('\n').length;
  lineGutter.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
}

codeEditor.addEventListener('input', () => {
  saveActiveFile();
  updateGutter();
  saveToLocalStorage();
});

codeEditor.addEventListener('scroll', () => {
  lineGutter.scrollTop = codeEditor.scrollTop;
});

function loadActiveFile() {
  if (activeFile && files[activeFile]) {
    codeEditor.value = files[activeFile].file.contents;
    currentFileLabel.textContent = activeFile;
    codeEditor.disabled = false;
  } else {
    codeEditor.value = '';
    currentFileLabel.textContent = 'None';
    codeEditor.disabled = true;
  }
  updateGutter();
}

function saveActiveFile() {
  if (activeFile && files[activeFile]) {
    files[activeFile].file.contents = codeEditor.value;
  }
}

// 5. TREE EXPLORER (BISA SUBFOLDER APAPUN)
function renderTree() {
  treeList.innerHTML = '';
  const fileKeys = Object.keys(files);
  fileCounter.textContent = `${fileKeys.length} File`;

  fileKeys.forEach(path => {
    const parts = path.split('/');
    const fileName = parts.pop();
    const folderPath = parts.length ? parts.join('/') + '/' : '';
    const ext = fileName.split('.').pop() || 'txt';

    const li = document.createElement('li');
    li.className = `tree-item ${path === activeFile ? 'active' : ''}`;
    
    li.innerHTML = `
      <div class="tree-left">
        <div class="tree-icon">${ext.slice(0, 3).toUpperCase()}</div>
        <div class="tree-path">
          <span class="tree-folder">${folderPath}</span><span class="tree-file">${fileName}</span>
        </div>
      </div>
      <button class="tree-del" data-path="${path}">✕</button>
    `;

    li.onclick = (e) => {
      if (e.target.classList.contains('tree-del')) return;
      saveActiveFile();
      activeFile = path;
      loadActiveFile();
      renderTree();
      switchTab('pane-editor');
    };

    li.querySelector('.tree-del').onclick = (e) => {
      e.stopPropagation();
      deleteFilePath(path);
    };

    treeList.appendChild(li);
  });
}

btnAddFile.onclick = () => {
  let p = inputNewPath.value.trim().replace(/^\/+|\/+$/g, '');
  if (!p) return alert('Ketik nama file atau struktur folder!');
  if (files[p]) return alert('File ini sudah ada!');

  files[p] = { file: { contents: '' } };
  inputNewPath.value = '';
  saveActiveFile();
  activeFile = p;
  saveToLocalStorage();
  loadActiveFile();
  renderTree();
  switchTab('pane-editor');
};

function deleteFilePath(path) {
  if (Object.keys(files).length <= 1) return alert('Project minimal punya 1 file!');
  if (confirm(`Hapus file "${path}"?`)) {
    delete files[path];
    if (activeFile === path) {
      activeFile = Object.keys(files)[0];
    }
    saveToLocalStorage();
    loadActiveFile();
    renderTree();
  }
}

// 6. FITUR EKSTRA: RESET & DOWNLOAD BACKUP
btnReset.onclick = () => {
  if (confirm('Kembalikan ke struktur default awal? Kodingan saat ini akan di-reset.')) {
    files = JSON.parse(JSON.stringify(DEFAULT_PROJECT_FILES));
    activeFile = 'public/index.html';
    saveToLocalStorage();
    renderTree();
    loadActiveFile();
    alert('Project berhasil di-reset!');
  }
};

btnExport.onclick = () => {
  const blob = new Blob([JSON.stringify(files, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${repoName.value || 'project'}-structure.json`;
  a.click();
};

// 7. PREVIEW INSTAN JIKA HANYA STATIC HTML
function renderStaticInstantPreview() {
  const htmlFile = files['public/index.html'] || files['index.html'];
  if (!htmlFile) return false;

  let htmlContent = htmlFile.file.contents;
  
  // Inject CSS jika ada
  const cssFile = files['public/style.css'] || files['style.css'];
  if (cssFile) {
    htmlContent = htmlContent.replace('</head>', `<style>${cssFile.file.contents}</style></head>`);
  }

  // Inject JS jika ada
  const jsFile = files['public/script.js'] || files['script.js'];
  if (jsFile) {
    htmlContent = htmlContent.replace('</body>', `<script>${jsFile.file.contents}<\/script></body>`);
  }

  previewEmpty.style.display = 'none';
  previewFrame.style.display = 'block';
  previewFrame.srcdoc = htmlContent;
  return true;
}

// 8. RUNNER ENGINE REALTIME (PANEL + WEBCONTAINER DUAL MODE)
function buildNestedFS(map) {
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

btnRun.onclick = async () => {
  saveActiveFile();
  saveToLocalStorage();
  btnRun.disabled = true;
  btnRun.innerHTML = '<span>⏳</span> Running...';
  switchTab('pane-preview');
  logTerminal(`\n[${new Date().toLocaleTimeString()}] Memulai eksekusi project...`);

  // Langkah 1: Render preview statis terlebih dahulu agar tidak ada layar putih kosong
  renderStaticInstantPreview();

  // Langkah 2: Coba kirim ke server Panel jika aktif
  let panelSuccess = false;
  try {
    logTerminal(`Mencoba menghubungkan ke Panel Runner (${PANEL_RUNNER_URL})...`);
    const panelRes = await fetch(`${PANEL_RUNNER_URL}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: repoName.value,
        files: files
      })
    });

    if (panelRes.ok) {
      const pData = await panelRes.json();
      logTerminal(`🚀 Sukses di Panel: ${pData.message}`);
      panelSuccess = true;
    }
  } catch (err) {
    logTerminal(`Panel offline / unreachable (${err.message}). Beralih ke WebContainer browser...`);
  }

  // Langkah 3: Jika panel gagal atau sedang offline, jalankan via WebContainer Node.js
  if (!panelSuccess) {
    try {
      if (!webcontainerInstance) {
        logTerminal('Memulai WebContainer engine di browser...');
        webcontainerInstance = await WebContainer.boot();
        
        webcontainerInstance.on('server-ready', (port, url) => {
          logTerminal(`🚀 Backend siap mendengarkan port ${port}!`);
          previewEmpty.style.display = 'none';
          previewFrame.style.display = 'block';
          previewFrame.removeAttribute('srcdoc');
          previewFrame.src = url;
        });
      }

      logTerminal('Mounting seluruh pohon folder...');
      const fsTree = buildNestedFS(files);
      await webcontainerInstance.mount(fsTree);

      logTerminal('Menjalankan npm install...');
      const procInstall = await webcontainerInstance.spawn('npm', ['install']);
      procInstall.output.pipeTo(new WritableStream({
        write(d) { logTerminal(d); }
      }));
      await procInstall.exit;

      logTerminal('Menjalankan backend server (npm start)...');
      const procStart = await webcontainerInstance.spawn('npm', ['start']);
      procStart.output.pipeTo(new WritableStream({
        write(d) { logTerminal(d); }
      }));

    } catch (error) {
      logTerminal(`Container Notice: ${error.message}`);
    }
  }

  btnRun.disabled = false;
  btnRun.innerHTML = '<span>🔄</span> Restart';
};

// Initial Start
renderTree();
loadActiveFile();
