import React, { useMemo, useState } from 'react';
import { Flag, RotateCcw, Timer } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Boat, RaceState } from '../types/regatta';
import { getClassRaceState } from '../services/classRaceState';
import { canRecordFinish, finishOrder, xFlagState } from '../services/recallAndFinish';
import { normalizeSail } from '../utils/sailNumber';

const sailOf = (b: Boat) => b.sailNumber || b.name;
const bySail = (a: Boat, b: Boat) => sailOf(a).localeCompare(sailOf(b), undefined, { numeric: true });

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** 1st, 2nd, 3rd, 4th, 11th, 21st */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/* ---------- Individual recall: choose the boats ---------- */

interface IndividualRecallDialogProps {
  className: string;
  boats: Boat[];
  /** Boats GPS puts on the course side of the line, ticked to start with */
  suggested: string[];
  onConfirm: (boatIds: string[]) => void;
  onClose: () => void;
}

export const IndividualRecallDialog: React.FC<IndividualRecallDialogProps> = ({ className, boats, suggested, onConfirm, onClose }) => {
  const fleet = useMemo(
    () => boats.filter((b) => b.class === className && (b.status === 'RACING' || b.status === 'OCS')).sort(bySail),
    [boats, className]
  );
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(suggested));
  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const ids = fleet.filter((b) => chosen.has(b.id)).map((b) => b.id);

  return (
    <Dialog
      open
      onClose={onClose}
      role="alertdialog"
      title={`Individual recall: ${className}`}
      description="X flag with one sound (RRS 29.1). Choose the boats over the line at the start."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<Flag />} onClick={() => onConfirm(ids)} disabled={ids.length === 0}>
            {ids.length === 0 ? 'Raise X' : `Raise X for ${ids.length} ${ids.length === 1 ? 'boat' : 'boats'}`}
          </Button>
        </>
      }
    >
      {fleet.length === 0 ? (
        <p className="text-sm text-ink-muted">No boats are racing in {className}.</p>
      ) : (
        <fieldset className="space-y-1.5 max-h-72 overflow-y-auto">
          <legend className="sr-only">Boats over the line</legend>
          {fleet.map((b) => (
            <label key={b.id} className="flex items-center gap-3 p-2.5 min-h-11 rounded-control border border-line bg-canvas cursor-pointer has-[:checked]:border-danger-ink">
              <input type="checkbox" className="w-5 h-5" checked={chosen.has(b.id)} onChange={() => toggle(b.id)} />
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: b.color }} aria-hidden="true" />
              <span className="text-sm text-ink flex-1 min-w-0">
                <strong>{sailOf(b)}</strong> <span className="text-ink-muted">{b.name}</span>
              </span>
              {suggested.includes(b.id) && <span className="text-xs text-danger-ink font-semibold">Over by GPS</span>}
            </label>
          ))}
        </fieldset>
      )}
      <p className="text-xs text-ink-muted mt-3">
        The boats are marked OCS and the fleet gets a VHF notice with their sail numbers. GPS only suggests boats; you decide.
      </p>
    </Dialog>
  );
};

/* ---------- X flag up: who still has to come back ---------- */

interface XFlagCardProps {
  className: string;
  raceState: RaceState;
  boats: Boat[];
  now: number;
  /** Which side of the line GPS puts a boat, if known */
  sideOf: (boat: Boat) => 'COURSE' | 'PRE_START' | null;
  onReturned: (boatId: string) => void;
  onLower: () => void;
}

export const XFlagCard: React.FC<XFlagCardProps> = ({ className, raceState, boats, now, sideOf, onReturned, onLower }) => {
  const cs = getClassRaceState(raceState, className);
  const x = xFlagState(cs, boats, now);
  if (!x.up || !cs.xFlag) return null;
  const recalled = cs.xFlag.boatIds.map((id) => boats.find((b) => b.id === id)).filter((b): b is Boat => !!b);
  const secLeft = Math.ceil(x.msLeft / 1000);

  return (
    <section aria-label="X flag" className="sm:col-span-2 p-3 rounded-xl border border-danger-ink bg-danger/10 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-bold text-ink flex items-center gap-2">
          <Flag className="w-4 h-4 text-danger-ink" aria-hidden="true" />X flag up
        </h4>
        <span className="text-xs font-mono text-ink" aria-live="off">
          {secLeft > 0 ? `${formatDuration(secLeft)} left (4 min limit)` : '4 minutes since the start'}
        </span>
      </div>
      {x.shouldLower && (
        <p className="text-sm font-semibold text-danger-ink" role="status">
          {x.stillOver.length === 0 ? 'Every recalled boat has returned. Lower X.' : 'Lower X now: 4 minutes since the start. Boats still OCS stay OCS.'}
        </p>
      )}
      <ul className="space-y-1.5">
        {recalled.map((b) => {
          const over = b.status === 'OCS';
          const side = over ? sideOf(b) : null;
          return (
            <li key={b.id} className="flex items-center gap-2 p-2 rounded-control bg-canvas border border-line">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} aria-hidden="true" />
              <span className="text-sm text-ink flex-1 min-w-0 truncate">
                <strong>{sailOf(b)}</strong> <span className="text-ink-muted">{b.name}</span>
                {side === 'PRE_START' && <span className="block text-xs text-success-ink">GPS: back behind the line</span>}
              </span>
              {over ? (
                <Button onClick={() => onReturned(b.id)}>Returned</Button>
              ) : (
                <span className="text-xs text-success-ink font-semibold px-2">{b.status === 'CLEARED_OCS' ? 'Cleared' : b.status}</span>
              )}
            </li>
          );
        })}
      </ul>
      <Button variant={x.shouldLower ? 'primary' : 'secondary'} onClick={onLower}>Lower X</Button>
    </section>
  );
};

