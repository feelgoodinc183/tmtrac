import React, { useState } from 'react';
import { X, Lock, KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';
import { roomService } from '../services/roomService';

interface PinUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  onSuccess: () => void;
}

export const PinUnlockModal: React.FC<PinUnlockModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setIsVerifying(true);
    setError(null);
    try {
      const result = await roomService.verifyPin(pin.trim(), roomCode);
      if (result.isAdmin) {
        onSuccess();
        onClose();
      } else {
        setError('Incorrect Race Officer PIN. Please try again.');
      }
    } catch (e: any) {
      setError(e.message || 'Error verifying PIN');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-lb-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm bg-lb-060b16 border border-ll-amber-500/40 rounded-2xl shadow-2xl p-5 text-lt-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-lb-amber-500/20 border border-ll-amber-500/40 flex items-center justify-center text-lt-amber-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm font-google">Race Officer Authority</h3>
              <p className="text-xs font-mono text-lt-slate-400">Room #{roomCode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-lt-slate-400 hover:text-lt-white hover:bg-lb-1e293b"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-mono text-lt-slate-300 mb-1.5">
              Enter 4-Digit Committee PIN
            </label>
            <input
              type="password"
              autoFocus
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-digit PIN"
              className="w-full bg-lb-0a0f1e border border-ll-1e293b focus:border-ll-amber-400 rounded-xl px-3.5 py-2.5 text-center text-xl tracking-widest font-mono font-bold text-lt-amber-300 placeholder:text-lt-slate-600 focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-2 rounded bg-lb-rose-500/15 border border-ll-rose-500/30 text-lt-rose-300 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 rounded-xl bg-lb-1e293b hover:bg-lb-slate-700 text-xs font-mono font-bold text-lt-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || !pin}
              className="w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-lb-amber-500 to-lb-amber-600 hover:opacity-90 text-lt-black text-xs font-mono font-bold flex items-center justify-center gap-1.5 shadow-md shadow-ll-amber-500/20 transition-all disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isVerifying ? 'Verifying...' : 'Unlock RC'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
