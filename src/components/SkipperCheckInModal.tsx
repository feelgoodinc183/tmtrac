import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Anchor,
  Compass,
  Radio,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Search,
  Check,
  Plus,
} from 'lucide-react';
import { Boat, DeviceGpsState } from '../types/regatta';
import { deviceTrackerService } from '../services/deviceTrackerService';

interface SkipperCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  boats: Boat[];
  targetBoatId?: string | null;
  targetSailNumber?: string | null;
  activeRoomCode?: string;
  deviceGps: DeviceGpsState;
  isAdmin?: boolean;
  onBindAndStartGps?: (boatId: string, skipperName?: string) => void;
  onToggleDeviceGps?: () => void;
  onBindNodeToBoat?: (nodeId: string, boatId: string) => void;
  onSelectBoat?: (boatId: string) => void;
  onSwitchToMapTab?: () => void;
}

export const SkipperCheckInModal: React.FC<SkipperCheckInModalProps> = ({
  isOpen,
  onClose,
  boats,
  targetBoatId,
  targetSailNumber,
  activeRoomCode,
  deviceGps,
  isAdmin = false,
  onBindAndStartGps,
  onToggleDeviceGps,
  onBindNodeToBoat,
  onSelectBoat,
  onSwitchToMapTab,
}) => {
  const [selectedBoatId, setSelectedBoatId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [justActivated, setJustActivated] = useState<boolean>(false);

  // Available boats: if not admin, hide boats already bound to other trackers
  const availableBoats = useMemo(() => {
    if (isAdmin) return boats;
    const localNode = deviceTrackerService.getLocalNode();
    const localNodeId = localNode ? localNode.id : '';
    return boats.filter(
      (b) =>
        !b.nodeId ||
        b.nodeId === localNodeId ||
        b.nodeId === 'LOCAL_PHONE_GPS' ||
        b.id === deviceGps.profile.boundBoatId
    );
  }, [boats, isAdmin, deviceGps.profile.boundBoatId]);

  // Determine initial boat from props
  useEffect(() => {
    if (targetBoatId) {
      const match = boats.find((b) => b.id === targetBoatId);
      if (match) {
        setSelectedBoatId(match.id);
        return;
      }
    }
    if (targetSailNumber) {
      const cleanSail = targetSailNumber.trim().toLowerCase();
      const match = boats.find(
        (b) => b.sailNumber?.trim().toLowerCase() === cleanSail
      );
      if (match) {
        setSelectedBoatId(match.id);
        return;
      }
    }
    // Fallback: If local profile is already bound to a boat
    if (deviceGps.profile.boundBoatId) {
      const match = boats.find((b) => b.id === deviceGps.profile.boundBoatId);
      if (match) {
        setSelectedBoatId(match.id);
        return;
      }
    }
    if (availableBoats.length > 0 && !selectedBoatId) {
      setSelectedBoatId(availableBoats[0].id);
    }
  }, [targetBoatId, targetSailNumber, boats, availableBoats, deviceGps.profile.boundBoatId]);

  const selectedBoat = useMemo(() => {
    return boats.find((b) => b.id === selectedBoatId) || null;
  }, [boats, selectedBoatId]);

  const filteredBoats = useMemo(() => {
    if (!searchQuery.trim()) return availableBoats;
    const q = searchQuery.toLowerCase().trim();
    return availableBoats.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.sailNumber.toLowerCase().includes(q) ||
        b.class.toLowerCase().includes(q) ||
        (b.skipper && b.skipper.toLowerCase().includes(q))
    );
  }, [availableBoats, searchQuery]);

  const isLocalDeviceBound = useMemo(() => {
    if (!selectedBoat) return false;
    const localNode = deviceTrackerService.getLocalNode();
    const localNodeId = localNode ? localNode.id : '';
    return (
      selectedBoat.nodeId === localNodeId ||
      selectedBoat.nodeId === 'LOCAL_PHONE_GPS' ||
      deviceGps.profile.boundBoatId === selectedBoat.id
    );
  }, [selectedBoat, deviceGps.profile.boundBoatId]);

  const isBoundToAnotherDevice = useMemo(() => {
    if (!selectedBoat || !selectedBoat.nodeId) return false;
    return !isLocalDeviceBound;
  }, [selectedBoat, isLocalDeviceBound]);

  if (!isOpen) return null;

  const handleActivateLiveTracking = async () => {
    if (!selectedBoat) return;
    setIsActivating(true);

    try {
      // 1. Configure local device profile to match this boat
      const localNode = deviceTrackerService.getLocalNode();
      const localNodeId = localNode ? localNode.id : '';
      deviceTrackerService.updateProfile({
        deviceName: `${selectedBoat.name} (Phone)`,
        deviceType: 'PHONE',
        role: 'COMPETITOR',
        sailNumber: selectedBoat.sailNumber,
        boundBoatId: selectedBoat.id,
        color: selectedBoat.color || '#00D4FF',
      });

      // 2. Turn on High-Accuracy GPS and bind to boat
      if (onBindAndStartGps) {
        onBindAndStartGps(selectedBoat.id, selectedBoat.skipper);
      } else {
        if (!deviceGps.active && onToggleDeviceGps) {
          onToggleDeviceGps();
        }
        if (onBindNodeToBoat) {
          onBindNodeToBoat(localNodeId, selectedBoat.id);
        }
      }

      if (onSelectBoat) {
        onSelectBoat(selectedBoat.id);
      }

      setJustActivated(true);
      setTimeout(() => {
        setIsActivating(false);
      }, 500);
    } catch (err) {
      console.error('Error activating tracking:', err);
      setIsActivating(false);
    }
  };

  const handleDone = () => {
    onClose();
    if (onSwitchToMapTab) {
      onSwitchToMapTab();
    }
  };

  return (
    <div
      id="skipper-checkin-modal-backdrop"
      className="fixed inset-0 z-[130] bg-lb-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        id="skipper-checkin-modal-card"
        className="bg-lb-0a101d border border-ll-00d4ff/40 rounded-3xl w-full max-w-lg shadow-[0_0_50px_rgba(0,212,255,0.15)] overflow-hidden flex flex-col max-h-[94vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-ll-1e293b bg-lb-0f172a/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-lb-00d4ff/20 text-lt-00d4ff border border-ll-00d4ff/40 flex items-center justify-center shrink-0 shadow-md">
              <Navigation className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-google text-lt-white tracking-wide flex items-center gap-2">
                Skipper Quick Check-In
              </h2>
              <p className="text-xs text-lt-slate-400 font-mono">
                1-Tap Live GPS Fleet Telemetry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-lt-slate-400 hover:text-lt-white rounded-xl hover:bg-lb-slate-800/80 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
          {justActivated ? (
            /* Success confirmation screen */
            <div className="text-center py-6 px-4 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-lb-1e8e3e/20 text-lt-81c995 border border-ll-1e8e3e/50 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-black text-lt-white font-google">
                  Live Tracking Activated!
                </h3>
                <p className="text-xs font-mono text-lt-emerald-400 mt-1">
                  Your phone is now transmitting live coordinates for:
                </p>
                <div className="mt-3 p-3 bg-lb-slate-900 border border-ll-slate-800 rounded-2xl inline-block">
                  <span className="text-sm font-bold text-lt-white font-google">
                    {selectedBoat?.name}
                  </span>
                  <span className="ml-2 px-2 py-0.5 rounded bg-lb-00d4ff/20 text-lt-00d4ff text-xs font-mono font-bold">
                    {selectedBoat?.sailNumber}
                  </span>
                </div>
              </div>

              <div className="text-xs font-mono text-lt-slate-400 max-w-sm mx-auto leading-relaxed">
                Speed Over Ground (SOG), Course (COG), and mark rounding calculations are live. Keep this browser tab open while racing.
              </div>

              <div className="pt-3">
                <button
                  onClick={handleDone}
                  className="w-full py-3.5 px-4 rounded-2xl bg-lb-00d4ff hover:bg-lb-00d4ff/90 text-lt-black font-google font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-ll-00d4ff/20 transition-all cursor-pointer"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Go to Live Race Map</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* If no boats exist in the system */}
              {boats.length === 0 ? (
                <div className="p-6 text-center text-lt-slate-400 font-mono text-sm bg-lb-slate-900/50 rounded-2xl border border-ll-slate-800 space-y-3">
                  <AlertCircle className="w-8 h-8 text-lt-amber-400 mx-auto opacity-80" />
                  <p>No boats registered in this regatta yet.</p>
                  <p className="text-xs text-lt-slate-500">
                    The Race Officer needs to add fleet entries before boats can be bound.
                  </p>
                </div>
              ) : (
                <>
                  {/* Boat Card to Bind */}
                  {selectedBoat && (
                    <div className="bg-gradient-to-b from-lb-131e32 to-lb-0a101d border-2 border-ll-00d4ff/40 rounded-3xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full inline-block shrink-0 shadow-sm"
                            style={{ backgroundColor: selectedBoat.color || '#00D4FF' }}
                          />
                          <div>
                            <h3 className="text-base sm:text-lg font-black text-lt-white font-google leading-tight">
                              {selectedBoat.name}
                            </h3>
                            <span className="text-xs font-mono text-lt-slate-400">
                              {selectedBoat.class}
                            </span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-xl bg-lb-00d4ff/20 text-lt-00d4ff border border-ll-00d4ff/40 text-xs font-mono font-bold">
                          {selectedBoat.sailNumber}
                        </span>
                      </div>

                      {/* Boat Meta Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-lt-slate-300 bg-lb-slate-900/60 rounded-xl p-3 mb-4 border border-ll-slate-800/80">
                        <div>
                          <span className="text-lt-slate-500 block text-xs uppercase">Skipper</span>
                          <span className="font-bold text-lt-white truncate block">
                            {selectedBoat.skipper || 'Not Specified'}
                          </span>
                        </div>
                        <div>
                          <span className="text-lt-slate-500 block text-xs uppercase">Rating / TCC</span>
                          <span className="font-bold text-lt-white block">
                            {selectedBoat.handicapRating
                              ? `${selectedBoat.handicapSystem || 'IRC'} ${selectedBoat.handicapRating}`
                              : 'Standard'}
                          </span>
                        </div>
                      </div>

                      {/* Binding Status Banner */}
                      <div className="mb-4">
                        {isLocalDeviceBound && deviceGps.active ? (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-lb-1e8e3e/20 border border-ll-1e8e3e/50 text-lt-81c995 text-xs font-mono">
                            <CheckCircle2 className="w-4 h-4 shrink-0 animate-pulse" />
                            <span>This boat is currently bound and tracking on your phone!</span>
                          </div>
                        ) : isBoundToAnotherDevice && !isAdmin ? (
                          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-lb-amber-500/15 border border-ll-amber-500/40 text-lt-amber-200 text-xs font-mono">
                            <AlertCircle className="w-4 h-4 text-lt-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold block text-lt-amber-300">Boat Already Bound ({selectedBoat.nodeId})</span>
                              <span>This vessel is actively bound to another device. Re-binding is restricted to Race Officials to protect live race data. Pick an unbound boat below.</span>
                            </div>
                          </div>
                        ) : selectedBoat.nodeId ? (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-lb-amber-500/15 border border-ll-amber-500/40 text-lt-amber-300 text-xs font-mono">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Currently assigned to {selectedBoat.nodeId}. {isAdmin ? '(Admin Override: Tapping below will reassign)' : ''}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-lb-00d4ff/10 border border-ll-00d4ff/30 text-lt-00d4ff text-xs font-mono">
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                            <span>Ready to bind. 1 tap will activate live GPS tracking.</span>
                          </div>
                        )}
                      </div>

                      {/* Primary Action Button: 1-Tap Activate or Locked State */}
                      {isBoundToAnotherDevice && !isAdmin ? (
                        <button
                          disabled
                          className="w-full py-3.5 px-4 rounded-2xl font-google font-bold text-xs bg-lb-slate-800 text-lt-slate-400 border border-ll-slate-700 cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                        >
                          <ShieldCheck className="w-4 h-4 text-lt-amber-400" />
                          <span>Protected: Already Bound to Active Tracker</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleActivateLiveTracking}
                          disabled={isActivating}
                          className={`w-full py-4 px-4 rounded-2xl font-google font-black text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer ${
                            isLocalDeviceBound && deviceGps.active
                              ? 'bg-lb-1e8e3e text-lt-white hover:bg-lb-1e8e3e/90'
                              : 'bg-lb-00d4ff text-lt-020408 hover:bg-lb-00d4ff/90 shadow-ll-00d4ff/30 hover:scale-[1.02] active:scale-95'
                          }`}
                        >
                          <Navigation className={`w-5 h-5 ${isActivating ? 'animate-spin' : 'animate-bounce'}`} />
                          <span>
                            {isActivating
                              ? 'Activating Live GPS...'
                              : isLocalDeviceBound && deviceGps.active
                              ? 'GPS Tracking Active (Tap to Refresh)'
                              : selectedBoat.nodeId && isAdmin
                              ? 'Admin Override: Reassign to This Phone'
                              : '🟢 Activate Live Phone Tracking (1-Tap)'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Switch Boat Selector (if participant needs a different boat) */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-lt-slate-300 uppercase tracking-wider">
                        Not your boat? Pick from Fleet:
                      </span>
                      <span className="text-xs font-mono text-lt-slate-400">
                        {availableBoats.length} available to bind {isAdmin ? `(${boats.length} total)` : ''}
                      </span>
                    </div>

                    {/* Search Field */}
                    {boats.length > 3 && (
                      <div className="relative mb-2">
                        <Search className="w-4 h-4 text-lt-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search by sail number, name, or skipper..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-lb-131e32 border border-ll-233554 rounded-xl pl-9 pr-3 py-2 text-xs text-lt-white font-mono placeholder:text-lt-slate-500 focus:outline-none focus:border-ll-00d4ff"
                        />
                      </div>
                    )}

                    {/* Quick Boat List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-0.5">
                      {filteredBoats.map((b) => {
                        const isSelected = b.id === selectedBoatId;
                        return (
                          <button
                            key={b.id}
                            onClick={() => setSelectedBoatId(b.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                              isSelected
                                ? 'bg-lb-00d4ff/15 border-ll-00d4ff text-lt-white'
                                : 'bg-lb-0f172a/70 border-ll-slate-800 text-lt-slate-300 hover:border-ll-slate-700 hover:bg-lb-slate-800/50'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                  style={{ backgroundColor: b.color || '#00D4FF' }}
                                />
                                <span className="text-xs font-bold font-google truncate block">
                                  {b.name}
                                </span>
                              </div>
                              <span className="text-xs font-mono text-lt-slate-400 block mt-0.5">
                                {b.class} {b.skipper ? `• ${b.skipper}` : ''}
                              </span>
                            </div>

                            <span className="px-1.5 py-0.5 rounded bg-lb-slate-900 text-lt-00d4ff text-xs font-mono font-bold shrink-0">
                              {b.sailNumber}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
