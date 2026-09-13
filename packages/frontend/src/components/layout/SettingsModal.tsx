import { useTheme } from '../../hooks/useTheme';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, toggleTheme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div
        className="settings-modal animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <div className="settings-title-group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <h2 id="settings-title" className="font-heading text-lg">Settings & Preferences</h2>
          </div>
          <button className="settings-close-btn" onClick={onClose} aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {/* Appearance */}
          <div className="settings-section">
            <h3 className="settings-section-title text-sm font-heading">Appearance</h3>
            <div className="settings-row">
              <div className="settings-row-text">
                <span className="settings-label text-sm">Theme Mode</span>
                <span className="settings-subtext text-xs text-secondary">
                  Current: {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </span>
              </div>
              <button
                className="btn btn-secondary settings-action-btn"
                onClick={toggleTheme}
              >
                {theme === 'light' ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                    Switch to Dark
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    Switch to Light
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RAG Engine Defaults */}
          <div className="settings-section">
            <h3 className="settings-section-title text-sm font-heading">Study Engine Defaults</h3>
            <div className="settings-row">
              <div className="settings-row-text">
                <span className="settings-label text-sm">Grounding Constraint</span>
                <span className="settings-subtext text-xs text-secondary">
                  Focus mode strictly confines responses to your ingested lecture notes and textbooks.
                </span>
              </div>
              <span className="settings-badge text-xs">Strict Grounding</span>
            </div>

            <div className="settings-row">
              <div className="settings-row-text">
                <span className="settings-label text-sm">Retrieval Pipeline</span>
                <span className="settings-subtext text-xs text-secondary">
                  Hybrid dense pgvector (HNSW) + sparse BM25 with reciprocal rank fusion.
                </span>
              </div>
              <span className="settings-badge text-xs">Dense + Sparse</span>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="settings-section">
            <h3 className="settings-section-title text-sm font-heading">Keyboard Shortcuts</h3>
            <div className="settings-shortcuts-list">
              <div className="settings-shortcut-item">
                <span className="text-sm">Search chats</span>
                <kbd className="settings-kbd">⌘K / Ctrl+K</kbd>
              </div>
              <div className="settings-shortcut-item">
                <span className="text-sm">Submit message</span>
                <kbd className="settings-kbd">Enter</kbd>
              </div>
              <div className="settings-shortcut-item">
                <span className="text-sm">New line in input</span>
                <kbd className="settings-kbd">Shift + Enter</kbd>
              </div>
              <div className="settings-shortcut-item">
                <span className="text-sm">Close overlays / modals</span>
                <kbd className="settings-kbd">Esc</kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-primary settings-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
