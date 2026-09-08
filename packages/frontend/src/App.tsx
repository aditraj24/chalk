import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { useTheme } from './hooks/useTheme';

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
      <Route path="/" element={<HomePage />} />
      <Route path="/chat/:chatId" element={<ChatPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/*
          TODO: Wrap with ClerkProvider when Clerk keys are configured
          <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
        */}
        <AppContent />
        {/* </ClerkProvider> */}
      </BrowserRouter>
    </QueryClientProvider>
  );
}
