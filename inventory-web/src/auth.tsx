import { useState } from 'react';
import type { ReactNode } from 'react';

// WEB-008 — dev-stub auth gate. Local-only name entry, session-scoped. NOTHING
// renders before the gate passes. In Azure this slot is replaced by Entra ID
// (DEC-002). This is explicitly NOT a production auth mechanism.

const SESSION_KEY = 'inventory-web.devUser';

export function useDevUser(): [string | null, (name: string) => void, () => void] {
  const [user, setUser] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });

  const signIn = (name: string) => {
    try {
      sessionStorage.setItem(SESSION_KEY, name);
    } catch {
      /* sessionStorage unavailable — fall back to in-memory state only */
    }
    setUser(name);
  };

  const signOut = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  };

  return [user, signIn, signOut];
}

export function AuthGate({
  user,
  onSignIn,
  children,
}: {
  user: string | null;
  onSignIn: (name: string) => void;
  children: ReactNode;
}) {
  if (user) return <>{children}</>;
  return <NameEntry onSubmit={onSignIn} />;
}

function NameEntry({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();

  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onSubmit(trimmed);
        }}
      >
        <h1>Inventory Dashboard</h1>
        <div className="sub">Analytics &amp; Project Search</div>

        <div className="field">
          <label htmlFor="dev-name">Your name</label>
          <input
            id="dev-name"
            type="text"
            autoFocus
            placeholder="e.g. Jordan Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={!trimmed}>
          Enter dashboard
        </button>

        <div className="dev-note">
          Dev-stub sign-in — NOT production authentication. Session-only; replaced by
          Entra ID in Azure (DEC-002).
        </div>
      </form>
    </div>
  );
}
