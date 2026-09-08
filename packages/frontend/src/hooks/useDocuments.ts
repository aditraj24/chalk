import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '../lib/api';

export function useDocuments(chatId: string | undefined) {
  return useQuery({
    queryKey: ['documents', chatId],
    queryFn: () => documentApi.list(chatId!),
    select: (data) => data.documents,
    enabled: !!chatId,
  });
}

export function useUploadDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, files, docType }: { chatId: string; files: File[]; docType?: string }) =>
      documentApi.upload(chatId, files, docType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.chatId] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, docId }: { chatId: string; docId: string }) =>
      documentApi.delete(chatId, docId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.chatId] });
    },
  });
}