/* ---------- Finishes: one tap per boat ---------- */

interface FinishRecorderProps {
  raceState: RaceState;
  boats: Boat[];
  onRecordFinish: (boatId: string) => void;
  onUndoFinish: (boatId: string) => void;
}

export const FinishRecorder: React.FC<FinishRecorderProps> = ({ raceState, boats, onRecordFinish, onUndoFinish }) => {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const racingClass = (cls: string) => getClassRaceState(raceState, cls).status === 'RACING';
  const toFinish = boats.filter((b) => racingClass(b.class) && canRecordFinish(b)).sort(bySail);
  const finished = finishOrder(boats.filter((b) => racingClass(b.class) || getClassRaceState(raceState, b.class).status === 'FINISHED'));
  const classesRacing = Array.from(new Set(boats.filter((b) => racingClass(b.class)).map((b) => b.class)));

  const record = (b: Boat) => {
    onRecordFinish(b.id);
    const place = finished.filter((f) => f.class === b.class && f.status === 'FINISHED').length + 1;
    setMessage({
      text: b.status === 'OCS' ? `${sailOf(b)} finish recorded. Still OCS: it didn't return to start.` : `${sailOf(b)} finished, ${ordinal(place)} in ${b.class}.`,
      tone: 'ok',
    });
    setQuery('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = normalizeSail(query);
    if (!q) return;
    const digits = q.replace(/\D/g, '');
    const exact = toFinish.filter((b) => normalizeSail(b.sailNumber || '') === q);
    const matches = exact.length ? exact : digits ? toFinish.filter((b) => (b.sailNumber || '').replace(/\D/g, '') === digits) : [];
    if (matches.length === 1) record(matches[0]);
    else if (matches.length === 0) {
      const done = boats.find((b) => normalizeSail(b.sailNumber || '') === q && b.finishTime);
      setMessage({ text: done ? `${sailOf(done)} already has a finish.` : `No racing boat with sail number ${q}.`, tone: 'error' });
    } else setMessage({ text: `${matches.length} boats match ${q}: ${matches.map(sailOf).join(', ')}. Tap the right one.`, tone: 'error' });
  };

  if (classesRacing.length === 0 && finished.length === 0) {
    return (
      <div className="bg-canvas border border-line p-4 rounded-2xl text-sm text-ink-muted">
        Finishes are recorded here once a class has started. Boats with a tracker also finish on their own when they cross the line.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="bg-canvas border border-line p-3.5 rounded-2xl space-y-3">
        <div>
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <Timer className="w-4 h-4" aria-hidden="true" />Record a finish
          </h3>
          <p className="text-xs text-ink-muted">
            Tap a boat as it crosses. The time is taken at the tap, from its class start
            {classesRacing.length ? ` (racing: ${classesRacing.join(', ')})` : ''}.
          </p>
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <label className="flex-1 min-w-0">
            <span className="sr-only">Sail number</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sail number, then Enter"
              inputMode="text"
              autoCapitalize="characters"
              className="w-full min-h-11 bg-surface border border-line rounded-control px-3 text-base text-ink uppercase"
            />
          </label>
          <Button type="submit" variant="primary" disabled={!query.trim()}>Finish</Button>
        </form>
        <p aria-live="polite" className={`text-sm min-h-5 ${message?.tone === 'error' ? 'text-danger-ink' : 'text-success-ink'}`}>
          {message?.text}
        </p>
        {toFinish.length === 0 ? (
          <p className="text-sm text-ink-muted">Every racing boat has a finish.</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto" aria-label="Boats still racing">
            {toFinish.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => record(b)}
                  className={`w-full min-h-14 p-2 rounded-control border text-left transition-[filter] hover:brightness-110 ${
                    b.status === 'OCS' ? 'border-danger-ink bg-danger/10' : 'border-line bg-surface'
                  }`}
                  aria-label={`Finish ${sailOf(b)} ${b.name}${b.status === 'OCS' ? ', OCS' : ''}`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} aria-hidden="true" />
                    <strong className="text-base text-ink truncate">{sailOf(b)}</strong>
                    {b.status === 'OCS' && <span className="ml-auto text-xs font-bold text-danger-ink">OCS</span>}
                  </span>
                  <span className="block text-xs text-ink-muted truncate">{b.name} · {b.class}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-canvas border border-line p-3.5 rounded-2xl space-y-2">
        <h3 className="text-sm font-bold text-ink">Finish order</h3>
        {finished.length === 0 ? (
          <p className="text-sm text-ink-muted">No finishes yet.</p>
        ) : (
          <ol className="divide-y divide-line border border-line rounded-container overflow-hidden max-h-96 overflow-y-auto">
            {finished.map((b, i) => (
              <li key={b.id} className="flex items-center gap-2 px-2.5 py-2 bg-surface/60">
                <span className="w-6 text-right text-xs font-mono text-ink-muted">{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm text-ink">
                    <strong>{sailOf(b)}</strong> <span className="text-ink-muted">{b.name}</span>
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {b.class} · {clock(b.finishTime as number)} · {formatDuration(b.elapsedSeconds)}
                    {b.status === 'OCS' && <span className="text-danger-ink font-semibold"> · scored OCS</span>}
                  </span>
                </span>
                {racingClass(b.class) && (
                  <Button variant="ghost" icon={<RotateCcw />} onClick={() => onUndoFinish(b.id)} aria-label={`Undo finish for ${sailOf(b)}`} />
                )}
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-ink-muted">Undo puts a boat back in the race; its clock runs on from the class start.</p>
      </div>
    </div>
  );
};
