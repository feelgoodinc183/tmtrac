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
    return `${origin}/?${params.toString()}`;
  }, [selectedBoat, activeRoomCode]);

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
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        id="boat-checkin-qr-card"
        className="bg-[#0A101D] border border-[#1E293B] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#1E293B] bg-[#0F172A]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 flex items-center justify-center shrink-0 shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-google text-white tracking-wide flex items-center gap-2">
                Smart Boat QR Code
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Zero-Configuration 1-Scan Auto-Binding for Skippers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
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
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Select Fleet Boat:
                </label>
                {isAdmin && boats.some((b) => b.nodeId) && (
                  <button
                    type="button"
                    onClick={() => setShowBoundBoats((prev) => !prev)}
                    className="text-[10px] font-mono text-[#00D4FF] hover:underline cursor-pointer"
                  >
                    {showBoundBoats ? 'Showing All (Toggle Unbound Only)' : `Show All (${boats.length} boats)`}
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  value={selectedBoatId}
                  onChange={(e) => setSelectedBoatId(e.target.value)}
                  className="w-full appearance-none bg-[#131E32] border border-[#233554] rounded-2xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#00D4FF] pr-10"
                >
                  {displayBoats.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.sailNumber} - {b.name} ({b.class}) {b.nodeId ? `• [Bound: ${b.nodeId}]` : '• [Available]'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {boats.length === 0 ? (
            <div className="p-6 text-center text-slate-400 font-mono text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-80" />
              No boats registered in this fleet yet. Add boats to generate individual skipper check-in QR codes.
            </div>
          ) : !isAdmin && displayBoats.length === 0 ? (
            <div className="p-6 text-center text-slate-300 font-mono text-xs bg-slate-900/60 rounded-2xl border border-amber-500/30 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#00D4FF] mx-auto opacity-90" />
              <p className="font-bold text-white text-sm">All Fleet Vessels Are Already Bound</p>
              <p className="text-slate-400 max-w-sm mx-auto leading-relaxed">
                All {boats.length} registered boats are actively linked to trackers. Bound vessels are hidden to prevent accidental re-binding. If you need to reassign or unbind a vessel, contact the Race Committee Admin.
              </p>
            </div>
          ) : selectedBoat ? (
            <>
              {/* QR Card Container */}
              <div className="flex flex-col items-center bg-gradient-to-b from-[#0F172A] to-[#0A101D] border border-slate-800 rounded-3xl p-5 text-center shadow-lg">
                {/* Boat Header Info */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-sm"
                    style={{ backgroundColor: selectedBoat.color || '#00D4FF' }}
                  />
                  <span className="text-base font-black text-white font-google tracking-wide">
                    {selectedBoat.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30 text-xs font-mono font-bold">
                    {selectedBoat.sailNumber}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mb-4 text-xs font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Class: {selectedBoat.class}
                  </span>
                  {selectedBoat.skipper && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Skipper: {selectedBoat.skipper}
                    </span>
                  )}
                  {selectedBoat.nodeId ? (
                    <span className="px-2 py-0.5 rounded bg-[#1E8E3E]/20 text-[#81C995] border border-[#1E8E3E]/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Bound: {selectedBoat.nodeId}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Ready to Bind
                    </span>
                  )}
                </div>

                {/* Printable QR Code Display */}
                <div className="p-4 bg-white rounded-3xl shadow-2xl border-4 border-[#00D4FF]/40 mb-3 relative group">
                  {isGenerating || !qrDataUrl ? (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-slate-400 font-mono text-xs">
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

                <p className="text-xs text-slate-400 font-mono max-w-sm leading-relaxed mt-1">
                  Skipper scans with their phone's native camera. Opens directly to boat check-in with <strong className="text-slate-200">1-tap live GPS tracking</strong>.
                </p>
              </div>

              {/* Direct URL Box */}
              <div className="bg-[#070D18] border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs font-mono gap-2">
                <span className="text-slate-400 truncate select-all">{directLink}</span>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-xl bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 text-[#00D4FF] font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  title="Copy direct join link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  id="btn-print-skipper-card"
                  onClick={handlePrint}
                  className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-slate-800/90 to-slate-800/70 hover:from-slate-700 hover:to-slate-700/90 active:scale-[0.98] text-slate-100 hover:text-white font-mono font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 hover:border-[#00D4FF]/40 shadow-sm transition-all cursor-pointer group"
                  title="Print waterproof Skipper Check-In QR card or save as PDF"
                >
                  <Printer className="w-4 h-4 text-[#00D4FF] group-hover:scale-110 transition-transform" />
                  <span>Print Card</span>
                </button>

                {onOpenCheckInForBoat && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenCheckInForBoat(selectedBoat.id);
                    }}
                    className="py-2.5 px-3 rounded-2xl bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 text-[#00D4FF] font-mono font-bold text-xs flex items-center justify-center gap-2 border border-[#00D4FF]/40 transition-all"
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
