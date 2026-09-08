import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Rail } from '../components/layout/Rail';
import { CommandSurface } from '../components/layout/CommandSurface';
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
  const { streamedContent, isStreaming, sendMessage } = useSendMessage(chatId);

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
      sendMessage(content, () => {
        // Refresh messages after streaming completes
        queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      });
    },
    [sendMessage, queryClient, chatId],
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
    (mode: 'focus' | 'explore') => {
      if (chatId) updateChat.mutate({ chatId, mode });
    },
    [chatId, updateChat],
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
        <Rail onNewChat={handleNewChat} onOpenChats={openCommand} />
        <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-secondary">Chat not found</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Rail
        onNewChat={handleNewChat}
        onOpenChats={openCommand}
        documentCount={documents.filter((d) => d.status === 'ready').length}
      />

      <main className="main-content">
        <ChatView
          chatId={chatId}
          title={currentChat.title}
          mode={currentChat.mode as 'focus' | 'explore'}
          perfMode={currentChat.perfMode as 'speed' | 'balanced' | 'accuracy'}
          messages={messages}
          documents={documents}
          streamedContent={streamedContent}
          isStreaming={isStreaming}
          onSend={handleSend}
          onModeChange={handleModeChange}
          onPerfModeChange={handlePerfModeChange}
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
    </div>
  );
}
