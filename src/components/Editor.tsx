interface EditorProps {
  content: string;
  onChange: (content: string) => void;
}

export default function Editor({ content, onChange }: EditorProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;

    // Tab 缩进
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // 取消缩进
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const linePrefix = value.slice(lineStart, selectionStart);
        if (linePrefix.startsWith('  ')) {
          const newValue = value.slice(0, lineStart) + value.slice(lineStart + 2);
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart - 2;
          }, 0);
        }
      } else {
        const newValue = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + 2;
        }, 0);
      }
    }
  };

  return (
    <div className="editor-pane">
      <textarea
        className="editor-textarea"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="开始写 Markdown 笔记...&#10;&#10;支持：# 标题, **粗体**, *斜体*, - 列表, > 引用, `代码` 等语法"
        spellCheck={false}
      />
    </div>
  );
}
