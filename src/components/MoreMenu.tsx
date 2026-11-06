import React, { useId } from 'react';
import { BarChart2, Bot, Building2, Database, Globe, Info, QrCode, Radio, ShieldAlert, Trophy, X } from 'lucide-react';
import { Button } from './ui/Button';
import { DialogFrame } from './ui/Dialog';

export interface MoreMenuProps {
  onClose: () => void;
  onOpenResults: () => void;
  onOpenVhfJury: () => void;
  onOpenSpectatorQr: () => void;
  /** Only when there are two boats to compare */
  onOpenHeadToHead?: () => void;
  /** Only when the AI tactician feature is on */
  onOpenChat?: () => void;
  onOpenMqttInspector: () => void;
  onOpenOfflineCache: () => void;
  onOpenLocations: () => void;
  /** Only for club admins and officers */
  onOpenClub?: () => void;
  onOpenAbout: () => void;
}

interface Item {
  label: string;
  hint: string;
  icon: React.ReactNode;
  onSelect?: () => void;
}

/** Everything that isn't setup or racing: jury, sharing, diagnostics, club, locations, About. */
export const MoreMenu: React.FC<MoreMenuProps> = (p) => {
  const titleId = useId();
  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Race day',
      items: [
        { label: 'Results', hint: 'Scores, series and exports', icon: <Trophy />, onSelect: p.onOpenResults },
        { label: 'VHF & jury', hint: 'Bulletins, protests and MOB alert', icon: <ShieldAlert />, onSelect: p.onOpenVhfJury },
        { label: 'Compare boats', hint: 'Speed, VMG and heading side by side', icon: <BarChart2 />, onSelect: p.onOpenHeadToHead },
        { label: 'AI tactician', hint: 'Wind shifts and laylines', icon: <Bot />, onSelect: p.onOpenChat },
        { label: 'Share live view', hint: 'QR code and link for spectators', icon: <QrCode />, onSelect: p.onOpenSpectatorQr },
      ],
    },
    {
      title: 'System',
      items: [
        { label: 'Packet inspector', hint: 'Live MQTT and LoRa packets', icon: <Radio />, onSelect: p.onOpenMqttInspector },
        { label: 'Offline cache', hint: 'What is stored on this device', icon: <Database />, onSelect: p.onOpenOfflineCache },
        { label: 'Regatta locations', hint: 'The sailing area the map centres on', icon: <Globe />, onSelect: p.onOpenLocations },
        { label: 'Club', hint: 'Members, officers and plan', icon: <Building2 />, onSelect: p.onOpenClub },
        { label: 'About TMTRAC', hint: 'Version and contact', icon: <Info />, onSelect: p.onOpenAbout },
      ],
    },
  ];

  return (
    <DialogFrame
      onClose={p.onClose}
      labelledBy={titleId}
      closeOnBackdrop
      overlayClassName="fixed inset-0 z-50 bg-canvas/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
      id="more-menu"
      className="w-full sm:max-w-md max-h-[85dvh] overflow-y-auto custom-scrollbar rounded-t-container sm:rounded-container border border-line bg-surface text-ink shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <h2 id={titleId} className="text-base font-bold">
          More
        </h2>
        <Button variant="ghost" icon={<X />} aria-label="Close" onClick={p.onClose} />
      </div>
      {groups.map((g) => (
        <div key={g.title} className="px-2 py-2">
          <h3 className="px-2 pb-1 text-xs font-bold text-ink-muted">{g.title}</h3>
          <ul>
            {g.items
              .filter((it) => it.onSelect)
              .map((it) => (
                <li key={it.label}>
                  <button
                    type="button"
                    onClick={() => {
                      p.onClose();
                      it.onSelect?.();
                    }}
                    className="w-full min-h-12 flex items-center gap-3 px-2 py-2 rounded-control text-left hover:bg-raised"
                  >
                    <span aria-hidden="true" className="text-accent [&>svg]:w-5 [&>svg]:h-5 shrink-0">
                      {it.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{it.label}</span>
                      <span className="block text-xs text-ink-muted">{it.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </DialogFrame>
  );
};
