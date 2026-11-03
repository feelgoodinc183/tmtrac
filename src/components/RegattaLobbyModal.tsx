import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  Eye,
  PlusCircle,
  Users,
  Radio,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Lock,
  Unlock,
  AlertCircle,
  Search,
  Sparkles,
  MapPin,
  Flag,
  Ship,
  User,
  LogIn,
  Trash2,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { RegattaRoomSummary, UserAccount } from '../types/regatta';
import { roomService } from '../services/roomService';
import { APP_VERSION } from '../appVersion';

interface RegattaLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoomCode: string;
  isOrganizer: boolean;
  viewMode: 'RC_CONSOLE' | 'SPECTATOR';
  onSetViewMode: (mode: 'RC_CONSOLE' | 'SPECTATOR') => void;
  connectedPeerCount: number;
  currentUser?: UserAccount | null;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onOpenDashboard?: () => void;
}

export const RegattaLobbyModal: React.FC<RegattaLobbyModalProps> = ({
  isOpen,
  onClose,
  activeRoomCode,
  isOrganizer,
  viewMode,
  onSetViewMode,
  connectedPeerCount,
  currentUser,
  onOpenAuth,
  onOpenDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<'JOIN' | 'CREATE'>('JOIN');
  const [joinCodeInput, setJoinCodeInput] = useState(activeRoomCode || '');
  const [joinPinInput, setJoinPinInput] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [publicRooms, setPublicRooms] = useState<RegattaRoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // New Room Creation Form State
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Load public rooms and default to active room on open, with Escape key dismiss
  useEffect(() => {
    if (isOpen) {
      loadRooms();
      setErrorMessage(null);
      setSuccessMessage(null);
      if (activeRoomCode) {
        setJoinCodeInput(activeRoomCode);
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, activeRoomCode, onClose]);

  const loadRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const rooms = await roomService.fetchPublicRooms();
      setPublicRooms(rooms);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  if (!isOpen) return null;

  const handleJoinSpectator = async (codeToJoin = joinCodeInput) => {
    setErrorMessage(null);
    const code = codeToJoin.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!code) {
      setErrorMessage('Please enter a valid room code.');
      return;
    }

    // Verify room code validity before allowing entry
    const val = await roomService.validateRoomCode(code);
    if (!val.valid) {
      setErrorMessage(val.error || `Regatta room code "${code}" does not exist. Please check the code.`);
      return;
    }

    const success = await roomService.switchRoom(code, undefined, true);
    if (success) {
      onSetViewMode('SPECTATOR');
      setSuccessMessage(`Joined room #${code} as Spectator.`);
      setTimeout(() => {
        onClose();
      }, 500);
    } else {
      setErrorMessage('Could not connect to room. Please check the room code.');
    }
  };

  const handleJoinOrganizer = async (codeToJoin = joinCodeInput) => {
    setErrorMessage(null);
    const code = codeToJoin.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!code) {
      setErrorMessage('Please enter a room code.');
      return;
    }

    // Verify room code validity before requesting PIN
    const val = await roomService.validateRoomCode(code);
    if (!val.valid) {
      setErrorMessage(val.error || `Regatta room code "${code}" does not exist. Please check the code.`);
      return;
    }

    if (!joinPinInput) {
      setShowPinInput(true);
      setErrorMessage('Enter the 4-digit Race Officer PIN to access the RC Console.');
      return;
    }
    const verified = await roomService.verifyPin(joinPinInput, code);
    if (verified.valid && verified.isAdmin) {
      await roomService.switchRoom(code, joinPinInput, false);
      onSetViewMode('RC_CONSOLE');
      setSuccessMessage(`Race Officer Admin unlocked for #${code}!`);
      setTimeout(() => {
        onClose();
      }, 500);
    } else {
      setErrorMessage('Invalid Race Officer PIN for this room.');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentUser) {
      setErrorMessage('An authenticated user account is required to create a new room.');
      onOpenAuth?.('register');
      return;
    }

    if (!newTitle.trim()) {
      setErrorMessage('Event title is required.');
      return;
    }
    const cleanCode = (newCode || newTitle.slice(0, 6)).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode.length < 3) {
      setErrorMessage('Room code must be at least 3 characters.');
      return;
    }
    if (newPin.length < 3) {
      setErrorMessage('Admin PIN must be at least 3 characters.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await roomService.createRoom({
        code: cleanCode,
        title: newTitle.trim(),
        locationName: newLocation.trim() || 'Coastal Waters',
        adminPin: newPin.trim(),
        isPublic: newIsPublic,
      });

      if (res.success) {
        onSetViewMode('RC_CONSOLE');
        setSuccessMessage(`Room #${cleanCode} created! RC Console ready.`);
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        setErrorMessage(res.error || 'Failed to create room.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopySpectatorLink = () => {
    const link = roomService.getShareableLink('spectator');
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const generateRandomCode = () => {
    const prefixes = ['REGATTA', 'CUP', 'DERBY', 'SERIES', 'OPEN', 'RACE'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(10 + Math.random() * 90);
    setNewCode(`${prefix}${num}`);
  };

  const renderPublicRoomsList = (titlePrefix?: string) => (
    <div id="lobby-public-rooms-list" className="space-y-3 pt-2">
      <div className="text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-slate-300 font-semibold">
          <Users className="w-3.5 h-3.5 text-[#00D4FF]" />
          <span>{titlePrefix || 'Live Regattas'} ({publicRooms.length})</span>
        </div>
        <button
          id="refresh-lobby-public-btn"
          onClick={loadRooms}
          disabled={isLoadingRooms}
          className="text-cyan-400 hover:underline text-[11px] font-mono flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${isLoadingRooms ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isLoadingRooms ? (
        <div className="p-8 text-center text-slate-400 font-mono text-xs bg-[#0A0F1E]/50 border border-[#1E293B] rounded-xl">
          Loading active regatta directory...
        </div>
      ) : publicRooms.length === 0 ? (
        <div className="p-8 text-center text-slate-400 font-mono text-xs bg-[#0A0F1E]/50 border border-[#1E293B] rounded-xl">
          No public regattas listed currently. Create one to get started!
        </div>
      ) : (
        publicRooms.map((room) => {
          const isCurrent = room.code === activeRoomCode;
          const isRoomOwner = !!(room.isOwner || (currentUser && room.ownerId === currentUser.id));

          return (
            <div
              key={room.code}
              className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                isCurrent
                  ? 'bg-[#00D4FF]/10 border-[#00D4FF]/50 shadow-[0_0_15px_rgba(0,212,255,0.1)]'
                  : 'bg-[#0A0F1E] border-[#1E293B] hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">{room.title}</span>
                    <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[#00D4FF] border border-[#00D4FF]/30 font-mono text-[10px] font-bold">
                      #{room.code}
                    </span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold">
                        ACTIVE
                      </span>
                    )}
                    {isRoomOwner && (
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-[9px] font-bold">
                        YOUR ROOM
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 text-xs font-mono">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#00D4FF]" />
                      {room.locationName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Ship className="w-3 h-3 text-slate-400" />
                      {room.boatCount} Boats
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      {room.activeClients} Online
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {isRoomOwner && onOpenDashboard && (
                    <button
                      id={`lobby-manage-room-${room.code}`}
                      onClick={() => {
                        onClose();
                        onOpenDashboard();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-mono flex items-center gap-1 transition-all"
                      title="Manage PIN, Course & Event from Your Dashboard"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Manage</span>
                    </button>
                  )}

                  <button
                    id={`lobby-watch-room-${room.code}`}
                    onClick={() => handleJoinSpectator(room.code)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 text-[#00D4FF] border border-[#00D4FF]/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Watch</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div
      id="regatta-lobby-modal-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="regatta-lobby-modal-card"
        className="relative w-full max-w-2xl bg-[#060B16] border border-[#1E293B] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Modal Header */}
        <div className="p-3 sm:p-4 bg-[#0A0F1E] border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#00D4FF]/20 to-[#1A73E8]/20 border border-[#00D4FF]/30 flex items-center justify-center text-[#00D4FF]">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold font-google text-white flex items-center gap-2">
                Regatta Rooms & Live Sessions
              </h2>
            </div>
          </div>
          <button
            id="close-regatta-lobby-btn"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="group p-2 sm:p-2.5 rounded-xl bg-[#1E293B]/70 hover:bg-rose-500/20 active:bg-rose-500/30 border border-slate-700/60 hover:border-rose-500/40 text-slate-400 hover:text-rose-200 active:scale-95 transition-all duration-150 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            title="Close menu (Esc)"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 pointer-events-none transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110 stroke-[2.2]" />
          </button>
        </div>

        {/* User Account Bar in Lobby */}
        <div className="px-3 sm:px-4 py-2 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          {currentUser ? (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="text-slate-400 shrink-0">Logged in:</span>
                <span className="text-cyan-300 font-bold truncate max-w-[150px] sm:max-w-[220px]">
                  {currentUser.fullName}
                </span>
                <span
                  id="lobby-user-role-badge"
                  className="text-[10px] px-2 py-0.5 bg-cyan-950/90 border border-cyan-700/70 text-cyan-300 rounded-md uppercase font-mono font-bold tracking-wider shadow-xs shrink-0"
                >
                  {currentUser.role}
                </span>
              </div>

              <button
                id="lobby-my-dashboard-btn"
                onClick={() => {
                  onClose();
                  onOpenDashboard?.();
                }}
                className="ml-auto shrink-0 px-3 py-1 rounded-lg bg-[#00D4FF]/15 hover:bg-[#00D4FF]/25 active:scale-95 border border-[#00D4FF]/40 hover:border-[#00D4FF]/70 text-[#00D4FF] hover:text-white text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap"
                title="Open My Regattas & Account Dashboard"
              >
                <User className="w-3.5 h-3.5 text-[#00D4FF]" />
                <span>My Dashboard</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                <span>Guest Mode (Spectator access to all live rooms)</span>
              </div>
              <button
                id="lobby-signin-btn"
                onClick={() => {
                  onClose();
                  onOpenAuth?.('login');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <LogIn className="w-3 h-3 text-cyan-400" />
                <span>Sign In to Host</span>
              </button>
            </div>
          )}
        </div>

        {/* Current Active Room Banner */}
        <div className="px-3 sm:px-4 py-2.5 bg-[#0c1427] border-b border-[#1E293B]/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#64748B] font-mono text-[11px]">ACTIVE:</span>
            <span className="px-2 py-0.5 rounded bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30 font-mono font-bold text-xs tracking-wider">
              #{activeRoomCode}
            </span>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
              ({connectedPeerCount} device{connectedPeerCount > 1 ? 's' : ''} online)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800/80 font-mono text-[10px]">
              {isOrganizer ? (
                <>
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300 font-bold">RC Organizer</span>
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3 text-[#00D4FF]" />
                  <span className="text-slate-300">Spectator</span>
                </>
              )}
            </div>

            <button
              id="lobby-share-link-btn"
              onClick={handleCopySpectatorLink}
              className="px-2 py-0.5 rounded bg-[#1E293B] hover:bg-[#2A3B53] text-[#00D4FF] border border-slate-700 flex items-center gap-1 text-[10px] font-mono transition-all"
              title="Copy public spectator link"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLink ? 'Copied!' : 'Share Link'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#1E293B] bg-[#0A0F1E]/50 px-3 sm:px-4 pt-2 gap-1 overflow-x-auto no-scrollbar">
          <button
            id="tab-lobby-join"
            onClick={() => {
              setActiveTab('JOIN');
              setErrorMessage(null);
            }}
            className={`pb-2.5 px-3 font-mono text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'JOIN'
                ? 'border-[#00D4FF] text-[#00D4FF]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Live Regattas ({publicRooms.length})
          </button>

          <button
            id="tab-lobby-create"
            onClick={() => {
              setActiveTab('CREATE');
              setErrorMessage(null);
            }}
            className={`pb-2.5 px-3 font-mono text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'CREATE'
                ? 'border-[#00D4FF] text-[#00D4FF]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Host / Create Room
          </button>
        </div>

        {/* Notifications */}
        {errorMessage && (
          <div className="mx-3 sm:mx-4 mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-3 sm:mx-4 mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: ENTER CODE */}
          {activeTab === 'JOIN' && (
            <div className="space-y-4">
              <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Regatta Room Code
                  </label>
                  {activeRoomCode && (
                    <span className="text-[11px] font-mono text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/30 px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00D4FF] animate-pulse"></span>
                      Current Room: #{activeRoomCode}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="join-code-input-field"
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder={activeRoomCode ? `Current: ${activeRoomCode}` : "e.g. REGATTA123"}
                    className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] rounded-lg px-3.5 py-2.5 text-base font-mono font-bold text-white tracking-widest placeholder:text-slate-500 focus:outline-none"
                    maxLength={16}
                  />
                  <div className="absolute right-2.5 top-2.5 text-slate-500 text-xs font-mono">
                    {joinCodeInput.length}/16
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] font-mono">
                  <span className="text-slate-400">
                    {activeRoomCode && joinCodeInput === activeRoomCode
                      ? `Displaying your current room #${activeRoomCode}. Enter a different room code to switch.`
                      : 'Tip: Ask your club race committee or check your registration sheet for the 6-character room code.'}
                  </span>
                  {activeRoomCode && joinCodeInput !== activeRoomCode && (
                    <button
                      type="button"
                      onClick={() => setJoinCodeInput(activeRoomCode)}
                      className="text-[#00D4FF] hover:underline cursor-pointer shrink-0 ml-2"
                    >
                      Reset to #{activeRoomCode}
                    </button>
                  )}
                </div>

                {showPinInput && (
                  <div className="mt-4 pt-4 border-t border-[#1E293B] animate-in fade-in duration-150">
                    <label className="block text-xs font-mono font-bold text-amber-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Race Officer Admin PIN
                    </label>
                    <input
                      id="join-pin-input-field"
                      type="password"
                      value={joinPinInput}
                      onChange={(e) => setJoinPinInput(e.target.value)}
                      placeholder="e.g. 1234"
                      maxLength={12}
                      className="w-full bg-[#060B16] border border-amber-500/50 focus:border-amber-400 rounded-lg px-3.5 py-2 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      Required only for Race Committee to drag marks, fire guns, and issue penalties.
                    </p>
                  </div>
                )}

                {/* Join Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                  <button
                    id="join-as-spectator-btn"
                    onClick={() => handleJoinSpectator()}
                    className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-[#00D4FF]/20 to-[#1A73E8]/20 hover:from-[#00D4FF]/30 hover:to-[#1A73E8]/30 border border-[#00D4FF]/40 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all group"
                  >
                    <Eye className="w-4 h-4 text-[#00D4FF] group-hover:scale-110 transition-transform" />
                    <span>Join as Spectator (Public)</span>
                  </button>

                  <button
                    id="join-as-rc-btn"
                    onClick={() => handleJoinOrganizer()}
                    className="w-full px-4 py-3 rounded-xl bg-[#1E293B] hover:bg-[#2A3B53] border border-slate-600 text-slate-200 hover:text-white font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>{showPinInput ? 'Verify PIN & Unlock RC' : 'RC Officer Admin (PIN)'}</span>
                  </button>
                </div>
              </div>

              {/* Live Regattas Directory with Code Entry */}
              {renderPublicRoomsList()}
            </div>
          )}

          {/* TAB 2: CREATE ROOM (Gated for Registered Users) */}
          {activeTab === 'CREATE' && (
            <div>
              {!currentUser ? (
                /* Unauthenticated Notice according to user requirement */
                <div className="bg-[#0A0F1E] border border-cyan-900/60 rounded-2xl p-5 sm:p-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">
                      User Account Required to Host Rooms
                    </h3>
                    <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                      To those who do not wish to register a user account, you can freely join any available Live Regatta Room in the directory.
                      <br /><br />
                      To create and organize your own Regatta Room, customize PINs, set course coordinates, and track race statistics, please register or sign in.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      id="lobby-register-now-btn"
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuth?.('register');
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl transition shadow"
                    >
                      Create Free Account
                    </button>
                    <button
                      id="lobby-login-now-btn"
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuth?.('login');
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl transition"
                    >
                      Already registered? Sign In
                    </button>
                  </div>
                </div>
              ) : (
                /* Authenticated User Room Creation Form */
                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl text-xs text-cyan-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      Hosting as <strong>{currentUser.fullName}</strong>. This room will be attached to your account dashboard.
                    </span>
                  </div>

                  <div className="bg-gradient-to-b from-[#0A1020] to-[#060B16] border border-[#1E293B]/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl shadow-black/40">
                    <div>
                      <label className="block text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Event / Regatta Name *</span>
                      </label>
                      <input
                        id="new-room-title-input"
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Raja Muda Regatta"
                        className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF]/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                          Venue / Club Location
                        </label>
                        <input
                          id="new-room-location-input"
                          type="text"
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          placeholder="e.g. Port Klang, Selangor"
                          className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF]/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                            Room Code *
                          </label>
                          <button
                            id="auto-code-btn"
                            type="button"
                            onClick={generateRandomCode}
                            className="text-[10px] font-mono text-[#00D4FF] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" /> Auto
                          </button>
                        </div>
                        <input
                          id="new-room-code-input"
                          type="text"
                          required
                          value={newCode}
                          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                          placeholder="e.g. REGATTA123"
                          maxLength={12}
                          className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF]/40 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-[#00D4FF] tracking-wider placeholder:text-slate-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-[#1E293B]">
                      <div>
                        <label className="block text-xs font-mono font-bold text-amber-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          RC Officer Admin PIN *
                        </label>
                        <input
                          id="new-room-pin-input"
                          type="text"
                          required
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value)}
                          placeholder="e.g. 1234"
                          maxLength={8}
                          className="w-full bg-[#060B16] border border-amber-500/50 hover:border-amber-400/70 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold tracking-widest text-amber-200 placeholder:text-slate-500 placeholder:font-normal placeholder:tracking-normal focus:outline-none transition-all shadow-inner"
                        />
                        <p className="text-[10px] text-slate-400 font-mono mt-1.5">
                          You can edit this PIN anytime from your dashboard.
                        </p>
                      </div>

                      <div className="flex flex-col justify-center">
                        <label className="flex items-center gap-2.5 cursor-pointer mt-1 sm:mt-3 p-2 rounded-xl hover:bg-slate-900/60 transition-colors">
                          <input
                            id="new-room-ispublic-checkbox"
                            type="checkbox"
                            checked={newIsPublic}
                            onChange={(e) => setNewIsPublic(e.target.checked)}
                            className="w-4 h-4 rounded bg-[#060B16] border-slate-700 text-[#00D4FF] focus:ring-0 cursor-pointer"
                          />
                          <span className="text-xs font-mono text-slate-300">
                            List in Public Regattas Directory
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <button
                    id="submit-create-room-btn"
                    type="submit"
                    disabled={isCreating}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#1A73E8] hover:opacity-90 text-black font-mono font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00D4FF]/20 transition-all disabled:opacity-50"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{isCreating ? 'Creating Regatta Room...' : 'Create Regatta Room & Launch'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#0A0F1E] border-t border-[#1E293B] flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>TMTRAC v{APP_VERSION}</span>
          <button
            id="close-lobby-footer-btn"
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#1E293B] hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
