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
import { serverNow } from '../services/serverClock';

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
        'bg-lb-0e131f text-lt-e8eaed border-ll-1e293b'
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
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-lb-00d4ff/20 border border-ll-00d4ff/50 text-lt-00d4ff flex items-center justify-center font-bold shadow-sm shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-current">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
            </svg>
          </div>
          <span className="text-sm sm:text-base font-bold tracking-tight text-lt-white font-google">
            TMTRAC
          </span>
        </div>

        {onOpenLandingPage && (
          <button
            onClick={onOpenLandingPage}
            className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg bg-lb-slate-800/80 hover:bg-lb-slate-700 text-lt-slate-300 hover:text-lt-white text-xs font-medium border border-ll-slate-700 transition-colors"
            title="Return to Front Landing Page"
          >
            <Home className="w-3.5 h-3.5 text-lt-cyan-400" />
            <span className="text-xs">Home</span>
          </button>
        )}


        {/* Realtime Live Peer Sync Indicator */}
        <button
          id="header-live-peer-badge"
          onClick={onOpenQrModal}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
            connectedPeerCount > 1
              ? 'bg-lb-emerald-500/15 text-lt-emerald-300 border border-ll-emerald-500/40 hover:bg-lb-emerald-500/25'
              : 'bg-lb-1e293b text-lt-slate-300 border border-ll-slate-700 hover:text-lt-white'
          }`}
          title={`${connectedPeerCount} device(s) live. Tap to share regatta QR link.`}
        >
          <Zap className="w-2.5 h-2.5 text-lt-emerald-400 animate-pulse shrink-0" />
          <span className="tracking-wider">{connectedPeerCount}</span>
          <span className="hidden sm:inline">LIVE</span>
        </button>

        {/* Room Selector */}
        <button
          id="header-room-selector"
          onClick={onOpenLobby}
          className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg bg-lb-121826 hover:bg-lb-1e293b border border-ll-00d4ff/30 hover:border-ll-00d4ff text-lt-00d4ff text-xs sm:text-xs font-mono transition-all cursor-pointer shadow-xs"
          title="Switch Regatta Room or Host Session"
        >
          <Radio className="w-3 h-3 text-lt-00d4ff shrink-0" />
          <span className="font-bold tracking-wider max-w-[65px] sm:max-w-[100px] truncate">#{activeRoomCode}</span>
          <ChevronDown className="w-2.5 h-2.5 text-lt-slate-400 shrink-0" />
        </button>


        {/* Mode Toggle Indicator (RC Officer vs Spectator) */}
        {viewMode === 'SPECTATOR' ? (
          <button
            id="header-mode-unlock-btn"
            onClick={onOpenPinUnlock}
            className="hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-full bg-lb-amber-500/15 hover:bg-lb-amber-500/25 border border-ll-amber-500/40 text-lt-amber-300 font-mono text-xs transition-colors cursor-pointer"
            title="Spectator Mode (Read-only). Tap to enter PIN and unlock Race Officer Console."
          >
            <Lock className="w-2.5 h-2.5 text-lt-amber-400 shrink-0" />
            <span className="hidden md:inline font-bold">SPECTATOR</span>
            <span className="md:hidden font-bold">SPEC</span>
          </button>
        ) : (
          <button
            id="header-mode-spectator-btn"
            onClick={() => setViewMode?.('SPECTATOR')}
            className="hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-full bg-lb-emerald-500/15 hover:bg-lb-emerald-500/25 border border-ll-emerald-500/40 text-lt-emerald-300 font-mono text-xs transition-colors cursor-pointer"
            title="Race Officer Console Active. Tap to preview Spectator view."
          >
            <ShieldCheck className="w-2.5 h-2.5 text-lt-emerald-400 shrink-0" />
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
            ? Math.max(0, Math.ceil((target - serverNow()) / 1000))
            : rawClassState.countdownSeconds;
          const isCountdown = rawClassState.startSequenceActive && countdownSec > 0;
          const displayStatus = isCountdown ? 'COUNTDOWN' : rawClassState.status;

          return (
            <div
              onClick={() => handleOpenHub('RACE')}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-lb-121826 border border-ll-1e293b text-xs font-mono shadow-xs cursor-pointer hover:border-ll-slate-600 transition-colors"
              title="Click to open Race & Course Console"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  displayStatus === 'RACING'
                    ? 'bg-lb-emerald-400 animate-pulse'
                    : displayStatus === 'FINISHED'
                    ? 'bg-lb-purple-400'
                    : isCountdown
                    ? 'bg-lb-amber-400 animate-pulse'
                    : 'bg-lb-slate-400'
                }`}
              />
              <span className="text-lt-slate-400 font-bold">CLASS:</span>
              <span className="text-lt-white font-bold">{raceState.activeClass}</span>
              <span className="text-lt-slate-600">·</span>
              <span
                className={`font-bold ${
                  displayStatus === 'RACING'
                    ? 'text-lt-emerald-400'
                    : displayStatus === 'FINISHED'
                    ? 'text-lt-purple-300'
                    : isCountdown
                    ? 'text-lt-amber-400'
                    : 'text-lt-slate-300'
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
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-ll-00d4ff/70 bg-lb-00d4ff/20 hover:bg-lb-00d4ff/35 text-lt-00d4ff font-mono font-bold text-xs sm:text-xs transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,212,255,0.25)] cursor-pointer active:scale-95 shrink-0"
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
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-ll-purple-500/70 bg-lb-purple-950/70 hover:bg-lb-purple-900/90 text-lt-purple-200 transition-all flex items-center gap-1.5 shadow-sm shadow-ll-purple-950/60 cursor-pointer shrink-0"
            title="Open Super Admin Master Panel"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-lt-purple-400 shrink-0" />
            <span className="text-xs font-mono font-bold hidden sm:inline text-lt-purple-300">
              SUPER ADMIN
            </span>
          </button>
        )}

        {/* User Account / Profile / Dashboard Button */}
        {currentUser ? (
          <button
            id="header-user-dashboard-btn"
            onClick={onOpenDashboard}
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-ll-cyan-500/40 bg-lb-cyan-950/40 hover:bg-lb-cyan-900/60 text-lt-cyan-300 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            title={`Signed in as ${currentUser.fullName}. Open Sailor Dashboard.`}
          >
            <div className="w-5 h-5 rounded-full bg-lb-cyan-500/30 text-lt-cyan-200 text-xs font-bold flex items-center justify-center shrink-0">
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
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-ll-1e293b bg-lb-121826 hover:bg-lb-1e293b text-lt-slate-300 hover:text-lt-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Sign in or register account"
          >
            <User className="w-3.5 h-3.5 text-lt-cyan-400 shrink-0" />
            <span className="text-xs font-mono font-bold hidden sm:inline">
              SIGN IN
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
