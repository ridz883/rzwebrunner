import { WebContainer } from 'https://cdn.jsdelivr.net/npm/@webcontainer/api@1.6.4/+esm';

// Default project jika belum ada kodingan
const DEFAULT_FILES = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: "chat-ai-workspace",
        version: "1.0.0",
        type: "module",
        scripts: {
          "dev": "vercel dev"
        },
        dependencies: {}
      }, null, 2)
    }
  },
  'api/index.js': {
    file: {
      contents: `// Vercel Serverless Function Handler
export default function handler(req, res) {
  res.status(200).json({
    success: true,
    message: "Halo dari Vercel Serverless Function (/api/index)!",
    time: new Date().toLocaleTimeString()
  });
}`
    }
  },
  'public/index.html': {
    file: {
      contents: `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Vercel App Preview</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d1117;
      color: #f0f6fc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 85vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 24px;
      max-width: 320px;
      width: 100%;
      text-align: center;
    }
    h2 { font-size: 18px; color: #58a6ff; margin-bottom: 8px; }
    p { font-size: 12px; color: #8b949e; line-height: 1.5; margin-bottom: 16px; }
    button {
      background: #238636;
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }
    .res {
      margin-top: 14px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px;
      font-family: monospace;
      font-size: 11px;
      color: #7ee787;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>Vercel Project Berjalan</h2>
    <p>Frontend dari <code>public/index.html</code> siap memanggil Serverless Function.</p>
    <button id="btn-call">Panggil /api/index</button>
    <div id="output" class="res">Menunggu interaksi...</div>
  </div>

  <script>
    document.getElementById('btn-call').onclick = async () => {
      const out = document.getElementById('output');
      out.innerText = 'Mengambil respon function...';
      try {
        const res = await fetch('/api');
        const data = await res.json();
        out.innerText = JSON.stringify(data, null, 2);
      } catch (err) {
        out.innerText = 'Error: ' + err.message;
      }
    };
  <\/script>
</body>
</html>`
    }
  }
};

// State Manager
let files = JSON.parse(localStorage.getItem('my_project_files')) || DEFAULT_FILES;
let currentFolder = '';
let activeFilePath = 'package.json';
let activeTab = 'pane-files';
let webcontainerInstance = null;

// DOM
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

function logTerminal(msg) {
  terminalStream.textContent += '\n' + msg;
  terminalStream.scrollTop = terminalStream.scrollHeight;
}

function saveState() {
  localStorage.setItem('my_project_files', JSON.stringify(files));
}

function showIframeError(title, detail) {
  previewEmpty.style.display = 'none';
  previewFrame.style.display = 'block';
  previewFrame.removeAttribute('src');
  previewFrame.srcdoc = `<!DOCTYPE html>
  <html>
  <head>
    <style>
      body { background: #0d1117; color: #f85149; font-family: monospace; padding: 24px; }
      .box { border: 1px solid #da3633; background: #161b22; border-radius: 8px; padding: 18px; }
      h3 { margin-top: 0; color: #f85149; font-size: 16px; }
      pre { color: #c9d1d9; background: #010409; padding: 12px; border-radius: 6px; overflow: auto; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="box">
      <h3>⚠️ Runtime Error: ${title}</h3>
      <pre>${detail}</pre>
    </div>
  </body>
  </html>`;
}

// 1. Android Back Button Handling
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

