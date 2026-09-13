import './SidebarToggle.css';

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function SidebarToggle({ isOpen, onToggle }: SidebarToggleProps) {
  return (
    <button
      className={`sidebar-floating-toggle ${isOpen ? 'is-open' : ''}`}
      onClick={onToggle}
      title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      id="btn-sidebar-toggle"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
        <path d="m14 9-3 3 3 3" />
      </svg>
    </button>
  );
}
