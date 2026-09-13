import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserButton, useUser } from '@clerk/clerk-react';
import { useTheme } from '../../hooks/useTheme';
import { SettingsModal } from './SettingsModal';
import { HelpModal } from './HelpModal';
import type { Chat } from '../../lib/api';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
  chats: Chat[];
  currentChatId?: string;
  onNewChat: () => void;
  onOpenSearch: () => void;
  onOpenProjects?: () => void;
  onSelectChat: (chatId: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onDeleteChat: (chatId: string) => void;
}

interface DateGroupedChats {
  today: Chat[];
  yesterday: Chat[];
  previous7Days: Chat[];
  previous30Days: Chat[];
  older: Chat[];
}

export function Sidebar({
  isOpen,
  onToggle,
  onCloseMobile,
  chats,
  currentChatId,
  onNewChat,
  onOpenSearch,
  onOpenProjects,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();

  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input
  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingChatId]);

  // Date categorization
  const groupedChats = useMemo<DateGroupedChats>(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const startOf30Days = startOfToday - 30 * 24 * 60 * 60 * 1000;

    const groups: DateGroupedChats = {
      today: [],
      yesterday: [],
      previous7Days: [],
      previous30Days: [],
      older: [],
    };

    // Sort chats by updatedAt descending
    const sorted = [...chats].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    for (const chat of sorted) {
      const time = new Date(chat.updatedAt).getTime();
      if (time >= startOfToday) {
        groups.today.push(chat);
      } else if (time >= startOfYesterday) {
        groups.yesterday.push(chat);
      } else if (time >= startOf7Days) {
        groups.previous7Days.push(chat);
      } else if (time >= startOf30Days) {
        groups.previous30Days.push(chat);
      } else {
        groups.older.push(chat);
      }
    }

    return groups;
  }, [chats]);

  const handleStartRename = (e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const handleSaveRename = (chatId: string) => {
    if (editTitle.trim()) {
      onRenameChat(chatId, editTitle.trim());
    }
    setEditingChatId(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (deleteConfirmId === chatId) {
      onDeleteChat(chatId);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(chatId);
      setTimeout(() => {
        setDeleteConfirmId((prev) => (prev === chatId ? null : prev));
      }, 3000);
    }
  };

  const isHome = location.pathname === '/';

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'sidebar-backdrop-visible' : ''}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${isOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}
        aria-label="Sidebar navigation"
      >
        <div className="sidebar-inner">
          {/* Top Section: Brand + Collapse Toggle */}
          <div className="sidebar-top">
            <button
              className="sidebar-brand"
              onClick={() => {
                navigate('/');
                onCloseMobile();
              }}
              title="Chalk Home"
            >
              <div className="sidebar-brand-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  <path d="m15 5 3 3" />
                </svg>
              </div>
              <span className="sidebar-brand-name font-heading">Chalk</span>
            </button>

            <button
              className="sidebar-toggle-btn"
              onClick={onToggle}
              title="Close sidebar"
              aria-label="Collapse sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
                <path d="m14 9-3 3 3 3" />
              </svg>
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="sidebar-nav">
            <button
              className="sidebar-nav-item sidebar-new-chat-btn"
              onClick={() => {
                onNewChat();
                onCloseMobile();
              }}
              id="sidebar-btn-new-chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="sidebar-nav-text">New Chat</span>
            </button>

            <button
              className="sidebar-nav-item"
              onClick={() => {
                onOpenSearch();
                onCloseMobile();
              }}
              id="sidebar-btn-search"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="sidebar-nav-text">Search</span>
              <kbd className="sidebar-nav-shortcut">⌘K</kbd>
            </button>

            <button
              className={`sidebar-nav-item ${isHome ? 'active' : ''}`}
              onClick={() => {
                navigate('/');
                onCloseMobile();
              }}
              id="sidebar-btn-home"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="sidebar-nav-text">Home</span>
            </button>

            <button
              className="sidebar-nav-item"
              onClick={() => {
                navigate('/');
                onCloseMobile();
              }}
              id="sidebar-btn-explore"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              <span className="sidebar-nav-text">Explore & Discover</span>
            </button>

            <button
              className="sidebar-nav-item"
              onClick={() => {
                if (onOpenProjects) onOpenProjects();
                else navigate('/');
                onCloseMobile();
              }}
              id="sidebar-btn-projects"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
              <span className="sidebar-nav-text">Course Projects</span>
            </button>
          </nav>

          {/* Conversation History (Scrollable Area) */}
          <div className="sidebar-history-container">
            <div className="sidebar-history-header">
              <span className="text-xs text-secondary font-heading uppercase tracking-wide">
                Recent Chats
              </span>
            </div>

            <div className="sidebar-history-list">
              {chats.length === 0 ? (
                <div className="sidebar-empty-history">
                  <span className="text-xs text-secondary">No conversations yet</span>
                </div>
              ) : (
                <>
                  {/* Today */}
                  {groupedChats.today.length > 0 && (
                    <div className="sidebar-group">
                      <span className="sidebar-group-title">Today</span>
                      {groupedChats.today.map((chat) => renderChatItem(chat))}
                    </div>
                  )}

                  {/* Yesterday */}
                  {groupedChats.yesterday.length > 0 && (
                    <div className="sidebar-group">
                      <span className="sidebar-group-title">Yesterday</span>
                      {groupedChats.yesterday.map((chat) => renderChatItem(chat))}
                    </div>
                  )}

                  {/* Previous 7 Days */}
                  {groupedChats.previous7Days.length > 0 && (
                    <div className="sidebar-group">
                      <span className="sidebar-group-title">Previous 7 Days</span>
                      {groupedChats.previous7Days.map((chat) => renderChatItem(chat))}
                    </div>
                  )}

                  {/* Previous 30 Days */}
                  {groupedChats.previous30Days.length > 0 && (
                    <div className="sidebar-group">
                      <span className="sidebar-group-title">Previous 30 Days</span>
                      {groupedChats.previous30Days.map((chat) => renderChatItem(chat))}
                    </div>
                  )}

                  {/* Older */}
                  {groupedChats.older.length > 0 && (
                    <div className="sidebar-group">
                      <span className="sidebar-group-title">Older</span>
                      {groupedChats.older.map((chat) => renderChatItem(chat))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Bottom Section: Pinned to bottom */}
          <div className="sidebar-bottom">
            {/* User Profile */}
            <div className="sidebar-user-row">
              <div className="sidebar-user-avatar">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      rootBox: { display: 'flex', alignItems: 'center' },
                      avatarBox: { width: 30, height: 30 },
                    },
                  }}
                />
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name truncate">
                  {user?.fullName || user?.firstName || 'Student Account'}
                </span>
                <span className="sidebar-user-email truncate">
                  {user?.primaryEmailAddress?.emailAddress || 'grounded-study'}
                </span>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="sidebar-footer-actions">
              <button
                className="sidebar-footer-btn"
                onClick={() => setShowSettings(true)}
                title="Settings & Preferences"
                id="sidebar-btn-settings"
              >
                {/* Modern Crisp Gear / Settings SVG */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="sidebar-footer-text">Settings</span>
              </button>

              <button
                className="sidebar-footer-btn"
                onClick={() => setShowHelp(true)}
                title="Help & Guides"
                id="sidebar-btn-help"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="sidebar-footer-text">Help</span>
              </button>

              <button
                className="sidebar-footer-btn"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                id="sidebar-btn-theme"
              >
                {theme === 'light' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
                <span className="sidebar-footer-text">
                  {theme === 'light' ? 'Dark theme' : 'Light theme'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Modals */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );

  function renderChatItem(chat: Chat) {
    const isActive = chat.id === currentChatId;
    const isEditing = editingChatId === chat.id;
    const isConfirmingDelete = deleteConfirmId === chat.id;

    return (
      <div
        key={chat.id}
        className={`sidebar-chat-row ${isActive ? 'active' : ''}`}
        onClick={() => {
          if (!isEditing) {
            onSelectChat(chat.id);
            onCloseMobile();
          }
        }}
      >
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            className="sidebar-chat-edit-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => handleSaveRename(chat.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename(chat.id);
              if (e.key === 'Escape') setEditingChatId(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="sidebar-chat-title truncate">{chat.title}</span>

            {/* Hover Actions */}
            <div className="sidebar-chat-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className="sidebar-chat-action-btn"
                onClick={(e) => handleStartRename(e, chat)}
                title="Rename chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>

              <button
                className={`sidebar-chat-action-btn ${isConfirmingDelete ? 'delete-confirm' : ''}`}
                onClick={(e) => handleDeleteClick(e, chat.id)}
                title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete chat'}
              >
                {isConfirmingDelete ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }
}
