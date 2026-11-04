import React from 'react';
import { Map as MapIcon, Compass, ListOrdered, Trophy, SlidersHorizontal } from 'lucide-react';

export type MobileTab = 'MAP' | 'LEADERBOARD' | 'FLEET_GPS' | 'RC_CONSOLE' | 'TOOLS';

interface MobileBottomBarProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  /** Race control is only offered to people who can run the race */
  showRace: boolean;
  onOpenResults: () => void;
  onOpenTools: () => void;
}

/**
 * Phone navigation: labelled tabs instead of unlabelled map icons. 64px tall; the replay bar
 * sits above it (bottom-16).
 */
export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({ activeTab, onSelectTab, showRace, onOpenResults, onOpenTools }) => {
  const items: { key: string; label: string; icon: React.ReactNode; active: boolean; onClick: () => void }[] = [
    { key: 'map', label: 'Map', icon: <MapIcon />, active: activeTab === 'MAP', onClick: () => onSelectTab('MAP') },
    ...(showRace
      ? [{ key: 'race', label: 'Race', icon: <Compass />, active: activeTab === 'RC_CONSOLE', onClick: () => onSelectTab('RC_CONSOLE') }]
      : []),
    { key: 'standings', label: 'Standings', icon: <ListOrdered />, active: activeTab === 'LEADERBOARD', onClick: () => onSelectTab('LEADERBOARD') },
    { key: 'results', label: 'Results', icon: <Trophy />, active: false, onClick: onOpenResults },
    { key: 'tools', label: 'Tools', icon: <SlidersHorizontal />, active: false, onClick: onOpenTools },
  ];

  return (
    <nav aria-label="Main" className="md:hidden h-16 shrink-0 border-t border-line bg-surface flex items-stretch z-30">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={item.onClick}
          aria-current={item.active ? 'page' : undefined}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors [&>svg]:h-5 [&>svg]:w-5 ${
            item.active ? 'text-accent' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};
