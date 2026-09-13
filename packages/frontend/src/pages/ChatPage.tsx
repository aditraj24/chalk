import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { SidebarToggle } from '../components/layout/SidebarToggle';
import { CommandSurface } from '../components/layout/CommandSurface';
import { ProjectsModal } from '../components/layout/ProjectsModal';
import { ChatView } from '../components/chat/ChatView';
import { useCommandSurface } from '../hooks/useCommandSurface';
import { useChats, useCreateChat, useUpdateChat, useDeleteChat } from '../hooks/useChats';
import { useDocuments, useUploadDocuments } from '../hooks/useDocuments';
import { useMessages, useSendMessage } from '../hooks/useMessages';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Chat page — displays a specific chat with its documents and messages.
 */
export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOpen: commandOpen, open: openCommand, close: closeCommand } = useCommandSurface();

  // Data hooks
  const { data: chats = [] } = useChats();
  const createChat = useCreateChat();
  const updateChat = useUpdateChat();
  const deleteChat = useDeleteChat();
  const { data: documents = [] } = useDocuments(chatId);
  const { data: messages = [] } = useMessages(chatId);
  const uploadDocs = useUploadDocuments();
  const {
    streamedContent,
    isStreaming,
    searchConfirmation,
    sendMessage,
    resumeSearch,
  } = useSendMessage(chatId);

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

  const currentChat = chats.find((c) => c.id === chatId);

  // Handlers
  const handleNewChat = useCallback(async () => {
    try {
      const result = await createChat.mutateAsync({
        title: 'New Study Session',
        mode: 'focus',
        perfMode: 'balanced',
      });
      navigate(`/chat/${result.chat.id}`);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  }, [createChat, navigate]);

  const handleSelectChat = useCallback(
    (id: string) => navigate(`/chat/${id}`),
    [navigate],
  );

  const handleSend = useCallback(
    (content: string) => {
      // Auto-rename chat if it's the first message and title is still default
      if (
        chatId &&
        currentChat &&
        (currentChat.title === 'New Study Session' || !currentChat.title) &&
        messages.length === 0
      ) {
        const cleanPrompt = content.trim().replace(/\s+/g, ' ');
        const autoTitle = cleanPrompt.length > 36 ? cleanPrompt.slice(0, 36).trim() + '...' : cleanPrompt;
        if (autoTitle) {
          updateChat.mutate({ chatId, title: autoTitle });
        }
      }

      sendMessage(content, () => {
        // Refresh messages after streaming completes
        queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      });
    },
    [sendMessage, queryClient, chatId, currentChat, messages.length, updateChat],
  );

  const handleUploadDocs = useCallback(
    (files: File[]) => {
      if (chatId) {
        uploadDocs.mutate({ chatId, files });
      }
    },
    [chatId, uploadDocs],
  );

  const handleModeChange = useCallback(
    (mode: 'focus' | 'agent') => {
      if (chatId) updateChat.mutate({ chatId, mode });
    },
    [chatId, updateChat],
  );

  const handleAutoSearchChange = useCallback(
    (autoSearch: boolean) => {
      if (chatId) updateChat.mutate({ chatId, autoSearch });
    },
    [chatId, updateChat],
  );

  const handleResumeSearch = useCallback(
    (confirmed: boolean) => {
      resumeSearch(confirmed, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      });
    },
    [resumeSearch, queryClient, chatId],
  );

  const handlePerfModeChange = useCallback(
    (perfMode: 'speed' | 'balanced' | 'accuracy') => {
      if (chatId) updateChat.mutate({ chatId, perfMode });
    },
    [chatId, updateChat],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (chatId) updateChat.mutate({ chatId, title });
    },
    [chatId, updateChat],
  );

  if (!chatId || !currentChat) {
    return (
      <div className="app-layout">
        <SidebarToggle isOpen={isSidebarOpen} onToggle={handleToggleSidebar} />
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={handleToggleSidebar}
          onCloseMobile={handleCloseMobileSidebar}
          chats={chats}
          onNewChat={handleNewChat}
          onOpenSearch={openCommand}
          onOpenProjects={() => setProjectsOpen(true)}
          onSelectChat={handleSelectChat}
          onRenameChat={(id, title) => updateChat.mutate({ chatId: id, title })}
          onDeleteChat={(id) => {
            deleteChat.mutate(id);
            if (id === chatId) navigate('/');
          }}
        />
        <main className={`main-content ${isSidebarOpen ? 'with-sidebar' : 'without-sidebar'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-secondary">Chat not found</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Floating expand button when sidebar is collapsed */}
      <SidebarToggle isOpen={isSidebarOpen} onToggle={handleToggleSidebar} />

      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        onCloseMobile={handleCloseMobileSidebar}
        chats={chats}
        currentChatId={chatId}
        onNewChat={handleNewChat}
        onOpenSearch={openCommand}
        onOpenProjects={() => setProjectsOpen(true)}
        onSelectChat={handleSelectChat}
        onRenameChat={(id, title) => updateChat.mutate({ chatId: id, title })}
        onDeleteChat={(id) => {
          deleteChat.mutate(id);
          if (id === chatId) navigate('/');
        }}
      />

      <main className={`main-content ${isSidebarOpen ? 'with-sidebar' : 'without-sidebar'}`}>
        <ChatView
          chatId={chatId}
          title={currentChat.title}
          mode={currentChat.mode}
          perfMode={currentChat.perfMode as 'speed' | 'balanced' | 'accuracy'}
          autoSearch={currentChat.autoSearch ?? true}
          messages={messages}
          documents={documents}
          streamedContent={streamedContent}
          isStreaming={isStreaming}
          searchConfirmation={searchConfirmation}
          onSend={handleSend}
          onResumeSearch={handleResumeSearch}
          onModeChange={handleModeChange}
          onPerfModeChange={handlePerfModeChange}
          onAutoSearchChange={handleAutoSearchChange}
          onTitleChange={handleTitleChange}
          onUploadDocs={handleUploadDocs}
          isUploading={uploadDocs.isPending}
        />
      </main>

      <CommandSurface
        isOpen={commandOpen}
        onClose={closeCommand}
        chats={chats}
        onSelectChat={handleSelectChat}
        onRenameChat={(id, title) => updateChat.mutate({ chatId: id, title })}
        onDeleteChat={(id) => {
          deleteChat.mutate(id);
          if (id === chatId) navigate('/');
        }}
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
