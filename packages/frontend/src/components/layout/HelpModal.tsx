import './HelpModal.css';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div
        className="help-modal animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-header">
          <div className="help-title-group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h2 id="help-title" className="font-heading text-lg">Help & Guide</h2>
          </div>
          <button className="help-close-btn" onClick={onClose} aria-label="Close help">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="help-body">
          <div className="help-card">
            <h3 className="help-card-title font-heading text-sm">How Chalk Works</h3>
            <p className="help-card-text text-sm text-secondary">
              Chalk is a strictly grounded RAG study assistant. You upload your course documents (lecture notes, syllabi, textbooks), and Chalk chunks, embeds, and indexes them using dense vector retrieval and sparse keyword search.
            </p>
          </div>

          <div className="help-card">
            <h3 className="help-card-title font-heading text-sm">Focus Mode vs. Explore Mode</h3>
            <div className="help-mode-item">
              <span className="help-mode-pill focus-tag">Focus</span>
              <p className="text-xs text-secondary">
                Strict course-material grounding. If an answer isn't in your notes, Chalk tells you honestly rather than hallucinating.
              </p>
            </div>
            <div className="help-mode-item">
              <span className="help-mode-pill explore-tag">Explore</span>
              <p className="text-xs text-secondary">
                Expands beyond your course notes to web knowledge and broader context when you want deeper explanations or real-world examples.
              </p>
            </div>
          </div>

          <div className="help-card">
            <h3 className="help-card-title font-heading text-sm">Performance Controls</h3>
            <ul className="help-list text-xs text-secondary">
              <li><strong>Speed:</strong> Skips reranking for near-instant responses during rapid review.</li>
              <li><strong>Balanced:</strong> Dense + sparse hybrid search with standard cross-encoder reranking.</li>
              <li><strong>Accuracy:</strong> Deep multi-hop retrieval and maximum grounding scrutiny for exam preparation.</li>
            </ul>
          </div>
        </div>

        <div className="help-footer">
          <button className="btn btn-primary help-done-btn" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
