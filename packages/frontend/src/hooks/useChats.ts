import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, type Chat } from '../lib/api';

export function useChats() {
  return useQuery({
    queryKey: ['chats'],
    queryFn: () => chatApi.list(),
    select: (data) => data.chats,
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useUpdateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      chatId,
      ...data
    }: {
      chatId: string;
      title?: string;
      mode?: string;
      perfMode?: string;
      autoSearch?: boolean;
    }) => chatApi.update(chatId, data),
    onMutate: async ({ chatId, ...data }) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['chats'] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<{ chats: Chat[] }>(['chats']);

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<{ chats: Chat[] }>(['chats'], {
          ...previousData,
          chats: previousData.chats.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  ...(data.title !== undefined ? { title: data.title } : {}),
                  ...(data.mode !== undefined
                    ? { mode: (data.mode === 'explore' ? 'agent' : data.mode) as 'focus' | 'agent' }
                    : {}),
                  ...(data.perfMode !== undefined
                    ? { perfMode: data.perfMode as 'speed' | 'balanced' | 'accuracy' }
                    : {}),
                  ...(data.autoSearch !== undefined ? { autoSearch: data.autoSearch } : {}),
                  updatedAt: new Date().toISOString(),
                }
              : chat,
          ),
        });
      }

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['chats'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatApi.delete,
    onMutate: async (chatId: string) => {
      await queryClient.cancelQueries({ queryKey: ['chats'] });
      const previousData = queryClient.getQueryData<{ chats: Chat[] }>(['chats']);
      if (previousData) {
        queryClient.setQueryData<{ chats: Chat[] }>(['chats'], {
          ...previousData,
          chats: previousData.chats.filter((chat) => chat.id !== chatId),
        });
      }
      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['chats'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

