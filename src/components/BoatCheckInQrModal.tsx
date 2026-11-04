import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  QrCode,
  Copy,
  Check,
  Printer,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Link2,
  ChevronDown,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Boat } from '../types/regatta';
import { roomService } from '../services/roomService';

interface BoatCheckInQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  boats: Boat[];
  initialBoatId?: string | null;
  selectedBoatId?: string;
  activeRoomCode: string;
  onOpenCheckInForBoat?: (boatId: string) => void;
  isAdmin?: boolean;
}

export const BoatCheckInQrModal: React.FC<BoatCheckInQrModalProps> = ({
  isOpen,
  onClose,
  boats,
  initialBoatId,
  selectedBoatId: propSelectedBoatId,
  activeRoomCode,
  onOpenCheckInForBoat,
  isAdmin = false,
}) => {
  const [showBoundBoats, setShowBoundBoats] = useState<boolean>(isAdmin);

  // For non-admin users: hide fleet boats that are already bound so they don't accidentally re-bind!
  // For admins: show unbound by default or toggle to view all boats
  const displayBoats = useMemo(() => {
    if (!isAdmin) {
      return boats.filter((b) => !b.nodeId || b.nodeId.trim() === '');
    }
    return showBoundBoats ? boats : boats.filter((b) => !b.nodeId || b.nodeId.trim() === '');
  }, [boats, isAdmin, showBoundBoats]);

  const effectiveInitialId = propSelectedBoatId || initialBoatId;

  const [selectedBoatId, setSelectedBoatId] = useState<string>(() => {
    if (effectiveInitialId && displayBoats.some((b) => b.id === effectiveInitialId)) {
      return effectiveInitialId;
    }
    return displayBoats[0]?.id || '';
  });

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  // The room's participant PIN goes into the link so a scanning phone may send its boat's GPS.
  // Only people who can edit the room get it back from the server.
  const [participantPin, setParticipantPin] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !isAdmin || !activeRoomCode) {
      setParticipantPin('');
      return;
    }
    let cancelled = false;
    roomService.fetchRoomPins(activeRoomCode).then((pins) => {
      if (!cancelled) setParticipantPin(pins?.participantPin || '');
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isAdmin, activeRoomCode]);

  // Sync selected boat if initialBoatId or displayBoats change
  useEffect(() => {
    if (effectiveInitialId && displayBoats.some((b) => b.id === effectiveInitialId)) {
      setSelectedBoatId(effectiveInitialId);
    } else if (!displayBoats.some((b) => b.id === selectedBoatId) && displayBoats.length > 0) {
      setSelectedBoatId(displayBoats[0].id);
    }
  }, [effectiveInitialId, displayBoats, selectedBoatId]);

  const selectedBoat = useMemo(() => {
    return displayBoats.find((b) => b.id === selectedBoatId) || displayBoats[0] || null;
  }, [displayBoats, selectedBoatId]);

  // Generate direct join link with room and boat identifier
  const directLink = useMemo(() => {
    if (!selectedBoat) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://regatta.marine.app';
    const params = new URLSearchParams();
    if (activeRoomCode) {
      params.set('room', activeRoomCode);
    }
    params.set('boat', selectedBoat.id);
    if (selectedBoat.sailNumber) {
      params.set('sail', selectedBoat.sailNumber);
    }
    if (participantPin) {
      params.set('pin', participantPin);
    }
    return `${origin}/?${params.toString()}`;
  }, [selectedBoat, activeRoomCode, participantPin]);

  // Generate real scannable QR Code
  useEffect(() => {
    if (!directLink) return;
    setIsGenerating(true);
    QRCode.toDataURL(directLink, {
      width: 400,
      margin: 2,
      color: {
        dark: '#020408',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url: string) => {
        setQrDataUrl(url);
        setIsGenerating(false);
      })
      .catch((err: unknown) => {
        console.error('Failed to generate boat QR code:', err);
        setIsGenerating(false);
      });
  }, [directLink]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!directLink) return;
    navigator.clipboard.writeText(directLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="boat-checkin-qr-backdrop"
      className="fixed inset-0 z-[120] bg-canvas/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        id="boat-checkin-qr-card"
        className="bg-surface border border-line rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line bg-surface/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/20 text-accent border border-accent/40 flex items-center justify-center shrink-0 shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
                Smart Boat QR Code
              </h2>
              <p className="text-xs text-ink-muted">
                Zero-Configuration 1-Scan Auto-Binding for Skippers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-ink-muted hover:text-ink rounded-xl hover:bg-raised/80 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
          {/* Boat Selector */}
          {displayBoats.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-ink">
                  Select Fleet Boat:
                </label>
                {isAdmin && boats.some((b) => b.nodeId) && (
                  <button
                    type="button"
                    onClick={() => setShowBoundBoats((prev) => !prev)}
                    className="text-xs text-accent hover:underline cursor-pointer"
                  >
                    {showBoundBoats ? 'Showing All (Toggle Unbound Only)' : `Show All (${boats.length} boats)`}
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  value={selectedBoatId}
                  onChange={(e) => setSelectedBoatId(e.target.value)}
                  className="w-full appearance-none bg-raised border border-accent rounded-2xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-accent pr-10"
                >
                  {displayBoats.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.sailNumber} - {b.name} ({b.class}) {b.nodeId ? `• [Bound: ${b.nodeId}]` : '• [Available]'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {boats.length === 0 ? (
            <div className="p-6 text-center text-ink-muted text-sm bg-surface/50 rounded-2xl border border-line">
              <AlertTriangle className="w-8 h-8 text-warning-ink mx-auto mb-2 opacity-80" />
              No boats registered in this fleet yet. Add boats to generate individual skipper check-in QR codes.
            </div>
          ) : !isAdmin && displayBoats.length === 0 ? (
            <div className="p-6 text-center text-ink text-xs bg-surface/60 rounded-2xl border border-warning-ink/30 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-accent mx-auto opacity-90" />
              <p className="font-bold text-ink text-sm">All Fleet Vessels Are Already Bound</p>
              <p className="text-ink-muted max-w-sm mx-auto leading-relaxed">
                All {boats.length} registered boats are actively linked to trackers. Bound vessels are hidden to prevent accidental re-binding. If you need to reassign or unbind a vessel, contact the Race Committee Admin.
              </p>
            </div>
          ) : selectedBoat ? (
            <>
              {/* QR Card Container */}
              <div className="flex flex-col items-center bg-gradient-to-b from-surface to-surface border border-line rounded-3xl p-5 text-center shadow-lg">
                {/* Boat Header Info */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-sm"
                    style={{ backgroundColor: selectedBoat.color || '#00D4FF' }}
                  />
                  <span className="text-base font-black text-ink">
                    {selectedBoat.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/30 text-xs font-bold">
                    {selectedBoat.sailNumber}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mb-4 text-xs text-ink-muted">
                  <span className="px-2 py-0.5 rounded bg-raised text-ink">
                    Class: {selectedBoat.class}
                  </span>
                  {selectedBoat.skipper && (
                    <span className="px-2 py-0.5 rounded bg-raised text-ink">
                      Skipper: {selectedBoat.skipper}
                    </span>
                  )}
                  {selectedBoat.nodeId ? (
                    <span className="px-2 py-0.5 rounded bg-success-ink/20 text-success-ink border border-success-ink/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Bound: {selectedBoat.nodeId}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-warning-ink/10 text-warning-ink border border-warning-ink/30 flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Ready to Bind
                    </span>
                  )}
                </div>

                {/* Printable QR Code Display */}
                <div className="p-4 bg-ink rounded-3xl shadow-2xl border-4 border-accent/40 mb-3 relative group">
                  {isGenerating || !qrDataUrl ? (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-ink-muted text-xs">
                      Generating QR...
                    </div>
                  ) : (
                    <img
                      src={qrDataUrl}
                      alt={`Check-in QR for ${selectedBoat.name}`}
                      className="w-48 h-48 sm:w-56 sm:h-56 object-contain block"
                    />
                  )}
                </div>

                <p className="text-xs text-ink-muted max-w-sm leading-relaxed mt-1">
                  Skipper scans with their phone's native camera. Opens directly to boat check-in with <strong className="text-ink">1-tap live GPS tracking</strong>.
                </p>
              </div>

              {/* Direct URL Box */}
              <div className="bg-canvas border border-line rounded-2xl p-3 flex items-center justify-between text-xs gap-2">
                <span className="text-ink-muted truncate select-all">{directLink}</span>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  title="Copy direct join link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-success-ink" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  id="btn-print-skipper-card"
                  onClick={handlePrint}
                  className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-raised/90 to-raised/70 hover:from-raised hover:to-raised/90 active:scale-[0.98] text-ink hover:text-ink font-bold text-xs flex items-center justify-center gap-2 border border-line hover:border-accent/40 shadow-sm transition-all cursor-pointer group"
                  title="Print waterproof Skipper Check-In QR card or save as PDF"
                >
                  <Printer className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                  <span>Print Card</span>
                </button>

                {onOpenCheckInForBoat && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenCheckInForBoat(selectedBoat.id);
                    }}
                    className="py-2.5 px-3 rounded-2xl bg-accent/20 hover:bg-accent/30 text-accent font-bold text-xs flex items-center justify-center gap-2 border border-accent/40 transition-all"
                    title="Test or trigger check-in flow directly"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Test Check-In</span>
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
