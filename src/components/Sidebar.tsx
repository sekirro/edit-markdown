import { useState } from 'react';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface SidebarProps {
  fileTree: FileNode[];
  onFileSelect: (path: string) => void;
  currentFile: string | null;
  onNewFile: (name: string, parentPath: string) => void;
  onNewFolder: (name: string, parentPath: string) => void;
  onDelete: (path: string) => void;
  onRename: (oldPath: string, newName: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function TreeNode({
  node,
  depth,
  onFileSelect,
  currentFile,
  onNewFile,
  onNewFolder,
  onDelete,
  onRename,
}: {
  node: FileNode;
  depth: number;
} & Omit<SidebarProps, 'collapsed' | 'onToggleCollapse' | 'fileTree'>) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [showChildNew, setShowChildNew] = useState<'file' | 'folder' | null>(null);
  const [childName, setChildName] = useState('');

  const isMd = node.name.endsWith('.md') || node.name.endsWith('.markdown');
  const isActive = currentFile === node.path;

  const handleClick = () => {
    if (node.isDirectory) {
      setExpanded(!expanded);
    } else if (isMd || node.name.endsWith('.txt')) {
      onFileSelect(node.path);
    }
  };

  const handleRename = () => {
    if (renameValue && renameValue !== node.name) {
      onRename(node.path, renameValue);
    }
    setRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
      setRenaming(false);
      setRenameValue(node.name);
    }
  };

  const handleChildCreate = () => {
    if (!childName) return;
    if (showChildNew === 'folder') {
      onNewFolder(childName, node.path);
    } else {
      const finalName = childName.endsWith('.md') || childName.endsWith('.txt') ? childName : `${childName}.md`;
      onNewFile(finalName, node.path);
    }
    setChildName('');
    setShowChildNew(null);
    setExpanded(true);
  };

  const handleChildKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleChildCreate();
    if (e.key === 'Escape') {
      setShowChildNew(null);
      setChildName('');
    }
  };

  return (
    <div>
      <div
        className={`tree-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={handleClick}
      >
        {node.isDirectory && (
          <span className={`arrow ${expanded ? 'expanded' : ''}`}>▶</span>
        )}
        {!node.isDirectory && <span className="icon">📝</span>}
        {node.isDirectory && !renaming && <span className="icon">📁</span>}

        {renaming ? (
          <input
            className="rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="name" title={node.name}>
            {node.name}
          </span>
        )}

        {!renaming && (
          <span className="actions" onClick={(e) => e.stopPropagation()}>
            {node.isDirectory && (
              <>
                <button
                  title="在此文件夹中新建笔记"
                  onClick={() => { setShowChildNew('file'); setChildName(''); setExpanded(true); }}
                >
                  ➕
                </button>
                <button
                  title="在此文件夹中新建子文件夹"
                  onClick={() => { setShowChildNew('folder'); setChildName(''); setExpanded(true); }}
                >
                  📁
                </button>
              </>
            )}
            <button
              title="重命名"
              onClick={() => { setRenaming(true); setRenameValue(node.name); }}
            >
              ✏️
            </button>
            <button title="删除" onClick={() => onDelete(node.path)}>
              🗑️
            </button>
          </span>
        )}
      </div>

      {/* Child creation input inside folder */}
      {node.isDirectory && showChildNew && (
        <div className="tree-item child-new" style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }}>
          <span className="icon">{showChildNew === 'folder' ? '📁' : '📝'}</span>
          <input
            className="rename-input"
            placeholder={showChildNew === 'folder' ? '文件夹名称（回车创建）' : '笔记名称（回车创建）'}
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={handleChildKeyDown}
            onBlur={() => { if (!childName) setShowChildNew(null); }}
            autoFocus
          />
        </div>
      )}

      {node.isDirectory && expanded && node.children && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              currentFile={currentFile}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  fileTree,
  onFileSelect,
  currentFile,
  onNewFile,
  onNewFolder,
  onDelete,
  onRename,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = (isFolder: boolean) => {
    if (!newName) return;
    if (isFolder) {
      onNewFolder(newName, '');
    } else {
      const finalName = newName.endsWith('.md') || newName.endsWith('.txt') ? newName : `${newName}.md`;
      onNewFile(finalName, '');
    }
    setNewName('');
    setShowNewFile(false);
    setShowNewFolder(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, isFolder: boolean) => {
    if (e.key === 'Enter') handleCreate(isFolder);
    if (e.key === 'Escape') {
      setShowNewFile(false);
      setShowNewFolder(false);
      setNewName('');
    }
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h2>📓 NOTES</h2>
        <div className="sidebar-actions">
          <button
            title="新建笔记 (根目录)"
            onClick={() => { setShowNewFile(true); setShowNewFolder(false); setNewName(''); }}
          >
            ➕
          </button>
          <button
            title="新建文件夹 (根目录)"
            onClick={() => { setShowNewFolder(true); setShowNewFile(false); setNewName(''); }}
          >
            📁
          </button>
          <button title="收起侧栏" onClick={onToggleCollapse}>
            ◀
          </button>
        </div>
      </div>

      <div className="file-tree">
        {(showNewFile || showNewFolder) && (
          <div className="tree-item" style={{ paddingLeft: '12px' }}>
            <span className="icon">{showNewFolder ? '📁' : '📝'}</span>
            <input
              className="rename-input"
              placeholder={showNewFolder ? '文件夹名称（回车创建）' : '笔记名称（回车创建）'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, showNewFolder)}
              onBlur={() => { if (!newName) { setShowNewFile(false); setShowNewFolder(false); } }}
              autoFocus
            />
          </div>
        )}

        {fileTree.length === 0 && !showNewFile && !showNewFolder && (
          <div className="empty-tree">
            <span>暂无笔记</span>
          </div>
        )}

        {fileTree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            onFileSelect={onFileSelect}
            currentFile={currentFile}
            onNewFile={onNewFile}
            onNewFolder={onNewFolder}
            onDelete={onDelete}
            onRename={onRename}
          />
        ))}
      </div>
    </aside>
  );
}
