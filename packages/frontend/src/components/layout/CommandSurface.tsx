import { useState, useRef, useEffect } from 'react';
import type { Chat } from '../../lib/api';
import './CommandSurface.css';

interface CommandSurfaceProps {
  isOpen: boolean;
  onClose: () => void;
  chats: Chat[];
  onSelectChat: (chatId: string) => void;
  onRenameChat: (chatId: string, title: string) => void;
  onDeleteChat: (chatId: string) => void;
}

/**
 * Command Surface — centered floating overlay for chat search and management.
 * Opened via ⌘K/Ctrl+K or clicking "Chats" in the rail.
 * Features: fuzzy search, keyboard navigation, inline rename/delete.
 */
export function CommandSurface({
  isOpen,
  onClose,
  chats,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
}: CommandSurfaceProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Filter chats by search query
  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(search.toLowerCase()),
  );

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setEditingId(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingId) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingId]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingId) {
      if (e.key === 'Enter') {
        onRenameChat(editingId, editTitle);
        setEditingId(null);
      }
      if (e.key === 'Escape') {
        setEditingId(null);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredChats.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredChats[selectedIndex]) {
          onSelectChat(filteredChats[selectedIndex].id);
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="command-surface animate-scale-in" onKeyDown={handleKeyDown}>
        {/* Search Input */}
        <div className="command-search">
          <svg className="command-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="command-input"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <kbd className="command-kbd">ESC</kbd>
        </div>

        {/* Chat List */}
        <div className="command-list">
          {filteredChats.length === 0 ? (
            <div className="command-empty">
              <span className="text-secondary text-sm">
                {chats.length === 0 ? 'No chats yet' : 'No chats match your search'}
              </span>
            </div>
          ) : (
            filteredChats.map((chat, index) => (
              <div
                key={chat.id}
                className={`command-item ${index === selectedIndex ? 'command-item-selected' : ''}`}
                onClick={() => {
                  if (!editingId) {
                    onSelectChat(chat.id);
                    onClose();
                  }
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {editingId === chat.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    className="command-edit-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => {
                      onRenameChat(chat.id, editTitle);
                      setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div className="command-item-content">
                      <span className="command-item-title truncate">{chat.title}</span>
                      <span className="command-item-meta text-xs text-secondary">
                        {chat.mode === 'focus' ? '🎯' : '🌐'}{' '}
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="command-item-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-ghost btn-icon command-action-btn"
                        onClick={() => {
                          setEditingId(chat.id);
                          setEditTitle(chat.title);
                        }}
                        title="Rename"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="btn-ghost btn-icon command-action-btn command-action-delete"
                        onClick={() => onDeleteChat(chat.id)}
                        title="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="command-footer">
          <span className="text-xs text-secondary">
            ↑↓ Navigate · Enter Select · Esc Close
          </span>
        </div>
      </div>
    </>
  );
}
