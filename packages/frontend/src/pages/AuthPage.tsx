import { SignIn } from '@clerk/clerk-react';
import './AuthPage.css';

/**
 * Embedded Auth Page — renders in-app Sign In without redirecting to Clerk hosted URLs.
 */
export function AuthPage() {
  return (
    <div className="auth-page-container">
      <div className="auth-card-wrapper animate-fade-in">
        <div className="auth-brand-header">
          <div className="auth-logo-badge">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              <path d="m15 5 3 3" />
            </svg>
          </div>
          <h1 className="auth-title font-heading">Chalk</h1>
          <p className="auth-subtitle text-secondary text-sm">
            Sign in to access your course workspaces and lecture notes.
          </p>
        </div>

        <div className="auth-clerk-wrapper">
          <SignIn routing="hash" />
        </div>
      </div>
    </div>
  );
}
