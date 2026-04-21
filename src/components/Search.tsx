import { useState, useCallback, useRef, useEffect } from 'react';

interface SearchResult {
  path: string;
  name: string;
  matchLine: string;
  matchIndex: number;
}

interface SearchProps {
  onSelect: (path: string) => void;
  visible: boolean;
  onClose: () => void;
}

export default function Search({ onSelect, visible, onClose }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [visible]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  };

  if (!visible) return null;

  return (
    <div className="search-panel">
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          className="search-input"
          value={query}
          onChange={handleChange}
          placeholder="搜索笔记内容..."
        />
        <button className="search-close" onClick={onClose}>✕</button>
      </div>
      {searching && <div className="search-loading">搜索中...</div>}
      {!searching && results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <div
              key={`${r.path}-${i}`}
              className="search-result"
              onClick={() => { onSelect(r.path); onClose(); }}
            >
              <div className="search-result-name">{r.name}</div>
              <div className="search-result-line">{r.matchLine}</div>
            </div>
          ))}
        </div>
      )}
      {!searching && query && results.length === 0 && (
        <div className="search-empty">没有找到匹配的结果</div>
      )}
    </div>
  );
}
