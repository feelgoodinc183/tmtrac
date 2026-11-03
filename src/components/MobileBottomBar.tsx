import React from 'react';
import {
  Map as MapIcon,
  Navigation,
  Compass,
  Clock,
  Trophy,
  Settings,
  Zap,
} from 'lucide-react';
import { RaceState, DeviceGpsState, UserAccount } from '../types/regatta';
import { HubTab } from './UnifiedHubModal';

export type MobileTab = 'MAP' | 'LEADERBOARD' | 'FLEET_GPS' | 'RC_CONSOLE' | 'TOOLS';

interface MobileBottomBarProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  boatCount: number;
  hybridTrackerCount: number;
  connectedPeerCount: number;
  raceState: RaceState;
  deviceGps: DeviceGpsState;
  onToggleDeviceGps: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  directSunlightMode: boolean;
  onToggleSunlightMode: () => void;
  onOpenChat: () => void;
  onOpenVhfJuryModal: () => void;
  onOpenNmeaMalaysiaModal: () => void;
  onOpenHardwareScan: () => void;
  onOpenOfflineCache: () => void;
  onOpenSpectatorQr: () => void;
  onOpenCourseProfiles?: () => void;
  onOpenClassManager?: () => void;
  onOpenResults?: () => void;
  onOpenNodeBinding?: () => void;
  onOpenHybridTrackers?: () => void;
  onOpenSkipperCheckIn?: () => void;
  onOpenBoatQr?: () => void;
  onOpenAbout?: () => void;
  showReplayBar?: boolean;
  onToggleReplayBar?: () => void;
  showRcConsoleOverlay?: boolean;
  showLeaderboardOverlay?: boolean;
  showToolsDrawer?: boolean;
  onCloseToolsDrawer?: () => void;
  viewMode?: 'RC_CONSOLE' | 'SPECTATOR';
  currentUser?: UserAccount | null;
  onOpenDashboard?: () => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onOpenLobby?: () => void;
  onOpenHub?: (hub: HubTab) => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeTab,
  onSelectTab,
  boatCount,
  raceState,
  directSunlightMode,
  showRcConsoleOverlay,
  showLeaderboardOverlay,
  onOpenHub,
  onOpenResults,
}) => {
  const isMapActive =
    activeTab === 'MAP' && !showRcConsoleOverlay && !showLeaderboardOverlay;

  const handleTabClick = (hub: HubTab) => {
    if (onOpenHub) {
      onOpenHub(hub);
    } else {
      if (hub === 'FLEET') onSelectTab('FLEET_GPS');
      if (hub === 'RACE') onSelectTab('RC_CONSOLE');
      if (hub === 'RESULTS') {
        if (onOpenResults) onOpenResults();
        else onSelectTab('LEADERBOARD');
      }
      if (hub === 'SYSTEM') onSelectTab('TOOLS');
    }
  };

  return (
    <nav
      id="mobile-bottom-navigation-bar"
      aria-label="Mobile Navigation"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 border-t flex items-center justify-around px-1 select-none backdrop-blur-md transition-colors ${
        'bg-lb-0e131f/95 text-lt-e8eaed border-ll-1e293b'
      }`}
    >
      {/* 1. Map Tab */}
      <button
        id="mobile-nav-map"
        onClick={() => onSelectTab('MAP')}
        className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors cursor-pointer ${
          isMapActive ? 'text-lt-00d4ff' : 'text-lt-slate-400 hover:text-lt-slate-200'
        }`}
      >
        <MapIcon className={`w-4 h-4 ${isMapActive ? 'stroke-[2.5]' : ''}`} />
        <span className="text-xs font-mono font-bold mt-0.5 tracking-tight">
          Map
        </span>
      </button>

      {/* 2. Fleet Tab */}
      <button
        id="mobile-nav-fleet"
        onClick={() => handleTabClick('FLEET')}
        className="flex-1 flex flex-col items-center justify-center py-1 text-lt-slate-400 hover:text-lt-slate-200 transition-colors relative cursor-pointer"
      >
        <div className="relative">
          <Compass className="w-4 h-4 text-lt-00d4ff" />
          {boatCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-lb-00d4ff text-lt-black text-xs font-mono font-bold px-1 rounded-full leading-tight">
              {boatCount}
            </span>
          )}
        </div>
        <span className="text-xs font-mono font-bold mt-0.5 tracking-tight">
          Fleet
        </span>
      </button>

      {/* 3. Race Tab */}
      <button
        id="mobile-nav-race"
        onClick={() => handleTabClick('RACE')}
        className="flex-1 flex flex-col items-center justify-center py-1 text-lt-slate-400 hover:text-lt-slate-200 transition-colors relative cursor-pointer"
      >
        <div className="relative">
          <Clock className="w-4 h-4 text-lt-fbbc04" />
          <span
            className={`absolute -top-0.5 -right-1 w-2 h-2 rounded-full ${
              raceState.status === 'RACING'
                ? 'bg-lb-emerald-400 animate-pulse'
                : raceState.startSequenceActive
                ? 'bg-lb-amber-400 animate-pulse'
                : 'bg-lb-slate-400'
            }`}
          />
        </div>
        <span className="text-xs font-mono font-bold mt-0.5 tracking-tight">
          Race
        </span>
      </button>

      {/* 4. Results Tab */}
      <button
        id="mobile-nav-results"
        onClick={() => handleTabClick('RESULTS')}
        className="flex-1 flex flex-col items-center justify-center py-1 text-lt-slate-400 hover:text-lt-slate-200 transition-colors cursor-pointer"
      >
        <Trophy className="w-4 h-4 text-lt-ffb800" />
        <span className="text-xs font-mono font-bold mt-0.5 tracking-tight">
          Results
        </span>
      </button>

      {/* 5. System Tab */}
      <button
        id="mobile-nav-system"
        onClick={() => handleTabClick('SYSTEM')}
        className="flex-1 flex flex-col items-center justify-center py-1 text-lt-slate-400 hover:text-lt-slate-200 transition-colors cursor-pointer"
      >
        <Settings className="w-4 h-4 text-lt-cyan-400" />
        <span className="text-xs font-mono font-bold mt-0.5 tracking-tight">
          System
        </span>
      </button>
    </nav>
  );
};
