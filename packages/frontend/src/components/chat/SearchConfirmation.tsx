import './SearchConfirmation.css';

export interface SearchConfirmationProps {
  reason: string;
  originalQuery: string;
  rewrittenQuery?: string | null;
  onConfirm: () => void;
  onDecline: () => void;
  isResuming?: boolean;
}

export function SearchConfirmation({
  reason,
  originalQuery: _originalQuery,
  rewrittenQuery,
  onConfirm,
  onDecline,
  isResuming = false,
}: SearchConfirmationProps) {
  return (
    <div className="search-confirmation-card" id="search-confirmation">
      <div className="search-confirmation-header">
        <div className="search-confirmation-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Web Search Confirmation</span>
        </div>
      </div>

      <div className="search-confirmation-body">
        <p className="search-confirmation-main-text font-heading">
          Your notes don&apos;t fully cover this topic.
        </p>

        {reason && (
          <p className="search-confirmation-reason text-sm">
            {reason}
          </p>
        )}

        {rewrittenQuery && (
          <div className="search-confirmation-query-box">
            <span className="query-box-label">Target search query:</span>
            <span className="query-box-content">&ldquo;{rewrittenQuery}&rdquo;</span>
          </div>
        )}

        <p className="search-confirmation-subtext text-sm">
          Would you like me to search verified academic web sources to answer your question?
        </p>
      </div>

      <div className="search-confirmation-actions">
        <button
          type="button"
          className="btn-confirm-search"
          onClick={onConfirm}
          disabled={isResuming}
          id="btn-confirm-search"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span>{isResuming ? 'Searching...' : 'Yes, Search Web'}</span>
        </button>

        <button
          type="button"
          className="btn-decline-search"
          onClick={onDecline}
          disabled={isResuming}
          id="btn-decline-search"
        >
          <span>Answer from Notes Only</span>
        </button>
      </div>
    </div>
  );
}
