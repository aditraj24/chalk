import { useRef, useCallback } from 'react';
import './IngestPanel.css';

interface DocumentInfo {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  pageCount: number | null;
}

interface IngestPanelProps {
  documents: DocumentInfo[];
  onUpload: (files: File[]) => void;
  isUploading: boolean;
}

/**
 * Document ingestion panel with drag-and-drop upload and per-document progress.
 */
export function IngestPanel({ documents, onUpload, isUploading }: IngestPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === 'application/pdf',
      );
      if (files.length > 0) onUpload(files);
    },
    [onUpload],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileSelect = () => {
    const files = fileInputRef.current?.files;
    if (files && files.length > 0) {
      onUpload(Array.from(files));
      fileInputRef.current!.value = '';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--focus-mode)' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'failed':
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--error)' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case 'processing':
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--warning)', animation: 'pulse 1.5s infinite' }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      default:
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        );
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Uploading';
      case 'processing': return 'Processing';
      case 'ready': return 'Ready';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  return (
    <div className="ingest-panel">
      {/* Drop Zone */}
      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,.pdf,.docx,.pptx,.txt,.md"
          multiple
          onChange={handleFileSelect}
          hidden
        />
        <div className="drop-zone-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="drop-zone-text font-heading">
          {isUploading ? 'Uploading...' : 'Drop PDFs here or click to browse'}
        </p>
        <p className="drop-zone-hint text-xs text-secondary">PDF files only, max 50MB each</p>
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="doc-list">
          {documents.map((doc) => (
            <div key={doc.id} className="doc-row animate-slide-up">
              <div className="doc-info">
                <span className="doc-status-icon">{statusIcon(doc.status)}</span>
                <span className="doc-filename truncate">{doc.filename}</span>
                {doc.pageCount && (
                  <span className="doc-pages text-xs text-secondary">
                    {doc.pageCount} pages
                  </span>
                )}
              </div>
              <div className="doc-status">
                <span className={`doc-status-label doc-status-${doc.status}`}>
                  {statusLabel(doc.status)}
                </span>
                {doc.status === 'processing' && (
                  <div className="doc-progress-bar">
                    <div className="doc-progress-fill" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
