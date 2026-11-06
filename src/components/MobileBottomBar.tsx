import React from 'react';
import { Map as MapIcon, Compass, ListOrdered, Trophy, Settings2, MoreHorizontal } from 'lucide-react';

export type MobileTab = 'MAP' | 'LEADERBOARD' | 'FLEET_GPS' | 'RC_CONSOLE' | 'TOOLS';

interface MobileBottomBarProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  /** Race control and Setup are only offered to people who can run the race */
  showRace: boolean;
  onOpenSetup: () => void;
  /** Setup steps done (of 4) */
  setupDoneCount: number;
  onOpenResults: () => void;
  onOpenMore: () => void;
}

/**
 * Phone navigation: labelled tabs instead of unlabelled map icons. 64px tall; the replay bar
 * sits above it (bottom-16). Race officers get Setup here; Results is then in More (and in
 * Race control). Spectators get Results instead.
 */
export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeTab,
  onSelectTab,
  showRace,
  onOpenSetup,
  setupDoneCount,
  onOpenResults,
  onOpenMore,
}) => {
  const items: { key: string; label: string; ariaLabel?: string; icon: React.ReactNode; badge?: string; active: boolean; onClick: () => void }[] = [
    { key: 'map', label: 'Map', icon: <MapIcon />, active: activeTab === 'MAP', onClick: () => onSelectTab('MAP') },
    ...(showRace
      ? [
          { key: 'race', label: 'Race', icon: <Compass />, active: activeTab === 'RC_CONSOLE', onClick: () => onSelectTab('RC_CONSOLE') },
          {
            key: 'setup',
            label: 'Setup',
            ariaLabel: `Setup, ${setupDoneCount} of 4 steps done`,
            icon: <Settings2 />,
            badge: setupDoneCount < 4 ? `${setupDoneCount}/4` : undefined,
            active: false,
            onClick: onOpenSetup,
          },
        ]
      : []),
    { key: 'standings', label: 'Standings', icon: <ListOrdered />, active: activeTab === 'LEADERBOARD', onClick: () => onSelectTab('LEADERBOARD') },
    ...(showRace ? [] : [{ key: 'results', label: 'Results', icon: <Trophy />, active: false, onClick: onOpenResults }]),
    { key: 'more', label: 'More', icon: <MoreHorizontal />, active: false, onClick: onOpenMore },
  ];

  return (
    <nav aria-label="Main" className="md:hidden h-16 shrink-0 border-t border-line bg-surface flex items-stretch z-30">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={item.onClick}
          aria-label={item.ariaLabel}
          aria-current={item.active ? 'page' : undefined}
          className={`relative flex-1 flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors [&>svg]:h-5 [&>svg]:w-5 ${
            item.active ? 'text-accent' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.badge && (
            <span aria-hidden="true" className="absolute top-1.5 left-1/2 ml-2 px-1 rounded-full bg-warning-ink text-canvas text-[10px] leading-4 font-bold">
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
};
