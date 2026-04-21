const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// 默认笔记目录
const NOTEBOOK_DIR = path.join(__dirname, 'notes');

// 确保笔记目录存在
if (!fs.existsSync(NOTEBOOK_DIR)) {
  fs.mkdirSync(NOTEBOOK_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Express 5: {*path} returns an array, normalize to string
const getPath = (req) => {
  const p = req.params.path;
  return Array.isArray(p) ? p.join('/') : (p || '');
};

const resolveNotebookPath = (targetPath = '') => {
  const resolvedPath = path.resolve(NOTEBOOK_DIR, targetPath);
  const relativePath = path.relative(NOTEBOOK_DIR, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    const error = new Error('Invalid path');
    error.statusCode = 400;
    throw error;
  }

  return resolvedPath;
};

const getErrorStatus = (error) => error.statusCode || 500;
const getErrorMessage = (error) => error.message || 'Internal server error';
const getMtimeMs = (filePath) => Math.trunc(fs.statSync(filePath).mtimeMs);

// 读取目录结构
app.get('/api/files', (req, res) => {
  let dirPath;
  try {
    dirPath = resolveNotebookPath(typeof req.query.path === 'string' ? req.query.path : '');
  } catch (error) {
    return res.status(getErrorStatus(error)).json({ error: getErrorMessage(error) });
  }

  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = entries.map((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    const stats = fs.statSync(fullPath);
    return {
      name: entry.name,
      path: req.query.path
        ? `${req.query.path}/${entry.name}`
        : entry.name,
      isDirectory: entry.isDirectory(),
      mtime: stats.mtime,
      size: stats.size,
    };
  });

  // 排序：文件夹在前，然后按名称
  files.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  res.json(files);
});

// 搜索笔记内容
app.get('/api/search', (req, res) => {
  const q = req.query.q || '';
  if (!q || typeof q !== 'string') return res.json([]);

  const results = [];
  const MAX_RESULTS = 50;

  const searchInDir = (dir) => {
    if (results.length >= MAX_RESULTS) return;
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= MAX_RESULTS) break;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        searchInDir(fullPath);
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown') || entry.name.endsWith('.txt')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= MAX_RESULTS) break;
            const idx = lines[i].toLowerCase().indexOf(q.toLowerCase());
            if (idx !== -1) {
              const relPath = path.relative(NOTEBOOK_DIR, fullPath);
              const start = Math.max(0, idx - 20);
              const end = Math.min(lines[i].length, idx + q.length + 40);
              const matchLine = (start > 0 ? '…' : '') + lines[i].slice(start, end) + (end < lines[i].length ? '…' : '');
              results.push({
                path: relPath,
                name: entry.name,
                matchLine,
              });
              break; // one match per file
            }
          }
        } catch {}
      }
    }
  };

  searchInDir(NOTEBOOK_DIR);
  res.json(results);
});

// 递归读取目录树
app.get('/api/tree', (req, res) => {
  let dirPath;
  try {
    dirPath = resolveNotebookPath(typeof req.query.path === 'string' ? req.query.path : '');
  } catch (error) {
    return res.status(getErrorStatus(error)).json({ error: getErrorMessage(error) });
  }

  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  const buildTree = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries
      .map((entry) => {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(NOTEBOOK_DIR, fullPath);
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: relPath,
            isDirectory: true,
            children: buildTree(fullPath),
          };
        }
        return {
          name: entry.name,
          path: relPath,
          isDirectory: false,
        };
      })
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  };

  res.json(buildTree(dirPath));
});

// 读取文件内容
app.get('/api/files/{*path}', (req, res) => {
  let filePath;
  try {
    filePath = resolveNotebookPath(getPath(req));
  } catch (error) {
    return res.status(getErrorStatus(error)).json({ error: getErrorMessage(error) });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (fs.statSync(filePath).isDirectory()) {
    return res.status(400).json({ error: 'Path is a directory' });
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  res.json({
    name: path.basename(filePath),
    path: getPath(req),
    content,
    mtimeMs: getMtimeMs(filePath),
  });
});

// 保存文件
app.put('/api/files/{*path}', (req, res) => {
  let filePath;
  try {
    filePath = resolveNotebookPath(getPath(req));
  } catch (error) {
    return res.status(getErrorStatus(error)).json({ error: getErrorMessage(error) });
  }

  const { baseMtimeMs } = req.body;
  const fileExists = fs.existsSync(filePath);

  if (!fileExists && typeof baseMtimeMs === 'number') {
    return res.status(409).json({
      error: 'File was removed on disk',
      exists: false,
    });
  }

  if (fileExists && typeof baseMtimeMs === 'number') {
    const currentMtimeMs = getMtimeMs(filePath);
    if (currentMtimeMs !== baseMtimeMs) {
      return res.status(409).json({
        error: 'File changed on disk',
        exists: true,
        content: fs.readFileSync(filePath, 'utf-8'),
        mtimeMs: currentMtimeMs,
      });
    }
  }

  // 确保父目录存在
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFileSync(filePath, req.body.content || '', 'utf-8');
  res.json({
    success: true,
    path: getPath(req),
    mtimeMs: getMtimeMs(filePath),
  });
});

// 新建文件或文件夹
app.post('/api/files/{*path}', (req, res) => {
  let filePath;
  try {
    filePath = resolveNotebookPath(getPath(req));
  } catch (error) {
    return res.status(getErrorStatus(error)).json({ error: getErrorMessage(error) });
  }
  const { isDirectory } = req.body;

  if (fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'Already exists' });
  }

  if (isDirectory) {
    fs.mkdirSync(filePath, { recursive: true });
  } else {
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(filePath, '', 'utf-8');
  }

  res.json({ success: true, path: getPath(req) });
});

// 删除文件或文件夹
app.delete('/api/files/{*path}', (req, res) => {
  let filePath;
  try {
    filePath = resolveNotebookPath(getPath(req));
  } catch (error) {
    return res.status(getErrorStatus(error)).json({ error: getErrorMessage(error) });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (fs.statSync(filePath).isDirectory()) {
    fs.rmSync(filePath, { recursive: true });
  } else {
    fs.unlinkSync(filePath);
  }

  res.json({ success: true });
});

// 重命名文件或文件夹
app.patch('/api/files/{*path}', (req, res) => {
  let filePath;
  try {
    filePath = resolveNotebookPath(getPath(req));
  } catch (error) {
    return res.status(getErrorStatus(error)).json({ error: getErrorMessage(error) });
  }
  const { newName } = req.body;

  if (typeof newName !== 'string' || !newName.trim() || newName.includes('/') || newName.includes('\\')) {
    return res.status(400).json({ error: 'Invalid target name' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const currentRelativePath = getPath(req);
  const newRelativePath = path.join(path.dirname(currentRelativePath), newName);
  const newPath = resolveNotebookPath(newRelativePath);
  if (fs.existsSync(newPath)) {
    return res.status(400).json({ error: 'Target already exists' });
  }

  fs.renameSync(filePath, newPath);
  res.json({ success: true, newPath: path.relative(NOTEBOOK_DIR, newPath) });
});

// 生产模式：serve 前端构建产物
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*any}', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`Notebook server running on http://localhost:${PORT}`);
  console.log(`Notes directory: ${NOTEBOOK_DIR}`);
});
