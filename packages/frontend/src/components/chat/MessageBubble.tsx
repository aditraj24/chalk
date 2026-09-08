import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MessageBubble.css';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  mode?: string | null;
}

/**
 * Message bubble component.
 * - User messages: right-aligned on bg-surface-raised
 * - Assistant messages: left-aligned, full/near-full width (not bubble-constrained)
 * - Renders markdown for assistant responses
 * - Citation chips highlighted with focus-mode color
 */
export function MessageBubble({ role, content, isStreaming, mode }: MessageBubbleProps) {
  return (
    <div className={`message message-${role} animate-slide-up`}>
      <div className={`message-bubble message-bubble-${role}`}>
        {role === 'assistant' ? (
          <div className="message-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Style code blocks with JetBrains Mono
                code: ({ children, className, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="inline-code" {...props}>{children}</code>
                  ) : (
                    <code className={`code-block font-mono ${className || ''}`} {...props}>
                      {children}
                    </code>
                  );
                },
                // Detect citation patterns and render as chips
                p: ({ children }) => {
                  return <p>{processCitations(children, mode)}</p>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
            {isStreaming && <span className="streaming-cursor" />}
          </div>
        ) : (
          <p className="message-content">{content}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Process text children to convert [Doc: name, p.X] patterns into citation chips.
 */
function processCitations(
  children: React.ReactNode,
  mode?: string | null,
): React.ReactNode {
  if (typeof children !== 'string' && !Array.isArray(children)) return children;

  const text = typeof children === 'string' ? children : '';
  if (!text) return children;

  const citationRegex = /\[Doc:\s*([^,\]]+),\s*(p\.\d+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = citationRegex.exec(text)) !== null) {
    // Add text before the citation
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add citation chip
    const chipClass = mode === 'explore' ? 'citation-chip-explore' : 'citation-chip-focus';
    parts.push(
      <span key={match.index} className={`citation-chip ${chipClass}`}>
        📄 {match[1].trim()}, {match[2]}
      </span>,
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : children;
}
