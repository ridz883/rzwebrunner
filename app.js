import { WebContainer } from 'https://cdn.jsdelivr.net/npm/@webcontainer/api@1.6.4/+esm';

// Default project files (Backend Express + HTML Frontend sederhana)
let files = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: "inbrowser-project",
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

app.get('/api/pesan', (req, res) => {
  res.json({ status: true, message: 'Halo dari Backend Express!' });
});

app.listen(PORT, () => {
  console.log('Server berjalan di port ' + PORT);
});`
    }
  },
  'public/index.html': {
    file: {
      contents: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Hasil Web</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 40px; background: #f0fdf4; color: #166534; }
    button { padding: 10px 20px; font-size: 14px; cursor: pointer; border-radius: 6px; border: 1px solid #16a34a; background: #22c55e; color: white; }
  </style>
</head>
<body>
  <h1>Frontend Berhasil Terhubung!</h1>
  <button id="btn">Ambil Data Backend</button>
  <p id="result" style="font-weight: bold; margin-top: 20px;"></p>

  <script>
    document.getElementById('btn').onclick = async () => {
      const res = await fetch('/api/pesan');
      const data = await res.json();
      document.getElementById('result').innerText = data.message;
    };
  <\/script>
</body>
</html>`
    }
  }
};

let activeFile = 'server.js';
let webcontainerInstance = null;

// DOM Elements
const fileListEl = document.getElementById('file-list');
const editorEl = document.getElementById('code-editor');
const activeFileLabel = document.getElementById('active-file-label');
const terminalEl = document.getElementById('terminal-output');
const previewFrame = document.getElementById('preview-frame');
const previewPlaceholder = document.getElementById('preview-placeholder');
const btnRun = document.getElementById('btn-run');
const btnAddFile = document.getElementById('btn-add-file');
const newFilenameInput = document.getElementById('new-filename-input');

function logTerminal(message) {
  terminalEl.textContent += '\n' + message;
  terminalEl.scrollTop = terminalEl.scrollHeight;
}

// 1. Render File Explorer
function renderFileList() {
  fileListEl.innerHTML = '';
  Object.keys(files).forEach((filename) => {
    const li = document.createElement('li');
    li.className = `flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer ${
      filename === activeFile ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    }`;
    
    li.innerHTML = `
      <span class="truncate flex-1">${filename}</span>
      <button class="btn-del text-red-400 hover:text-red-300 px-2 py-0.5" data-filename="${filename}">✕</button>
    `;

    li.onclick = (e) => {
      if (e.target.classList.contains('btn-del')) return;
      saveActiveFileContent();
      activeFile = filename;
      loadActiveFileContent();
      renderFileList();
      switchTab('tab-editor');
    };

    li.querySelector('.btn-del').onclick = (e) => {
      e.stopPropagation();
      deleteFile(filename);
    };

    fileListEl.appendChild(li);
  });
}

// 2. File State Operations (Add, Edit, Delete)
function loadActiveFileContent() {
  if (activeFile && files[activeFile]) {
    editorEl.value = files[activeFile].file.contents;
    activeFileLabel.textContent = activeFile;
    editorEl.disabled = false;
  } else {
    editorEl.value = '';
    activeFileLabel.textContent = 'None';
    editorEl.disabled = true;
  }
}

function saveActiveFileContent() {
  if (activeFile && files[activeFile]) {
    files[activeFile].file.contents = editorEl.value;
  }
}

editorEl.addEventListener('input', () => {
  if (activeFile && files[activeFile]) {
    files[activeFile].file.contents = editorEl.value;
  }
});

btnAddFile.onclick = () => {
  const name = newFilenameInput.value.trim();
  if (!name) return alert('Masukkan nama file');
  if (files[name]) return alert('File sudah ada');

  files[name] = { file: { contents: '' } };
  newFilenameInput.value = '';
  saveActiveFileContent();
  activeFile = name;
  loadActiveFileContent();
  renderFileList();
  switchTab('tab-editor');
};

function deleteFile(name) {
  if (Object.keys(files).length <= 1) {
    return alert('Minimal harus ada 1 file di project!');
  }
  if (confirm(`Yakin ingin menghapus file ${name}?`)) {
    delete files[name];
    if (activeFile === name) {
      activeFile = Object.keys(files)[0];
    }
    loadActiveFileContent();
    renderFileList();
  }
}

// 3. Tab Switching for Mobile
function switchTab(targetTabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('text-indigo-400', 'border-indigo-500');
    btn.classList.add('text-slate-400', 'border-transparent');
  });

  document.getElementById(targetTabId).classList.add('active');
  const activeBtn = document.querySelector(`[data-tab="${targetTabId}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-400', 'border-transparent');
    activeBtn.classList.add('text-indigo-400', 'border-indigo-500');
  }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    saveActiveFileContent();
    switchTab(btn.getAttribute('data-tab'));
  };
});

// Helper: Convert flat paths (e.g. 'public/index.html') into nested WebContainer tree
function buildFileSystemTree(fileMap) {
  const tree = {};
  for (const [path, data] of Object.entries(fileMap)) {
    const parts = path.split('/');
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = { file: { contents: data.file.contents } };
      } else {
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }
    }
  }
  return tree;
}

// 4. Run / Execution Logic
btnRun.onclick = async () => {
  saveActiveFileContent();
  btnRun.disabled = true;
  btnRun.innerText = 'Running...';
  switchTab('tab-preview');
  terminalEl.textContent = 'Memulai container...';

  try {
    // Inisialisasi WebContainer (jika belum)
    if (!webcontainerInstance) {
      logTerminal('Memuat WebContainer Node.js engine...');
      webcontainerInstance = await WebContainer.boot();
      
      // Listener event ketika server Express siap listen ke port
      webcontainerInstance.on('server-ready', (port, url) => {
        logTerminal(`🚀 Server running di port ${port}`);
        previewPlaceholder.classList.add('hidden');
        previewFrame.classList.remove('hidden');
        previewFrame.src = url;
      });
    }

    logTerminal('Mounting struktur file...');
    const tree = buildFileSystemTree(files);
    await webcontainerInstance.mount(tree);

    logTerminal('Menginstall dependensi (npm install)...');
    const installProcess = await webcontainerInstance.spawn('npm', ['install']);
    installProcess.output.pipeTo(new WritableStream({
      write(data) { logTerminal(data); }
    }));
    
    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      logTerminal('Instalasi npm gagal.');
      btnRun.disabled = false;
      btnRun.innerText = '▶ Run Project';
      return;
    }

    logTerminal('Menjalankan server (npm start)...');
    const startProcess = await webcontainerInstance.spawn('npm', ['start']);
    startProcess.output.pipeTo(new WritableStream({
      write(data) { logTerminal(data); }
    }));

  } catch (err) {
    logTerminal(`Error: ${err.message}`);
  } finally {
    btnRun.disabled = false;
    btnRun.innerText = '▶ Restart Project';
  }
};

// Initial Setup
renderFileList();
loadActiveFileContent();
