import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  QrCode,
  Copy,
  Check,
  Printer,
  ExternalLink,
  Anchor,
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
      className="fixed inset-0 z-[120] bg-lb-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        id="boat-checkin-qr-card"
        className="bg-lb-0a101d border border-ll-1e293b rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-ll-1e293b bg-lb-0f172a/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-lb-00d4ff/20 text-lt-00d4ff border border-ll-00d4ff/40 flex items-center justify-center shrink-0 shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-google text-lt-white tracking-wide flex items-center gap-2">
                Smart Boat QR Code
              </h2>
              <p className="text-xs text-lt-slate-400 font-mono">
                Zero-Configuration 1-Scan Auto-Binding for Skippers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-lt-slate-400 hover:text-lt-white rounded-xl hover:bg-lb-slate-800/80 transition-colors"
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
                <label className="block text-xs font-mono font-bold text-lt-slate-300 uppercase tracking-wider">
                  Select Fleet Boat:
                </label>
                {isAdmin && boats.some((b) => b.nodeId) && (
                  <button
                    type="button"
                    onClick={() => setShowBoundBoats((prev) => !prev)}
                    className="text-xs font-mono text-lt-00d4ff hover:underline cursor-pointer"
                  >
                    {showBoundBoats ? 'Showing All (Toggle Unbound Only)' : `Show All (${boats.length} boats)`}
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  value={selectedBoatId}
                  onChange={(e) => setSelectedBoatId(e.target.value)}
                  className="w-full appearance-none bg-lb-131e32 border border-ll-233554 rounded-2xl px-3.5 py-2.5 text-sm text-lt-white font-mono focus:outline-none focus:border-ll-00d4ff pr-10"
                >
                  {displayBoats.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.sailNumber} - {b.name} ({b.class}) {b.nodeId ? `• [Bound: ${b.nodeId}]` : '• [Available]'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-lt-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {boats.length === 0 ? (
            <div className="p-6 text-center text-lt-slate-400 font-mono text-sm bg-lb-slate-900/50 rounded-2xl border border-ll-slate-800">
              <AlertTriangle className="w-8 h-8 text-lt-amber-400 mx-auto mb-2 opacity-80" />
              No boats registered in this fleet yet. Add boats to generate individual skipper check-in QR codes.
            </div>
          ) : !isAdmin && displayBoats.length === 0 ? (
            <div className="p-6 text-center text-lt-slate-300 font-mono text-xs bg-lb-slate-900/60 rounded-2xl border border-ll-amber-500/30 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-lt-00d4ff mx-auto opacity-90" />
              <p className="font-bold text-lt-white text-sm">All Fleet Vessels Are Already Bound</p>
              <p className="text-lt-slate-400 max-w-sm mx-auto leading-relaxed">
                All {boats.length} registered boats are actively linked to trackers. Bound vessels are hidden to prevent accidental re-binding. If you need to reassign or unbind a vessel, contact the Race Committee Admin.
              </p>
            </div>
          ) : selectedBoat ? (
            <>
              {/* QR Card Container */}
              <div className="flex flex-col items-center bg-gradient-to-b from-lb-0f172a to-lb-0a101d border border-ll-slate-800 rounded-3xl p-5 text-center shadow-lg">
                {/* Boat Header Info */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-sm"
                    style={{ backgroundColor: selectedBoat.color || '#00D4FF' }}
                  />
                  <span className="text-base font-black text-lt-white font-google tracking-wide">
                    {selectedBoat.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-lb-00d4ff/10 text-lt-00d4ff border border-ll-00d4ff/30 text-xs font-mono font-bold">
                    {selectedBoat.sailNumber}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mb-4 text-xs font-mono text-lt-slate-400">
                  <span className="px-2 py-0.5 rounded bg-lb-slate-800 text-lt-slate-300">
                    Class: {selectedBoat.class}
                  </span>
                  {selectedBoat.skipper && (
                    <span className="px-2 py-0.5 rounded bg-lb-slate-800 text-lt-slate-300">
                      Skipper: {selectedBoat.skipper}
                    </span>
                  )}
                  {selectedBoat.nodeId ? (
                    <span className="px-2 py-0.5 rounded bg-lb-1e8e3e/20 text-lt-81c995 border border-ll-1e8e3e/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Bound: {selectedBoat.nodeId}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-lb-amber-500/10 text-lt-amber-400 border border-ll-amber-500/30 flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Ready to Bind
                    </span>
                  )}
                </div>

                {/* Printable QR Code Display */}
                <div className="p-4 bg-lb-white rounded-3xl shadow-2xl border-4 border-ll-00d4ff/40 mb-3 relative group">
                  {isGenerating || !qrDataUrl ? (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-lt-slate-400 font-mono text-xs">
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

                <p className="text-xs text-lt-slate-400 font-mono max-w-sm leading-relaxed mt-1">
                  Skipper scans with their phone's native camera. Opens directly to boat check-in with <strong className="text-lt-slate-200">1-tap live GPS tracking</strong>.
                </p>
              </div>

              {/* Direct URL Box */}
              <div className="bg-lb-070d18 border border-ll-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs font-mono gap-2">
                <span className="text-lt-slate-400 truncate select-all">{directLink}</span>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-xl bg-lb-00d4ff/20 hover:bg-lb-00d4ff/30 text-lt-00d4ff font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  title="Copy direct join link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-lt-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  id="btn-print-skipper-card"
                  onClick={handlePrint}
                  className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-lb-slate-800/90 to-lb-slate-800/70 hover:from-lb-slate-700 hover:to-lb-slate-700/90 active:scale-[0.98] text-lt-slate-100 hover:text-lt-white font-mono font-bold text-xs flex items-center justify-center gap-2 border border-ll-slate-700 hover:border-ll-00d4ff/40 shadow-sm transition-all cursor-pointer group"
                  title="Print waterproof Skipper Check-In QR card or save as PDF"
                >
                  <Printer className="w-4 h-4 text-lt-00d4ff group-hover:scale-110 transition-transform" />
                  <span>Print Card</span>
                </button>

                {onOpenCheckInForBoat && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenCheckInForBoat(selectedBoat.id);
                    }}
                    className="py-2.5 px-3 rounded-2xl bg-lb-00d4ff/20 hover:bg-lb-00d4ff/30 text-lt-00d4ff font-mono font-bold text-xs flex items-center justify-center gap-2 border border-ll-00d4ff/40 transition-all"
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