// 2. Table Render
function renderTable() {
  tableFileRows.innerHTML = '';
  bcRootLabel.textContent = inputRepoTitle.value || 'my-project';
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

// 3. Editor Logic
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

// 4. Helper: Mount Tree
function buildTreeFS(map) {
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

// 5. VERCEL SERVERLESS SIMULATOR RUNNER (TIDAK BUTUH SCRIPT START SAMA SEKALI)
btnRunAll.onclick = async () => {
  saveActiveEditorContent();
  saveState();

  btnRunAll.disabled = true;
  btnRunAll.innerHTML = '<span>⏳</span> Running...';
  terminalBadge.textContent = 'Simulating';
  terminalBadge.style.color = '#e3b341';

  switchTab('pane-preview');
  terminalStream.textContent = `[${inputRepoTitle.value}] Memulai Vercel Runtime Simulator...`;

  try {
    if (!webcontainerInstance) {
      logTerminal('Booting WebContainer engine di browser...');
      webcontainerInstance = await WebContainer.boot();

      webcontainerInstance.on('server-ready', (port, url) => {
        logTerminal(`🚀 Vercel Serverless Simulator aktif di port ${port}!`);
        previewEmpty.style.display = 'none';
        previewFrame.style.display = 'block';
        previewFrame.removeAttribute('srcdoc');
        previewFrame.src = url;
        terminalBadge.textContent = 'Active :' + port;
        terminalBadge.style.color = '#7ee787';
      });
    }

    // Salin file project asli
    const runtimeFiles = { ...files };

    // Buat Server Gateway Internal otomatis untuk memproses /api dan /public
    // Ini menghilangkan kewajiban script "start" di package.json pengguna!
    const apiFiles = Object.keys(files).filter(k => k.startsWith('api/') && (k.endsWith('.js') || k.endsWith('.mjs')));
    
    let routeImports = '';
    let routeRegistrations = '';

    apiFiles.forEach((fileKey, index) => {
      const routeVar = `route_${index}`;
      let apiRoute = fileKey.replace(/^api\//, '').replace(/\.(js|mjs)$/, '');
      if (apiRoute === 'index') apiRoute = ''; // /api atau /api/index
      
      routeImports += `import ${routeVar} from './${fileKey}';\n`;
      routeRegistrations += `
        app.all('/api/${apiRoute}', async (req, res) => {
          try {
            const fn = ${routeVar}.default || ${routeVar};
            if (typeof fn === 'function') {
              await fn(req, res);
            } else {
              res.status(500).json({ error: "File ${fileKey} tidak mengekspor default function handler" });
            }
          } catch(err) {
            res.status(500).json({ error: err.message, stack: err.stack });
          }
        });
      `;
      if (apiRoute === '') {
        // Daftarkan juga untuk persis '/api'
        routeRegistrations += `
          app.all('/api', async (req, res) => {
            try {
              const fn = ${routeVar}.default || ${routeVar};
              await fn(req, res);
            } catch(err) {
              res.status(500).json({ error: err.message });
            }
          });
        `;
      }
    });

    // File server virtual yang bertindak seperti Vercel Dev Server
    runtimeFiles['__vercel_runtime_server.js'] = {
      file: {
        contents: `import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

${routeImports}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Daftarkan serverless functions
${routeRegistrations}

// Sajikan folder public otomatis
if (fs.existsSync('./public')) {
  app.use(express.static('./public'));
}

// Fallback jika memanggil root tapi index ada di root
if (fs.existsSync('./index.html')) {
  app.get('/', (req, res) => {
    res.sendFile(path.resolve('./index.html'));
  });
}

app.listen(PORT, () => {
  console.log('✅ Vercel Local Engine listening on port ' + PORT);
});`
      }
    };

    // Pastikan express terpasang di runtime
    let pkgObj = {};
    try {
      pkgObj = JSON.parse(files['package.json']?.file?.contents || '{}');
    } catch(e) {
      pkgObj = {};
    }
    pkgObj.type = "module";
    pkgObj.dependencies = pkgObj.dependencies || {};
    pkgObj.dependencies["express"] = "^4.18.2";
    pkgObj.dependencies["cors"] = "^2.8.5";

    runtimeFiles['package.json'] = {
      file: { contents: JSON.stringify(pkgObj, null, 2) }
    };

    logTerminal('Mounting struktur folder project...');
    const tree = buildTreeFS(runtimeFiles);
    await webcontainerInstance.mount(tree);

    logTerminal('Menginstall dependensi simulator...');
    const install = await webcontainerInstance.spawn('npm', ['install']);
    install.output.pipeTo(new WritableStream({
      write(d) { logTerminal(d); }
    }));
    await install.exit;

    logTerminal('Menjalankan engine Vercel Serverless...');
    const runProcess = await webcontainerInstance.spawn('node', ['__vercel_runtime_server.js']);
    
    let errorLog = '';
    runProcess.output.pipeTo(new WritableStream({
      write(d) {
        logTerminal(d);
        if (d.toLowerCase().includes('error')) errorLog += d;
      }
    }));

    runProcess.exit.then((code) => {
      if (code !== 0) {
        terminalBadge.textContent = 'Crashed';
        terminalBadge.style.color = '#f85149';
        showIframeError(`Process exited with code ${code}`, errorLog || 'Periksa terminal di bawah.');
      }
    });

  } catch (err) {
    logTerminal('❌ ERROR: ' + err.message);
    terminalBadge.textContent = 'Error';
    terminalBadge.style.color = '#f85149';
    showIframeError('System Error', err.message);
  } finally {
    btnRunAll.disabled = false;
    btnRunAll.innerHTML = '<span>▶</span> Run Project';
  }
};

// Initial Start
renderTable();
loadActiveFileToEditor();
