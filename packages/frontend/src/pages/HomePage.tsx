import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { SidebarToggle } from '../components/layout/SidebarToggle';
import { CommandSurface } from '../components/layout/CommandSurface';
import { ProjectsModal } from '../components/layout/ProjectsModal';
import { useCommandSurface } from '../hooks/useCommandSurface';
import { useChats, useCreateChat, useUpdateChat, useDeleteChat } from '../hooks/useChats';
import './HomePage.css';

/**
 * Home page — landing screen when no chat is selected.
 * Shows the "Start studying" prompt and handles new chat creation.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { isOpen: commandOpen, open: openCommand, close: closeCommand } = useCommandSurface();
  const { data: chats = [] } = useChats();
  const createChat = useCreateChat();
  const updateChat = useUpdateChat();
  const deleteChat = useDeleteChat();

  const [isCreating, setIsCreating] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  // Responsive sidebar state: open by default on desktop (>=768px), collapsed on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  // Sync with window resizing
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseMobileSidebar = useCallback(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const result = await createChat.mutateAsync({
        title: 'New Study Session',
        mode: 'focus',
        perfMode: 'balanced',
      });
      navigate(`/chat/${result.chat.id}`);
    } catch (error) {
      console.error('Failed to create chat:', error);
    } finally {
      setIsCreating(false);
    }
  }, [createChat, navigate, isCreating]);

  const handleSelectChat = useCallback(
    (chatId: string) => navigate(`/chat/${chatId}`),
    [navigate],
  );

  const handleRenameChat = useCallback(
    (chatId: string, title: string) => {
      updateChat.mutate({ chatId, title });
    },
    [updateChat],
  );

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      deleteChat.mutate(chatId);
    },
    [deleteChat],
  );

  return (
    <div className="app-layout">
      {/* Floating expand toggle button when sidebar is collapsed */}
      <SidebarToggle
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        onCloseMobile={handleCloseMobileSidebar}
        chats={chats}
        onNewChat={handleNewChat}
        onOpenSearch={openCommand}
        onOpenProjects={() => setProjectsOpen(true)}
        onSelectChat={handleSelectChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
      />

      <main className={`main-content ${isSidebarOpen ? 'with-sidebar' : 'without-sidebar'}`}>
        <div className="home-content">
          <div className="home-hero animate-fade-in">
            <div className="home-logo">
              <div className="home-logo-badge">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  <path d="m15 5 3 3" />
                </svg>
              </div>
            </div>
            <h1 className="home-title font-heading">Chalk</h1>
            <p className="home-subtitle text-secondary">
              Your study assistant, grounded in your professor's notes.
            </p>
            <p className="home-desc text-secondary text-sm">
              Upload your PDFs, and Chalk will answer your questions strictly from your course material — no hallucinations, no outside knowledge unless you want it.
            </p>
            <button
              className="btn btn-primary home-cta"
              onClick={handleNewChat}
              disabled={isCreating}
              id="btn-home-new-chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {isCreating ? 'Creating...' : 'Start a Study Session'}
            </button>

            {chats.length > 0 && (
              <div className="home-recent">
                <p className="text-xs text-secondary" style={{ marginBottom: 8 }}>
                  Recent chats
                </p>
                <div className="home-recent-list">
                  {chats.slice(0, 5).map((chat) => (
                    <button
                      key={chat.id}
                      className="home-recent-item"
                      onClick={() => handleSelectChat(chat.id)}
                    >
                      <span className="truncate">{chat.title}</span>
                      <span className="text-xs text-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {chat.mode === 'focus' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--focus-mode)' }}>
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="4" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--explore-mode)' }}>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                          </svg>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <CommandSurface
        isOpen={commandOpen}
        onClose={closeCommand}
        chats={chats}
        onSelectChat={handleSelectChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
      />

      <ProjectsModal
        isOpen={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        chats={chats}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
      />
    </div>
  );
}
