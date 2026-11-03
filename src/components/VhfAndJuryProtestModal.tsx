import React, { useState } from 'react';
import { Boat, VhfBulletin, JuryIncidentSnapshot, MobDistressAlert } from '../types/regatta';
import { safeFixed } from '../utils/formatters';
import {
  X,
  Radio,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  FileText,
  Lock,
  Download,
  Flame,
  Volume2,
  Users
} from 'lucide-react';

interface VhfAndJuryProtestModalProps {
  boats: Boat[];
  bulletins: VhfBulletin[];
  onSendBulletin: (bulletin: VhfBulletin) => void;
  mobAlert: MobDistressAlert | null;
  onTriggerMobAlert: (boatId: string) => void;
  onClearMobAlert: () => void;
  protestSnapshots: JuryIncidentSnapshot[];
  onCreateProtestSnapshot: (protestorId: string, respondentId: string, rule: string) => void;
  onClose: () => void;
}

export const VhfAndJuryProtestModal: React.FC<VhfAndJuryProtestModalProps> = ({
  boats,
  bulletins,
  onSendBulletin,
  mobAlert,
  onTriggerMobAlert,
  onClearMobAlert,
  protestSnapshots,
  onCreateProtestSnapshot,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'VHF_BULLETINS' | 'JURY_PROTEST' | 'MOB_DISTRESS'>('VHF_BULLETINS');

  // New VHF Bulletin form
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<VhfBulletin['type']>('GENERAL_ANNOUNCEMENT');

  // New Protest form
  const [protestorId, setProtestorId] = useState<string>(boats[0]?.id || '');
  const [respondentId, setRespondentId] = useState<string>(boats[1]?.id || '');
  const [ruleInfringement, setRuleInfringement] = useState('Rule 10 (On Opposite Tacks / Starboard Boat Right-of-Way)');

  const handlePublishBulletin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const bulletin: VhfBulletin = {
      id: 'vhf-' + Date.now(),
      timestamp: Date.now(),
      type: newType,
      title: newTitle.trim(),
      content: newContent.trim(),
      sender: 'Race Committee Base',
      deliveryMatrix: boats.map((b) => ({
        boatId: b.id,
        boatName: b.name,
        status: 'RECEIVED',
      })),
    };

    onSendBulletin(bulletin);
    setNewTitle('');
    setNewContent('');
  };

  const handleCreateProtest = (e: React.FormEvent) => {
    e.preventDefault();
    if (protestorId === respondentId) return;
    onCreateProtestSnapshot(protestorId, respondentId, ruleInfringement);
  };

  return (
    <div className="fixed inset-0 z-50 bg-lb-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200 font-google">
      <div className="bg-lb-0a0f1e/95 backdrop-blur-md border border-ll-334155/80 w-full max-w-3xl max-h-[calc(100vh-120px)] sm:max-h-[85vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0 rounded-3xl landscape:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-lt-e0e6ed">
        {/* Header */}
        <div className="px-5 py-4 landscape:py-2.5 bg-lb-060b16/90 border-b border-ll-1e293b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-lb-00d4ff/15 border border-ll-00d4ff/40 flex items-center justify-center text-lt-00d4ff shrink-0 shadow-sm">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-lt-white flex items-center gap-2 truncate">
                Digital VHF & Jury Protest Room
                <span className="text-xs bg-lb-00d4ff/20 text-lt-00d4ff px-2 py-0.5 rounded-full font-mono border border-ll-00d4ff/30">
                  LORA MESH TELEMETRY
                </span>
              </h2>
              <p className="text-xs text-lt-64748b font-mono truncate">
                Encrypted Fleet Text Bulletins, Rule Infringement Audits & SOS Protocols
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-lt-94a3b8 hover:text-lt-white hover:bg-lb-1e293b/80 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-ll-1e293b bg-lb-060b16/60 p-2.5 gap-2 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('VHF_BULLETINS')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[130px] ${
              activeTab === 'VHF_BULLETINS'
                ? 'bg-lb-00d4ff text-lt-020408 shadow-[0_0_12px_rgba(0,212,255,0.4)]'
                : 'bg-lb-0a0f1e text-lt-94a3b8 hover:text-lt-white border border-ll-1e293b'
            }`}
          >
            <Radio className="w-4 h-4" />
            Digital VHF ({bulletins.length})
          </button>

          <button
            onClick={() => setActiveTab('JURY_PROTEST')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[130px] ${
              activeTab === 'JURY_PROTEST'
                ? 'bg-lb-c084fc text-lt-020408 shadow-[0_0_12px_rgba(192,132,252,0.4)]'
                : 'bg-lb-0a0f1e text-lt-94a3b8 hover:text-lt-white border border-ll-1e293b'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Jury Protest ({protestSnapshots.length})
          </button>

          <button
            onClick={() => setActiveTab('MOB_DISTRESS')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[130px] ${
              activeTab === 'MOB_DISTRESS'
                ? 'bg-lb-ff4d4d text-lt-020408 shadow-[0_0_12px_rgba(255,77,77,0.4)] animate-pulse'
                : 'bg-lb-0a0f1e text-lt-94a3b8 hover:text-lt-white border border-ll-1e293b'
            }`}
          >
            <Flame className="w-4 h-4 text-lt-ff4d4d" />
            SOS / MOB
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar overscroll-contain min-h-0">
          {/* TAB 1: DIGITAL VHF BULLETINS */}
          {activeTab === 'VHF_BULLETINS' && (
            <div className="space-y-5">
              {/* Broadcast Form */}
              <form onSubmit={handlePublishBulletin} className="bg-lb-060b16 border border-ll-1e293b p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-ll-1e293b pb-2">
                  <span className="text-xs font-bold text-lt-white flex items-center gap-2 font-mono">
                    <Send className="w-4 h-4 text-lt-00d4ff" />
                    Broadcast Official Mesh Bulletin
                  </span>
                  <span className="text-xs text-lt-00ff9d font-mono">
                    ENCRYPTED BROADCAST TO ALL VESSEL NODES
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-mono text-lt-64748b block mb-1">
                      Notice Category
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                      className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-00d4ff font-mono focus:border-ll-00d4ff outline-none"
                    >
                      <option value="GENERAL_ANNOUNCEMENT">General Announcement</option>
                      <option value="COURSE_CHANGE">Course Change / Shorten</option>
                      <option value="POSTPONEMENT">Postponement (AP Flag)</option>
                      <option value="SAFETY_WARNING">Safety / Squall Warning</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-mono text-lt-64748b block mb-1">
                      Bulletin Headline
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Course Shortened at Mark 2 Wing Buoy"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-white font-mono focus:border-ll-00d4ff outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-lt-64748b block mb-1">
                    Notice Content
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter detailed instructions broadcast to all vessel displays..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-white font-mono focus:border-ll-00d4ff outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="py-2 px-5 bg-lb-00d4ff hover:bg-lb-cyan-300 text-lt-020408 font-bold text-xs rounded-xl transition-all font-mono shadow-[0_0_10px_rgba(0,212,255,0.3)] flex items-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Transmit Over Mesh
                  </button>
                </div>
              </form>

              {/* Published Bulletins Feed & Delivery Receipts */}
              <div className="space-y-3">
                <label className="text-xs font-mono uppercase tracking-widest text-lt-64748b block">
                  Broadcast History & Delivery Receipt Matrix
                </label>

                {bulletins.map((b) => (
                  <div key={b.id} className="p-4 bg-lb-060b16 rounded-xl border border-ll-1e293b space-y-3">
                    <div className="flex items-center justify-between border-b border-ll-1e293b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-lt-white font-mono">{b.title}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-lb-00d4ff/10 text-lt-00d4ff border border-ll-00d4ff/20">
                          {b.type}
                        </span>
                      </div>
                      <span className="text-xs text-lt-64748b font-mono">
                        {new Date(b.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-lt-94a3b8 font-sans leading-relaxed">{b.content}</p>

                    {/* Delivery Receipt Matrix */}
                    <div className="pt-2 border-t border-ll-1e293b/60">
                      <span className="text-xs font-mono uppercase tracking-widest text-lt-64748b block mb-1.5">
                        Mesh Delivery Acknowledgments ({b.deliveryMatrix.filter((d) => d.status === 'ACKNOWLEDGED').length}/{b.deliveryMatrix.length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {b.deliveryMatrix.map((dm) => (
                          <div
                            key={dm.boatId}
                            className="p-1.5 rounded-lg bg-lb-0a0f1e border border-ll-1e293b flex items-center justify-between text-xs font-mono"
                          >
                            <span className="text-lt-white truncate">{dm.boatName}</span>
                            {dm.status === 'ACKNOWLEDGED' ? (
                              <span className="text-lt-00ff9d font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                ACK
                              </span>
                            ) : (
                              <span className="text-lt-00d4ff flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                RCV
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: JURY ROOM PROTEST SNAPSHOTS */}
          {activeTab === 'JURY_PROTEST' && (
            <div className="space-y-5">
              {/* Trigger Protest Form */}
              <form onSubmit={handleCreateProtest} className="bg-lb-060b16 border border-ll-1e293b p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-ll-1e293b pb-2">
                  <span className="text-xs font-bold text-lt-white flex items-center gap-2 font-mono">
                    <ShieldAlert className="w-4 h-4 text-lt-c084fc" />
                    File Incident Protest Flag (Freeze 5-Min Telemetry)
                  </span>
                  <span className="text-xs text-lt-c084fc font-mono">
                    LOCKS POSITIONS & HEADINGS BEFORE & AFTER
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-lt-64748b block mb-1">
                      Protesting Vessel (Protestor)
                    </label>
                    <select
                      value={protestorId}
                      onChange={(e) => setProtestorId(e.target.value)}
                      className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-00d4ff font-mono focus:border-ll-c084fc outline-none"
                    >
                      {boats.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.sailNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-mono text-lt-64748b block mb-1">
                      Respondent Vessel (Involved)
                    </label>
                    <select
                      value={respondentId}
                      onChange={(e) => setRespondentId(e.target.value)}
                      className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-ff4d4d font-mono focus:border-ll-c084fc outline-none"
                    >
                      {boats.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.sailNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-lt-64748b block mb-1">
                    World Sailing Rule Infringement Claim
                  </label>
                  <input
                    type="text"
                    value={ruleInfringement}
                    onChange={(e) => setRuleInfringement(e.target.value)}
                    className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-white font-mono focus:border-ll-c084fc outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="py-2 px-5 bg-lb-c084fc hover:bg-lb-purple-300 text-lt-020408 font-bold text-xs rounded-xl transition-all font-mono shadow-[0_0_10px_rgba(192,132,252,0.3)] flex items-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Lock 5-Min Telemetry Snapshot
                  </button>
                </div>
              </form>

              {/* Locked Protest Logs */}
              <div className="space-y-3">
                <label className="text-xs font-mono uppercase tracking-widest text-lt-64748b block">
                  Arbitration Jury Snapshots ({protestSnapshots.length})
                </label>

                {protestSnapshots.map((snap) => (
                  <div key={snap.id} className="p-4 bg-lb-060b16 rounded-xl border border-ll-1e293b space-y-3">
                    <div className="flex items-center justify-between border-b border-ll-1e293b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-lt-white font-mono">
                          {snap.protestingBoatName} vs {snap.respondentBoatName}
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-lb-c084fc/10 text-lt-c084fc border border-ll-c084fc/20">
                          {snap.status}
                        </span>
                      </div>
                      <span className="text-xs text-lt-64748b font-mono">
                        {new Date(snap.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-lt-94a3b8 font-mono">
                      Claim: <strong className="text-lt-white">{snap.ruleInfringement}</strong>
                    </p>

                    {/* Telemetry Scrub Log */}
                    <div className="bg-lb-020408 border border-ll-1e293b rounded-lg p-2 text-xs font-mono space-y-1">
                      <span className="text-lt-64748b block mb-1">
                        Locked 5-Min Interval Telemetry Records (10s intervals):
                      </span>
                      {snap.telemetryLog5Min.slice(0, 3).map((log, idx) => (
                        <div key={idx} className="flex justify-between text-lt-94a3b8">
                          <span>T-{log.timeSecAgo}s</span>
                          <span>
                            {snap.protestingBoatName}: SOG {log.boat1.sog}kt COG {log.boat1.cog}°
                          </span>
                          <span>
                            {snap.respondentBoatName}: SOG {log.boat2.sog}kt COG {log.boat2.cog}°
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SOS / MOB EMERGENCY PROTOCOL */}
          {activeTab === 'MOB_DISTRESS' && (
            <div className="space-y-4">
              {mobAlert && mobAlert.active ? (
                <div className="p-5 rounded-2xl bg-lb-ff4d4d/15 border border-ll-ff4d4d space-y-4 shadow-[0_0_24px_rgba(255,77,77,0.3)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-lb-ff4d4d text-lt-black animate-bounce">
                        <Flame className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-lt-white font-mono flex items-center gap-2">
                          EMERGENCY MOB / DISTRESS ACTIVE
                          <span className="text-xs bg-lb-ff4d4d text-lt-black px-2 py-0.5 rounded font-bold">
                            PRIORITY BROADCAST
                          </span>
                        </h3>
                        <p className="text-xs text-lt-ff4d4d font-mono">
                          Vessel: {mobAlert.boatName} • Position: {safeFixed(mobAlert.lat, 4)}°N, {safeFixed(mobAlert.lng, 4)}°W
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={onClearMobAlert}
                      className="px-4 py-2 bg-lb-060b16 border border-ll-ff4d4d text-lt-ff4d4d font-bold text-xs rounded-xl font-mono hover:bg-lb-ff4d4d hover:text-lt-black transition-all"
                    >
                      Clear Alarm
                    </button>
                  </div>

                  {/* Intercept Vectors */}
                  <div>
                    <label className="text-xs font-mono uppercase tracking-widest text-lt-ff4d4d block mb-2">
                      Nearest Competitor Intercept Vectors
                    </label>
                    <div className="space-y-2">
                      {mobAlert.interceptingBoats.map((ib) => (
                        <div
                          key={ib.boatId}
                          className="p-3 bg-lb-060b16 rounded-xl border border-ll-ff4d4d/40 flex items-center justify-between"
                        >
                          <span className="text-xs font-bold text-lt-white font-mono">{ib.boatName}</span>
                          <div className="text-right font-mono text-xs">
                            <span className="text-lt-00d4ff mr-3">Dist: {safeFixed(ib.distanceNm, 2, '0.00')} NM</span>
                            <span className="text-lt-00ff9d mr-3">Bearing: {ib.bearingDeg}°</span>
                            <span className="text-lt-ff4d4d font-bold">ETA: {ib.etaMinutes} mins</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-lb-060b16 rounded-2xl border border-ll-1e293b text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-lb-ff4d4d/10 text-lt-ff4d4d border border-ll-ff4d4d/30 flex items-center justify-center mx-auto">
                    <Flame className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-lt-white font-mono">Trigger Fleet Emergency Beacon</h3>
                    <p className="text-xs text-lt-64748b font-mono mt-1 max-w-md mx-auto">
                      Overrides all bandwidth optimization rules to broadcast continuous distress beacons, sound alarm horns, and calculate rescue intercept vectors.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center gap-3 max-w-md mx-auto">
                    {boats.map((boat) => (
                      <button
                        key={boat.id}
                        onClick={() => onTriggerMobAlert(boat.id)}
                        className="py-2.5 px-4 bg-lb-ff4d4d/10 hover:bg-lb-ff4d4d text-lt-ff4d4d hover:text-lt-black font-bold text-xs rounded-xl border border-ll-ff4d4d/40 transition-all font-mono"
                      >
                        MOB: {boat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-lb-060b16/90 border-t border-ll-1e293b flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-lb-00d4ff text-lt-020408 font-bold text-xs shadow-[0_0_12px_rgba(0,212,255,0.3)] hover:bg-lb-cyan-300 transition-all font-mono"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
