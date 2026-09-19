import { WebContainer } from 'https://cdn.jsdelivr.net/npm/@webcontainer/api@1.6.4/+esm';

// Konfigurasi URL Panel kamu jika sudah siap (bisa diganti URL domain panelmu)
const PANEL_RUNNER_URL = "http://erine.jkt48node.id:3668"; 

// Struktur file awal project
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

app.get('/api/data', (req, res) => {
  res.json({ success: true, message: 'Halo dari Node.js Backend!' });
});

app.listen(PORT, () => {
  console.log(\`Server berjalan di port \${PORT}\`);
});`
    }
  },
  'api/routes.js': {
    file: {
      contents: `// File contoh dalam subfolder
export const helloRoute = (req, res) => {
  res.send('API Route Aktif');
};`
    }
  },
  'public/index.html': {
    file: {
      contents: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Preview</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 40px; }
    button { background: #7c5cfc; color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <h2>Web App Berjalan</h2>
  <button id="btn">Fetch API</button>
  <p id="out"></p>
  <script>
    document.getElementById('btn').onclick = async () => {
      const res = await fetch('/api/data');
      const data = await res.json();
      document.getElementById('out').innerText = data.message;
    };
  <\/script>
</body>
</html>`
    }
  }
};

let currentTab = 'pane-files';
let activeFile = 'server.js';
let webcontainerInstance = null;

// Elements
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
const repoNameInput = document.getElementById('repo-name-input');

function logTerminal(text) {
  terminalEl.textContent += '\n' + text;
  terminalEl.scrollTop = terminalEl.scrollHeight;
}

// 1. Tombol Back HP Handling (Supaya tidak langsung keluar web)
history.replaceState({ tab: 'pane-files' }, '');

window.addEventListener('popstate', (e) => {
  if (currentTab !== 'pane-files') {
    // Jika sedang di editor atau preview, kembalikan ke tab Files
    switchTab('pane-files', false);
  } else {
    // Jika sudah di Files dan user pencet back lagi, beri konfirmasi keluar
    if (confirm('Yakin ingin menutup web RunnerBox?')) {
      history.back();
    } else {
      history.pushState({ tab: 'pane-files' }, '');
    }
  }
});

function switchTab(targetPaneId, push = true) {
  if (currentTab === targetPaneId) return;
  saveActiveContent();

  currentTab = targetPaneId;
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

  document.getElementById(targetPaneId).classList.add('active');
  const activeNav = document.querySelector(`[data-target="${targetPaneId}"]`);
  if (activeNav) activeNav.classList.add('active');

  if (push) {
    history.pushState({ tab: targetPaneId }, '');
  }
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.onclick = () => switchTab(btn.getAttribute('data-target'));
});

// 2. File Explorer & Path Struktur
function updateLineNumbers() {
  const lineCount = editorEl.value.split('\n').length;
  lineNumbersEl.innerHTML = Array.from({ length: lineCount }, (_, i) => i + 1).join('<br>');
}

function renderFiles() {
  fileListEl.innerHTML = '';
  Object.keys(files).forEach((filePath) => {
    const parts = filePath.split('/');
    const fileName = parts.pop();
    const folderPath = parts.length ? parts.join('/') + '/' : '';
    const ext = fileName.split('.').pop() || 'file';

    const li = document.createElement('li');
    li.className = `file-item ${filePath === activeFile ? 'active' : ''}`;
    
    li.innerHTML = `
      <div class="file-info">
        <div class="file-badge">${ext.substring(0, 4)}</div>
        <span class="file-path">
          <span class="file-folder-prefix">${folderPath}</span>${fileName}
        </span>
      </div>
      <button class="file-del" data-path="${filePath}">✕</button>
    `;

    li.onclick = (e) => {
      if (e.target.classList.contains('file-del')) return;
      saveActiveContent();
      activeFile = filePath;
      loadActiveContent();
      renderFiles();
      switchTab('pane-editor');
    };

    li.querySelector('.file-del').onclick = (e) => {
      e.stopPropagation();
      deleteFile(filePath);
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

// Buat File & Struktur Folder Baru (contoh: routes/auth/login.js)
btnCreateFile.onclick = () => {
  let path = inputFilename.value.trim();
  if (!path) return alert('Ketik nama file atau path folder!');
  
  // Normalisasi path
  path = path.replace(/^\/+|\/+$/g, '');
  if (files[path]) return alert('File atau path ini sudah ada!');

  files[path] = { file: { contents: '' } };
  inputFilename.value = '';
  saveActiveContent();
  activeFile = path;
  loadActiveContent();
  renderFiles();
  switchTab('pane-editor');
};

function deleteFile(path) {
  if (Object.keys(files).length <= 1) {
    return alert('Minimal harus ada 1 file di project!');
  }
  if (confirm(`Hapus "${path}"?`)) {
    delete files[path];
    if (activeFile === path) {
      activeFile = Object.keys(files)[0];
    }
    loadActiveContent();
    renderFiles();
  }
}

// 3. Execution (WebContainer / Fallback Panel)
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

btnRun.onclick = async () => {
  saveActiveContent();
  btnRun.disabled = true;
  btnRun.innerHTML = '<span>⏳</span> Running...';
  switchTab('pane-preview');
  terminalEl.textContent = `[${repoNameInput.value}] Memulai proses...`;

  try {
    if (!webcontainerInstance) {
      logTerminal('Menyiapkan engine container...');
      webcontainerInstance = await WebContainer.boot();

      webcontainerInstance.on('server-ready', (port, url) => {
        logTerminal(`🚀 Server aktif di port ${port}`);
        previewIdle.style.display = 'none';
        previewFrame.style.display = 'block';
        previewFrame.src = url;
      });
    }

    logTerminal('Mounting struktur folder dan file...');
    const tree = buildFSTree(files);
    await webcontainerInstance.mount(tree);

    logTerminal('Menjalankan npm install...');
    const install = await webcontainerInstance.spawn('npm', ['install']);
    install.output.pipeTo(new WritableStream({
      write(chunk) { logTerminal(chunk); }
    }));

    const code = await install.exit;
    if (code !== 0) {
      logTerminal('npm install selesai dengan error.');
      btnRun.disabled = false;
      btnRun.innerHTML = '<span>▶</span> Run';
      return;
    }

    logTerminal('Menjalankan npm start...');
    const start = await webcontainerInstance.spawn('npm', ['start']);
    start.output.pipeTo(new WritableStream({
      write(chunk) { logTerminal(chunk); }
    }));

  } catch (err) {
    logTerminal('Container Error: ' + err.message);
  } finally {
    btnRun.disabled = false;
    btnRun.innerHTML = '<span>🔄</span> Restart';
  }
};

// Initial Setup
renderFiles();
loadActiveContent();
