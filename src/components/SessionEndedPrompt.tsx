import React, { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { authService } from '../services/authService';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';

/**
 * Shown when the server stops accepting this device's login (expired, password changed, or the
 * account was signed out by an admin). It sits on top of whatever was open, so unsaved work in a
 * dialog underneath is kept while the user signs in again.
 */
export const SessionEndedPrompt: React.FC = () => {
  const [ended, setEnded] = useState(authService.isSessionEnded());
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => authService.onSessionEndedChange(setEnded), []);
  useEffect(() => {
    if (!ended) {
      setPassword('');
      setError(null);
    }
  }, [ended]);

  const email = authService.getCurrentUser()?.email;

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    const result = await authService.login(email, password);
    setBusy(false);
    if (!result.success) setError(result.error || 'That password was not accepted.');
  };

  return (
    <Dialog
      open={ended}
      role="alertdialog"
      layer="system"
      dismissible={false}
      onClose={() => {}}
      title="You've been signed out"
      description="Your session on this device has ended. It may have expired, or the password was changed. Anything you were editing is still open behind this message."
      error={error}
      footer={
        email ? (
          <>
            <Button onClick={() => authService.logout()}>Continue signed out</Button>
            <Button
              variant="primary"
              type="submit"
              form="session-ended-form"
              icon={<LogIn />}
              disabled={!password}
              loading={busy}
              loadingLabel="Signing in…"
            >
              Sign in again
            </Button>
          </>
        ) : (
          <Button onClick={() => authService.logout()}>OK</Button>
        )
      }
    >
      {email && (
        <form id="session-ended-form" onSubmit={signIn} className="space-y-2">
          <label htmlFor="session-ended-password" className="block text-sm text-ink-muted">
            Password for {email}
          </label>
          <input
            id="session-ended-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-11 rounded-control border border-line bg-canvas px-3 text-ink"
          />
        </form>
      )}
    </Dialog>
  );
};
