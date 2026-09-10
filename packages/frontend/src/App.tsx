import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { useTheme } from './hooks/useTheme';

declare global {
  interface Window {
    __ENV__?: {
      VITE_CLERK_PUBLISHABLE_KEY?: string;
    };
  }
}

const CLERK_PUBLISHABLE_KEY =
  (typeof window !== 'undefined' && window.__ENV__?.VITE_CLERK_PUBLISHABLE_KEY) ||
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  'pk_test_ZHluYW1pYy1lYWdsZS0zODU5LmNsZXJrLmFjY291bnRzLmRldiQ';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30 seconds
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

/**
 * Root App component.
 * Sets up: TanStack Query, React Router, theme initialization.
 *
 * NOTE: Clerk auth is commented out for MVP local development.
 * Uncomment and wrap with <ClerkProvider> when Clerk keys are configured.
 */
function AppContent() {
  // Initialize theme on mount
  useTheme();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <SignedIn>
              <HomePage />
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        }
      />
      <Route
        path="/chat/:chatId"
        element={
          <>
            <SignedIn>
              <ChatPage />
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        }
      />
    </Routes>
  );
}

function AppRoutes() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
