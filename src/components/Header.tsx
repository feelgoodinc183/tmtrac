import React from 'react';
import {
  Navigation,
  Zap,
  Radio,
  ChevronDown,
  Lock,
  ShieldCheck,
  User,
  Compass,
  Clock,
  Trophy,
  Sliders,
  Settings,
  Menu,
  Building2,
  Crown,
  Home,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import { RaceState, HardwareConnection, RegattaLocation, DeviceGpsState, UserAccount, PlanTier } from '../types/regatta';

export type HubTab = 'FLEET' | 'RACE' | 'RESULTS' | 'SYSTEM';

interface HeaderProps {
  raceState: RaceState;
  hardwareConn?: HardwareConnection;
  selectedLocation?: RegattaLocation;
  directSunlightMode: boolean;
  onToggleSunlightMode: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  deviceGps: DeviceGpsState;
  onToggleDeviceGps: () => void;
  onOpenHybridTrackers?: () => void;
  hybridTrackerCount?: number;
  boatCount?: number;
  connectedPeerCount?: number;
  viewMode: 'RC_CONSOLE' | 'SPECTATOR';
  setViewMode?: (mode: 'RC_CONSOLE' | 'SPECTATOR') => void;
  activeRoomCode?: string;
  onOpenLobby?: () => void;
  onOpenPinUnlock?: () => void;
  onOpenChat?: () => void;
  onOpenImageAnalysis?: () => void;
  onOpenNodeBinding?: () => void;
  onOpenMqttInspector?: () => void;
  onOpenOfflineCache?: () => void;
  onOpenQrModal?: () => void;
  onOpenHardwareScan?: () => void;
  onOpenVhfJuryModal?: () => void;
  onOpenNmeaMalaysiaModal?: () => void;
  onOpenResults?: () => void;
  onOpenCourseProfiles?: () => void;
  onOpenBoatQr?: () => void;
  onOpenSkipperCheckIn?: () => void;
  showReplayBar?: boolean;
  onToggleReplayBar?: () => void;
  onOpenTools?: () => void;
  isToolsOpen?: boolean;
  onOpenHub?: (hub: HubTab) => void;
  currentUser?: UserAccount | null;
  onOpenDashboard?: () => void;
  onOpenAuth?: (mode?: 'login' | 'register-participant' | 'register-org') => void;
  onOpenCpanelDeploy?: () => void;
  onOpenTenantDashboard?: () => void;
  onOpenSubscriptionModal?: () => void;
  onOpenSuperAdmin?: () => void;
  onOpenLandingPage?: () => void;
  tenantName?: string;
  planTier?: PlanTier;
}

export const Header: React.FC<HeaderProps> = ({
  raceState,
  directSunlightMode,
  connectedPeerCount = 1,
  boatCount = 0,
  viewMode,
  setViewMode,
  activeRoomCode = 'LOBBY',
  onOpenLobby,
  onOpenPinUnlock,
  onOpenQrModal,
  onOpenResults,
  onOpenSkipperCheckIn,
  onOpenTools,
  onOpenHub,
  currentUser,
  onOpenDashboard,
  onOpenAuth,
  onOpenCpanelDeploy,
  onOpenTenantDashboard,
  onOpenSubscriptionModal,
  onOpenSuperAdmin,
  onOpenLandingPage,
  tenantName,
  planTier = 'FREE',
}) => {
  const handleOpenHub = (hub: HubTab) => {
    if (onOpenHub) {
      onOpenHub(hub);
    } else if (hub === 'RESULTS' && onOpenResults) {
      onOpenResults();
    } else if (onOpenTools) {
      onOpenTools();
    }
  };

  return (
    <header
      id="main-app-header"
      className={`h-12 sm:h-14 border-b flex items-center justify-between px-2 sm:px-4 shrink-0 select-none z-30 font-google w-full relative ${
        directSunlightMode
          ? 'bg-black text-white border-white'
          : 'bg-[#0E131F] text-[#E8EAED] border-[#1E293B]'
      }`}
    >
      {/* Left: Brand + Realtime Sync + Room Selector */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Brand Logo & Name */}
        <div
          onClick={onOpenLandingPage}
          className="flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
          title="Return to Front Landing Page"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#00D4FF]/20 border border-[#00D4FF]/50 text-[#00D4FF] flex items-center justify-center font-bold shadow-sm shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-current">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
            </svg>
          </div>
          <span className="text-sm sm:text-base font-bold tracking-tight text-white font-google">
            TMTRAC
          </span>
        </div>

        {onOpenLandingPage && (
          <button
            onClick={onOpenLandingPage}
            className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
            title="Return to Front Landing Page"
          >
            <Home className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px]">Home</span>
          </button>
        )}


        {/* Realtime Live Peer Sync Indicator */}
        <button
          id="header-live-peer-badge"
          onClick={onOpenQrModal}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer ${
            connectedPeerCount > 1
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25'
              : 'bg-[#1E293B] text-slate-300 border border-slate-700 hover:text-white'
          }`}
          title={`${connectedPeerCount} device(s) live. Tap to share regatta QR link.`}
        >
          <Zap className="w-2.5 h-2.5 text-emerald-400 animate-pulse shrink-0" />
          <span className="tracking-wider">{connectedPeerCount}</span>
          <span className="hidden sm:inline">LIVE</span>
        </button>

        {/* Room Selector */}
        <button
          id="header-room-selector"
          onClick={onOpenLobby}
          className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg bg-[#121826] hover:bg-[#1E293B] border border-[#00D4FF]/30 hover:border-[#00D4FF] text-[#00D4FF] text-[10px] sm:text-xs font-mono transition-all cursor-pointer shadow-xs"
          title="Switch Regatta Room or Host Session"
        >
          <Radio className="w-3 h-3 text-[#00D4FF] shrink-0" />
          <span className="font-bold tracking-wider max-w-[65px] sm:max-w-[100px] truncate">#{activeRoomCode}</span>
          <ChevronDown className="w-2.5 h-2.5 text-slate-400 shrink-0" />
        </button>


        {/* Mode Toggle Indicator (RC Officer vs Spectator) */}
        {viewMode === 'SPECTATOR' ? (
          <button
            id="header-mode-unlock-btn"
            onClick={onOpenPinUnlock}
            className="hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-mono text-[10px] transition-colors cursor-pointer"
            title="Spectator Mode (Read-only). Tap to enter PIN and unlock Race Officer Console."
          >
            <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
            <span className="hidden md:inline font-bold">SPECTATOR</span>
            <span className="md:hidden font-bold">SPEC</span>
          </button>
        ) : (
          <button
            id="header-mode-spectator-btn"
            onClick={() => setViewMode?.('SPECTATOR')}
            className="hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] transition-colors cursor-pointer"
            title="Race Officer Console Active. Tap to preview Spectator view."
          >
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            <span className="hidden md:inline font-bold">RC ADMIN</span>
            <span className="md:hidden font-bold">RC</span>
          </button>
        )}
      </div>

      {/* Middle: Live Race Status Ticker (Desktop & Tablet) */}
      <div className="hidden lg:flex items-center gap-2">
        {(() => {
          const rawClassState = raceState.classStates?.[raceState.activeClass] || {
            status: raceState.status,
            countdownSeconds: raceState.countdownSeconds,
            startSequenceActive: raceState.startSequenceActive,
            targetStartTime: raceState.targetStartTime,
          };
          const target = rawClassState.targetStartTime ?? raceState.targetStartTime;
          const countdownSec = rawClassState.startSequenceActive && target
            ? Math.max(0, Math.ceil((target - Date.now()) / 1000))
            : rawClassState.countdownSeconds;
          const isCountdown = rawClassState.startSequenceActive && countdownSec > 0;
          const displayStatus = isCountdown ? 'COUNTDOWN' : rawClassState.status;

          return (
            <div
              onClick={() => handleOpenHub('RACE')}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#121826] border border-[#1E293B] text-xs font-mono shadow-xs cursor-pointer hover:border-slate-600 transition-colors"
              title="Click to open Race & Course Console"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  displayStatus === 'RACING'
                    ? 'bg-emerald-400 animate-pulse'
                    : displayStatus === 'FINISHED'
                    ? 'bg-purple-400'
                    : isCountdown
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
              <span className="text-slate-400 font-bold">CLASS:</span>
              <span className="text-white font-bold">{raceState.activeClass}</span>
              <span className="text-slate-600">·</span>
              <span
                className={`font-bold ${
                  displayStatus === 'RACING'
                    ? 'text-emerald-400'
                    : displayStatus === 'FINISHED'
                    ? 'text-purple-300'
                    : isCountdown
                    ? 'text-amber-400'
                    : 'text-slate-300'
                }`}
              >
                {displayStatus === 'RACING'
                  ? 'RACING'
                  : displayStatus === 'FINISHED'
                  ? 'FINISHED'
                  : isCountdown
                  ? `COUNTDOWN (${Math.floor(countdownSec / 60)}:${(countdownSec % 60).toString().padStart(2, '0')})`
                  : displayStatus}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Right: Consolidated 4 Hubs + Quick Track Boat + User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Glowing 1-Tap Skipper Check-In / Track Boat */}
        {onOpenSkipperCheckIn && (
          <button
            id="header-skipper-checkin-btn"
            onClick={onOpenSkipperCheckIn}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-[#00D4FF]/70 bg-[#00D4FF]/20 hover:bg-[#00D4FF]/35 text-[#00D4FF] font-mono font-bold text-[11px] sm:text-xs transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,212,255,0.25)] cursor-pointer active:scale-95 shrink-0"
            title="Skipper 1-Tap Check-In: Auto-bind your vessel & start live fleet GPS tracking"
          >
            <Navigation className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden xs:inline">TRACK BOAT</span>
            <span className="xs:hidden">TRACK</span>
          </button>
        )}

        {/* Super Admin Control Panel Access */}
        {currentUser?.isSuperAdmin && onOpenSuperAdmin && (
          <button
            id="header-superadmin-btn"
            onClick={onOpenSuperAdmin}
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-purple-500/70 bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 transition-all flex items-center gap-1.5 shadow-sm shadow-purple-950/60 cursor-pointer shrink-0"
            title="Open Super Admin Master Panel"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-xs font-mono font-bold hidden sm:inline text-purple-300">
              SUPER ADMIN
            </span>
          </button>
        )}

        {/* User Account / Profile / Dashboard Button */}
        {currentUser ? (
          <button
            id="header-user-dashboard-btn"
            onClick={onOpenDashboard}
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            title={`Signed in as ${currentUser.fullName}. Open Sailor Dashboard.`}
          >
            <div className="w-5 h-5 rounded-full bg-cyan-500/30 text-cyan-200 text-[10px] font-bold flex items-center justify-center shrink-0">
              {currentUser.fullName.charAt(0) || 'U'}
            </div>
            <span className="text-xs font-mono font-bold max-w-[80px] truncate hidden sm:inline">
              {currentUser.fullName.split(' ')[0]}
            </span>
          </button>
        ) : (
          <button
            id="header-login-btn"
            onClick={() => onOpenAuth?.('login')}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-[#1E293B] bg-[#121826] hover:bg-[#1E293B] text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Sign in or register account"
          >
            <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-xs font-mono font-bold hidden sm:inline">
              SIGN IN
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
