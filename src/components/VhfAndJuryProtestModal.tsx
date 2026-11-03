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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200 font-google">
      <div className="bg-[#0A0F1E]/95 backdrop-blur-md border border-[#334155]/80 w-full max-w-3xl max-h-[calc(100vh-120px)] sm:max-h-[85vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0 rounded-3xl landscape:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#E0E6ED]">
        {/* Header */}
        <div className="px-5 py-4 landscape:py-2.5 bg-[#060B16]/90 border-b border-[#1E293B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#00D4FF]/15 border border-[#00D4FF]/40 flex items-center justify-center text-[#00D4FF] shrink-0 shadow-sm">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2 truncate">
                Digital VHF & Jury Protest Room
                <span className="text-[10px] bg-[#00D4FF]/20 text-[#00D4FF] px-2 py-0.5 rounded-full font-mono border border-[#00D4FF]/30">
                  LORA MESH TELEMETRY
                </span>
              </h2>
              <p className="text-[11px] text-[#64748B] font-mono truncate">
                Encrypted Fleet Text Bulletins, Rule Infringement Audits & SOS Protocols
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/80 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#1E293B] bg-[#060B16]/60 p-2.5 gap-2 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('VHF_BULLETINS')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[130px] ${
              activeTab === 'VHF_BULLETINS'
                ? 'bg-[#00D4FF] text-[#020408] shadow-[0_0_12px_rgba(0,212,255,0.4)]'
                : 'bg-[#0A0F1E] text-[#94A3B8] hover:text-white border border-[#1E293B]'
            }`}
          >
            <Radio className="w-4 h-4" />
            Digital VHF ({bulletins.length})
          </button>

          <button
            onClick={() => setActiveTab('JURY_PROTEST')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[130px] ${
              activeTab === 'JURY_PROTEST'
                ? 'bg-[#C084FC] text-[#020408] shadow-[0_0_12px_rgba(192,132,252,0.4)]'
                : 'bg-[#0A0F1E] text-[#94A3B8] hover:text-white border border-[#1E293B]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Jury Protest ({protestSnapshots.length})
          </button>

          <button
            onClick={() => setActiveTab('MOB_DISTRESS')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[130px] ${
              activeTab === 'MOB_DISTRESS'
                ? 'bg-[#FF4D4D] text-[#020408] shadow-[0_0_12px_rgba(255,77,77,0.4)] animate-pulse'
                : 'bg-[#0A0F1E] text-[#94A3B8] hover:text-white border border-[#1E293B]'
            }`}
          >
            <Flame className="w-4 h-4 text-[#FF4D4D]" />
            SOS / MOB
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar overscroll-contain min-h-0">
          {/* TAB 1: DIGITAL VHF BULLETINS */}
          {activeTab === 'VHF_BULLETINS' && (
            <div className="space-y-5">
              {/* Broadcast Form */}
              <form onSubmit={handlePublishBulletin} className="bg-[#060B16] border border-[#1E293B] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                    <Send className="w-4 h-4 text-[#00D4FF]" />
                    Broadcast Official Mesh Bulletin
                  </span>
                  <span className="text-[10px] text-[#00FF9D] font-mono">
                    ENCRYPTED BROADCAST TO ALL VESSEL NODES
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-[#64748B] block mb-1">
                      Notice Category
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                      className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-xs text-[#00D4FF] font-mono focus:border-[#00D4FF] outline-none"
                    >
                      <option value="GENERAL_ANNOUNCEMENT">General Announcement</option>
                      <option value="COURSE_CHANGE">Course Change / Shorten</option>
                      <option value="POSTPONEMENT">Postponement (AP Flag)</option>
                      <option value="SAFETY_WARNING">Safety / Squall Warning</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-mono text-[#64748B] block mb-1">
                      Bulletin Headline
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Course Shortened at Mark 2 Wing Buoy"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-xs text-white font-mono focus:border-[#00D4FF] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#64748B] block mb-1">
                    Notice Content
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter detailed instructions broadcast to all vessel displays..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-xs text-white font-mono focus:border-[#00D4FF] outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="py-2 px-5 bg-[#00D4FF] hover:bg-cyan-300 text-[#020408] font-bold text-xs rounded-xl transition-all font-mono shadow-[0_0_10px_rgba(0,212,255,0.3)] flex items-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Transmit Over Mesh
                  </button>
                </div>
              </form>

              {/* Published Bulletins Feed & Delivery Receipts */}
              <div className="space-y-3">
                <label className="text-[10px] font-mono uppercase tracking-widest text-[#64748B] block">
                  Broadcast History & Delivery Receipt Matrix
                </label>

                {bulletins.map((b) => (
                  <div key={b.id} className="p-4 bg-[#060B16] rounded-xl border border-[#1E293B] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">{b.title}</span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20">
                          {b.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#64748B] font-mono">
                        {new Date(b.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-[#94A3B8] font-sans leading-relaxed">{b.content}</p>

                    {/* Delivery Receipt Matrix */}
                    <div className="pt-2 border-t border-[#1E293B]/60">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[#64748B] block mb-1.5">
                        Mesh Delivery Acknowledgments ({b.deliveryMatrix.filter((d) => d.status === 'ACKNOWLEDGED').length}/{b.deliveryMatrix.length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {b.deliveryMatrix.map((dm) => (
                          <div
                            key={dm.boatId}
                            className="p-1.5 rounded-lg bg-[#0A0F1E] border border-[#1E293B] flex items-center justify-between text-[10px] font-mono"
                          >
                            <span className="text-white truncate">{dm.boatName}</span>
                            {dm.status === 'ACKNOWLEDGED' ? (
                              <span className="text-[#00FF9D] font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                ACK
                              </span>
                            ) : (
                              <span className="text-[#00D4FF] flex items-center gap-1">
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
              <form onSubmit={handleCreateProtest} className="bg-[#060B16] border border-[#1E293B] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                    <ShieldAlert className="w-4 h-4 text-[#C084FC]" />
                    File Incident Protest Flag (Freeze 5-Min Telemetry)
                  </span>
                  <span className="text-[10px] text-[#C084FC] font-mono">
                    LOCKS POSITIONS & HEADINGS BEFORE & AFTER
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-[#64748B] block mb-1">
                      Protesting Vessel (Protestor)
                    </label>
                    <select
                      value={protestorId}
                      onChange={(e) => setProtestorId(e.target.value)}
                      className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-xs text-[#00D4FF] font-mono focus:border-[#C084FC] outline-none"
                    >
                      {boats.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.sailNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-[#64748B] block mb-1">
                      Respondent Vessel (Involved)
                    </label>
                    <select
                      value={respondentId}
                      onChange={(e) => setRespondentId(e.target.value)}
                      className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-xs text-[#FF4D4D] font-mono focus:border-[#C084FC] outline-none"
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
                  <label className="text-[10px] font-mono text-[#64748B] block mb-1">
                    World Sailing Rule Infringement Claim
                  </label>
                  <input
                    type="text"
                    value={ruleInfringement}
                    onChange={(e) => setRuleInfringement(e.target.value)}
                    className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-xs text-white font-mono focus:border-[#C084FC] outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="py-2 px-5 bg-[#C084FC] hover:bg-purple-300 text-[#020408] font-bold text-xs rounded-xl transition-all font-mono shadow-[0_0_10px_rgba(192,132,252,0.3)] flex items-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Lock 5-Min Telemetry Snapshot
                  </button>
                </div>
              </form>

              {/* Locked Protest Logs */}
              <div className="space-y-3">
                <label className="text-[10px] font-mono uppercase tracking-widest text-[#64748B] block">
                  Arbitration Jury Snapshots ({protestSnapshots.length})
                </label>

                {protestSnapshots.map((snap) => (
                  <div key={snap.id} className="p-4 bg-[#060B16] rounded-xl border border-[#1E293B] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">
                          {snap.protestingBoatName} vs {snap.respondentBoatName}
                        </span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#C084FC]/10 text-[#C084FC] border border-[#C084FC]/20">
                          {snap.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#64748B] font-mono">
                        {new Date(snap.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-[#94A3B8] font-mono">
                      Claim: <strong className="text-white">{snap.ruleInfringement}</strong>
                    </p>

                    {/* Telemetry Scrub Log */}
                    <div className="bg-[#020408] border border-[#1E293B] rounded-lg p-2 text-[10px] font-mono space-y-1">
                      <span className="text-[#64748B] block mb-1">
                        Locked 5-Min Interval Telemetry Records (10s intervals):
                      </span>
                      {snap.telemetryLog5Min.slice(0, 3).map((log, idx) => (
                        <div key={idx} className="flex justify-between text-[#94A3B8]">
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
                <div className="p-5 rounded-2xl bg-[#FF4D4D]/15 border border-[#FF4D4D] space-y-4 shadow-[0_0_24px_rgba(255,77,77,0.3)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[#FF4D4D] text-black animate-bounce">
                        <Flame className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                          EMERGENCY MOB / DISTRESS ACTIVE
                          <span className="text-[10px] bg-[#FF4D4D] text-black px-2 py-0.5 rounded font-bold">
                            PRIORITY BROADCAST
                          </span>
                        </h3>
                        <p className="text-xs text-[#FF4D4D] font-mono">
                          Vessel: {mobAlert.boatName} • Position: {safeFixed(mobAlert.lat, 4)}°N, {safeFixed(mobAlert.lng, 4)}°W
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={onClearMobAlert}
                      className="px-4 py-2 bg-[#060B16] border border-[#FF4D4D] text-[#FF4D4D] font-bold text-xs rounded-xl font-mono hover:bg-[#FF4D4D] hover:text-black transition-all"
                    >
                      Clear Alarm
                    </button>
                  </div>

                  {/* Intercept Vectors */}
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#FF4D4D] block mb-2">
                      Nearest Competitor Intercept Vectors
                    </label>
                    <div className="space-y-2">
                      {mobAlert.interceptingBoats.map((ib) => (
                        <div
                          key={ib.boatId}
                          className="p-3 bg-[#060B16] rounded-xl border border-[#FF4D4D]/40 flex items-center justify-between"
                        >
                          <span className="text-xs font-bold text-white font-mono">{ib.boatName}</span>
                          <div className="text-right font-mono text-xs">
                            <span className="text-[#00D4FF] mr-3">Dist: {safeFixed(ib.distanceNm, 2, '0.00')} NM</span>
                            <span className="text-[#00FF9D] mr-3">Bearing: {ib.bearingDeg}°</span>
                            <span className="text-[#FF4D4D] font-bold">ETA: {ib.etaMinutes} mins</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-[#060B16] rounded-2xl border border-[#1E293B] text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-[#FF4D4D]/10 text-[#FF4D4D] border border-[#FF4D4D]/30 flex items-center justify-center mx-auto">
                    <Flame className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono">Trigger Fleet Emergency Beacon</h3>
                    <p className="text-xs text-[#64748B] font-mono mt-1 max-w-md mx-auto">
                      Overrides all bandwidth optimization rules to broadcast continuous distress beacons, sound alarm horns, and calculate rescue intercept vectors.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center gap-3 max-w-md mx-auto">
                    {boats.map((boat) => (
                      <button
                        key={boat.id}
                        onClick={() => onTriggerMobAlert(boat.id)}
                        className="py-2.5 px-4 bg-[#FF4D4D]/10 hover:bg-[#FF4D4D] text-[#FF4D4D] hover:text-black font-bold text-xs rounded-xl border border-[#FF4D4D]/40 transition-all font-mono"
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
        <div className="px-5 py-3.5 bg-[#060B16]/90 border-t border-[#1E293B] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#00D4FF] text-[#020408] font-bold text-xs shadow-[0_0_12px_rgba(0,212,255,0.3)] hover:bg-cyan-300 transition-all font-mono"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
