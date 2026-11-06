import React, { useId, useState } from 'react';
import { AlertTriangle, Check, Upload, Users, X } from 'lucide-react';
import { CompetitorImportRecord } from '../types/regatta';
import { parseCompetitorRoster } from '../services/scoringService';
import { safeFixed } from '../utils/formatters';
import { DialogFrame } from './ui/Dialog';

interface RosterImportDialogProps {
  onClose: () => void;
  /** Adds the boats to the fleet; a boat whose sail number is already there is updated */
  onImport: (records: CompetitorImportRecord[]) => void;
}

/** Import a competitor roster (Sailwave / World Sailing CSV, or JSON) into the fleet. */
export const RosterImportDialog: React.FC<RosterImportDialogProps> = ({ onClose, onImport }) => {
  const titleId = useId();
  const [rosterInputText, setRosterInputText] = useState('');
  const [parsedRosterRecords, setParsedRosterRecords] = useState<CompetitorImportRecord[]>([]);
  const [rosterParseError, setRosterParseError] = useState<string | null>(null);

  // Parse Competitor Roster Text or File
  const handleParseRoster = (text: string) => {
    setRosterParseError(null);
    const res = parseCompetitorRoster(text);
    if (res.success && res.records.length > 0) {
      setParsedRosterRecords(res.records);
      setRosterParseError(null);
    } else {
      setParsedRosterRecords([]);
      setRosterParseError(res.error || 'No valid competitor records found. Check format.');
    }
  };

  // Register the parsed boats in the fleet (boats with a known sail number are updated)
  const handleConfirmRosterImport = () => {
    if (parsedRosterRecords.length === 0) return;
    onImport(parsedRosterRecords);
    onClose();
  };

  // Sample CSV template loader
  const handleLoadSampleRoster = () => {
    const sample = `BoatName,SailNo,Skipper,Class,Rating,Club
Ocean Spirit,MAS 101,Azlan Shah,Class 1,1.025,Royal Langkawi Yacht Club
Veloce,SIN 44,Marcus Tan,Class 1,1.010,Changi Sailing Club
Black Baccara,MAS 33,Haris Lee,Class 3,0.920,Royal Selangor Yacht Club
Nirvana,MAS 701,S. Pillai,Class 2,1.050,Penang Port Yacht Club
Tioman Breeze,MAS 88,Farid Zakaria,Class 2,0.985,Tioman Sailing Centre
Wave Runner,MAS 12,Ahmad Kamil,Class 3,0.940,Port Dickson Yacht Club`;
    setRosterInputText(sample);
    handleParseRoster(sample);
  };


  return (
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      overlayClassName="fixed inset-0 z-60 bg-canvas/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200"
      className="bg-surface border border-line w-full max-w-2xl rounded-3xl landscape:rounded-2xl shadow-2xl p-4 sm:p-6 space-y-4 max-h-[90vh] landscape:max-h-[96dvh] flex flex-col text-ink overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-ink/15 border border-line/40 flex items-center justify-center text-ink-muted shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 id={titleId} className="text-base font-bold text-ink flex items-center gap-2">
              Import Competitor Fleet Roster
              <span className="text-xs bg-ink/20 text-ink-muted px-2 py-0.5 rounded-full border border-line/30">
                SAILWAVE &amp; WS
              </span>
            </h3>
            <p className="text-xs text-ink-muted">
              Upload or paste CSV / JSON entries to automatically register boats, sail numbers &amp; ratings
            </p>
          </div>
        </div>
        <button
          aria-label="Close"
          onClick={() => onClose()}
          className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-raised transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
        {/* File drop / select + sample buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="px-3 py-1.5 bg-raised hover:bg-raised text-ink text-xs font-bold rounded-xl border border-line cursor-pointer flex items-center gap-1.5 transition-all">
              <Upload className="w-3.5 h-3.5 text-accent" />
              <span>Upload CSV / JSON</span>
              <input
                type="file"
                accept=".csv,.json,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const content = event.target?.result as string;
                    setRosterInputText(content);
                    handleParseRoster(content);
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
            <button
              onClick={handleLoadSampleRoster}
              className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold rounded-xl border border-accent/30 transition-all"
            >
              Load Sample Roster
            </button>
          </div>

          <span className="text-xs text-ink-muted">
            Headers: BoatName, SailNo, Skipper, Class, Rating
          </span>
        </div>

        {/* Textarea for pasting */}
        <div>
          <textarea
            rows={5}
            value={rosterInputText}
            onChange={(e) => {
              setRosterInputText(e.target.value);
              handleParseRoster(e.target.value);
            }}
            placeholder={`Paste CSV or JSON competitor data here...\ne.g.\nBoatName,SailNo,Skipper,Class,Rating\nOcean Spirit,MAS 101,Azlan Shah,Class 1,1.025`}
            className="w-full bg-canvas border border-line rounded-2xl p-3 text-xs text-ink placeholder:text-ink-muted focus:border-line outline-none"
          />
        </div>

        {/* Parsing status / errors */}
        {rosterParseError && (
          <div className="p-3 rounded-xl bg-danger/15 border border-danger-ink/40 text-danger-ink text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger-ink shrink-0" />
            <span>{rosterParseError}</span>
          </div>
        )}

        {/* Parsed records preview table */}
        {parsedRosterRecords.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-success-ink font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-success-ink" />
                Detected {parsedRosterRecords.length} Competitors:
              </span>
              <span className="text-ink-muted">Ready to register into active fleet</span>
            </div>

            <div className="border border-line rounded-2xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-ink-muted border-b border-line sticky top-0">
                  <tr>
                    <th className="p-2">Sail #</th>
                    <th className="p-2">Boat Name</th>
                    <th className="p-2">Skipper</th>
                    <th className="p-2">Class</th>
                    <th className="p-2 text-right">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-surface">
                  {parsedRosterRecords.map((r, idx) => (
                    <tr key={idx} className="hover:bg-raised/40">
                      <td className="p-2 font-bold text-accent">{r.sailNumber}</td>
                      <td className="p-2 text-ink">{r.name}</td>
                      <td className="p-2 text-ink">{r.skipper}</td>
                      <td className="p-2">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-raised text-ink-muted">
                          {r.className}
                        </span>
                      </td>
                      <td className="p-2 text-right font-bold text-warning-ink">
                        {safeFixed(r.handicapRating, 3, '1.000')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-line shrink-0">
        <button
          onClick={() => onClose()}
          className="px-4 py-2 rounded-xl bg-raised hover:bg-raised text-xs text-ink-muted hover:text-ink transition-all"
        >
          Cancel
        </button>

        <button
          onClick={handleConfirmRosterImport}
          disabled={parsedRosterRecords.length === 0}
          className={`px-5 py-2 rounded-xl text-xs  font-bold flex items-center gap-2 transition-all ${
            parsedRosterRecords.length > 0
              ? 'bg-accent text-on-accent hover:brightness-110'
              : 'bg-raised text-ink-muted cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>Sync {parsedRosterRecords.length} Boats to Fleet</span>
        </button>
      </div>
    </DialogFrame>
  );
};
