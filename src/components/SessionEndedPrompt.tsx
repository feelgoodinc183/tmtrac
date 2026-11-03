import React, { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { authService } from '../services/authService';

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

  if (!ended) return null;
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
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-ended-title"
        aria-describedby="session-ended-body"
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl"
      >
        <h2 id="session-ended-title" className="text-base font-bold text-white">
          You've been signed out
        </h2>
        <p id="session-ended-body" className="mt-2 text-sm leading-relaxed text-slate-300">
          Your session on this device has ended. It may have expired, or the password was changed. Anything you were
          editing is still open behind this message.
        </p>

        {email ? (
          <form onSubmit={signIn} className="mt-4 space-y-2">
            <label htmlFor="session-ended-password" className="block text-sm text-slate-300">
              Password for {email}
            </label>
            <input
              id="session-ended-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-slate-600 bg-slate-950 px-3 text-white"
            />
            {error && (
              <p role="alert" className="text-sm text-rose-300">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => authService.logout()}
                className="min-h-[44px] rounded-lg bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-600"
              >
                Continue signed out
              </button>
              <button
                type="submit"
                disabled={busy || !password}
                className="min-h-[44px] rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 flex items-center gap-2"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {busy ? 'Signing in…' : 'Sign in again'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => authService.logout()}
              className="min-h-[44px] rounded-lg bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-600"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
