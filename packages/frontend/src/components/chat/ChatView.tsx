import { useRef, useEffect, useState } from 'react';
import { ModePills } from './ModePills';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { EmptyState } from '../documents/EmptyState';
import { IngestPanel } from '../documents/IngestPanel';
import type { Message, Document } from '../../lib/api';
import './ChatView.css';

interface ChatViewProps {
  chatId: string;
  title: string;
  mode: 'focus' | 'explore';
  perfMode: 'speed' | 'balanced' | 'accuracy';
  messages: Message[];
  documents: Document[];
  streamedContent: string;
  isStreaming: boolean;
  onSend: (content: string) => void;
  onModeChange: (mode: 'focus' | 'explore') => void;
  onPerfModeChange: (perfMode: 'speed' | 'balanced' | 'accuracy') => void;
  onTitleChange: (title: string) => void;
  onUploadDocs: (files: File[]) => void;
  isUploading: boolean;
}

/**
 * Main chat view — message thread with mode pills, inline title editing,
 * and message input. Shows EmptyState if no documents are ingested.
 */
export function ChatView({
  chatId,
  title,
  mode,
  perfMode,
  messages,
  documents,
  streamedContent,
  isStreaming,
  onSend,
  onModeChange,
  onPerfModeChange,
  onTitleChange,
  onUploadDocs,
  isUploading,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [showIngest, setShowIngest] = useState(false);

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const hasDocuments = readyDocs.length > 0;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedContent]);

  const handleTitleSubmit = () => {
    if (editTitle.trim()) {
      onTitleChange(editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  if (!hasDocuments && !showIngest) {
    return (
      <div className="chat-view">
        <EmptyState onIngest={() => setShowIngest(true)} />
      </div>
    );
  }

  if (showIngest && !hasDocuments) {
    return (
      <div className="chat-view">
        <div className="chat-header">
          <h1 className="chat-title font-heading text-xl">{title}</h1>
        </div>
        <div className="ingest-wrapper">
          <IngestPanel
            documents={documents}
            onUpload={onUploadDocs}
            isUploading={isUploading}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view">
      {/* Header: Title + Mode Pills */}
      <div className="chat-header">
        <div className="chat-header-left">
          {isEditingTitle ? (
            <input
              type="text"
              className="chat-title-input font-heading"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              autoFocus
            />
          ) : (
            <h1
              className="chat-title font-heading text-xl"
              onClick={() => {
                setIsEditingTitle(true);
                setEditTitle(title);
              }}
              title="Click to rename"
            >
              {title}
            </h1>
          )}
        </div>

        <ModePills
          mode={mode}
          perfMode={perfMode}
          onModeChange={onModeChange}
          onPerfModeChange={onPerfModeChange}
        />
      </div>

      {/* Message Thread */}
      <div className="message-thread">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            mode={msg.modeUsed}
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamedContent && (
          <MessageBubble
            role="assistant"
            content={streamedContent}
            isStreaming={true}
            mode={mode}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={onSend}
        isStreaming={isStreaming}
        documentCount={readyDocs.length}
        onAddDocs={() => setShowIngest(true)}
      />

      {/* Ingest Modal Overlay */}
      {showIngest && (
        <>
          <div className="backdrop" onClick={() => setShowIngest(false)} />
          <div className="ingest-modal surface-raised animate-scale-in">
            <div className="ingest-modal-header">
              <h2 className="font-heading text-lg">Documents</h2>
              <button className="btn btn-ghost" onClick={() => setShowIngest(false)}>✕</button>
            </div>
            <IngestPanel
              documents={documents}
              onUpload={onUploadDocs}
              isUploading={isUploading}
            />
          </div>
        </>
      )}
    </div>
  );
}
