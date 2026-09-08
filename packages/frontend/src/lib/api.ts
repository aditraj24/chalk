const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Fetch wrapper that injects Clerk auth token and handles JSON responses.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;

  // Get Clerk token from window (injected by ClerkProvider)
  let token: string | null = null;
  try {
    // @ts-expect-error Clerk global
    const clerk = window.Clerk;
    if (clerk?.session) {
      token = await clerk.session.getToken();
    }
  } catch {
    // No Clerk session available
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets boundary automatically)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// ─── Chat API ──────────────────────────────────────────

export interface Chat {
  id: string;
  userId: string;
  title: string;
  mode: 'focus' | 'explore';
  perfMode: 'speed' | 'balanced' | 'accuracy';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export const chatApi = {
  list: () => apiFetch<{ chats: Chat[] }>('/chats'),

  create: (data: { title: string; mode?: string; perfMode?: string }) =>
    apiFetch<{ chat: Chat }>('/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (chatId: string, data: { title?: string; mode?: string; perfMode?: string }) =>
    apiFetch<{ chat: Chat }>(`/chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (chatId: string) =>
    apiFetch<{ success: boolean }>(`/chats/${chatId}`, {
      method: 'DELETE',
    }),
};

// ─── Document API ──────────────────────────────────────

export interface Document {
  id: string;
  chatId: string;
  filename: string;
  s3Key: string;
  docType: string | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  pageCount: number | null;
  uploadedAt: string;
}

export const documentApi = {
  list: (chatId: string) =>
    apiFetch<{ documents: Document[] }>(`/chats/${chatId}/documents`),

  upload: async (chatId: string, files: File[], docType?: string) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (docType) formData.append('docType', docType);

    return apiFetch<{ documents: Document[] }>(`/chats/${chatId}/documents`, {
      method: 'POST',
      body: formData,
    });
  },

  delete: (chatId: string, docId: string) =>
    apiFetch<{ success: boolean }>(`/chats/${chatId}/documents/${docId}`, {
      method: 'DELETE',
    }),
};

// ─── Message API ───────────────────────────────────────

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  modeUsed: string | null;
  retrievedChunkIds: string | null;
  createdAt: string;
}

export interface StreamEvent {
  type: 'token' | 'citations' | 'done' | 'error';
  content?: string;
  citations?: Array<{
    chunkId: string;
    documentName: string;
    pageNumber: number | null;
    label: string;
  }>;
  error?: string;
}

export const messageApi = {
  history: (chatId: string) =>
    apiFetch<{ messages: Message[] }>(`/chats/${chatId}/messages`),

  /**
   * Send a message and stream the response via SSE.
   */
  send: async function* (chatId: string, content: string): AsyncGenerator<StreamEvent> {
    const url = `${API_BASE}/chats/${chatId}/messages`;

    let token: string | null = null;
    try {
      // @ts-expect-error Clerk global
      const clerk = window.Clerk;
      if (clerk?.session) {
        token = await clerk.session.getToken();
      }
    } catch {
      // No Clerk session
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: StreamEvent = JSON.parse(line.slice(6));
            yield event;
          } catch {
            // Skip malformed events
          }
        }
      }
    }
  },
};
