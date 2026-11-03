import React, { useState, useEffect, useMemo } from 'react';
import { Boat, MeshtasticNode, HandicapSystem, RaceClass, RaceClassDefinition } from '../types/regatta';
import { X, Radio, Anchor, CheckCircle2, Link2, Unlink, Smartphone, Tablet, Bluetooth, Cpu, AlertCircle, QrCode } from 'lucide-react';
import { formatLastHeard, safeFixed } from '../utils/formatters';

interface NodeBindingModalProps {
  nodes: MeshtasticNode[];
  boats: Boat[];
  onClose: () => void;
  onBindNodeToBoat: (nodeId: string, boatId: string) => void;
  onUnbindNode?: (nodeId: string) => void;
  onCreateNewBoat: (boatData: Omit<Boat, 'id' | 'markRoundings' | 'trail' | 'elapsedSeconds' | 'correctedSeconds' | 'status'>) => void;
  raceClasses?: RaceClassDefinition[];
  initialNodeId?: string;
  initialBoatId?: string;
  onOpenBoatQr?: (boatId: string) => void;
  isAdmin?: boolean;
}

export const NodeBindingModal: React.FC<NodeBindingModalProps> = ({
  nodes,
  boats,
  onClose,
  onBindNodeToBoat,
  onUnbindNode,
  onCreateNewBoat,
  raceClasses = [],
  initialNodeId,
  initialBoatId,
  onOpenBoatQr,
  isAdmin = false,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(() => {
    if (initialNodeId && nodes.some((n) => n.id === initialNodeId)) return initialNodeId;
    return nodes[0]?.id || '';
  });

  const activeNode = nodes.find((n) => n.id === selectedNodeId);

  // If non-admin: hide fleet boats already bound to other nodes
  const selectableBoats = useMemo(() => {
    if (isAdmin) return boats;
    return boats.filter(
      (b) =>
        !b.nodeId ||
        b.nodeId === selectedNodeId ||
        (activeNode && activeNode.boundBoatId === b.id) ||
        (initialBoatId && b.id === initialBoatId)
    );
  }, [boats, isAdmin, selectedNodeId, activeNode, initialBoatId]);

  const [selectedBoatId, setSelectedBoatId] = useState<string>(() => {
    if (initialBoatId && selectableBoats.some((b) => b.id === initialBoatId)) return initialBoatId;
    return selectableBoats[0]?.id || '';
  });

  const [isCreatingBoat, setIsCreatingBoat] = useState(false);

  // Sync if initial props change or if currently empty
  useEffect(() => {
    if (initialNodeId && nodes.some((n) => n.id === initialNodeId)) {
      setSelectedNodeId(initialNodeId);
    } else if (!selectedNodeId && nodes.length > 0) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [initialNodeId, nodes, selectedNodeId]);

  useEffect(() => {
    if (initialBoatId && selectableBoats.some((b) => b.id === initialBoatId)) {
      setSelectedBoatId(initialBoatId);
    } else if (!selectableBoats.some((b) => b.id === selectedBoatId) && selectableBoats.length > 0) {
      setSelectedBoatId(selectableBoats[0].id);
    }
  }, [initialBoatId, selectableBoats, selectedBoatId]);

  // New Boat Form State
  const [newBoatName, setNewBoatName] = useState('');
  const [newSailNumber, setNewSailNumber] = useState('');
  const [newClass, setNewClass] = useState<RaceClass>(raceClasses[0]?.name ?? 'Class 1');
  const [newHandicapSystem, setNewHandicapSystem] = useState<HandicapSystem>('IRC');
  const [newHandicapRating, setNewHandicapRating] = useState('1.000');
  const [newSkipper, setNewSkipper] = useState('');

  const activeBoat = boats.find((b) => b.id === selectedBoatId);

  // Check current binding relation
  const currentlyBoundBoat = activeNode
    ? (activeNode.boundBoatId ? boats.find((b) => b.id === activeNode.boundBoatId) : boats.find((b) => b.nodeId === activeNode.id))
    : null;
  const boatCurrentlyBoundNode = activeBoat
    ? (activeBoat.nodeId ? nodes.find((n) => n.id === activeBoat.nodeId) : nodes.find((n) => n.boundBoatId === activeBoat.id))
    : null;

  const isAlreadyBoundTogether = Boolean(
    activeNode &&
    activeBoat &&
    (activeNode.boundBoatId === activeBoat.id || activeBoat.nodeId === activeNode.id)
  );

  const handleBind = () => {
    if (selectedNodeId && selectedBoatId) {
      onBindNodeToBoat(selectedNodeId, selectedBoatId);
      onClose();
    }
  };

  const handleUnbindCurrent = () => {
    if (selectedNodeId) {
      if (onUnbindNode) {
        onUnbindNode(selectedNodeId);
      } else {
        onBindNodeToBoat(selectedNodeId, '');
      }
    }
  };

  const handleCreateBoat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoatName || !newSailNumber) return;

    const hasValidNodePos = activeNode && typeof activeNode.lat === 'number' && typeof activeNode.lng === 'number' && activeNode.lat !== 0 && activeNode.lng !== 0;

    onCreateNewBoat({
      name: newBoatName.toUpperCase(),
      sailNumber: newSailNumber.toUpperCase(),
      class: newClass,
      handicapSystem: newHandicapSystem,
      handicapRating: parseFloat(newHandicapRating) || 1.0,
      skipper: newSkipper || 'Unknown Skipper',
      nodeId: selectedNodeId || null,
      lat: hasValidNodePos ? activeNode!.lat! : undefined,
      lng: hasValidNodePos ? activeNode!.lng! : undefined,
      sog: hasValidNodePos && typeof activeNode?.speedKt === 'number' ? activeNode.speedKt : 0,
      cog: hasValidNodePos && typeof activeNode?.headingDeg === 'number' ? activeNode.headingDeg : 320,
      vmg: (hasValidNodePos && typeof activeNode?.speedKt === 'number' ? activeNode.speedKt : 7.5) * 0.9,
      dtw: 2.0,
      heading: hasValidNodePos && typeof activeNode?.headingDeg === 'number' ? activeNode.headingDeg : 320,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    });

    setIsCreatingBoat(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-lb-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200 font-google">
      <div className="bg-lb-0a0f1e/95 backdrop-blur-md border border-ll-334155/80 w-full max-w-xl rounded-3xl landscape:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-lt-e0e6ed max-h-[calc(100vh-120px)] sm:max-h-[85vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0">
        {/* Header */}
        <div className="px-5 py-4 landscape:py-2.5 bg-lb-060b16/90 border-b border-ll-1e293b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-lb-00d4ff/15 border border-ll-00d4ff/40 flex items-center justify-center text-lt-00d4ff shrink-0 shadow-sm">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-lt-white flex items-center gap-2 truncate">
                Bind to Tracker
              </h2>
              <p className="text-xs text-lt-64748b font-mono truncate">
                Link Boat to Bluetooth, LoRa Devices, Phones, PCs & Tablets
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar overscroll-contain flex-1 min-h-0">
          {/* Step 1: Select Meshtastic Node */}
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-lt-64748b font-bold block mb-1.5 flex items-center justify-between">
              <span>SELECT TRACKER NODE</span>
              <span className="text-xs text-lt-00d4ff font-normal">{nodes.length} Nodes Available</span>
            </label>

            {nodes.length === 0 ? (
              <div className="p-3 rounded-xl bg-lb-060b16 border border-dashed border-ll-1e293b text-center text-xs text-lt-94a3b8 font-mono">
                No Meshtastic nodes detected. Connect a T-Echo (BLE/USB) or start Phone GPS.
              </div>
            ) : (
              <select
                value={selectedNodeId}
                onChange={(e) => setSelectedNodeId(e.target.value)}
                className="w-full bg-lb-060b16 border border-ll-1e293b rounded-xl p-2.5 text-xs sm:text-sm font-mono text-lt-00d4ff focus:border-ll-00d4ff outline-none"
              >
                {nodes.map((node) => {
                  const bound = boats.find((b) => b.id === node.boundBoatId);
                  return (
                    <option key={node.id} value={node.id}>
                      {node.id} - {node.longName} ({node.connectionType || 'LORA'}) • Bat: {node.battery}% {bound ? `[Bound: ${bound.name}]` : '[Unassigned]'}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Active Node Info Card */}
            {activeNode && (
              <div className="mt-2 p-2.5 rounded-xl bg-lb-060b16 border border-ll-1e293b text-xs font-mono flex items-center justify-between text-lt-94a3b8">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-lb-00d4ff/20 text-lt-00d4ff">
                    {activeNode.connectionType === 'PHONE' ? (
                      <Smartphone className="w-3.5 h-3.5" />
                    ) : activeNode.connectionType === 'TABLET' ? (
                      <Tablet className="w-3.5 h-3.5" />
                    ) : activeNode.isBluetoothConnected ? (
                      <Bluetooth className="w-3.5 h-3.5" />
                    ) : (
                      <Radio className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <span className="text-lt-white font-bold block">{activeNode.longName} ({activeNode.id})</span>
                    <span className="text-lt-64748b">MAC: {activeNode.mac || '24:6F:28:7A:2C:10'} • Model: {activeNode.hardwareModel || 'T-Echo / LoRa'}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-lt-00ff9d font-bold block">⚡ {activeNode.battery}%</span>
                  <span className="text-lt-64748b">Heard: {formatLastHeard(activeNode.lastPingTime)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Target Boat Selector or Creator */}
          {!isCreatingBoat ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-lt-64748b font-bold">
                  2. Select Racing Vessel to Link
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingBoat(true)}
                  className="text-xs text-lt-00d4ff font-mono hover:underline font-bold"
                >
                  + Add New Boat
                </button>
              </div>

              {boats.length === 0 ? (
                <div className="p-4 rounded-xl bg-lb-060b16 border border-dashed border-ll-1e293b text-center">
                  <p className="text-xs text-lt-64748b font-mono mb-2">No vessels currently registered in the fleet.</p>
                  <button
                    type="button"
                    onClick={() => setIsCreatingBoat(true)}
                    className="px-3 py-1.5 bg-lb-00d4ff text-lt-black font-bold text-xs rounded-lg font-mono"
                  >
                    + Register New Boat
                  </button>
                </div>
              ) : !isAdmin && selectableBoats.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-lb-slate-900/60 border border-ll-amber-500/30 text-center space-y-1">
                  <p className="text-xs font-bold text-lt-amber-300 font-mono">All Fleet Vessels Already Bound</p>
                  <p className="text-xs text-lt-slate-400 font-mono">
                    All boats in this regatta are already linked to active nodes. Only Race Officials can reassign or swap trackers.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedBoatId}
                    onChange={(e) => setSelectedBoatId(e.target.value)}
                    className="flex-1 bg-lb-060b16 border border-ll-1e293b rounded-xl p-2.5 text-xs sm:text-sm font-semibold text-lt-white focus:border-ll-00d4ff outline-none min-w-0"
                  >
                    {selectableBoats.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.sailNumber}) - {b.class} [{b.handicapSystem} {safeFixed(b.handicapRating, 3, '1.000')}] {b.nodeId ? `(Node: ${b.nodeId})` : ''}
                      </option>
                    ))}
                  </select>
                  {onOpenBoatQr && selectedBoatId && (
                    <button
                      type="button"
                      onClick={() => onOpenBoatQr(selectedBoatId)}
                      className="p-2.5 rounded-xl bg-lb-00d4ff/15 text-lt-00d4ff border border-ll-00d4ff/40 hover:bg-lb-00d4ff/30 transition-colors shrink-0"
                      title="Show Smart Boat QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Active Boat Details */}
              {activeBoat && (
                <div className="mt-2 p-2.5 rounded-xl bg-lb-060b16 border border-ll-1e293b text-xs font-mono flex items-center justify-between text-lt-94a3b8">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: activeBoat.color }} />
                    <div>
                      <span className="text-lt-white font-bold block">{activeBoat.name} ({activeBoat.sailNumber})</span>
                      <span className="text-lt-64748b">Skipper: {activeBoat.skipper} • {activeBoat.class} ({activeBoat.handicapSystem} {activeBoat.handicapRating})</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-lt-00d4ff font-bold block">SOG: {safeFixed(activeBoat.sog ?? activeBoat.speedKt, 1, '0.0')} kt</span>
                    <span className="text-lt-64748b">Status: {activeBoat.status}</span>
                  </div>
                </div>
              )}

              {/* Conflict / Reassignment Notice */}
              {currentlyBoundBoat && currentlyBoundBoat.id !== selectedBoatId && (
                <div className="mt-2 p-2 rounded-lg bg-lb-amber-500/10 border border-ll-amber-500/30 text-xs font-mono text-lt-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-lt-amber-400" />
                  <span>
                    Node {activeNode?.id} is currently bound to <strong>{currentlyBoundBoat.name}</strong>. Binding will transfer this node to <strong>{activeBoat?.name}</strong>.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateBoat} className="space-y-3 bg-lb-060b16 p-4 rounded-xl border border-ll-1e293b">
              <div className="flex items-center justify-between border-b border-ll-1e293b pb-2">
                <span className="text-xs font-bold text-lt-00d4ff flex items-center gap-1.5 font-google">
                  <Anchor className="w-4 h-4" />
                  Register New Vessel for Node {selectedNodeId}
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingBoat(false)}
                  className="text-xs text-lt-64748b hover:text-lt-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-lt-64748b block mb-1 font-mono">Boat Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VANGUARD"
                    value={newBoatName}
                    onChange={(e) => setNewBoatName(e.target.value)}
                    className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-white uppercase focus:border-ll-00d4ff outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-lt-64748b block mb-1 font-mono">Sail Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MAS 99"
                    value={newSailNumber}
                    onChange={(e) => setNewSailNumber(e.target.value)}
                    className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-white uppercase focus:border-ll-00d4ff outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-lt-64748b block mb-1 font-mono">Race Class</label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value as RaceClass)}
                    className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-white focus:border-ll-00d4ff outline-none"
                  >
                    {raceClasses.length > 0 ? (
                      raceClasses.map((cls) => (
                        <option key={cls.id} value={cls.name}>
                          {cls.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Class 1">Class 1</option>
                        <option value="Class 2">Class 2</option>
                        <option value="Class 3">Class 3</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-lt-64748b block mb-1 font-mono">Rating System</label>
                  <select
                    value={newHandicapSystem}
                    onChange={(e) => setNewHandicapSystem(e.target.value as HandicapSystem)}
                    className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-white focus:border-ll-00d4ff outline-none"
                  >
                    <option value="IRC">IRC TCC</option>
                    <option value="ORC">ORC ToD</option>
                    <option value="PY">Portsmouth (PY)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-lt-64748b block mb-1 font-mono">Rating (e.g. 1.000)</label>
                  <input
                    type="text"
                    value={newHandicapRating}
                    onChange={(e) => setNewHandicapRating(e.target.value)}
                    placeholder="1.000"
                    className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-white focus:border-ll-00d4ff outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-lt-64748b block mb-1 font-mono">Skipper / Helm</label>
                <input
                  type="text"
                  placeholder="e.g. Capt. Azman"
                  value={newSkipper}
                  onChange={(e) => setNewSkipper(e.target.value)}
                  className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg p-2 text-xs text-lt-white focus:border-ll-00d4ff outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-lb-00d4ff text-lt-020408 font-bold text-xs rounded-xl hover:bg-lb-cyan-300 transition-all mt-2 font-mono shadow-md"
              >
                Save & Bind Vessel to Node {selectedNodeId}
              </button>
            </form>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-5 py-3.5 bg-lb-060b16/90 border-t border-ll-1e293b flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div>
            {activeNode?.boundBoatId && !isCreatingBoat && (
              <button
                type="button"
                onClick={handleUnbindCurrent}
                className="px-3.5 py-2 rounded-xl bg-lb-red-500/10 hover:bg-lb-red-500/20 text-lt-red-400 border border-ll-red-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
                title="Unlink node from its current vessel"
              >
                <Unlink className="w-3.5 h-3.5" />
                Unlink Node
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono text-lt-94a3b8 hover:text-lt-white transition-colors"
            >
              Cancel
            </button>

            {!isCreatingBoat && (
              <button
                type="button"
                onClick={handleBind}
                disabled={!selectedNodeId || !selectedBoatId}
                className={`px-5 py-2 rounded-xl font-bold text-xs font-mono transition-all flex items-center gap-2 ${
                  !selectedNodeId || !selectedBoatId
                    ? 'bg-lb-1e293b text-lt-64748b cursor-not-allowed'
                    : isAlreadyBoundTogether
                    ? 'bg-lb-00ff9d text-lt-black shadow-[0_0_12px_rgba(0,255,157,0.4)]'
                    : 'bg-lb-00d4ff text-lt-020408 shadow-[0_0_12px_rgba(0,212,255,0.4)] hover:bg-lb-cyan-300'
                }`}
              >
                {isAlreadyBoundTogether ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Bound (Re-confirm)
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    Bind Node to Boat
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
