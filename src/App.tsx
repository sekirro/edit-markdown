import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Preview from './components/Preview';
import Search from './components/Search';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface FilePayload {
  name: string;
  path: string;
  content: string;
  mtimeMs: number;
}

interface SaveSuccess {
  success: boolean;
  path: string;
  mtimeMs: number;
}

type SyncNotice = {
  level: 'info' | 'warning';
  message: string;
} | null;

type ViewMode = 'edit' | 'preview' | 'split';

const AUTO_SAVE_DELAY = 3000; // 3s idle before auto-save
const FILE_SYNC_INTERVAL = 2000;

function App() {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true); // is content synced with disk?
  const [searchOpen, setSearchOpen] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [baseMtimeMs, setBaseMtimeMs] = useState<number | null>(null);
  const [externalConflict, setExternalConflict] = useState(false);
  const [syncNotice, setSyncNotice] = useState<SyncNotice>(null);
  const contentRef = useRef(content);
  const fileRef = useRef(currentFile);
  const savedRef = useRef(saved);
  const baseMtimeRef = useRef(baseMtimeMs);
  const externalConflictRef = useRef(externalConflict);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingExternalVersionRef = useRef<string | null>(null);

  // keep refs in sync
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { fileRef.current = currentFile; }, [currentFile]);
  useEffect(() => { savedRef.current = saved; }, [saved]);
  useEffect(() => { baseMtimeRef.current = baseMtimeMs; }, [baseMtimeMs]);
  useEffect(() => { externalConflictRef.current = externalConflict; }, [externalConflict]);

  // load file tree
  const loadTree = useCallback(async () => {
    try {
      const res = await fetch('/api/tree');
      const data = await res.json();
      setFileTree(data);
    } catch (e) {
      console.error('Failed to load file tree:', e);
    }
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  const clearCurrentFileState = useCallback(() => {
    setCurrentFile(null);
    setContent('');
    setSaved(true);
    setBaseMtimeMs(null);
    setExternalConflict(false);
    setSyncNotice(null);
    pendingExternalVersionRef.current = null;
  }, []);

  const applyFileData = useCallback((data: FilePayload) => {
    setCurrentFile(data.path);
    setContent(data.content);
    setSaved(true);
    setBaseMtimeMs(data.mtimeMs);
    setExternalConflict(false);
    setSyncNotice(null);
    pendingExternalVersionRef.current = null;
  }, []);

  const fetchFile = useCallback(async (filePath: string) => {
    const res = await fetch(`/api/files/${filePath}`);
    if (!res.ok) return null;
    return res.json() as Promise<FilePayload>;
  }, []);

  // load file content
  const loadFile = useCallback(async (filePath: string) => {
    try {
      const data = await fetchFile(filePath);
      if (data) applyFileData(data);
    } catch (e) {
      console.error('Failed to load file:', e);
    }
  }, [applyFileData, fetchFile]);

  // save file
  const saveFile = useCallback(async () => {
    const f = fileRef.current;
    const c = contentRef.current;
    if (!f) return false;
    if (externalConflictRef.current) {
      setSyncNotice({
        level: 'warning',
        message: '磁盘文件已被外部修改，已暂停保存。请先重新载入磁盘内容。',
      });
      return false;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/files/${f}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: c, baseMtimeMs: baseMtimeRef.current }),
      });
      if (res.status === 409) {
        const data = await res.json();
        setExternalConflict(true);
        if (typeof data.mtimeMs === 'number') {
          pendingExternalVersionRef.current = String(data.mtimeMs);
        }
        setSyncNotice({
          level: 'warning',
          message: data.exists === false
            ? '当前文件已在磁盘中删除，网页中的未保存内容无法直接保存。'
            : '磁盘文件已被外部修改，已阻止覆盖保存。请先重新载入磁盘内容。',
        });
        return false;
      }
      if (res.ok) {
        const data = await res.json() as SaveSuccess;
        setSaved(true);
        setBaseMtimeMs(data.mtimeMs);
        setExternalConflict(false);
        setSyncNotice(null);
        pendingExternalVersionRef.current = null;
        await loadTree();
        return true;
      }
    } catch (e) {
      console.error('Failed to save file:', e);
      return false;
    } finally {
      setSaving(false);
    }
    return false;
  }, [loadTree]);

  const reloadCurrentFile = useCallback(async () => {
    const f = fileRef.current;
    if (!f) return;

    if (!savedRef.current && !window.confirm('重新载入将丢弃网页中的未保存修改，是否继续？')) {
      return;
    }

    try {
      const res = await fetch(`/api/files/${f}`);
      if (res.status === 404) {
        clearCurrentFileState();
        await loadTree();
        setSyncNotice({
          level: 'warning',
          message: '当前文件已在磁盘中删除。',
        });
        return;
      }

      if (res.ok) {
        const data = await res.json() as FilePayload;
        applyFileData(data);
        setSyncNotice({
          level: 'info',
          message: '已重新载入磁盘内容。',
        });
        await loadTree();
      }
    } catch (e) {
      console.error('Failed to reload file:', e);
    }
  }, [applyFileData, clearCurrentFileState, loadTree]);

  const ensureCanLeaveCurrentFile = useCallback(async (nextFilePath: string) => {
    if (!currentFile || saved || nextFilePath === currentFile) {
      return true;
    }

    if (externalConflict) {
      return window.confirm('当前文件在磁盘上已被外部修改，网页中的未保存内容无法直接保存。是否放弃网页中的未保存修改并切换文件？');
    }

    if (autoSave) {
      return saveFile();
    }

    return window.confirm('当前文件有未保存的修改，继续切换将丢失这些修改。是否继续？');
  }, [autoSave, currentFile, externalConflict, saveFile, saved]);

  const openFile = useCallback(async (filePath: string) => {
    const canContinue = await ensureCanLeaveCurrentFile(filePath);
    if (!canContinue) return;
    await loadFile(filePath);
  }, [ensureCanLeaveCurrentFile, loadFile]);

  // detect external file changes for the current open file
  useEffect(() => {
    if (!currentFile) return;

    let cancelled = false;

    const checkForDiskChanges = async () => {
      try {
        const res = await fetch(`/api/files/${currentFile}`);

        if (cancelled) return;

        if (res.status === 404) {
          if (savedRef.current) {
            clearCurrentFileState();
            setSyncNotice({
              level: 'warning',
              message: '当前文件已在磁盘中删除。',
            });
            await loadTree();
          } else if (pendingExternalVersionRef.current !== 'deleted') {
            pendingExternalVersionRef.current = 'deleted';
            setExternalConflict(true);
            setSyncNotice({
              level: 'warning',
              message: '当前文件已在磁盘中删除，网页中的未保存内容无法直接保存。',
            });
            await loadTree();
          }
          return;
        }

        if (!res.ok) return;

        const data = await res.json() as FilePayload;
        const knownMtimeMs = baseMtimeRef.current;

        if (cancelled || knownMtimeMs === null || data.path !== fileRef.current) return;
        if (data.mtimeMs === knownMtimeMs) return;

        if (savedRef.current) {
          applyFileData(data);
          setSyncNotice({
            level: 'info',
            message: '检测到外部修改，已自动刷新当前文件。',
          });
          await loadTree();
          return;
        }

        const versionKey = String(data.mtimeMs);
        if (pendingExternalVersionRef.current === versionKey) return;

        pendingExternalVersionRef.current = versionKey;
        setExternalConflict(true);
        setSyncNotice({
          level: 'warning',
          message: '检测到磁盘文件已被外部修改，已暂停保存。请先处理网页中的改动，再重新载入磁盘内容。',
        });
        await loadTree();
      } catch (e) {
        console.error('Failed to sync file from disk:', e);
      }
    };

    const timer = setInterval(checkForDiskChanges, FILE_SYNC_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applyFileData, clearCurrentFileState, currentFile, loadTree]);

  // auto-save timer
  useEffect(() => {
    if (!autoSave || !currentFile || saved || externalConflict) {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveFile();
    }, AUTO_SAVE_DELAY);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [content, autoSave, currentFile, saved, externalConflict, saveFile]);

  // keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFile, searchOpen]);

  // warn on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!saved && currentFile) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saved, currentFile]);

  // new file
  const handleNewFile = useCallback(async (name: string, parentPath: string = '') => {
    const filePath = parentPath ? `${parentPath}/${name}` : name;
    const canContinue = await ensureCanLeaveCurrentFile(filePath);
    if (!canContinue) return;

    try {
      const res = await fetch(`/api/files/${filePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDirectory: false }),
      });
      if (res.ok) {
        await loadTree();
        await loadFile(filePath);
      }
    } catch (e) {
      console.error('Failed to create file:', e);
    }
  }, [ensureCanLeaveCurrentFile, loadTree, loadFile]);

  // new folder
  const handleNewFolder = useCallback(async (name: string, parentPath: string = '') => {
    const folderPath = parentPath ? `${parentPath}/${name}` : name;
    try {
      const res = await fetch(`/api/files/${folderPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDirectory: true }),
      });
      if (res.ok) await loadTree();
    } catch (e) {
      console.error('Failed to create folder:', e);
    }
  }, [loadTree]);

  // delete
  const handleDelete = useCallback(async (filePath: string) => {
    try {
      const res = await fetch(`/api/files/${filePath}`, { method: 'DELETE' });
      if (res.ok) {
        if (currentFile === filePath || currentFile?.startsWith(filePath + '/')) {
          clearCurrentFileState();
        }
        await loadTree();
      }
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  }, [clearCurrentFileState, currentFile, loadTree]);

  // rename
  const handleRename = useCallback(async (oldPath: string, newName: string) => {
    try {
      const res = await fetch(`/api/files/${oldPath}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (currentFile === oldPath) setCurrentFile(data.newPath);
        await loadTree();
      }
    } catch (e) {
      console.error('Failed to rename:', e);
    }
  }, [currentFile, loadTree]);

  // word & char count
  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content ? content.split('\n').length : 0;

  return (
    <div className="app">
      <Sidebar
        fileTree={fileTree}
        onFileSelect={openFile}
        currentFile={currentFile}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onDelete={handleDelete}
        onRename={handleRename}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="main-content">
        <div className="toolbar">
          <div className="toolbar-left">
            {!sidebarCollapsed && (
              <button className="collapse-btn" onClick={() => setSidebarCollapsed(true)} title="收起侧栏">☰</button>
            )}
            {sidebarCollapsed && (
              <button className="collapse-btn" onClick={() => setSidebarCollapsed(false)} title="展开侧栏">☰</button>
            )}
            {currentFile && (
              <span className="current-file-name">📄 {currentFile}</span>
            )}
          </div>
          <div className="toolbar-right">
            {(wordCount > 0 || charCount > 0) && (
              <span className="status-counts">
                {wordCount} 词 · {charCount} 字符 · {lineCount} 行
              </span>
            )}
            <button
              className={`autosave-btn ${autoSave ? 'on' : 'off'}`}
              onClick={() => setAutoSave(!autoSave)}
              title={autoSave ? '自动保存已开启 (Ctrl+S 手动保存)' : '自动保存已关闭'}
            >
              {autoSave ? '⏱ 自动' : '⏱ 手动'}
            </button>
            <div className="view-toggle">
              <button className={viewMode === 'edit' ? 'active' : ''} onClick={() => setViewMode('edit')} title="编辑模式">
                ✏️ 编辑
              </button>
              <button className={viewMode === 'split' ? 'active' : ''} onClick={() => setViewMode('split')} title="分屏模式">
                📐 分屏
              </button>
              <button className={viewMode === 'preview' ? 'active' : ''} onClick={() => setViewMode('preview')} title="预览模式">
                👁️ 预览
              </button>
            </div>
            <button className="save-btn" onClick={saveFile} disabled={!currentFile || saving || externalConflict}>
              {saving ? '保存中...' : saved ? '✓ 已保存' : '💾 保存'}
            </button>
          </div>
        </div>

        <Search
          visible={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={openFile}
        />

        {syncNotice && (
          <div className={`sync-banner ${syncNotice.level}`}>
            <span>{syncNotice.message}</span>
            {currentFile && externalConflict && (
              <button className="sync-banner-btn" onClick={reloadCurrentFile}>
                重新载入磁盘内容
              </button>
            )}
          </div>
        )}

        {currentFile ? (
          <div className={`editor-area view-${viewMode}`}>
            {(viewMode === 'edit' || viewMode === 'split') && (
              <Editor
                content={content}
                onChange={(c) => {
                  setContent(c);
                  setSaved(false);
                  setSyncNotice((prev) => prev?.level === 'info' ? null : prev);
                }}
              />
            )}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <Preview content={content} />
            )}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📓</div>
            <h2>Markdown Notebook</h2>
            <p>选择左侧文件树中的笔记，或新建一个笔记开始写作</p>
            <div className="shortcuts-hint">
              <span>Ctrl+S 保存</span> · <span>Ctrl+F 搜索</span> · <span>Tab 缩进</span>
            </div>
            <button onClick={() => handleNewFile('untitled.md')}>
              ✨ 新建笔记
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
