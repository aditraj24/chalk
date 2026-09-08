import './EmptyState.css';

interface EmptyStateProps {
  onIngest: () => void;
}

/**
 * Empty state — shown when a chat has no documents.
 * "Ingest your notes to start studying" with primary ingest button.
 */
export function EmptyState({ onIngest }: EmptyStateProps) {
  return (
    <div className="empty-state animate-fade-in">
      <div className="empty-state-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      </div>
      <h2 className="empty-state-title font-heading text-2xl">
        Ingest your notes to start studying
      </h2>
      <p className="empty-state-desc text-secondary">
        Upload your professor's notes and reference books as PDFs.
        Chalk will index them so you can ask questions grounded in your actual course material.
      </p>
      <button className="btn btn-primary empty-state-btn" onClick={onIngest} id="btn-ingest-start">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Ingest Documents
      </button>
    </div>
  );
}
