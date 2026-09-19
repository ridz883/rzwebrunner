import { WebContainer } from 'https://cdn.jsdelivr.net/npm/@webcontainer/api@1.6.4/+esm';

// Default project setup: Express Backend + Frontend Static
let files = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: "my-app",
        type: "module",
        dependencies: {
          "express": "^4.18.2"
        },
        scripts: {
          "start": "node server.js"
        }
      }, null, 2)
    }
  },
  'server.js': {
    file: {
      contents: `import express from 'express';
const app = express();
const PORT = 3000;

app.use(express.static('public'));

app.get('/api/info', (req, res) => {
  res.json({
    status: 'success',
    message: 'Backend Express berhasil merespon di browser HP!'
  });
});

app.listen(PORT, () => {
  console.log(\`Server berjalan di port \${PORT}\`);
});`
    }
  },
  'public/index.html': {
    file: {
      contents: `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Preview App</title>
  <style>
    body {
      font-family: -apple-system, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    .card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      max-width: 320px;
      width: 100%;
    }
    button {
      background: #7c5cfc;
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 12px;
    }
    #res {
      margin-top: 16px;
      font-size: 13px;
      color: #10b981;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <h3>Frontend Berjalan!</h3>
    <p style="font-size: 13px; color: #64748b;">Tekan tombol di bawah untuk memanggil API backend.</p>
    <button id="btn">Request ke Backend</button>
    <div id="res"></div>
  </div>

  <script>
    document.getElementById('btn').onclick = async () => {
      const res = await fetch('/api/info');
      const data = await res.json();
      document.getElementById('res').innerText = data.message;
    };
  <\/script>
</body>
</html>`
    }
  }
};

let activeFile = 'server.js';
let webcontainerInstance = null;

// UI References
const fileListEl = document.getElementById('file-list');
const editorEl = document.getElementById('code-editor');
const lineNumbersEl = document.getElementById('line-numbers');
const labelActiveFile = document.getElementById('label-active-file');
const inputFilename = document.getElementById('input-filename');
const btnCreateFile = document.getElementById('btn-create-file');
const btnRun = document.getElementById('btn-run');
const previewFrame = document.getElementById('preview-frame');
const previewIdle = document.getElementById('preview-idle');
const terminalEl = document.getElementById('terminal-output');

function logTerminal(text) {
  terminalEl.textContent += '\n' + text;
  terminalEl.scrollTop = terminalEl.scrollHeight;
}

// Update Line Numbers
function updateLineNumbers() {
  const lineCount = editorEl.value.split('\n').length;
  lineNumbersEl.innerHTML = Array.from({ length: lineCount }, (_, i) => i + 1).join('<br>');
}

// Render File Explorer
function renderFiles() {
  fileListEl.innerHTML = '';
  Object.keys(files).forEach((filename) => {
    const ext = filename.split('.').pop();
    const li = document.createElement('li');
    li.className = `file-item ${filename === activeFile ? 'active' : ''}`;
    
    li.innerHTML = `
      <div class="file-info">
        <div class="file-badge">${ext}</div>
        <span class="file-name">${filename}</span>
      </div>
      <button class="file-del" data-file="${filename}">✕</button>
    `;

    li.onclick = (e) => {
      if (e.target.classList.contains('file-del')) return;
      saveActiveContent();
      activeFile = filename;
      loadActiveContent();
      renderFiles();
      switchTab('pane-editor');
    };

    li.querySelector('.file-del').onclick = (e) => {
      e.stopPropagation();
      deleteFile(filename);
    };

    fileListEl.appendChild(li);
  });
}

function loadActiveContent() {
  if (activeFile && files[activeFile]) {
    editorEl.value = files[activeFile].file.contents;
    labelActiveFile.textContent = activeFile;
    editorEl.disabled = false;
  } else {
    editorEl.value = '';
    labelActiveFile.textContent = 'None';
    editorEl.disabled = true;
  }
  updateLineNumbers();
}

function saveActiveContent() {
  if (activeFile && files[activeFile]) {
    files[activeFile].file.contents = editorEl.value;
  }
}

editorEl.addEventListener('input', () => {
  saveActiveContent();
  updateLineNumbers();
});

editorEl.addEventListener('scroll', () => {
  lineNumbersEl.scrollTop = editorEl.scrollTop;
});

// File Management
btnCreateFile.onclick = () => {
  const name = inputFilename.value.trim();
  if (!name) return alert('Silakan masukkan nama file!');
  if (files[name]) return alert('File sudah ada!');

  files[name] = { file: { contents: '' } };
  inputFilename.value = '';
  saveActiveContent();
  activeFile = name;
  loadActiveContent();
  renderFiles();
  switchTab('pane-editor');
};

function deleteFile(name) {
  if (Object.keys(files).length <= 1) {
    return alert('Project harus memiliki minimal 1 file!');
  }
  if (confirm(`Hapus file "${name}"?`)) {
    delete files[name];
    if (activeFile === name) {
      activeFile = Object.keys(files)[0];
    }
    loadActiveContent();
    renderFiles();
  }
}

// Tab Switching
function switchTab(targetPaneId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

  document.getElementById(targetPaneId).classList.add('active');
  const activeNav = document.querySelector(`[data-target="${targetPaneId}"]`);
  if (activeNav) activeNav.classList.add('active');
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.onclick = () => {
    saveActiveContent();
    switchTab(btn.getAttribute('data-target'));
  };
});

// Transform paths to nested tree for WebContainer
function buildFSTree(fileMap) {
  const tree = {};
  for (const [path, data] of Object.entries(fileMap)) {
    const parts = path.split('/');
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = { file: { contents: data.file.contents } };
      } else {
        if (!current[part]) current[part] = { directory: {} };
        current = current[part].directory;
      }
    }
  }
  return tree;
}

// Runner Engine
btnRun.onclick = async () => {
  saveActiveContent();
  btnRun.disabled = true;
  btnRun.innerHTML = '<span>⏳</span> Running...';
  switchTab('pane-preview');
  terminalEl.textContent = 'Menyiapkan environment...';

  try {
    if (!webcontainerInstance) {
      logTerminal('Memulai WebContainer engine...');
      webcontainerInstance = await WebContainer.boot();

      webcontainerInstance.on('server-ready', (port, url) => {
        logTerminal(`🚀 Server siap di port ${port}!`);
        previewIdle.style.display = 'none';
        previewFrame.style.display = 'block';
        previewFrame.src = url;
      });
    }

    logTerminal('Sinkronisasi file project...');
    const tree = buildFSTree(files);
    await webcontainerInstance.mount(tree);

    logTerminal('Menjalankan npm install...');
    const install = await webcontainerInstance.spawn('npm', ['install']);
    install.output.pipeTo(new WritableStream({
      write(chunk) { logTerminal(chunk); }
    }));

    const exitCode = await install.exit;
    if (exitCode !== 0) {
      logTerminal('Gagal melakukan npm install.');
      btnRun.disabled = false;
      btnRun.innerHTML = '<span>▶</span> Run Project';
      return;
    }

    logTerminal('Menjalankan server (npm start)...');
    const start = await webcontainerInstance.spawn('npm', ['start']);
    start.output.pipeTo(new WritableStream({
      write(chunk) { logTerminal(chunk); }
    }));

  } catch (err) {
    logTerminal(`Error: ${err.message}`);
  } finally {
    btnRun.disabled = false;
    btnRun.innerHTML = '<span>🔄</span> Restart Project';
  }
};

// Initial Load
renderFiles();
loadActiveContent();
