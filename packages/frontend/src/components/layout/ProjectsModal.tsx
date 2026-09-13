import type { Chat } from '../../lib/api';
import './ProjectsModal.css';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chats: Chat[];
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

export function ProjectsModal({
  isOpen,
  onClose,
  chats,
  onSelectChat,
  onNewChat,
}: ProjectsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div
        className="projects-modal animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="projects-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="projects-header">
          <div className="projects-title-group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
            <h2 id="projects-title" className="font-heading text-lg">Course Projects & Subjects</h2>
          </div>
          <button className="projects-close-btn" onClick={onClose} aria-label="Close projects">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="projects-body">
          <p className="projects-desc text-sm text-secondary">
            Each study session acts as an isolated project with its own ingested course materials and grounding context.
          </p>

          <div className="projects-grid">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className="projects-card"
                onClick={() => {
                  onSelectChat(chat.id);
                  onClose();
                }}
              >
                <div className="projects-card-header">
                  <div className="projects-card-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <span className="projects-card-mode text-xs">
                    {chat.mode === 'focus' ? 'Focus Grounded' : 'Agent Mode'}
                  </span>
                </div>
                <h4 className="projects-card-title text-sm truncate">{chat.title}</h4>
                <span className="projects-card-date text-xs text-secondary">
                  Last updated {new Date(chat.updatedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="projects-footer">
          <button
            className="btn btn-primary projects-new-btn"
            onClick={() => {
              onNewChat();
              onClose();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create New Course Project
          </button>
        </div>
      </div>
    </div>
  );
}
