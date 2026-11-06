import React from 'react';
import {
  Navigation,
  Zap,
  Radio,
  ChevronDown,
  Lock,
  ShieldCheck,
  User,
  Home,
  ShieldAlert,
  Sun,
} from 'lucide-react';
import { RaceState, HardwareConnection, RegattaLocation, DeviceGpsState, UserAccount } from '../types/regatta';
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
  connectedPeerCount?: number;
  viewMode: 'RC_CONSOLE' | 'SPECTATOR';
  setViewMode?: (mode: 'RC_CONSOLE' | 'SPECTATOR') => void;
  activeRoomCode?: string;
  onOpenLobby?: () => void;
  onOpenPinUnlock?: () => void;
  onOpenMqttInspector?: () => void;
  onOpenOfflineCache?: () => void;
  onOpenQrModal?: () => void;
  onOpenVhfJuryModal?: () => void;
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
  onOpenSuperAdmin?: () => void;
  onOpenLandingPage?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  raceState,
  directSunlightMode,
  onToggleSunlightMode,
  connectedPeerCount = 1,
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
  onOpenSuperAdmin,
  onOpenLandingPage,
}) => {

  return (
    <header
      id="main-app-header"
      className={`h-12 sm:h-14 border-b flex items-center justify-between px-2 sm:px-4 shrink-0 select-none z-30 w-full relative ${
        'bg-surface text-ink border-line'
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
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent/20 border border-accent/50 text-accent flex items-center justify-center font-bold shadow-sm shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-current">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
            </svg>
          </div>
          <span className="hidden xs:inline text-sm sm:text-base font-bold tracking-tight text-ink">
            TMTRAC
          </span>
        </div>

        {onOpenLandingPage && (
          <button
            onClick={onOpenLandingPage}
            className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg bg-raised/80 hover:bg-raised text-ink hover:text-ink text-xs font-medium border border-line transition-colors"
            title="Return to Front Landing Page"
          >
            <Home className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs">Home</span>
          </button>
        )}


        {/* Realtime Live Peer Sync Indicator */}
        <button
          id="header-live-peer-badge"
          onClick={onOpenQrModal}
          className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs  font-bold transition-all cursor-pointer ${
            connectedPeerCount > 1
              ? 'bg-success-ink/15 text-success-ink border border-success-ink/40 hover:bg-success-ink/25'
              : 'bg-raised text-ink border border-line hover:text-ink'
          }`}
          title={`${connectedPeerCount} device(s) live. Tap to share regatta QR link.`}
        >
          <Zap className="w-2.5 h-2.5 text-success-ink shrink-0" />
          <span className="">{connectedPeerCount}</span>
          <span className="hidden sm:inline">live</span>
        </button>

        {/* Room Selector */}
        <button
          id="header-room-selector"
          onClick={onOpenLobby}
          className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg bg-surface hover:bg-raised border border-accent/30 hover:border-accent text-accent text-xs sm:text-xs transition-all cursor-pointer shadow-xs"
          title="Switch Regatta Room or Host Session"
        >
          <Radio className="w-3 h-3 text-accent shrink-0" />
          <span className="font-bold max-w-[65px] sm:max-w-[100px] truncate">#{activeRoomCode}</span>
          <ChevronDown className="w-2.5 h-2.5 text-ink-muted shrink-0" />
        </button>


        {/* Mode Toggle Indicator (RC Officer vs Spectator) */}
        {viewMode === 'SPECTATOR' ? (
          <button
            id="header-mode-unlock-btn"
            onClick={onOpenPinUnlock}
            className="flex items-center gap-1 p-2 xs:px-2 xs:py-0.5 rounded-full shrink-0 bg-warning-ink/15 hover:bg-warning-ink/25 border border-warning-ink/40 text-warning-ink text-xs transition-colors cursor-pointer"
            aria-label="Spectator mode. Unlock Race Officer console"
            title="Spectator Mode (Read-only). Tap to enter PIN and unlock Race Officer Console."
          >
            <Lock className="w-3.5 h-3.5 xs:w-2.5 xs:h-2.5 text-warning-ink shrink-0" />
            <span className="hidden md:inline font-bold">SPECTATOR</span>
            <span className="hidden xs:inline md:hidden font-bold">SPEC</span>
          </button>
        ) : (
          <button
            id="header-mode-spectator-btn"
            onClick={() => setViewMode?.('SPECTATOR')}
            className="flex items-center gap-1 p-2 xs:px-2 xs:py-0.5 rounded-full shrink-0 bg-success-ink/15 hover:bg-success-ink/25 border border-success-ink/40 text-success-ink text-xs transition-colors cursor-pointer"
            aria-label="Race Officer console active. Switch to spectator view"
            title="Race Officer Console Active. Tap to preview Spectator view."
          >
            <ShieldCheck className="w-3.5 h-3.5 xs:w-2.5 xs:h-2.5 text-success-ink shrink-0" />
            <span className="hidden md:inline font-bold">RC ADMIN</span>
            <span className="hidden xs:inline md:hidden font-bold">RC</span>
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
              role="status"
              aria-label={`Active class ${raceState.activeClass}`}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-line text-xs shadow-xs"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  displayStatus === 'RACING'
                    ? 'bg-success-ink '
                    : displayStatus === 'FINISHED'
                    ? 'bg-ink'
                    : isCountdown
                    ? 'bg-warning-ink '
                    : 'bg-ink'
                }`}
              />
              <span className="text-ink-muted">Class</span>
              <span className="text-ink font-bold">{raceState.activeClass}</span>
              <span className="text-ink-muted">·</span>
              <span
                className={`font-bold ${
                  displayStatus === 'RACING'
                    ? 'text-success-ink'
                    : displayStatus === 'FINISHED'
                    ? 'text-ink'
                    : isCountdown
                    ? 'text-warning-ink'
                    : 'text-ink'
                }`}
              >
                {displayStatus === 'RACING'
                  ? 'Racing'
                  : displayStatus === 'FINISHED'
                  ? 'Finished'
                  : isCountdown
                  ? `Start in ${Math.floor(countdownSec / 60)}:${(countdownSec % 60).toString().padStart(2, '0')}`
                  : 'Pre-start'}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Right: Consolidated 4 Hubs + Quick Track Boat + User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Sunlight Mode: light, high-contrast theme for use outdoors */}
        <button
          id="header-sunlight-btn"
          onClick={onToggleSunlightMode}
          aria-pressed={directSunlightMode}
          aria-label="Sunlight mode"
          className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            directSunlightMode
              ? 'bg-warning-ink text-canvas border-warning-ink'
              : 'bg-raised/60 text-ink border-line hover:text-ink'
          }`}
        >
          <Sun className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden lg:inline">Sunlight</span>
        </button>

        {/* Glowing 1-Tap Skipper Check-In / Track Boat */}
        {onOpenSkipperCheckIn && (
          <button
            id="header-skipper-checkin-btn"
            onClick={onOpenSkipperCheckIn}
            aria-label="Track my boat"
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-accent/70 bg-accent/20 hover:bg-accent/35 text-accent font-bold text-xs sm:text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
            title="Skipper 1-Tap Check-In: Auto-bind your vessel & start live fleet GPS tracking"
          >
            <Navigation className="w-3.5 h-3.5" />
                        <span className="max-[359px]:hidden">Track</span>
          </button>
        )}

        {/* Super Admin Control Panel Access */}
        {currentUser?.isSuperAdmin && onOpenSuperAdmin && (
          <button
            id="header-superadmin-btn"
            onClick={onOpenSuperAdmin}
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-line/70 bg-raised/70 hover:bg-raised/90 text-ink transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
            title="Open Super Admin Master Panel"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-ink-muted shrink-0" />
            <span className="text-xs font-bold hidden sm:inline text-ink">
              Super Admin
            </span>
          </button>
        )}

        {/* User Account / Profile / Dashboard Button */}
        {currentUser ? (
          <button
            id="header-user-dashboard-btn"
            onClick={onOpenDashboard}
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-accent/40 bg-surface/40 hover:bg-accent/60 text-accent transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            title={`Signed in as ${currentUser.fullName}. Open Sailor Dashboard.`}
          >
            <div className="w-5 h-5 rounded-full bg-accent/30 text-accent text-xs font-bold flex items-center justify-center shrink-0">
              {currentUser.fullName.charAt(0) || 'U'}
            </div>
            <span className="text-xs font-bold max-w-[80px] truncate hidden sm:inline">
              {currentUser.fullName.split(' ')[0]}
            </span>
          </button>
        ) : (
          <button
            id="header-login-btn"
            onClick={() => onOpenAuth?.('login')}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-line bg-surface hover:bg-raised text-ink hover:text-ink transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Sign in or register account"
          >
            <User className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-xs font-bold hidden sm:inline">
              SIGN IN
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
