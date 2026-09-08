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
          <span className="pill-icon">🎯</span>
          <span className="pill-text">Focus</span>
        </button>
        <button
          className={`pill-option ${mode === 'explore' ? 'active-explore' : ''}`}
          onClick={() => onModeChange('explore')}
          id="pill-explore"
        >
          <span className="pill-icon">🌐</span>
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
