import './ModePills.css';

interface ModePillsProps {
  mode: 'focus' | 'explore';
  perfMode: 'speed' | 'balanced' | 'accuracy';
  onModeChange: (mode: 'focus' | 'explore') => void;
  onPerfModeChange: (perfMode: 'speed' | 'balanced' | 'accuracy') => void;
}

/**
 * Mode pill controls — floating at top of message thread.
 * Focus/Explore pill + Speed/Balanced/Accuracy pill.
 */
export function ModePills({ mode, perfMode, onModeChange, onPerfModeChange }: ModePillsProps) {
  return (
    <div className="mode-pills" id="mode-pills">
      {/* Focus / Explore */}
      <div className="pill-group">
        <button
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
          className={`pill-option ${mode === 'explore' ? 'active-explore' : ''}`}
          onClick={() => onModeChange('explore')}
          id="pill-explore"
        >
          <svg className="pill-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span className="pill-text">Explore</span>
        </button>
      </div>

      {/* Speed / Balanced / Accuracy */}
      <div className="pill-group">
        <button
          className={`pill-option ${perfMode === 'speed' ? 'active' : ''}`}
          onClick={() => onPerfModeChange('speed')}
          id="pill-speed"
        >
          <span className="pill-text-short">S</span>
          <span className="pill-text-full">Speed</span>
        </button>
        <button
          className={`pill-option ${perfMode === 'balanced' ? 'active' : ''}`}
          onClick={() => onPerfModeChange('balanced')}
          id="pill-balanced"
        >
          <span className="pill-text-short">B</span>
          <span className="pill-text-full">Balanced</span>
        </button>
        <button
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
