import React, { useState } from 'react';
import {
  Smartphone,
  Tablet,
  Laptop,
  Radio,
  Navigation,
  Users,
  Shield,
  Zap,
  Check,
  Copy,
  Share2,
  Crosshair,
  Trash2,
  X,
  AlertTriangle,
  Flag,
  Award,
  LifeBuoy,
  Tv,
} from 'lucide-react';
import {
  DeviceGpsState,
  HybridFleetMember,
  MeshtasticNode,
  Boat,
  TrackerDeviceType,
  TrackerVesselRole,
} from '../types/regatta';
import { deviceTrackerService } from '../services/deviceTrackerService';
import { safeFixed } from '../utils/formatters';

interface DeviceGpsTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceGps: DeviceGpsState;
  onToggleDeviceGps?: () => void;
  fleetMembers?: HybridFleetMember[];
  boats?: Boat[];
  nodes?: MeshtasticNode[];
  viewMode?: 'RC_CONSOLE' | 'SPECTATOR';
  onBindBoat?: (boatId: string) => void;
  onFollowTarget?: (id: string, name: string) => void;
}

export const DeviceGpsTrackerModal: React.FC<DeviceGpsTrackerModalProps> = ({
  isOpen,
  onClose,
  deviceGps,
  onToggleDeviceGps,
  fleetMembers = [],
  boats = [],
  nodes = [],
  viewMode = 'RC_CONSOLE',
  onBindBoat,
  onFollowTarget,
}) => {
  const [activeTab, setActiveTab] = useState<'MY_GPS' | 'FLEET_LIST' | 'SETTINGS'>('MY_GPS');
  const [copiedLink, setCopiedLink] = useState(false);

  // Form states for Device Profile
  const [deviceName, setDeviceName] = useState(deviceGps.profile?.deviceName || 'Mobile Tracker');
  const [deviceType, setDeviceType] = useState<TrackerDeviceType>(deviceGps.profile?.deviceType || 'PHONE');
  const [deviceRole, setDeviceRole] = useState<TrackerVesselRole>(deviceGps.profile?.role || 'COMPETITOR');
  const [boundBoatId, setBoundBoatId] = useState<string>(deviceGps.profile?.boundBoatId || '');
  const [color, setColor] = useState(deviceGps.profile?.color || '#00D4FF');
  const [isBroadcasting, setIsBroadcasting] = useState(deviceGps.profile?.isBroadcasting ?? true);
  const [saveMessage, setSaveMessage] = useState(false);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
    deviceTrackerService.updateProfile({
      deviceName,
      deviceType,
      role: deviceRole,
      boundBoatId: boundBoatId || null,
      color,
      isBroadcasting,
    });
    if (onBindBoat) {
      onBindBoat(boundBoatId || '');
    }
    setSaveMessage(true);
    setTimeout(() => setSaveMessage(false), 2500);
  };

  const handleCopyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Icon helper
  const getDeviceIcon = (type: TrackerDeviceType, className = 'w-4 h-4') => {
    switch (type) {
      case 'PHONE':
        return <Smartphone className={className} />;
      case 'TABLET':
        return <Tablet className={className} />;
      case 'PC':
        return <Laptop className={className} />;
      case 'LORA_TECHO':
      case 'LORA_HELTEC':
      case 'LORA_RAK':
        return <Radio className={className} />;
      default:
        return <Navigation className={className} />;
    }
  };

  const getRoleBadge = (role: TrackerVesselRole) => {
    switch (role) {
      case 'COMPETITOR':
        return { label: 'COMPETITOR', bg: 'bg-accent/20 text-accent border-accent/40', icon: Flag };
      case 'SAFETY_BOAT':
        return { label: 'SAFETY RIB', bg: 'bg-warning-ink/20 text-warning-ink border-warning-ink/40', icon: LifeBuoy };
      case 'RACE_COMMITTEE':
        return { label: 'RACE COMMITTEE', bg: 'bg-danger/20 text-danger-ink border-danger-ink/40', icon: Shield };
      case 'SPECTATOR':
        return { label: 'SPECTATOR', bg: 'bg-success-ink/20 text-success-ink border-success-ink/40', icon: Users };
      case 'VIP_CHASE':
        return { label: 'VIP CHASE', bg: 'bg-ink/20 text-ink-muted border-line/40', icon: Award };
      case 'MEDIA':
        return { label: 'MEDIA / DRONE', bg: 'bg-ink/20 text-ink-muted border-line/40', icon: Tv };
    }
  };

  const totalHybridTrackers = (deviceGps?.active ? 1 : 0) + (fleetMembers?.length || 0) + (nodes?.length || 0);

  return (
    <div className="fixed inset-0 z-50 bg-canvas/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200">
      <div className="bg-surface/95 backdrop-blur-md border border-line/80 rounded-3xl landscape:rounded-2xl w-full max-w-3xl max-h-[calc(100vh-120px)] sm:max-h-[85vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0 flex flex-col shadow-2xl overflow-hidden text-ink">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 landscape:py-2.5 border-b border-line bg-canvas/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent shrink-0 shadow-sm">
              <Navigation className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-ink tracking-tight truncate">
                  Hybrid Fleet & Multi-Device Trackers
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-success-ink/20 text-success-ink border border-success-ink/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-ink" />
                  {totalHybridTrackers} Active Nodes
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5 truncate">
                Join live race tracking from Phone, Tablet, PC or LoRa Device
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-raised/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-line bg-canvas/60 shrink-0 px-3 py-2 gap-1.5 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('MY_GPS')}
            className={`py-3 px-4 text-xs font-bold    border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'MY_GPS'
                ? 'border-accent text-accent bg-accent/5'
                : 'border-transparent text-ink-muted hover:text-ink-muted'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            My Device GPS ({deviceGps.active ? 'LIVE' : 'OFF'})
          </button>

          <button
            onClick={() => setActiveTab('FLEET_LIST')}
            className={`py-3 px-4 text-xs font-bold    border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'FLEET_LIST'
                ? 'border-accent text-accent bg-accent/5'
                : 'border-transparent text-ink-muted hover:text-ink-muted'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Connected Fleet ({fleetMembers.length + (deviceGps.active ? 1 : 0)})
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`py-3 px-4 text-xs font-bold    border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'SETTINGS'
                ? 'border-accent text-accent bg-accent/5'
                : 'border-transparent text-ink-muted hover:text-ink-muted'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Tracker Setup & Role
          </button>

        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

          {/* TAB 1: MY DEVICE GPS */}
          {activeTab === 'MY_GPS' && (
            <div className="space-y-5">
              
              {/* PRIMARY POWER SWITCH CARD */}
              <div className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                deviceGps.active
                  ? 'bg-accent/10 border-accent/50 '
                  : 'bg-surface border-line'
              }`}>
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                    deviceGps.active
                      ? 'bg-accent text-on-accent border-accent'
                      : 'bg-raised text-ink-muted border-line'
                  }`}>
                    {getDeviceIcon(deviceGps.profile?.deviceType || 'PHONE', 'w-6 h-6')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-ink">
                        {deviceGps.profile?.deviceName || 'This Device GPS Tracker'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs  font-bold ${
                        deviceGps.active
                          ? 'bg-success-ink/20 text-success-ink border border-success-ink/30'
                          : 'bg-raised text-ink-muted'
                      }`}>
                        {deviceGps.active ? 'LIVE BROADCASTING' : 'OFFLINE'}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Role: <strong className="text-ink">{deviceGps.profile?.role || 'COMPETITOR'}</strong> • Device ID: <span className="text-accent">{deviceGps.profile?.deviceId}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={onToggleDeviceGps}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl  text-xs font-bold  transition-all shadow-md flex items-center justify-center gap-2 ${
                      deviceGps.active
                        ? 'bg-danger hover:brightness-110 text-on-danger'
                        : 'bg-accent hover:brightness-110 text-on-accent'
                    }`}
                  >
                    <Navigation className="w-4 h-4" />
                    {deviceGps.active ? 'STOP TRACKING' : 'ENABLE LIVE GPS'}
                  </button>
                </div>
              </div>

              {/* GPS ERROR WARNING */}
              {deviceGps.error && (
                <div className="p-3.5 bg-danger/10 border border-danger-ink/40 rounded-xl text-xs text-danger-ink flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-ink">GPS Signal Warning</strong>
                    <span>{deviceGps.error}</span>
                  </div>
                </div>
              )}

              {/* LIVE TELEMETRY STATS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-surface border border-line rounded-xl">
                  <span className="text-xs text-ink-muted block">Speed (SOG)</span>
                  <div className="text-xl font-bold text-accent mt-1">
                    {deviceGps.active && typeof deviceGps.speedKt === 'number' ? safeFixed(deviceGps.speedKt, 1) : '--'}
                    <span className="text-xs text-ink-muted font-normal ml-1">kt</span>
                  </div>
                  <span className="text-xs text-ink-muted">Ground Velocity</span>
                </div>

                <div className="p-3.5 bg-surface border border-line rounded-xl">
                  <span className="text-xs text-ink-muted block">Heading (COG)</span>
                  <div className="text-xl font-bold text-success-ink mt-1">
                    {deviceGps.active && deviceGps.headingDeg !== null ? `${deviceGps.headingDeg}°` : '--'}
                  </div>
                  <span className="text-xs text-ink-muted">Compass Track</span>
                </div>

                <div className="p-3.5 bg-surface border border-line rounded-xl">
                  <span className="text-xs text-ink-muted block">Accuracy</span>
                  <div className="text-xl font-bold text-warning-ink mt-1">
                    {deviceGps.active && deviceGps.accuracy !== null ? `±${deviceGps.accuracy}m` : '--'}
                  </div>
                  <span className="text-xs text-ink-muted">Fix Precision</span>
                </div>

                <div className="p-3.5 bg-surface border border-line rounded-xl">
                  <span className="text-xs text-ink-muted block">Mesh Packets</span>
                  <div className="text-xl font-bold text-ink-muted mt-1">
                    {deviceGps.packetsSent || 0}
                  </div>
                  <span className="text-xs text-ink-muted">Broadcasted Pings</span>
                </div>
              </div>

              {/* COORDINATES & MESH RELAY BOX */}
              <div className="p-4 bg-canvas border border-line rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-ink-muted">GPS Position:</span>
                  <span className="text-ink font-bold">
                    {deviceGps.active && typeof deviceGps.lat === 'number' && typeof deviceGps.lng === 'number'
                      ? `${safeFixed(deviceGps.lat, 6)}° N, ${safeFixed(deviceGps.lng, 6)}° E`
                      : 'Awaiting Hardware Location...'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-ink-muted">Mesh Transport:</span>
                  <span className="text-accent font-bold">
                    WebSocket MQTT + BroadcastChannel Fleet Mesh
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-ink-muted">GNSS Sat Hardware Time:</span>
                  <span className="text-success-ink font-bold flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-success-ink" />
                    {deviceGps.timestamp ? `${new Date(deviceGps.timestamp).toISOString().slice(11, 23)} UTC` : 'Syncing Satellites...'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-ink-muted">Store & Forward Buffer:</span>
                  <span className="font-bold flex items-center gap-1.5">
                    {deviceTrackerService.getOfflineBufferCount() > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-warning-ink/20 text-warning-ink text-xs border border-warning-ink/30">
                        {deviceTrackerService.getOfflineBufferCount()} offline fixes cached
                      </span>
                    ) : (
                      <span className="text-success-ink text-xs">
                        Synced • Zero-Loss Protected
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Bound Race Boat:</span>
                  <span className="text-success-ink font-bold">
                    {deviceGps.profile?.boundBoatId
                      ? boats.find((b) => b.id === deviceGps.profile.boundBoatId)?.name || deviceGps.profile.boundBoatId
                      : 'Independent Participant / Free Fleet Tracker'}
                  </span>
                </div>
              </div>

              {/* LIVE FLEET MEMBERS SECTION */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-accent" />
                    <h4 className="text-xs sm:text-sm font-bold text-ink">
                      Live Fleet Members ({fleetMembers.length + (deviceGps.active ? 1 : 0)})
                    </h4>
                  </div>
                  {fleetMembers.length > 0 && (
                    <button
                      onClick={() => deviceTrackerService.clearRemoteMembers()}
                      className="text-xs text-danger-ink hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear Sim Trackers
                    </button>
                  )}
                </div>

                {/* Local user device card if active */}
                {deviceGps.active && (
                  <div className="p-3 bg-accent/10 border border-accent/50 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-accent text-on-accent flex items-center justify-center font-bold shrink-0">
                        {getDeviceIcon(deviceGps.profile?.deviceType || 'PHONE', 'w-4 h-4')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs text-ink">
                            {deviceGps.profile?.deviceName || 'This Device (My Phone)'}
                          </strong>
                          <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-accent text-on-accent">
                            YOU (LOCAL)
                          </span>
                        </div>
                        <span className="text-xs text-accent">
                          {typeof deviceGps.lat === 'number' && typeof deviceGps.lng === 'number' ? `${safeFixed(deviceGps.lat, 4)}°N, ${safeFixed(deviceGps.lng, 4)}°E` : 'Locating...'} • {safeFixed(deviceGps.speedKt, 1, '0.0')} kt • {Math.round(deviceGps.headingDeg || 0)}°
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onFollowTarget(deviceTrackerService.getLocalNode().id, deviceGps.profile?.deviceName || 'My Device');
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-raised hover:bg-raised text-accent text-xs font-bold flex items-center gap-1 transition-all shrink-0"
                      title="Follow this device on map"
                    >
                      <Crosshair className="w-3 h-3" />
                      Locate
                    </button>
                  </div>
                )}

                {/* Remote fleet members */}
                {fleetMembers.length === 0 && !deviceGps.active ? (
                  <div className="p-5 text-center bg-surface border border-dashed border-line rounded-xl space-y-2.5">
                    <div className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto border border-accent/30">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-ink">No Other Visitors Active Right Now</h4>
                      <p className="text-xs text-ink-muted mt-0.5 max-w-sm mx-auto">
                        Turn on GPS above or open this link on another device to see live fleet members tracking on the map.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fleetMembers.map((member) => {
                      const roleBadge = getRoleBadge(member.role);
                      const RoleIcon = roleBadge.icon;

                      return (
                        <div
                          key={member.deviceId}
                          className="p-3 bg-surface hover:bg-raised border border-line rounded-xl flex items-center justify-between gap-3 transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center border text-ink font-bold shrink-0"
                              style={{ backgroundColor: `${member.color}25`, borderColor: member.color, color: member.color }}
                            >
                              {getDeviceIcon(member.deviceType, 'w-4 h-4')}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-xs font-bold text-ink truncate">{member.deviceName}</span>
                                <span className={`px-1.5 py-0.2 rounded text-xs  font-bold border flex items-center gap-0.5 shrink-0 ${roleBadge.bg}`}>
                                  <RoleIcon className="w-2.5 h-2.5" />
                                  {roleBadge.label}
                                </span>
                              </div>
                              <div className="text-xs text-ink-muted mt-0.5">
                                <span>{safeFixed(member.lat, 4)}°N, {safeFixed(member.lng, 4)}°E</span> •{' '}
                                <span className="text-accent font-bold">{safeFixed(member.speedKt, 1, '—')} kt</span> •{' '}
                                <span className="text-success-ink">{member.headingDeg !== undefined ? `${member.headingDeg}°` : '—'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                onFollowTarget(member.deviceId, member.deviceName);
                                onClose();
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-raised hover:bg-raised text-accent text-xs font-bold flex items-center gap-1 transition-all"
                              title="Follow this device on map"
                            >
                              <Crosshair className="w-3 h-3" />
                              Locate
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* QUICK SHARE BANNER */}
              <div className="p-4 bg-gradient-to-r from-accent/20 to-accent/10 border border-accent/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-ink">Invite Crew & Spectator Devices</h4>
                    <p className="text-xs text-ink-muted">
                      Share this URL with crew on other phones/tablets to view and broadcast on the same live map.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCopyShareLink}
                  className="w-full sm:w-auto px-4 py-2 bg-accent hover:brightness-110 text-on-accent font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-canvas" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Link Copied!' : 'Copy Regatta URL'}
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: CONNECTED FLEET LIST */}
          {activeTab === 'FLEET_LIST' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">All Visiting Devices & Hybrid Trackers</h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Real-time mesh synchronization between mobile phones, tablets, PCs, and LoRa radios.
                  </p>
                </div>

                <button
                  onClick={() => deviceTrackerService.clearRemoteMembers()}
                  className="px-2.5 py-1 text-xs text-danger-ink hover:bg-danger/10 rounded border border-danger-ink/30 transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Remote Trackers
                </button>
              </div>

              <div className="space-y-2.5">
                {/* Local user card if active */}
                {deviceGps.active && (
                  <div className="p-3 bg-accent/10 border border-accent/50 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent text-on-accent flex items-center justify-center">
                        {getDeviceIcon(deviceGps.profile?.deviceType || 'PHONE')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs text-ink">{deviceGps.profile?.deviceName}</strong>
                          <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-accent text-on-accent">
                            YOU (LOCAL)
                          </span>
                        </div>
                        <span className="text-xs text-accent">
                          {safeFixed(deviceGps.lat, 4)}°N, {safeFixed(deviceGps.lng, 4)}°E • {safeFixed(deviceGps.speedKt, 1, '0.0')} kt • ±{deviceGps.accuracy ?? 5}m
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-xs">
                      <span className="text-success-ink font-bold block">{deviceGps.profile?.role}</span>
                      <span className="text-xs text-ink-muted">Broadcasting Live</span>
                    </div>
                  </div>
                )}

                {/* Remote fleet members */}
                {fleetMembers.length === 0 && !deviceGps.active ? (
                  <div className="p-8 text-center bg-surface border border-dashed border-line rounded-2xl space-y-3">
                    <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto border border-accent/30">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-ink">No Other Visitors Active Right Now</h4>
                      <p className="text-xs text-ink-muted mt-1 max-w-md mx-auto">
                        Turn on your device GPS above or open this link on your smartphone to see multiple devices tracking each other on the live marine map.
                      </p>
                    </div>
                  </div>
                ) : (
                  fleetMembers.map((member) => {
                    const roleBadge = getRoleBadge(member.role);
                    const RoleIcon = roleBadge.icon;

                    return (
                      <div
                        key={member.deviceId}
                        className="p-3.5 bg-surface hover:bg-raised border border-line rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center border text-ink font-bold shrink-0"
                            style={{ backgroundColor: `${member.color}25`, borderColor: member.color, color: member.color }}
                          >
                            {getDeviceIcon(member.deviceType)}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-ink">{member.deviceName}</span>
                              <span className={`px-1.5 py-0.2 rounded text-xs  font-bold border flex items-center gap-1 ${roleBadge.bg}`}>
                                <RoleIcon className="w-2.5 h-2.5" />
                                {roleBadge.label}
                              </span>
                            </div>
                            <div className="text-xs text-ink-muted mt-0.5">
                              <span>{safeFixed(member.lat, 4)}°N, {safeFixed(member.lng, 4)}°E</span> •{' '}
                              <span className="text-accent font-bold">{safeFixed(member.speedKt, 1, '—')} kt</span> •{' '}
                              <span className="text-success-ink">{member.headingDeg !== undefined ? `${member.headingDeg}°` : '—'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-line">
                          <button
                            onClick={() => onFollowTarget(`!DEV-${member.deviceId.slice(-4).toUpperCase()}`, member.deviceName)}
                            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-raised hover:bg-raised text-accent text-xs font-bold flex items-center justify-center gap-1 transition-all"
                          >
                            <Crosshair className="w-3 h-3" />
                            Follow
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TRACKER SETUP & ROLE */}
          {activeTab === 'SETTINGS' && (
            <div className="space-y-4">
              <div className="p-4 bg-surface border border-line rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-ink border-b border-line pb-2">
                  My Device Tracker Profile
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tracker Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-ink-muted block">
                      Device Call-Sign / Display Name
                    </label>
                    <input
                      type="text"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="e.g. Capt. Sarah (iPhone 15)"
                      className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                    />
                  </div>

                  {/* Device Hardware Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-ink-muted block">
                      Hardware Tracker Type
                    </label>
                    <select
                      value={deviceType}
                      onChange={(e) => setDeviceType(e.target.value as TrackerDeviceType)}
                      className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                    >
                      <option value="PHONE">Smartphone (iPhone / Android)</option>
                      <option value="TABLET">Marine Tablet (iPad / Galaxy Tab)</option>
                      <option value="PC">Laptop / PC Nav Station</option>
                      <option value="LORA_TECHO">LoRa Device</option>
                    </select>
                  </div>

                  {/* Fleet Role */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-ink-muted block">
                      Regatta / Marine Role
                    </label>
                    <select
                      value={deviceRole}
                      onChange={(e) => setDeviceRole(e.target.value as TrackerVesselRole)}
                      className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                    >
                      <option value="COMPETITOR">Race Competitor (Sailing Boat)</option>
                      <option value="SAFETY_BOAT">Safety / Rescue RIB</option>
                      <option value="RACE_COMMITTEE">Race Committee (RC Signal Boat)</option>
                      <option value="SPECTATOR">Spectator / Supporter</option>
                      <option value="VIP_CHASE">VIP Chase Boat</option>
                      <option value="MEDIA">Media / Drone Vessel</option>
                    </select>
                  </div>

                  {/* Bound Boat Assignment */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-ink-muted block">
                      Bind to Registered Race Boat
                    </label>
                    <select
                      value={boundBoatId}
                      onChange={(e) => setBoundBoatId(e.target.value)}
                      className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                    >
                      <option value="">-- None (Independent Tracker) --</option>
                      {boats.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.sailNumber}) - {b.class}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Marker Color */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs text-ink-muted block">
                    Map Marker Color
                  </label>
                  <div className="flex items-center gap-2">
                    {['#00D4FF', '#00FF9D', '#FF4D4D', '#FF9900', '#C084FC', '#E879F9', '#FBBC04'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${
                          color === c ? 'scale-125 border-line shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Broadcasting Checkbox */}
                <div className="pt-2 border-t border-line">
                  <label className="flex items-center gap-3 cursor-pointer text-xs text-ink select-none">
                    <input
                      type="checkbox"
                      checked={isBroadcasting}
                      onChange={(e) => setIsBroadcasting(e.target.checked)}
                      className="w-4 h-4 rounded text-accent focus:ring-0 focus:outline-none"
                    />
                    <span>Broadcast my GPS position to all race participants and spectators</span>
                  </label>
                </div>

                {/* Save button */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={handleSaveProfile}
                    className="px-6 py-2.5 bg-accent hover:brightness-110 text-on-accent font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Save & Update Profile
                  </button>

                  {saveMessage && (
                    <span className="text-xs text-success-ink animate-fadeIn">
                      Profile Updated Live
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 border-t border-line bg-canvas/90 flex items-center justify-between shrink-0 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2 text-ink-muted">
            <Radio className="w-3.5 h-3.5 text-success-ink" />
            <span className="hidden sm:inline">Hybrid Telemetry: BLE / Serial / Phone GPS / MQTT</span>
            <span className="sm:hidden">Hybrid Telemetry Active</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-raised hover:bg-raised text-ink font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
