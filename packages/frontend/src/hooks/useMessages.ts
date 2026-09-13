import { useInfiniteQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { messageApi, type StreamEvent } from '../lib/api';

export function useMessages(chatId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['messages', chatId],
    queryFn: ({ pageParam }) => messageApi.history(chatId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.messages.length === 0) return undefined;
      return lastPage.messages[0].createdAt;
    },
    enabled: !!chatId,
    select: (data) => data.pages.flatMap((page) => page.messages),
  });
}

export interface SearchConfirmationState {
  reason: string;
  originalQuery: string;
  rewrittenQuery: string | null;
}

interface StreamingState {
  isStreaming: boolean;
  streamedContent: string;
  citations: StreamEvent['citations'];
  error: string | null;
  searchConfirmation: SearchConfirmationState | null;
}

/**
 * Hook for sending messages with SSE streaming support and interrupt/resume.
 */
export function useSendMessage(chatId: string | undefined) {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    streamedContent: '',
    citations: undefined,
    error: null,
    searchConfirmation: null,
  });

  const sendMessage = useCallback(
    async (content: string, onComplete?: () => void) => {
      if (!chatId || state.isStreaming) return;

      setState({
        isStreaming: true,
        streamedContent: '',
        citations: undefined,
        error: null,
        searchConfirmation: null,
      });

      try {
        for await (const event of messageApi.send(chatId, content)) {
          switch (event.type) {
            case 'token':
              setState((prev) => ({
                ...prev,
                streamedContent: prev.streamedContent + (event.content || ''),
              }));
              break;
            case 'citations':
              setState((prev) => ({
                ...prev,
                citations: event.citations,
              }));
              break;
            case 'search_confirmation':
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                searchConfirmation: {
                  reason: event.reason || "Your notes don't fully cover this topic.",
                  originalQuery: event.originalQuery || content,
                  rewrittenQuery: event.rewrittenQuery || null,
                },
              }));
              break;
            case 'done':
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                searchConfirmation: null,
              }));
              onComplete?.();
              break;
            case 'error':
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                searchConfirmation: null,
                error: event.error || 'Unknown error',
              }));
              break;
          }
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : 'Failed to send message',
        }));
      }
    },
    [chatId, state.isStreaming],
  );

  const resumeSearch = useCallback(
    async (confirmed: boolean, onComplete?: () => void) => {
      if (!chatId || state.isStreaming) return;

      setState((prev) => ({
        ...prev,
        isStreaming: true,
        searchConfirmation: null,
        error: null,
      }));

      try {
        for await (const event of messageApi.resume(chatId, confirmed)) {
          switch (event.type) {
            case 'token':
              setState((prev) => ({
                ...prev,
                streamedContent: prev.streamedContent + (event.content || ''),
              }));
              break;
            case 'citations':
              setState((prev) => ({
                ...prev,
                citations: event.citations,
              }));
              break;
            case 'done':
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                searchConfirmation: null,
              }));
              onComplete?.();
              break;
            case 'error':
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                searchConfirmation: null,
                error: event.error || 'Unknown error',
              }));
              break;
          }
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : 'Failed to resume search',
        }));
      }
    },
    [chatId, state.isStreaming],
  );

  const reset = useCallback(() => {
    setState({
      isStreaming: false,
      streamedContent: '',
      citations: undefined,
      error: null,
      searchConfirmation: null,
    });
  }, []);

  return { ...state, sendMessage, resumeSearch, reset };
}
