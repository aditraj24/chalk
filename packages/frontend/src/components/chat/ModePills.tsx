import './ModePills.css';

interface ModePillsProps {
  mode: 'focus' | 'agent' | 'explore';
  perfMode: 'speed' | 'balanced' | 'accuracy';
  autoSearch?: boolean;
  onModeChange: (mode: 'focus' | 'agent') => void;
  onPerfModeChange: (perfMode: 'speed' | 'balanced' | 'accuracy') => void;
  onAutoSearchChange?: (autoSearch: boolean) => void;
}

/**
 * Mode pill controls — floating at top of message thread.
 * Focus/Agent pill + Auto-search toggle (in Agent mode) + Speed/Balanced/Accuracy pill.
 */
export function ModePills({
  mode,
  perfMode,
  autoSearch = true,
  onModeChange,
  onPerfModeChange,
  onAutoSearchChange,
}: ModePillsProps) {
  const isAgent = mode === 'agent' || mode === 'explore';

  return (
    <div className="mode-pills" id="mode-pills">
      {/* Focus / Agent */}
      <div className="pill-group">
        <button
          type="button"
          className={`pill-option ${mode === 'focus' ? 'active-focus' : ''}`}
          onClick={() => onModeChange('focus')}
          id="pill-focus"
        >
          <svg className="pill-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
          </svg>
          <span className="pill-text">Focus</span>
        </button>
        <button
          type="button"
          className={`pill-option ${isAgent ? 'active-agent active-explore' : ''}`}
          onClick={() => onModeChange('agent')}
          id="pill-agent"
        >
          <svg className="pill-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4" />
            <line x1="8" y1="16" x2="8.01" y2="16" />
            <line x1="16" y1="16" x2="16.01" y2="16" />
          </svg>
          <span className="pill-text">Agent</span>
        </button>
      </div>

      {/* Auto-Search Toggle (Only visible in Agent mode) */}
      {isAgent && (
        <button
          type="button"
          className={`auto-search-toggle ${autoSearch ? 'is-enabled' : 'is-disabled'}`}
          onClick={() => onAutoSearchChange?.(!autoSearch)}
          id="auto-search-toggle"
          title={
            autoSearch
              ? 'Auto-search ON: Automatically searches web if notes are insufficient'
              : 'Auto-search OFF: Prompts for confirmation before searching web'
          }
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="auto-search-label">Auto-search:</span>
          <span className="auto-search-badge">{autoSearch ? 'ON' : 'OFF'}</span>
        </button>
      )}

      {/* Speed / Balanced / Accuracy */}
      <div className="pill-group">
        <button
          type="button"
          className={`pill-option ${perfMode === 'speed' ? 'active' : ''}`}
          onClick={() => onPerfModeChange('speed')}
          id="pill-speed"
        >
          <span className="pill-text-short">S</span>
          <span className="pill-text-full">Speed</span>
        </button>
        <button
          type="button"
          className={`pill-option ${perfMode === 'balanced' ? 'active' : ''}`}
          onClick={() => onPerfModeChange('balanced')}
          id="pill-balanced"
        >
          <span className="pill-text-short">B</span>
          <span className="pill-text-full">Balanced</span>
        </button>
        <button
          type="button"
          className={`pill-option ${perfMode === 'accuracy' ? 'active' : ''}`}
          onClick={() => onPerfModeChange('accuracy')}
          id="pill-accuracy"
        >
          <span className="pill-text-short">A</span>
          <span className="pill-text-full">Accuracy</span>
        </button>
      </div>
    </div>
  );
}
