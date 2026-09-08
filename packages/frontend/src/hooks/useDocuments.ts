import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '../lib/api';
import type { Document } from '../lib/api';

export function useDocuments(chatId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!chatId) return;

    let isActive = true;

    async function listenToProgress() {
      try {
        const gen = documentApi.progress(chatId!);
        for await (const event of gen) {
          if (!isActive) break;
          if (event.type === 'progress' && event.documents) {
            // Update cache dynamically
            queryClient.setQueryData<{ documents: Document[] }>(['documents', chatId], (old) => {
              if (!old) return old;
              
              const updatedDocs = old.documents.map((doc) => {
                const update = event.documents!.find((d) => d.id === doc.id);
                if (update) {
                  return { ...doc, ...update };
                }
                return doc;
              });

              // Add newly ingested documents that aren't in the cache yet
              const existingIds = new Set(old.documents.map((d) => d.id));
              const newDocs = event.documents!.filter((d) => !existingIds.has(d.id!)) as Document[];

              return { documents: [...updatedDocs, ...newDocs] };
            });
          }
        }
      } catch (err) {
        if (isActive) {
          console.error('SSE Progress Error:', err);
        }
      }
    }

    listenToProgress();

    return () => {
      isActive = false;
    };
  }, [chatId, queryClient]);

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
