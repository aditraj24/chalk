import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rail } from '../components/layout/Rail';
import { CommandSurface } from '../components/layout/CommandSurface';
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
      <Rail
        onNewChat={handleNewChat}
        onOpenChats={openCommand}
      />

      <main className="main-content">
        <div className="home-content">
          <div className="home-hero animate-fade-in">
            <div className="home-logo">
              <span className="home-logo-icon">🖍️</span>
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
                      <span className="text-xs text-secondary">
                        {chat.mode === 'focus' ? '🎯' : '🌐'}
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
    </div>
  );
}
