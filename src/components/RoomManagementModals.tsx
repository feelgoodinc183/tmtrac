import React, { useState, useId } from 'react';
import { KeyRound, Trash2, X, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { roomService } from '../services/roomService';
import { DialogFrame } from './ui/Dialog';

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
  const titleId = useId();
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

    if (newPin.trim().length < 4) {
      setError('New PIN must be 4 to 12 letters or digits.');
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
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      closeOnBackdrop
      overlayId="room-pin-modal-backdrop"
      id="room-pin-modal-card"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 backdrop-blur-sm"
      className="bg-surface border border-line rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-ink p-5 sm:p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning-ink/20 border border-warning-ink/30 flex items-center justify-center text-warning-ink">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 id={titleId} className="text-base sm:text-lg font-bold text-ink">
              Edit Room PIN
            </h3>
            <p className="text-xs text-ink-muted">
              {roomTitle || `Room #${roomCode}`}
            </p>
          </div>
        </div>
        <button
          aria-label="Close"
          id="close-pin-modal-btn"
          onClick={onClose}
          className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-raised"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {isOwner && (
        <div className="mb-4 p-2.5 bg-surface/40 border border-success-ink/40 rounded-xl text-xs text-success-ink flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-success-ink" />
          <span>You are authenticated as the organizer/owner of this room.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-2.5 bg-surface/60 border border-danger-ink/60 text-danger-ink text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-2.5 bg-surface/60 border border-success-ink/60 text-success-ink text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isOwner && (
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Current Admin PIN
            </label>
            <input
              id="current-pin-input"
              type="password"
              required
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              placeholder="Enter current room PIN"
              className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-warning-ink"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-ink mb-1.5">
            New Admin PIN
          </label>
          <input
            id="new-pin-input"
            type="text"
            required
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="New PIN (4+ characters)"
            className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-warning-ink"
          />
          <p className="text-xs text-ink-muted mt-1">
            Race Committee members will use this PIN to access organizer controls.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            id="cancel-pin-btn"
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-xs sm:text-sm font-semibold text-ink-muted hover:text-ink bg-raised hover:bg-slate-750 rounded-xl"
          >
            Cancel
          </button>
          <button
            id="save-new-pin-btn"
            type="submit"
            disabled={loading}
            className="flex-1 py-2 text-xs sm:text-sm font-semibold text-canvas bg-warning-ink hover:brightness-110 disabled:opacity-50 rounded-xl transition-all shadow"
          >
            {loading ? 'Updating...' : 'Save New PIN'}
          </button>
        </div>
      </form>
    </DialogFrame>
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
  const titleId = useId();
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
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      closeOnBackdrop
      role="alertdialog"
      overlayId="room-delete-modal-backdrop"
      id="room-delete-modal-card"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 backdrop-blur-sm"
      className="bg-surface border border-danger-ink/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-ink p-5 sm:p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger/20 border border-danger-ink/30 flex items-center justify-center text-danger-ink">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 id={titleId} className="text-base sm:text-lg font-bold text-ink">
              Delete Regatta Room
            </h3>
            <p className="text-xs text-danger-ink">
              Permanent action: Room #{roomCode}
            </p>
          </div>
        </div>
        <button
          aria-label="Close"
          id="close-delete-modal-btn"
          onClick={onClose}
          className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-raised"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-3 bg-surface/30 border border-danger-ink/40 rounded-xl mb-4 text-xs text-danger-ink">
        <p className="font-semibold mb-1">Warning: Regatta data will be terminated.</p>
        <p className="text-ink">
          Deleting <strong>{roomTitle || `Room #${roomCode}`}</strong> will immediately disconnect any active race participants and discard all in-progress courses, tracker telemetry, and broadcasts.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-2.5 bg-surface/60 border border-danger-ink/60 text-danger-ink text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleDelete} className="space-y-4">
        {!isOwner && (
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Admin PIN Confirmation
            </label>
            <input
              id="delete-pin-input"
              type="password"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter room Admin PIN to authorize"
              className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-danger-ink"
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            id="cancel-delete-btn"
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-xs sm:text-sm font-semibold text-ink-muted hover:text-ink bg-raised hover:bg-slate-750 rounded-xl"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-room-btn"
            type="submit"
            disabled={loading}
            className="flex-1 py-2 text-xs sm:text-sm font-semibold text-on-danger bg-danger hover:brightness-110 disabled:opacity-50 rounded-xl transition-all shadow flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            {loading ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
};
