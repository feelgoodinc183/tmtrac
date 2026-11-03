import React, { useState } from 'react';
import { KeyRound, Trash2, X, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { roomService } from '../services/roomService';
import { authService } from '../services/authService';

interface RoomPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  roomTitle?: string;
  isOwner?: boolean;
  onUpdated?: () => void;
}

export const RoomPinModal: React.FC<RoomPinModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  roomTitle,
  isOwner = false,
  onUpdated,
}) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPin.trim().length < 3) {
      setError('New PIN must be at least 3 digits or characters.');
      return;
    }

    setLoading(true);
    const res = await roomService.updateRoomPin(roomCode, newPin.trim(), isOwner ? undefined : currentPin.trim());
    setLoading(false);

    if (res.success) {
      setSuccess(`Room #${roomCode} PIN was successfully updated.`);
      setTimeout(() => {
        onUpdated?.();
        onClose();
      }, 1000);
    } else {
      setError(res.error || 'Failed to update PIN. Please verify credentials.');
    }
  };

  return (
    <div
      id="room-pin-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="room-pin-modal-card"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-100 p-5 sm:p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Edit Room PIN
              </h3>
              <p className="text-xs text-slate-400">
                {roomTitle || `Room #${roomCode}`}
              </p>
            </div>
          </div>
          <button
            id="close-pin-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isOwner && (
          <div className="mb-4 p-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>You are authenticated as the organizer/owner of this room.</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-2.5 bg-red-950/60 border border-red-800/60 text-red-300 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-2.5 bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isOwner && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Current Admin PIN
              </label>
              <input
                id="current-pin-input"
                type="password"
                required
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="Enter current room PIN"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              New Admin PIN
            </label>
            <input
              id="new-pin-input"
              type="text"
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="New PIN (4+ characters)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Race Committee members will use this PIN to access organizer controls.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              id="cancel-pin-btn"
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl"
            >
              Cancel
            </button>
            <button
              id="save-new-pin-btn"
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-xs sm:text-sm font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-xl transition-all shadow"
            >
              {loading ? 'Updating...' : 'Save New PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface RoomDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  roomTitle?: string;
  isOwner?: boolean;
  onDeleted?: () => void;
}

export const RoomDeleteModal: React.FC<RoomDeleteModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  roomTitle,
  isOwner = false,
  onDeleted,
}) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await roomService.deleteRoom(roomCode, isOwner ? undefined : pin);
    setLoading(false);

    if (res.success) {
      onDeleted?.();
      onClose();
    } else {
      setError(res.error || 'Failed to delete room. Check your authorization PIN.');
    }
  };

  return (
    <div
      id="room-delete-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="room-delete-modal-card"
        className="bg-slate-900 border border-red-900/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-100 p-5 sm:p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Delete Regatta Room
              </h3>
              <p className="text-xs text-red-300">
                Permanent action: Room #{roomCode}
              </p>
            </div>
          </div>
          <button
            id="close-delete-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl mb-4 text-xs text-red-200">
          <p className="font-semibold mb-1">Warning: Regatta data will be terminated.</p>
          <p className="text-slate-300">
            Deleting <strong>{roomTitle || `Room #${roomCode}`}</strong> will immediately disconnect any active race participants and discard all in-progress courses, tracker telemetry, and broadcasts.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-950/60 border border-red-800/60 text-red-300 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleDelete} className="space-y-4">
          {!isOwner && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin PIN Confirmation
              </label>
              <input
                id="delete-pin-input"
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter room Admin PIN to authorize"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              id="cancel-delete-btn"
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl"
            >
              Cancel
            </button>
            <button
              id="confirm-delete-room-btn"
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl transition-all shadow flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {loading ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
