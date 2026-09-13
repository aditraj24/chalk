import { useRef, useEffect, useState } from 'react';
import { ModePills } from './ModePills';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { SearchConfirmation } from './SearchConfirmation';
import { EmptyState } from '../documents/EmptyState';
import { IngestPanel } from '../documents/IngestPanel';
import type { Message, Document } from '../../lib/api';
import type { SearchConfirmationState } from '../../hooks/useMessages';
import './ChatView.css';

interface ChatViewProps {
  chatId: string;
  title: string;
  mode: 'focus' | 'agent' | 'explore';
  perfMode: 'speed' | 'balanced' | 'accuracy';
  autoSearch?: boolean;
  messages: Message[];
  documents: Document[];
  streamedContent: string;
  isStreaming: boolean;
  searchConfirmation?: SearchConfirmationState | null;
  onSend: (content: string) => void;
  onResumeSearch?: (confirmed: boolean) => void;
  onModeChange: (mode: 'focus' | 'agent') => void;
  onPerfModeChange: (perfMode: 'speed' | 'balanced' | 'accuracy') => void;
  onAutoSearchChange?: (autoSearch: boolean) => void;
  onTitleChange: (title: string) => void;
  onUploadDocs: (files: File[]) => void;
  isUploading: boolean;
}

/**
 * Main chat view — message thread with mode pills, inline title editing,
 * message input, and inline search confirmation.
 */
export function ChatView({
  title,
  mode,
  perfMode,
  autoSearch = true,
  messages,
  documents,
  streamedContent,
  isStreaming,
  searchConfirmation,
  onSend,
  onResumeSearch,
  onModeChange,
  onPerfModeChange,
  onAutoSearchChange,
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

  // Auto-scroll to bottom on new messages or confirmation prompt
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedContent, searchConfirmation]);

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
          autoSearch={autoSearch}
          onModeChange={onModeChange}
          onPerfModeChange={onPerfModeChange}
          onAutoSearchChange={onAutoSearchChange}
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

        {/* Search Confirmation Prompt (Agent mode interrupt) */}
        {searchConfirmation && (
          <SearchConfirmation
            reason={searchConfirmation.reason}
            originalQuery={searchConfirmation.originalQuery}
            rewrittenQuery={searchConfirmation.rewrittenQuery}
            onConfirm={() => onResumeSearch?.(true)}
            onDecline={() => onResumeSearch?.(false)}
            isResuming={isStreaming}
          />
        )}

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
        <div className="modal-backdrop-overlay" onClick={() => setShowIngest(false)}>
          <div className="ingest-modal surface-raised animate-scale-in" onClick={(e) => e.stopPropagation()}>
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
        </div>
      )}
    </div>
  );
}
