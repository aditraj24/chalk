import { useState, useRef, useEffect } from 'react';
import './MessageInput.css';

interface MessageInputProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
  documentCount: number;
  onAddDocs?: () => void;
}

/**
 * Chat input box with send button, document badge, and compress animation on send.
 */
export function MessageInput({ onSend, isStreaming, documentCount, onAddDocs }: MessageInputProps) {
  const [value, setValue] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleSend = () => {
    if (!value.trim() || isStreaming) return;

    // Compress animation
    setIsCompressing(true);
    setTimeout(() => setIsCompressing(false), 300);

    onSend(value.trim());
    setValue('');

    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`message-input-container ${isCompressing ? 'compress' : ''}`}>
      {/* Document badge */}
      {documentCount > 0 && (
        <button className="doc-badge" onClick={onAddDocs} title="Add more documents">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>{documentCount} doc{documentCount !== 1 ? 's' : ''}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      <div className="message-input-wrapper">
        <textarea
          ref={textareaRef}
          className="message-textarea"
          placeholder={documentCount === 0
            ? 'Upload documents first to start studying...'
            : 'Ask about your notes...'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={documentCount === 0 || isStreaming}
          id="message-input"
        />

        <button
          className="btn-primary send-btn"
          onClick={handleSend}
          disabled={!value.trim() || isStreaming || documentCount === 0}
          title="Send (Enter)"
          id="btn-send"
        >
          {isStreaming ? (
            <div className="send-loading" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
