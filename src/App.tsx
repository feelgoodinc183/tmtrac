import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Boat,
  ChatMessage,
  CourseMark,
  MeshtasticNode,
  RaceClassDefinition,
  RaceState,
  MapBasemap,
  WeatherOverlays,
  MapViewSize,
  HardwareConnection,
  RegattaLocation,
  VhfBulletin,
  JuryIncidentSnapshot,
  MobDistressAlert,
  RacePlaybackState,
  DeviceGpsState,
  HybridFleetMember,
  ClassRaceStatus,
  CompletedRace,
  CompetitorImportRecord,
} from './types/regatta';
import {
  INITIAL_MARKS,
  INITIAL_RACE_STATE,
  INITIAL_RACE_CLASSES,
  REGATTA_LOCATIONS,
  INITIAL_VHF_BULLETINS,
} from './services/initialData';
import { INITIAL_SERIES_RACES } from './services/scoringService';
import { Header } from './components/Header';
import { LeaderboardSidebar } from './components/LeaderboardSidebar';
import { MarineMapCanvas } from './components/MarineMapCanvas';
import { Footer } from './components/Footer';
import { ConfirmDialog } from './components/ConfirmDialog';
import { RcCommandConsolePanel } from './components/RcCommandConsolePanel';
import { MobileBottomBar, MobileTab } from './components/MobileBottomBar';
import { SetupPanel, SetupSection, CourseChoice, getSetupStatus } from './components/SetupPanel';
import { MoreMenu } from './components/MoreMenu';
import { RosterImportDialog } from './components/RosterImportDialog';
import { HeadToHeadModal } from './components/HeadToHeadModal';
import { GeminiChatModal } from './components/GeminiChatModal';
import { FEATURES } from './config/features';
import { MqttPacketInspectorModal } from './components/MqttPacketInspectorModal';
import { OfflineCacheModal } from './components/OfflineCacheModal';
import { SpectatorQrModal } from './components/SpectatorQrModal';
import { ConnectDeviceDialog } from './components/ConnectDeviceDialog';
import { VhfAndJuryProtestModal } from './components/VhfAndJuryProtestModal';
import { NmeaAndMalaysiaMeshModal } from './components/NmeaAndMalaysiaMeshModal';
import { RacePlaybackScrubber } from './components/RacePlaybackScrubber';
import { NodeTelemetryModal } from './components/NodeTelemetryModal';
import { DeviceGpsTrackerModal } from './components/DeviceGpsTrackerModal';
import { BoatEditorModal } from './components/BoatEditorModal';
import { ClassManagerModal } from './components/ClassManagerModal';
import { RaceResultsModal } from './components/RaceResultsModal';
import { CourseProfileModal } from './components/CourseProfileModal';
import { AboutModal } from './components/AboutModal';
import { RegattaLobbyModal } from './components/RegattaLobbyModal';
import { PinUnlockModal } from './components/PinUnlockModal';
import { UserAuthModal } from './components/UserAuthModal';
import { UserDashboardModal } from './components/UserDashboardModal';
import { TenantDashboardModal } from './components/TenantDashboardModal';
import { SubscriptionUpgradeModal } from './components/SubscriptionUpgradeModal';
import { CpanelDeployModal } from './components/CpanelDeployModal';
import { BoatCheckInQrModal } from './components/BoatCheckInQrModal';
import { SkipperCheckInModal } from './components/SkipperCheckInModal';
import { FrontLandingPage } from './components/FrontLandingPage';
import { SuperAdminModal } from './components/SuperAdminModal';
import { authService } from './services/authService';
import { tenantService } from './services/tenantService';
import { UserAccount, Tenant } from './types/regatta';
import { getSavedCourseProfiles, relocateCourseMarksToLocation } from './services/courseProfileService';
import { generateRaceHighlights, recordedRaceDurationSec } from './services/highlightService';
import { meshtasticService } from './services/meshtasticBleMqttService';
import { deviceTrackerService, getDefaultDeviceProfile } from './services/deviceTrackerService';
import { roomService } from './services/roomService';
import { serverNow } from './services/serverClock';
import { getClassRaceState } from './services/classRaceState';
import { computeLiveBoatStatus, createTrackerFixApplier, TrackerFix } from './services/trackerFix';
import { createTrackerRelayGate, isFixFresh, nodeFixTime } from './services/trackerRelay';
import { canonicalNodeId, clearLegacyTrackerIds, sameNodeId } from './utils/nodeId';
import {
  addCourseMark,
  removeCourseMark,
  moveMarkOrder,
  updateMarkCoordinates,
  updateMarkSettings,
  generateCoursePreset,
  evaluateBoatCourseProgress,
  replayBatchThroughCourseProgress,
} from './services/courseService';
import { getMapCenter, fitMapTo } from './services/mapView';

type CoursePresetType = 'WINDWARD_LEEWARD' | 'TRIANGLE' | 'TRAPEZOID';
const COURSE_PRESET_LABEL: Record<CoursePresetType, string> = {
  WINDWARD_LEEWARD: 'Windward-Leeward',
  TRIANGLE: 'Olympic Triangle',
  TRAPEZOID: 'Trapezoid',
};
import { Navigation, Trophy, X } from 'lucide-react';
import { formatBattery, nodeStatusFromLastPing } from './utils/formatters';

/** Boat colours, distinct on the map */
const BOAT_PALETTE = ['#00D4FF', '#00FF9D', '#FBBC04', '#EA4335', '#A142F4', '#FF8A80', '#38BDF8', '#F43F5E'];

const isValidNumber = (val: any): boolean => typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val);

export function deduplicateBoats(boatList: Boat[]): Boat[] {
  if (!Array.isArray(boatList)) return [];
  const seenIds = new Set<string>();
  const result: Boat[] = [];
  for (const b of boatList) {
    if (!b || !b.id) continue;
    if (!seenIds.has(b.id)) {
      seenIds.add(b.id);
      result.push(b);
    }
  }
  return result;
}

export function deduplicateNodes(nodeList: MeshtasticNode[]): MeshtasticNode[] {
  if (!Array.isArray(nodeList)) return [];
  const seenIds = new Set<string>();
  const result: MeshtasticNode[] = [];
  for (const n of nodeList) {
    if (!n || !n.id) continue;
    const id = canonicalNodeId(n.id);
    if (!seenIds.has(id)) {
      seenIds.add(id);
      result.push(n);
    }
  }
  return result;
}



// Before classes were room state they were kept per browser under this key. Returns them once
// (and removes the key) so a Race Officer's existing classes move to the room they open next.
const LEGACY_RACE_CLASSES_KEY = 'regatta_race_classes';
function takeLegacyRaceClasses(): RaceClassDefinition[] | null {
  try {
    const saved = localStorage.getItem(LEGACY_RACE_CLASSES_KEY);
    if (!saved) return null;
    localStorage.removeItem(LEGACY_RACE_CLASSES_KEY);
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (c: any) => c && typeof c.id === 'string' && c.id && typeof c.name === 'string' && c.name.trim()
    );
    // Unchanged defaults aren't worth saving to the room
    const isDefaults =
      valid.length === INITIAL_RACE_CLASSES.length &&
      valid.every((c: any, i: number) => JSON.stringify(c) === JSON.stringify(INITIAL_RACE_CLASSES[i]));
    return valid.length > 0 && !isDefaults ? valid : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [raceState, setRaceState] = useState<RaceState>(INITIAL_RACE_STATE);
  // Race classes belong to the room: they come from the server and edits go back through
  // deviceTrackerService. The defaults show until the room has classes of its own.
  const [raceClasses, setRaceClasses] = useState<RaceClassDefinition[]>(INITIAL_RACE_CLASSES);
  const [boats, setBoats] = useState<Boat[]>([]);
  const boatsRef = useRef(boats);
  boatsRef.current = boats;
  const [nodes, setNodes] = useState<MeshtasticNode[]>([]);
  const [marks, setMarks] = useState<CourseMark[]>(INITIAL_MARKS);

  // Tracker subscriptions are set up once, so they read race state, marks and boats through refs
  // to always score against the current values rather than the ones from the first render.
  const raceStateRef = useRef(raceState);
  raceStateRef.current = raceState;
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const [applyTrackerFix] = useState(() =>
    createTrackerFixApplier(() => raceStateRef.current, () => marksRef.current)
  );
  const playHornRef = useRef<(frequency?: number, durationMs?: number, forcePlay?: boolean) => void>(() => {});
  // Decides when a LoRa tracker update is shared with the room and applied to its boat
  // (binding checked first; repeated fixes not re-scored; relayed at least every 60 s)
  const [trackerRelay] = useState(() => createTrackerRelayGate());

  // Boat edits are sent to the room once React has applied them, not from inside the setBoats
  // updater: React may run an updater more than once (always twice in development's StrictMode),
  // which sent every change to the room twice. An updater only marks that the boats need sending,
  // which is safe to repeat; the effect below sends the committed boats once.
  const boatsBroadcastPendingRef = useRef(false);
  const pendingHornRef = useRef<{ frequency: number; durationMs: number } | null>(null);
  const scheduleBoatsBroadcast = () => {
    boatsBroadcastPendingRef.current = true;
  };
  useEffect(() => {
    if (boatsBroadcastPendingRef.current) {
      boatsBroadcastPendingRef.current = false;
      // Only the race office sends the fleet. A skipper's device that relays its tracker moves the
      // boat on its own map too, but the server would refuse the fleet (and show "not saved").
      if (canEditRef.current) deviceTrackerService.broadcastBoats(boats);
    }
    const horn = pendingHornRef.current;
    if (horn) {
      pendingHornRef.current = null;
      playHornRef.current(horn.frequency, horn.durationMs);
    }
  }, [boats]);

  const applyFixAndBroadcast = (prevBoats: Boat[], fix: TrackerFix): Boat[] => {
    const res = applyTrackerFix(prevBoats, fix);
    if (!res.changed) return prevBoats;
    if (res.rounding) {
      pendingHornRef.current = res.rounding.isFinished
        ? { frequency: 880, durationMs: 1000 }
        : { frequency: 660, durationMs: 400 };
    }
    scheduleBoatsBroadcast();
    return res.boats;
  };
  const [selectedBoatId, setSelectedBoatId] = useState<string | null>(null);
  const [activeRoomCode, setActiveRoomCode] = useState<string>(() => roomService.getActiveRoomCode());
  const [isOrganizer, setIsOrganizer] = useState<boolean>(() => roomService.isOrganizer());
  const [showLobbyModal, setShowLobbyModal] = useState<boolean>(false);
  const [showPinUnlockModal, setShowPinUnlockModal] = useState<boolean>(false);
  const soundedSecondsRef = useRef<Set<string>>(new Set());

  // User Management, Authentication & Tenant Dashboard States
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => authService.getCurrentUser());
  // Edit controls follow the server's answer for this room (PIN, own-club role, owner); an
  // Admin or Race Officer account from another club does not get them.
  const isUserAdminOrOfficer = Boolean(isOrganizer || currentUser?.isSuperAdmin || authService.isSuperAdmin());
  const canEditRef = useRef(isUserAdminOrOfficer);
  canEditRef.current = isUserAdminOrOfficer;
  // Unlocked with the skipper PIN in this room (the server's role for this connection)
  const [isSkipper, setIsSkipper] = useState(() => roomService.isParticipant());
  // Shown when the server refuses an edit, so a change never looks saved when it wasn't
  const [saveRejection, setSaveRejection] = useState<{ action: string; roomCode: string; at: number } | null>(null);
  // Boats that pointed at a tracker id from an older version and need their tracker attached again
  const [trackersToReattach, setTrackersToReattach] = useState<string[]>([]);

  useEffect(() => {
    return deviceTrackerService.onEditRejected((rejection) => {
      setSaveRejection({ action: rejection.action, roomCode: rejection.roomCode, at: Date.now() });
      // The server is the authority on edit rights; hide controls it won't accept
      setIsOrganizer(false);
    });
  }, []);

  useEffect(() => {
    if (!saveRejection) return;
    const timer = setTimeout(() => setSaveRejection(null), 8000);
    return () => clearTimeout(timer);
  }, [saveRejection]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(() => tenantService.getCurrentTenant());
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'register-participant' | 'register-org'>('login');
  const [showDashboardModal, setShowDashboardModal] = useState<boolean>(false);
  const [showTenantDashboard, setShowTenantDashboard] = useState<boolean>(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [showCpanelDeployModal, setShowCpanelDeployModal] = useState<boolean>(false);
  const [showSuperAdminModal, setShowSuperAdminModal] = useState<boolean>(false);
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room') || params.get('event') || params.get('view') === 'race') {
        return false;
      }
    }
    return true;
  });

  useEffect(() => {
    const unsubAuth = authService.onUserChange((u) => {
      setCurrentUser(u);
    });
    const unsubTenant = tenantService.onTenantChange((t) => {
      setCurrentTenant(t);
    });
    return () => {
      unsubAuth();
      unsubTenant();
    };
  }, []);
  const [viewMode, setViewMode] = useState<'RC_CONSOLE' | 'SPECTATOR'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('spectator') === 'true' || params.get('view') === 'spectator' || !roomService.isOrganizer()) {
        return 'SPECTATOR';
      }
    }
    return 'RC_CONSOLE';
  });
  const [mobileTab, setMobileTab] = useState<MobileTab>('MAP');

  useEffect(() => {
    if (viewMode === 'SPECTATOR' && mobileTab === 'RC_CONSOLE') setMobileTab('MAP');
  }, [viewMode, mobileTab]);

  // Owners, club admins and officers with an account go straight to the race console once the
  // server confirms they can edit this room (no PIN needed). Once per room, so choosing the
  // spectator view afterwards sticks; "Join as Spectator" is always respected.
  const autoConsoleRoomRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOrganizer || roomService.isSpectatorByChoice()) return;
    if (autoConsoleRoomRef.current === activeRoomCode) return;
    autoConsoleRoomRef.current = activeRoomCode;
    setViewMode('RC_CONSOLE');
    setMobileTab('RC_CONSOLE');
  }, [isOrganizer, activeRoomCode]);
  // Setup (classes, fleet, trackers, course) and the More menu replace the old Control Hub
  const [setupOpen, setSetupOpen] = useState<{ section?: SetupSection } | null>(null);
  const openSetup = (section?: SetupSection) => setSetupOpen({ section });
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showRosterImport, setShowRosterImport] = useState(false);
  // Bumped when Setup is finished, so race control shows the start sequence
  const [sequenceSignal, setSequenceSignal] = useState(0);
  const [connectedPeerCount, setConnectedPeerCount] = useState<number>(1);

  // Sunlight Mode: light, high-contrast theme for use outdoors. Remembered per device.
  const [directSunlightMode, setDirectSunlightMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tmtrac_sunlight_mode') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('tmtrac_sunlight_mode', directSunlightMode ? '1' : '0');
    } catch {}
  }, [directSunlightMode]);

  // The theme lives on <html> so every dialog picks it up; the marketing landing page stays as designed.
  useEffect(() => {
    const root = document.documentElement;
    if (directSunlightMode && !showLandingPage) root.dataset.theme = 'sunlight';
    else delete root.dataset.theme;
  }, [directSunlightMode, showLandingPage]);

  // Hybrid Multi-Device GPS State & Fleet Members
  const [fleetMembers, setFleetMembers] = useState<HybridFleetMember[]>([]);
  const [showHybridTrackerModal, setShowHybridTrackerModal] = useState<boolean>(false);

  const [deviceGps, setDeviceGps] = useState<DeviceGpsState>({
    active: false,
    lat: null,
    lng: null,
    accuracy: null,
    speedKt: null,
    headingDeg: null,
    altitudeMeters: null,
    batteryLevel: null,
    timestamp: null,
    error: null,
    isSharing: true,
    packetsSent: 0,
    profile: getDefaultDeviceProfile(),
  });

  const handleToggleDeviceGps = () => {
    if (deviceGps.active) {
      deviceTrackerService.stopSharingByUser();
    } else {
      deviceTrackerService.startSharingByUser();
    }
  };

  // Subscribe to Hybrid Device Tracker & Realtime Session Engine
  useEffect(() => {
    const unsubGps = deviceTrackerService.onGpsUpdate((gps) => {
      setDeviceGps(gps);

      // Keep local device tracker node in sync within the nodes list
      const localNode = deviceTrackerService.getLocalNode();

      if (!gps.active) {
        // When local mobile device stops Live Tracking, remove its location from the Mesh Topo list
        setNodes((prevNodes) =>
          prevNodes.filter(
            (n) => n.id !== localNode.id && !n.id.includes(localNode.shortName) && !n.longName.includes('(This Device)')
          )
        );
      } else if (isValidNumber(gps.lat) && isValidNumber(gps.lng) && gps.lat !== 0 && gps.lng !== 0) {
        // When user Enables tracking, bring it back onto the list with live coordinates
        localNode.lat = gps.lat;
        localNode.lng = gps.lng;
        localNode.speedKt = isValidNumber(gps.speedKt) ? gps.speedKt! : 0;
        localNode.headingDeg = isValidNumber(gps.headingDeg) ? gps.headingDeg! : 0;

        setNodes((prevNodes) => {
          const idx = prevNodes.findIndex((n) => n.id === localNode.id || n.longName.includes('(This Device)'));
          if (idx >= 0) {
            const updated = [...prevNodes];
            const oldTrail = prevNodes[idx].trail || [];
            const newTrail = [...oldTrail, { lat: localNode.lat!, lng: localNode.lng! }].slice(-1000);
            updated[idx] = { ...prevNodes[idx], ...localNode, trail: newTrail };
            return updated;
          } else {
            return [localNode, ...prevNodes];
          }
        });
      }

      // If our local device GPS is bound to a boat, update the boat directly with real-time coordinates
      if (gps && isValidNumber(gps.lat) && isValidNumber(gps.lng) && gps.lat !== 0 && gps.lng !== 0 && gps.profile?.boundBoatId) {
        const fix: TrackerFix = {
          trackerId: localNode.id,
          boundBoatId: gps.profile.boundBoatId,
          lat: gps.lat!,
          lng: gps.lng!,
          speedKt: isValidNumber(gps.speedKt) ? gps.speedKt! : undefined,
          headingDeg: isValidNumber(gps.headingDeg) ? gps.headingDeg! : undefined,
        };
        setBoats((prevBoats) => applyFixAndBroadcast(prevBoats, fix));
      }
    });

    const unsubFleet = deviceTrackerService.onFleetUpdate((members) => {
      setFleetMembers(members);
      if (Array.isArray(members)) {
        members.forEach((member) => {
          if (member && isValidNumber(member.lat) && isValidNumber(member.lng)) {
            const node = deviceTrackerService.convertMemberToNode(member);
            setNodes((prevNodes) => {
              const idx = prevNodes.findIndex((n) => n.id === node.id);
              if (idx >= 0) {
                const updated = [...prevNodes];
                const boundBoatId = (node.boundBoatId !== undefined && node.boundBoatId !== null) ? node.boundBoatId : prevNodes[idx].boundBoatId;
                updated[idx] = { ...prevNodes[idx], ...node, boundBoatId };
                return updated;
              } else {
                return [node, ...prevNodes];
              }
            });

            // If this tracker is bound to a race boat, update the boat's coordinates immediately
            if (member.boundBoatId || member.deviceId) {
              const fix: TrackerFix = {
                trackerId: member.deviceId,
                boundBoatId: member.boundBoatId,
                lat: member.lat,
                lng: member.lng,
                speedKt: isValidNumber(member.speedKt) ? member.speedKt : undefined,
                headingDeg: isValidNumber(member.headingDeg) ? member.headingDeg : undefined,
              };
              setBoats((prevBoats) => applyFixAndBroadcast(prevBoats, fix));
            }
          }
        });
      }
    });

    const unsubPeers = deviceTrackerService.onPeerCount((count) => {
      setConnectedPeerCount(count);
    });

    const unsubRemoteMarks = deviceTrackerService.onRemoteMarks((syncedMarks) => {
      if (Array.isArray(syncedMarks)) {
        const clean = syncedMarks.filter((m) => m && isValidNumber(m.lat) && isValidNumber(m.lng));
        setMarks(clean);
      }
    });

    const unsubRemoteRace = deviceTrackerService.onRemoteRaceState((syncedRaceState) => {
      if (syncedRaceState) {
        setRaceState((prev) => {
          const prevTime = prev.updatedAt || 0;
          const incomingTime = syncedRaceState.updatedAt || 0;
          if (incomingTime > 0 && prevTime > 0 && incomingTime < prevTime) {
            return prev;
          }

          // If incoming state is in start sequence but missing targetStartTime, derive it from countdownSeconds
          let targetStartTime = syncedRaceState.targetStartTime ?? prev.targetStartTime;
          if (syncedRaceState.startSequenceActive && !targetStartTime && typeof syncedRaceState.countdownSeconds === 'number' && syncedRaceState.countdownSeconds > 0) {
            targetStartTime = serverNow() + (syncedRaceState.countdownSeconds * 1000);
          }

          return {
            ...prev,
            ...syncedRaceState,
            targetStartTime: syncedRaceState.startSequenceActive ? targetStartTime : undefined,
          };
        });
      }
    });

    // Older versions bound boats to placeholder tracker ids ("!TECHO-…") that no tracker reports.
    // Clear them so the boat shows "no tracker" instead of silently never updating.
    const adoptRoomBoats = (incoming: Boat[], canEdit: boolean) => {
      const clean = incoming.filter((b) => b && isValidNumber(b.lat) && isValidNumber(b.lng));
      const { boats: fixed, cleared } = clearLegacyTrackerIds(deduplicateBoats(clean));
      setBoats(fixed);
      if (cleared.length > 0) {
        setTrackersToReattach(cleared.map((b) => b.name || b.sailNumber || b.id));
        if (canEdit) deviceTrackerService.broadcastBoats(fixed);
      }
    };

    const unsubRemoteBoats = deviceTrackerService.onRemoteBoats((syncedBoats) => {
      if (Array.isArray(syncedBoats)) adoptRoomBoats(syncedBoats, false);
    });

    const unsubRemoteVhf = deviceTrackerService.onRemoteVhf((bulletin) => {
      setBulletins((prev) => [bulletin, ...prev]);
    });

    const unsubRemoteClasses = deviceTrackerService.onRemoteClasses((syncedClasses) => {
      if (Array.isArray(syncedClasses) && syncedClasses.length > 0) setRaceClasses(syncedClasses);
    });

    const unsubRemoteSeries = deviceTrackerService.onRemoteSeriesRaces((syncedSeries) => {
      if (Array.isArray(syncedSeries)) {
        setSeriesRaces(syncedSeries);
      }
    });

    const unsubRoom = roomService.onRoomChange((code, isOrg) => {
      setActiveRoomCode(code);
      setIsOrganizer(isOrg);
      setIsSkipper(roomService.isParticipant());
      if (!isOrg) {
        setViewMode('SPECTATOR');
      }
      try {
        const roomSeries = localStorage.getItem(`regatta_race_series_${code}`);
        if (roomSeries) {
          const parsed = JSON.parse(roomSeries);
          if (Array.isArray(parsed)) {
            setSeriesRaces(parsed);
          }
        }
      } catch (e) {}
    });

    const unsubSessionSync = deviceTrackerService.onSessionSync((session) => {
      if (session.roomCode) {
        setActiveRoomCode(session.roomCode);
      }
      if (typeof session.userRole === 'string') setIsSkipper(session.userRole === 'PARTICIPANT');
      if (typeof session.canEdit === 'boolean') {
        setIsOrganizer(session.canEdit);
      } else if (typeof session.isAdmin === 'boolean') {
        setIsOrganizer(session.isAdmin);
      }
      if (session.seriesRaces && Array.isArray(session.seriesRaces)) {
        setSeriesRaces(session.seriesRaces);
      }
      if (session.marks && Array.isArray(session.marks)) {
        const cleanMarks = session.marks.filter((m) => m && isValidNumber(m.lat) && isValidNumber(m.lng));
        setMarks(cleanMarks);
      }
      if (session.raceState) setRaceState((prev) => ({ ...prev, ...session.raceState }));
      const canEditSession = session.canEdit === true || session.isAdmin === true;
      if (session.boats && Array.isArray(session.boats)) {
        adoptRoomBoats(session.boats, canEditSession);
      }
      if (Array.isArray(session.raceClasses) && session.raceClasses.length > 0) {
        setRaceClasses(session.raceClasses);
      } else if ('raceClasses' in session) {
        // The room has no classes yet. A Race Officer whose browser still holds classes from the
        // old per-browser storage sends them to this room once, then the local copy is removed.
        const legacy = canEditSession ? takeLegacyRaceClasses() : null;
        setRaceClasses(legacy || INITIAL_RACE_CLASSES);
        if (legacy) deviceTrackerService.broadcastClasses(legacy);
      }
      if (session.vhfBulletins && Array.isArray(session.vhfBulletins)) setBulletins(session.vhfBulletins);
      if (session.trackers && Array.isArray(session.trackers) && session.trackers.length > 0) {
        session.trackers.forEach((t: any) => {
          if (t && isValidNumber(t.lat) && isValidNumber(t.lng)) {
            const node = deviceTrackerService.convertMemberToNode(t);
            setNodes((prevNodes) => {
              const idx = prevNodes.findIndex((n) => n.id === node.id);
              if (idx >= 0) {
                const updated = [...prevNodes];
                updated[idx] = { ...prevNodes[idx], ...node };
                return updated;
              } else {
                return [node, ...prevNodes];
              }
            });
          }
        });
      }
    });

    const unsubRemoteNode = deviceTrackerService.onRemoteNodeGenerated((remoteNode) => {
      if (!remoteNode || !isValidNumber(remoteNode.lat) || !isValidNumber(remoteNode.lng)) return;
      setNodes((prevNodes) => {
        const idx = prevNodes.findIndex((n) => n.id === remoteNode.id);
        if (idx >= 0) {
          const updated = [...prevNodes];
          const oldTrail = prevNodes[idx].trail || [];
          const validLat = remoteNode.lat!;
          const validLng = remoteNode.lng!;
          const newTrail = [...oldTrail, { lat: validLat, lng: validLng }].slice(-1000);
          const boundBoatId = (remoteNode.boundBoatId !== undefined && remoteNode.boundBoatId !== null) ? remoteNode.boundBoatId : prevNodes[idx].boundBoatId;
          updated[idx] = { ...remoteNode, boundBoatId, trail: newTrail };
          return updated;
        } else {
          return [remoteNode, ...prevNodes];
        }
      });
    });

    // Meshtastic BLE & MQTT live hardware node stream
    const unsubMeshtasticNode = meshtasticService.onNodeUpdate((node) => {
      if (!node) return;
      setNodes((prevNodes) => {
        const idx = prevNodes.findIndex((n) => sameNodeId(n.id, node.id));
        if (idx >= 0) {
          const updated = [...prevNodes];
          const boundBoatId = node.boundBoatId ?? prevNodes[idx].boundBoatId;
          // The service keeps each node's trail from that node's own packets
          updated[idx] = { ...prevNodes[idx], ...node, boundBoatId };
          return updated;
        }
        return [node, ...prevNodes];
      });

      // Positions from the server's MQTT bridge reach every viewer, can be kilometres off on public
      // channels, and anyone on the broker can publish them: show the node, but only the device
      // whose own radio heard the tracker relays it and moves/scores the boat
      if (node.positionSource === 'MQTT') return;

      // Only trackers bound to a boat in this room are shared with the room
      const decision = trackerRelay.decide(node, boatsRef.current);
      if (!decision.boundBoatId) return;

      if (decision.relay) {
        deviceTrackerService.broadcastHardwareNode({ ...node, boundBoatId: decision.boundBoatId });
      }
      if (!decision.applyFix) return;

      const fix: TrackerFix = {
        trackerId: node.id,
        boundBoatId: decision.boundBoatId,
        lat: node.lat!,
        lng: node.lng!,
        speedKt: isValidNumber(node.speedKt) ? node.speedKt : undefined,
        headingDeg: isValidNumber(node.headingDeg) ? node.headingDeg : undefined,
      };
      setBoats((prevBoats) => applyFixAndBroadcast(prevBoats, fix));
    });

    const unsubMeshtasticPacket = meshtasticService.onPacketLog((_pkt) => {
      // Packet stream active
    });

    // Bluetooth tracker connection state drives the hardware status shown everywhere
    const unsubBleStatus = meshtasticService.onBleStatusChange((status) => {
      const connected = status.state === 'connected';
      setHardwareConn((prev) => ({
        ...prev,
        bluetoothConnected: connected,
        bluetoothDeviceName: status.deviceName ?? prev.bluetoothDeviceName,
        activePort: connected ? 'BLE' : prev.activePort === 'BLE' ? 'OFFLINE' : prev.activePort,
      }));
    });

    const unsubMqttStatus = meshtasticService.onMqttStatusChange((status) => {
      setRaceState((prev) => ({ ...prev, mqttConnected: status.connected }));
      if (status.connected) {
        setHardwareConn((prev) => ({
          ...prev,
          activePort: prev.activePort === 'OFFLINE' ? 'MQTT' : prev.activePort,
        }));
      }
    });

    // Handle replayed Store-and-Forward trajectory batches from reconnected phones & LoRa nodes
    const unsubBatchBackfill = deviceTrackerService.onBatchBackfill((payload) => {
      if (!payload || !Array.isArray(payload.points) || payload.points.length === 0) return;

      console.log(`🔄 [Store-and-Forward] Replaying ${payload.points.length} backfilled points for device ${payload.deviceId}`);
      setBoats((prevBoats) => {
        let hasChange = false;
        const updated = prevBoats.map((b) => {
          // The server names the bound boat; fall back to the node id only for older servers that don't
          if (payload.boundBoatId ? b.id === payload.boundBoatId : sameNodeId(b.nodeId, payload.deviceId)) {
            hasChange = true;
            const oldTrail = b.trail || [];
            const newCoords = payload.points.map((p) => ({ lat: p.lat, lng: p.lng }));
            const mergedTrail = [...oldTrail, ...newCoords].slice(-2000);

            const boatClassState = getClassRaceState(raceStateRef.current, b.class);
            const replayedBoat = replayBatchThroughCourseProgress(
              { ...b, trail: mergedTrail },
              marksRef.current,
              payload.points,
              boatClassState.countdownSeconds
            );

            return {
              ...replayedBoat,
              trail: mergedTrail,
            };
          }
          return b;
        });
        return hasChange ? updated : prevBoats;
      });
    });

    return () => {
      unsubRoom();
      unsubGps();
      unsubFleet();
      unsubPeers();
      unsubRemoteMarks();
      unsubRemoteRace();
      unsubRemoteBoats();
      unsubRemoteVhf();
      unsubRemoteSeries();
      unsubRemoteClasses();
      unsubSessionSync();
      unsubRemoteNode();
      unsubMeshtasticNode();
      unsubMeshtasticPacket();
      unsubMqttStatus();
      unsubBleStatus();
      unsubBatchBackfill();
    };
  }, []);

  // Tracker status follows how recently each node was heard (live / stale / offline), even when
  // no packets arrive, so a tracker that goes quiet is shown as such.
  useEffect(() => {
    const refreshStatuses = () => {
      setNodes((prev) => {
        let changed = false;
        const next = prev.map((n) => {
          const status = nodeStatusFromLastPing(n.lastPingTime);
          if (status === n.status) return n;
          changed = true;
          return { ...n, status };
        });
        return changed ? next : prev;
      });
    };
    refreshStatuses();
    const timer = setInterval(refreshStatuses, 15_000);
    return () => clearInterval(timer);
  }, []);

  // Selected Regional Location (Default to Langkawi International Regatta Circuit, Malaysia)
  const [selectedLocation, setSelectedLocation] = useState<RegattaLocation>(REGATTA_LOCATIONS[0]);

  // Hardware Connection State
  const [hardwareConn, setHardwareConn] = useState<HardwareConnection>({
    bluetoothConnected: false,
    bluetoothDeviceName: null,
    usbConnected: false,
    usbPortName: null,
    baudRate: 115200,
    activePort: 'OFFLINE',
    nmeaBridgeActive: false,
    nmeaSentencesPerSec: 5,
    malaysiaPublicMeshActive: true,
  });

  // Map Basemap & Overlays State
  const [basemap, setBasemap] = useState<MapBasemap>('OPEN_SEA_MAP');
  const [overlays, setOverlays] = useState<WeatherOverlays>({
    windParticles: true,
    windBarbs: true,
    isobars: true,
    oceanCurrents: false,
    waveHeatmap: false,
    openSeaMapLayers: true,
  });
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [mapSize, setMapSize] = useState<MapViewSize>('STANDARD');

  // Digital VHF Bulletins & Jury Protest Snapshots
  const [bulletins, setBulletins] = useState<VhfBulletin[]>(INITIAL_VHF_BULLETINS);
  const [protestSnapshots, setProtestSnapshots] = useState<JuryIncidentSnapshot[]>([]);

  // MOB Emergency Alert Protocol
  const [mobAlert, setMobAlert] = useState<MobDistressAlert | null>(null);

  // Race Replay Playback State
  const [playback, setPlayback] = useState<RacePlaybackState>({
    isPlaying: false,
    speedMultiplier: 1,
    currentTimeSec: 0,
    maxDurationSec: 0, // set from the recorded race below
  });

  // Camera Follow State (Boat ID or Node ID)
  const [followedTargetId, setFollowedTargetId] = useState<string | null>(null);

  // Node & Boat Telemetry Inspector Modal State
  const [inspectorTarget, setInspectorTarget] = useState<{
    node: MeshtasticNode | null;
    boat: Boat | null;
  } | null>(null);

  const handleToggleFollow = (id: string, name: string) => {
    if (followedTargetId === id) {
      setFollowedTargetId(null);
    } else {
      setFollowedTargetId(id);
      setSelectedBoatId(id);
    }
  };

  const handleOpenNodeInspector = (node: MeshtasticNode | null, boat: Boat | null) => {
    setInspectorTarget({ node, boat });
  };

  // Modals state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showReplayBar, setShowReplayBar] = useState(false);
  const [showHeadToHead, setShowHeadToHead] = useState(false);
  const [headToHeadPair, setHeadToHeadPair] = useState<[string, string] | null>(null);
  const [showGeminiChat, setShowGeminiChat] = useState(false);
  const [showMqttInspector, setShowMqttInspector] = useState(false);
  const [showOfflineCache, setShowOfflineCache] = useState(false);
  const [showSpectatorQr, setShowSpectatorQr] = useState(false);
  // Smart Boat QR & Skipper Auto-Binding State
  const [showBoatQrModal, setShowBoatQrModal] = useState<boolean>(false);
  const [boatQrTargetId, setBoatQrTargetId] = useState<string | null>(null);

  const [showSkipperCheckInModal, setShowSkipperCheckInModal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return !!(p.get('boat') || p.get('claim') || p.get('sail') || p.get('checkin') === 'true');
    }
    return false;
  });
  const [targetCheckInBoatId, setTargetCheckInBoatId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('boat') || p.get('claim') || null;
    }
    return null;
  });
  const [targetCheckInSail, setTargetCheckInSail] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('sail') || null;
    }
    return null;
  });
  const [showConnectDevice, setShowConnectDevice] = useState(false);
  // What the Connect device wizard was opened for: a boat card (boat) or a heard tracker (node)
  const [connectTarget, setConnectTarget] = useState<{ nodeId?: string; boatId?: string }>({});
  const openConnectDevice = (nodeId?: string, boatId?: string) => {
    setConnectTarget({ nodeId, boatId });
    setShowConnectDevice(true);
  };
  const [showVhfJuryModal, setShowVhfJuryModal] = useState(false);
  const [showNmeaMalaysiaModal, setShowNmeaMalaysiaModal] = useState(false);
  const [showBoatEditorModal, setShowBoatEditorModal] = useState(false);
  const [boatToEdit, setBoatToEdit] = useState<Boat | null>(null);
  const [showClassManager, setShowClassManager] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showCourseProfilesModal, setShowCourseProfilesModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [activeCourseProfileId, setActiveCourseProfileId] = useState<string | null>('profile-rlir-wl');
  const [courseProfileCount, setCourseProfileCount] = useState<number>(() => {
    try {
      return getSavedCourseProfiles().length;
    } catch {
      return 3;
    }
  });

  // Multi-Race Series Storage & Results Management
  const [seriesRaces, setSeriesRaces] = useState<CompletedRace[]>(() => {
    try {
      const saved = localStorage.getItem('regatta_race_series');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load saved race series:', e);
    }
    return INITIAL_SERIES_RACES;
  });

  // Automated Tactical Race Highlights
  const raceHighlights = useMemo(() => {
    return generateRaceHighlights(boats, raceState, marks);
  }, [boats, raceState, marks]);

  // The replay timeline is as long as the recorded race; 0 means nothing recorded yet.
  const recordedDurationSec = useMemo(() => recordedRaceDurationSec(boats, raceState), [boats, raceState]);
  useEffect(() => {
    setPlayback((prev) =>
      prev.maxDurationSec === recordedDurationSec
        ? prev
        : {
            ...prev,
            maxDurationSec: recordedDurationSec,
            currentTimeSec: Math.min(prev.currentTimeSec, recordedDurationSec),
            isPlaying: recordedDurationSec > 0 ? prev.isPlaying : false,
          }
    );
  }, [recordedDurationSec]);

  useEffect(() => {
    try {
      localStorage.setItem('regatta_race_series', JSON.stringify(seriesRaces));
    } catch (e) {
      console.warn('Failed to save race series to localStorage:', e);
    }
  }, [seriesRaces]);

  const handleSaveRaceToSeries = (race: CompletedRace) => {
    setSeriesRaces((prev) => {
      const existingIdx = prev.findIndex(
        (r) => r.id === race.id || (r.raceClass === race.raceClass && r.raceNumber === race.raceNumber)
      );
      let updated: CompletedRace[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = race;
      } else {
        updated = [...prev, race];
      }
      deviceTrackerService.broadcastSeriesRaces(updated);
      try {
        localStorage.setItem(`regatta_race_series_${activeRoomCode}`, JSON.stringify(updated));
        localStorage.setItem('regatta_race_series', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleDeleteRaceFromSeries = (raceId: string) => {
    setSeriesRaces((prev) => {
      const updated = prev.filter((r) => r.id !== raceId);
      deviceTrackerService.broadcastSeriesRaces(updated);
      try {
        localStorage.setItem(`regatta_race_series_${activeRoomCode}`, JSON.stringify(updated));
        localStorage.setItem('regatta_race_series', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleClearSeries = () => {
    setSeriesRaces([]);
    try {
      localStorage.setItem(`regatta_race_series_${activeRoomCode}`, JSON.stringify([]));
      localStorage.setItem('regatta_race_series', JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to clear race series:', e);
    }
    deviceTrackerService.broadcastSeriesRaces([]);
  };

  const handleNewSeries = (resetFleetStatus: boolean = true) => {
    setSeriesRaces([]);
    try {
      localStorage.setItem(`regatta_race_series_${activeRoomCode}`, JSON.stringify([]));
      localStorage.setItem('regatta_race_series', JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to clear race series:', e);
    }
    deviceTrackerService.broadcastSeriesRaces([]);
    if (resetFleetStatus) {
      handleResetForNextRace(1);
    }
  };


  const handleResetForNextRace = (_nextRaceNumber: number) => {
    setBoats((prevBoats) =>
      prevBoats.map((b) => ({
        ...b,
        status: 'PRE_START',
        elapsedSeconds: 0,
        correctedSeconds: 0,
        markRoundings: [],
      }))
    );
    setRaceState((prev) => ({
      ...prev,
      status: 'PRE_START',
      countdownSeconds: 300,
      startSequenceActive: false,
    }));
  };

  // Gemini Chat Messages state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: "Welcome to TMTRAC! I'm your Tactician AI & Mesh Network Engineer. I can analyze vessel VMG, calculate IRC handicap leads, check OCS start line risk, or monitor public Meshtastic LoRa nodes in Malaysia.",
      timestamp: Date.now(),
    },
  ]);

  // Audio Context for Start Signals & Emergency Horns
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (!next) {
        setTimeout(() => playHornSound(660, 250, true), 50);
      }
      return next;
    });
  };

  const playHornSound = (frequency = 440, durationMs = 800, forcePlay = false) => {
    if (isMuted && !forcePlay) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Audio synthesis unavailable:', e);
    }
  };

  playHornRef.current = playHornSound;

  // Replay scrubber tick loop - 250ms high-resolution timer for smooth motion
  useEffect(() => {
    if (!playback.isPlaying) return;

    const interval = setInterval(() => {
      setPlayback((prev) => {
        const nextTime = prev.currentTimeSec + prev.speedMultiplier * 0.25;
        if (nextTime >= prev.maxDurationSec) {
          return { ...prev, currentTimeSec: prev.maxDurationSec, isPlaying: false };
        }
        return { ...prev, currentTimeSec: Math.round(nextTime * 100) / 100 };
      });
    }, 250);

    return () => clearInterval(interval);
  }, [playback.isPlaying, playback.speedMultiplier]);

  // Race Countdown Timer & Audio Signals (Anchored Target Timestamp Architecture)
  // Computes remaining time deterministically against targetStartTime.
  // Zero network packet spam during countdown, ensuring zero jitter/skips across multiple devices.
  useEffect(() => {
    const classStateValues = Object.values(raceState.classStates || {}) as ClassRaceStatus[];
    const hasAnyActiveSequence =
      raceState.startSequenceActive ||
      classStateValues.some((cs) => cs.startSequenceActive);

    if (!hasAnyActiveSequence) return;

    const timer = setInterval(() => {
      const now = serverNow();

      setRaceState((prev) => {
        const currentClassStates: Record<string, ClassRaceStatus> = { ...(prev.classStates || {}) };
        let anyChanged = false;
        let anyGunFired = false;

        // Ensure active class is in classStates map
        if (!currentClassStates[prev.activeClass]) {
          currentClassStates[prev.activeClass] = {
            status: prev.status,
            countdownSeconds: prev.countdownSeconds,
            startSequenceActive: prev.startSequenceActive,
            targetStartTime: prev.targetStartTime,
            startTime: prev.startTime,
          };
        }

        const updatedClassStates = { ...currentClassStates };
        const startingClasses: string[] = [];

        Object.keys(updatedClassStates).forEach((clsKey) => {
          const cs = updatedClassStates[clsKey];
          if (cs && cs.startSequenceActive) {
            // Anchor targetStartTime if missing
            const target = cs.targetStartTime || (now + (cs.countdownSeconds || 300) * 1000);
            const msRemaining = target - now;
            const remainingSec = Math.max(0, Math.ceil(msRemaining / 1000));

            if (remainingSec <= 0) {
              // 0:00 Gun Shot -> RACE START!
              const soundKey = `${clsKey}-START`;
              if (!soundedSecondsRef.current.has(soundKey)) {
                soundedSecondsRef.current.add(soundKey);
                playHornSound(880, 1500, true);
              }
              anyChanged = true;
              anyGunFired = true;
              startingClasses.push(clsKey);
              updatedClassStates[clsKey] = {
                ...cs,
                countdownSeconds: 0,
                status: 'RACING',
                startSequenceActive: false,
                targetStartTime: undefined,
                startTime: target,
                updatedAt: now,
              };
            } else {
              // Sound warning horns at official World Sailing intervals: 5m (300s), 4m (240s), 1m (60s), 5..1s
              const soundKey = `${clsKey}-${remainingSec}`;
              if (!soundedSecondsRef.current.has(soundKey)) {
                soundedSecondsRef.current.add(soundKey);
                if (remainingSec === 300 || remainingSec === 240 || remainingSec === 60) {
                  playHornSound(520, 1000);
                } else if (remainingSec <= 5) {
                  playHornSound(660, 300);
                }
              }

              if (cs.countdownSeconds !== remainingSec || cs.status !== 'COUNTDOWN' || !cs.targetStartTime) {
                anyChanged = true;
                updatedClassStates[clsKey] = {
                  ...cs,
                  countdownSeconds: remainingSec,
                  status: 'COUNTDOWN',
                  targetStartTime: target,
                };
              }
            }
          }
        });

        if (!anyChanged) return prev;

        const activeCs = updatedClassStates[prev.activeClass] || {
          status: prev.status,
          countdownSeconds: prev.countdownSeconds,
          startSequenceActive: prev.startSequenceActive,
          targetStartTime: prev.targetStartTime,
          startTime: prev.startTime,
        };

        const next: RaceState = {
          ...prev,
          classStates: updatedClassStates,
          status: activeCs.status,
          countdownSeconds: activeCs.countdownSeconds,
          startSequenceActive: activeCs.startSequenceActive,
          targetStartTime: activeCs.targetStartTime,
          startTime: activeCs.startTime,
          updatedAt: anyGunFired ? now : prev.updatedAt,
        };

        // ONLY broadcast over the network when the race gun officially fires (0:00 START)
        // Per-second countdown numbers are NEVER spammed over WebSocket!
        if (anyGunFired) {
          deviceTrackerService.broadcastRaceState(next);
          if (startingClasses.length > 0) {
            setBoats((prevBoats) => {
              const updated = prevBoats.map((b) => {
                if (startingClasses.includes(b.class) && (b.status === 'PRE_START' || b.status === 'CLEARED_OCS')) {
                  return { ...b, status: 'RACING' as const };
                }
                return b;
              });
              scheduleBoatsBroadcast();
              return updated;
            });
          }
        }

        return next;
      });
    }, 250);

    return () => clearInterval(timer);
  }, [
    raceState.startSequenceActive,
    raceState.targetStartTime,
    JSON.stringify(
      (Object.entries(raceState.classStates || {}) as [string, ClassRaceStatus][]).map(([k, v]) => [k, v.startSequenceActive, v.targetStartTime, v.status])
    ),
  ]);

  // Race progress engine: timing, mark roundings, finish detection and ranking (paused during replay)
  useEffect(() => {
    if (showReplayBar) return;
    const tickInterval = raceState.telemetryRate === 'HIGH_FREQUENCY' ? 1000 : 3000;

    const progressTimer = setInterval(() => {
      setBoats((prevBoats) => {
        const updatedBoats = prevBoats.map((boat, boatIdx) => {
          const dtSec = tickInterval / 1000;
          const safeLat = typeof boat.lat === 'number' && Number.isFinite(boat.lat) ? boat.lat : 6.307;
          const safeLng = typeof boat.lng === 'number' && Number.isFinite(boat.lng) ? boat.lng : 99.843;

          // Look up independent class race state for this boat's class
          const boatClassState = getClassRaceState(raceState, boat.class);

          // Temporary boat state to check course progress & target mark
          const tempBoat = { ...boat, lat: safeLat, lng: safeLng };
          const progress = evaluateBoatCourseProgress(tempBoat, marks, boatClassState.countdownSeconds, boat.lat, boat.lng);

          const isClassInPreStartOrCountdown =
            boatClassState.status === 'PRE_START' ||
            boatClassState.status === 'COUNTDOWN' ||
            (typeof boatClassState.countdownSeconds === 'number' && boatClassState.countdownSeconds > 0);

          const updatedStatus = computeLiveBoatStatus(
            boat.status,
            progress,
            boatClassState,
            boat.elapsedSeconds,
            boat.markRoundings?.length
          );

          if (isClassInPreStartOrCountdown) {
            progress.updatedRoundings = [];
          }

          // Sound horn on mark rounding or race finish during active racing only
          if (progress.newlyRounded && !isClassInPreStartOrCountdown) {
            if (progress.isFinished && boat.status !== 'FINISHED') {
              playHornSound(880, 1000, true);
            } else {
              playHornSound(660, 400);
            }
          }

          // Freeze elapsed seconds once finished or if this class is not active racing
          const isClassActiveRacing = boatClassState.status === 'RACING' && boatClassState.countdownSeconds <= 0;
          const newElapsed = isClassInPreStartOrCountdown
            ? 0
            : updatedStatus === 'FINISHED'
            ? boat.elapsedSeconds
            : isClassActiveRacing
            ? boat.elapsedSeconds + dtSec
            : boat.elapsedSeconds;
          const newCorrected = newElapsed * (boat.handicapRating || 1.0);

          // Check if this boat is bound to a live hardware node or phone/tablet GPS tracker
          const isBoundToTracker =
            !!boat.nodeId ||
            nodes.some((n) => n.boundBoatId === boat.id) ||
            (deviceGps.active && deviceGps.profile?.boundBoatId === boat.id);

          // Only real position data moves a boat. A boat without a tracker stays where it is at
          // 0 kt, so it can't round marks or finish on its own (the race officer can set its
          // status by hand); it used to be sailed round the course by a simulator.
          return {
            ...boat,
            ...(isBoundToTracker ? {} : { sog: 0 }),
            status: updatedStatus,
            markRoundings: progress.updatedRoundings,
            dtw: progress.dtwNm,
            elapsedSeconds: newElapsed,
            correctedSeconds: newCorrected,
          };
        });

        // Robust World Sailing RRS Ranking Order
        const sorted = [...updatedBoats].sort((a, b) => {
          const isFinA = a.status === 'FINISHED';
          const isFinB = b.status === 'FINISHED';
          if (isFinA && !isFinB) return -1;
          if (!isFinA && isFinB) return 1;
          if (isFinA && isFinB) return a.correctedSeconds - b.correctedSeconds;

          // Place penalty boats (OCS, DNF, DNS, DSQ) behind active racing boats
          const aPenalty = ['OCS', 'DNF', 'DNS', 'DSQ'].includes(a.status);
          const bPenalty = ['OCS', 'DNF', 'DNS', 'DSQ'].includes(b.status);
          if (!aPenalty && bPenalty) return -1;
          if (aPenalty && !bPenalty) return 1;

          // More waypoints rounded leads
          const aRoundings = a.markRoundings?.length || 0;
          const bRoundings = b.markRoundings?.length || 0;
          if (aRoundings !== bRoundings) return bRoundings - aRoundings;

          // Closer to target mark leads
          if ((a.dtw || 0) !== (b.dtw || 0)) return (a.dtw || 0) - (b.dtw || 0);

          return a.correctedSeconds - b.correctedSeconds;
        });

        return updatedBoats.map((b) => {
          const rankIdx = sorted.findIndex((s) => s.id === b.id);
          return { ...b, rank: rankIdx >= 0 ? rankIdx + 1 : b.rank };
        });
      });

      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.lat && node.lng) {
            const nextTrail = [...(node.trail || []), { lat: node.lat, lng: node.lng }].slice(-1000);
            return { ...node, trail: nextTrail };
          }
          return node;
        })
      );
    }, tickInterval);

    return () => clearInterval(progressTimer);
  }, [raceState.telemetryRate, raceState.countdownSeconds, raceState.status, marks]);

  // Handle Mark Updating and Realtime Broadcast
  const handleUpdateMarks = (newMarks: CourseMark[]) => {
    setMarks(newMarks);
    deviceTrackerService.broadcastMarks(newMarks);
    // Every mark removed: no course is set any more.
    if (newMarks.length === 0 && raceState.courseName) handleUpdateRaceState({ courseName: '' });
  };

  const handleAddMark = (lat: number, lng: number, type?: CourseMark['type'], name?: string) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const updated = addCourseMark(marks, lat, lng, type, name);
    handleUpdateMarks(updated);
  };

  const handleDeleteMark = (markId: string) => {
    const updated = removeCourseMark(marks, markId);
    handleUpdateMarks(updated);
  };

  const handleMoveMarkPosition = (markId: string, lat: number, lng: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const updated = updateMarkCoordinates(marks, markId, lat, lng);
    handleUpdateMarks(updated);
  };

  const handleMoveBoatPosition = (boatId: string, lat: number, lng: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setBoats((prev) => {
      const updated = prev.map((b) => {
        if (b.id === boatId) {
          const newTrail = [...(b.trail || []), { lat, lng }].slice(-1000);
          const tempBoat = { ...b, lat, lng, trail: newTrail };
          const boatClassState = getClassRaceState(raceState, b.class);
          const progress = evaluateBoatCourseProgress(tempBoat, marks, boatClassState.countdownSeconds, b.lat, b.lng);

          const updatedStatus = computeLiveBoatStatus(
            b.status,
            progress,
            boatClassState,
            b.elapsedSeconds,
            b.markRoundings?.length
          );

          if (progress.newlyRounded) {
            playHornSound(progress.isFinished ? 880 : 660, progress.isFinished ? 1000 : 400);
          }

          return {
            ...b,
            lat,
            lng,
            trail: newTrail,
            markRoundings: progress.updatedRoundings,
            dtw: progress.dtwNm,
            status: updatedStatus,
          };
        }
        return b;
      });
      scheduleBoatsBroadcast();
      return updated;
    });

    // Also sync any bound Meshtastic hardware node
    setNodes((prev) =>
      prev.map((n) => {
        if (n.boundBoatId === boatId) {
          const nextTrail = [...(n.trail || []), { lat, lng }].slice(-1000);
          return { ...n, lat, lng, trail: nextTrail, lastHeard: Date.now() };
        }
        return n;
      })
    );
  };

  const handleUpdateMarkSettings = (markId: string, updates: Partial<CourseMark>) => {
    const updated = updateMarkSettings(marks, markId, updates);
    handleUpdateMarks(updated);
  };

  const handleMoveMarkOrder = (markId: string, dir: 'UP' | 'DOWN') => {
    const updated = moveMarkOrder(marks, markId, dir);
    handleUpdateMarks(updated);
  };

  // Where new marks go: next to the current course, else where the map is looking,
  // else the regatta location (map not shown yet).
  const courseAnchor = (): { lat: number; lng: number } => {
    if (marks.length > 0) return { lat: marks[0].lat, lng: marks[0].lng };
    return getMapCenter() ?? { lat: selectedLocation?.centerLat ?? 6.308, lng: selectedLocation?.centerLng ?? 99.845 };
  };

  const applyCoursePreset = (preset: CoursePresetType) => {
    const { lat, lng } = courseAnchor();
    const updated = generateCoursePreset(preset, lat, lng, raceState.windDirectionDeg);
    handleUpdateMarks(updated);
    handleUpdateRaceState({ courseName: COURSE_PRESET_LABEL[preset] });
    fitMapTo(updated);
  };

  // Loading a course (template or saved) replaces the whole course, so ask first when there is one.
  const [pendingCourseLoad, setPendingCourseLoad] = useState<{ name: string; apply: () => void } | null>(null);
  const handleLoadCourse = (choice: CourseChoice) => {
    let name: string;
    let apply: () => void;
    if ('preset' in choice) {
      name = COURSE_PRESET_LABEL[choice.preset];
      apply = () => applyCoursePreset(choice.preset);
    } else {
      const profile = getSavedCourseProfiles().find((p) => p.id === choice.profileId);
      if (!profile) return;
      name = profile.name;
      // Laid out where the race is: this device's GPS, else where the map is looking
      const at =
        deviceGps.active && deviceGps.lat && deviceGps.lng
          ? { lat: deviceGps.lat, lng: deviceGps.lng }
          : getMapCenter() ?? { lat: selectedLocation?.centerLat ?? 6.308, lng: selectedLocation?.centerLng ?? 99.845 };
      apply = () => handleApplyCourseProfile(relocateCourseMarksToLocation(profile.marks, at.lat, at.lng), profile.name, profile.id);
    }
    if (marks.length > 0) setPendingCourseLoad({ name, apply });
    else apply();
  };

  const handleAddCourseMarkNearView = () => {
    const { lat, lng } = courseAnchor();
    const updated = addCourseMark(marks, lat + (Math.random() - 0.5) * 0.01, lng + (Math.random() - 0.5) * 0.01, 'WINDWARD');
    handleUpdateMarks(updated);
    fitMapTo(updated);
  };

  const handleApplyCourseProfile = (newMarks: CourseMark[], profileName: string, profileId?: string) => {
    handleUpdateMarks(newMarks);
    handleUpdateRaceState({ courseName: profileName });
    fitMapTo(newMarks);
    if (profileId) {
      setActiveCourseProfileId(profileId);
    }
    setCourseProfileCount(getSavedCourseProfiles().length);
    // Send a subtle fleet notification
    handleSendVhfNotice(
      'COURSE PROFILE LOADED',
      `Active regatta course marks updated to "${profileName}" (${newMarks.length} marks).`,
      'COURSE_CHANGE'
    );
  };

  // Handle Race State Updates and Broadcast with Per-Class State Synchronization
  const handleUpdateRaceState = (partial: Partial<RaceState>) => {
    setRaceState((prev) => {
      const now = serverNow();
      let updatedClassStates = { ...(prev.classStates || {}) };
      const currentClass = prev.activeClass;
      const newActiveClass = partial.activeClass || currentClass;

      // Ensure currentClass and newActiveClass are seeded
      if (!updatedClassStates[currentClass]) {
        updatedClassStates[currentClass] = {
          status: prev.status,
          countdownSeconds: prev.countdownSeconds,
          startSequenceActive: prev.startSequenceActive,
          targetStartTime: prev.targetStartTime,
          startTime: prev.startTime,
        };
      }
      if (!updatedClassStates[newActiveClass]) {
        updatedClassStates[newActiveClass] = {
          status: 'PRE_START',
          countdownSeconds: 300,
          startSequenceActive: false,
        };
      }

      // If activeClass is switching
      if (partial.activeClass && partial.activeClass !== currentClass) {
        const targetCs = updatedClassStates[partial.activeClass];
        const next: RaceState = {
          ...prev,
          ...partial,
          classStates: updatedClassStates,
          activeClass: partial.activeClass,
          status: targetCs.status,
          countdownSeconds: targetCs.countdownSeconds,
          startSequenceActive: targetCs.startSequenceActive,
          targetStartTime: targetCs.targetStartTime,
          startTime: targetCs.startTime,
          postponed: targetCs.postponed,
          updatedAt: now,
        };
        deviceTrackerService.broadcastRaceState(next);
        return next;
      }

      // If updating status/countdown/sequence on currently active class
      if (
        partial.status !== undefined ||
        partial.countdownSeconds !== undefined ||
        partial.startSequenceActive !== undefined ||
        partial.postponed !== undefined
      ) {
        const cur = updatedClassStates[newActiveClass];
        const nextSequenceActive = partial.startSequenceActive ?? cur.startSequenceActive;
        const nextCountdown = partial.countdownSeconds ?? cur.countdownSeconds;
        let nextStatus = partial.status ?? cur.status;
        if (nextSequenceActive && nextCountdown > 0) {
          nextStatus = 'COUNTDOWN';
        } else if (partial.status) {
          nextStatus = partial.status;
        }

        // If class is transitioning into COUNTDOWN or PRE_START, reset all boats in this class to PRE_START
        if (nextStatus === 'COUNTDOWN' || nextStatus === 'PRE_START' || (nextCountdown > 0 && nextSequenceActive)) {
          setBoats((prevBoats) => {
            let hasChanges = false;
            const updated = prevBoats.map((b) => {
              if (b.class === newActiveClass && (b.status === 'FINISHED' || b.status === 'OCS' || (b.markRoundings && b.markRoundings.length > 0))) {
                hasChanges = true;
                return {
                  ...b,
                  status: 'PRE_START' as const,
                  elapsedSeconds: 0,
                  correctedSeconds: 0,
                  markRoundings: [],
                };
              }
              return b;
            });
            if (hasChanges) {
              scheduleBoatsBroadcast();
              return updated;
            }
            return prevBoats;
          });
        }

        let targetStartTime = cur.targetStartTime;
        if (nextSequenceActive) {
          // If starting or changing countdown seconds, anchor targetStartTime
          if (partial.countdownSeconds !== undefined || !targetStartTime || cur.startSequenceActive !== nextSequenceActive) {
            targetStartTime = now + (nextCountdown * 1000);
            soundedSecondsRef.current.clear();
          }
        } else {
          targetStartTime = undefined;
        }

        let startTime = cur.startTime;
        if (nextStatus === 'RACING' && !startTime) {
          startTime = now;
        } else if (nextStatus === 'PRE_START') {
          startTime = undefined;
        }

        updatedClassStates[newActiveClass] = {
          ...cur,
          status: nextStatus,
          countdownSeconds: nextCountdown,
          startSequenceActive: nextSequenceActive,
          targetStartTime,
          startTime,
          // AP only holds a class that hasn't started; a running sequence or a start clears it.
          postponed: nextStatus === 'PRE_START' && !nextSequenceActive ? (partial.postponed ?? cur.postponed ?? false) : false,
          updatedAt: now,
        };
      }

      const activeCs = updatedClassStates[newActiveClass];
      const next: RaceState = {
        ...prev,
        ...partial,
        classStates: updatedClassStates,
        status: activeCs.status,
        countdownSeconds: activeCs.countdownSeconds,
        startSequenceActive: activeCs.startSequenceActive,
        targetStartTime: activeCs.targetStartTime,
        startTime: activeCs.startTime,
        postponed: activeCs.postponed,
        updatedAt: now,
      };
      deviceTrackerService.broadcastRaceState(next);
      return next;
    });
  };

  const handleToggleRaceTimer = (forClass?: string) => {
    const targetClass = forClass || raceState.activeClass;
    setRaceState((prev) => {
      const now = serverNow();
      const curClsState = getClassRaceState(prev, targetClass);
      const nextSequenceActive = !curClsState.startSequenceActive;
      const nextCountdown = curClsState.countdownSeconds > 0 ? curClsState.countdownSeconds : 300;
      const nextStatus = nextSequenceActive && nextCountdown > 0
        ? 'COUNTDOWN'
        : (curClsState.status === 'COUNTDOWN' ? 'PRE_START' : curClsState.status);

      const targetStartTime = nextSequenceActive ? (now + (nextCountdown * 1000)) : undefined;
      if (nextSequenceActive) {
        soundedSecondsRef.current.clear();
        setBoats((prevBoats) => {
          let hasChanges = false;
          const updated = prevBoats.map((b) => {
            if ((!forClass || b.class === targetClass) && (b.status === 'FINISHED' || b.status === 'OCS' || (b.markRoundings && b.markRoundings.length > 0))) {
              hasChanges = true;
              return {
                ...b,
                status: 'PRE_START' as const,
                elapsedSeconds: 0,
                correctedSeconds: 0,
                markRoundings: [],
              };
            }
            return b;
          });
          if (hasChanges) {
            scheduleBoatsBroadcast();
            return updated;
          }
          return prevBoats;
        });
      }

      const updatedClassStates: Record<string, ClassRaceStatus> = {
        ...(prev.classStates || {}),
        [targetClass]: {
          ...curClsState,
          countdownSeconds: nextCountdown,
          startSequenceActive: nextSequenceActive,
          status: nextStatus,
          targetStartTime,
          ...(nextSequenceActive ? { postponed: false } : {}),
          updatedAt: now,
        },
      };

      const next: RaceState = {
        ...prev,
        classStates: updatedClassStates,
        updatedAt: now,
        ...(targetClass === prev.activeClass
          ? {
              countdownSeconds: nextCountdown,
              startSequenceActive: nextSequenceActive,
              status: nextStatus,
              targetStartTime,
            }
          : {}),
      };
      deviceTrackerService.broadcastRaceState(next);
      return next;
    });
  };

  const handleResetTimer = (forClass?: string, seconds = 300) => {
    const targetClass = forClass || raceState.activeClass;
    soundedSecondsRef.current.clear();
    setBoats((prev) => {
      const updated = prev.map((b) => {
        if (!forClass || b.class === targetClass) {
          return {
            ...b,
            status: 'PRE_START' as const,
            elapsedSeconds: 0,
            correctedSeconds: 0,
            markRoundings: [],
          };
        }
        return b;
      });
      scheduleBoatsBroadcast();
      return updated;
    });

    setRaceState((prev) => {
      const now = serverNow();
      const curClsState = getClassRaceState(prev, targetClass);
      const updatedClassStates: Record<string, ClassRaceStatus> = {
        ...(prev.classStates || {}),
        [targetClass]: {
          ...curClsState,
          status: 'PRE_START',
          countdownSeconds: seconds,
          startSequenceActive: false,
          targetStartTime: undefined,
          startTime: undefined,
          updatedAt: now,
        },
      };

      const next: RaceState = {
        ...prev,
        classStates: updatedClassStates,
        updatedAt: now,
        ...(targetClass === prev.activeClass
          ? {
              countdownSeconds: seconds,
              status: 'PRE_START',
              startSequenceActive: false,
              targetStartTime: undefined,
              startTime: undefined,
            }
          : {}),
      };
      deviceTrackerService.broadcastRaceState(next);
      return next;
    });
  };

  // Handle Boat Status Update
  const handleUpdateBoatStatus = (boatId: string, status: Boat['status']) => {
    setBoats((prev) => {
      const updated = prev.map((b) => (b.id === boatId ? { ...b, status } : b));
      scheduleBoatsBroadcast();
      return updated;
    });
  };

  // Handle Bulk Fleet Status Update
  const handleUpdateFleetStatus = (status: Boat['status'], forClass?: string) => {
    setBoats((prev) => {
      const updated = prev.map((b) => {
        if (!forClass || b.class === forClass) {
          return {
            ...b,
            status,
            ...(status === 'PRE_START'
              ? { elapsedSeconds: 0, correctedSeconds: 0, markRoundings: [] }
              : {}),
          };
        }
        return b;
      });
      scheduleBoatsBroadcast();
      return updated;
    });
  };

  // Handle Wind Updates
  const handleUpdateWind = (speedKt: number, dirDeg: number) => {
    handleUpdateRaceState({ windSpeedKt: speedKt, windDirectionDeg: dirDeg });
  };

  // Handle Broadcast VHF Notice
  const handleSendVhfNotice = (
    title: string,
    content: string,
    type: 'COURSE_CHANGE' | 'POSTPONEMENT' | 'SAFETY_WARNING' | 'GENERAL_ANNOUNCEMENT'
  ) => {
    const newNotice: VhfBulletin = {
      id: 'vhf-' + Date.now(),
      title,
      content,
      sender: 'Race Committee',
      timestamp: Date.now(),
      type,
      deliveryMatrix: boats.map((b) => ({
        boatId: b.id,
        boatName: b.name,
        status: 'RECEIVED',
      })),
    };
    setBulletins((prev) => [newNotice, ...prev]);
    deviceTrackerService.broadcastVhf(newNotice);
  };

  // The VHF / Jury console passes only the boat id: take its name and last known position
  // from the fleet, so the alert always says which boat and where.
  const handleTriggerMobAlert = (boatId: string, name?: string, lat?: number, lng?: number) => {
    const boat = boats.find((b) => b.id === boatId);
    setMobAlert({
      id: 'mob-' + Date.now(),
      boatId,
      boatName: name ?? boat?.name ?? boatId,
      lat: lat ?? boat?.lat ?? 0,
      lng: lng ?? boat?.lng ?? 0,
      triggeredAt: Date.now(),
      active: true,
      interceptingBoats: [],
    });
    playHornSound(990, 2000, true);
  };

  const handleClearMobAlert = () => {
    setMobAlert(null);
  };

  const handleCreateProtestSnapshot = (boat1Id: string, boat2Id: string, rule: string, notes = '') => {
    const boat1 = boats.find((b) => b.id === boat1Id);
    const boat2 = boats.find((b) => b.id === boat2Id);
    if (!boat1 || !boat2) return;

    const snap: JuryIncidentSnapshot = {
      id: 'protest-' + Date.now(),
      timestamp: Date.now(),
      protestingBoatId: boat1Id,
      protestingBoatName: boat1.name,
      respondentBoatId: boat2Id,
      respondentBoatName: boat2.name,
      ruleInfringement: rule,
      lat: boat1.lat,
      lng: boat1.lng,
      telemetryLog5Min: [],
      status: 'UNDER_REVIEW',
    };
    setProtestSnapshots((prev) => [snap, ...prev]);
  };

  const handleSelectLocation = (loc: RegattaLocation) => {
    setSelectedLocation(loc);
    handleUpdateRaceState({
      name: loc.name,
      locationName: `${loc.region}, ${loc.country}`,
    });
  };

  const handleToggleOverlay = (key: keyof WeatherOverlays) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEndRace = (forClass?: string) => {
    soundedSecondsRef.current.clear();
    const now = serverNow();
    setBoats((prev) => {
      const updated = prev.map((b) => {
        if (!forClass || b.class === forClass) {
          // 1. If already finished, preserve FINISHED status
          if (b.status === 'FINISHED') return b;
          // 2. If disqualified or retired or already has DNF/DNS, preserve status
          if (b.status === 'DSQ' || b.status === 'RET' || b.status === 'DNF' || b.status === 'DNS') return b;

          // 3. Check if boat actually rounded all waypoints and crossed finish line
          const boatClassState = getClassRaceState(raceState, b.class);
          const progress = evaluateBoatCourseProgress(b, marks, boatClassState.countdownSeconds, b.lat, b.lng);
          if (progress.isFinished) {
            return { ...b, status: 'FINISHED' as const };
          }

          // 4. Detect if boat ever started racing
          // If in PRE_START or 0 elapsed time with no start mark rounding -> DNS (Did Not Start)
          const hasStarted =
            b.status === 'RACING' ||
            b.status === 'OCS' ||
            b.status === 'CLEARED_OCS' ||
            (b.elapsedSeconds && b.elapsedSeconds > 0) ||
            (b.markRoundings && b.markRoundings.length > 0);

          if (b.status === 'PRE_START' || !hasStarted) {
            return { ...b, status: 'DNS' as const };
          }

          // 5. Started racing, but did not finish before race concluded -> DNF (Did Not Finish)
          return { ...b, status: 'DNF' as const };
        }
        return b;
      });
      scheduleBoatsBroadcast();
      return updated;
    });

    setRaceState((prev) => {
      let updatedClassStates = { ...(prev.classStates || {}) };
      if (forClass) {
        const cur = getClassRaceState(prev, forClass);
        updatedClassStates[forClass] = {
          ...cur,
          status: 'FINISHED',
          startSequenceActive: false,
          targetStartTime: undefined,
          updatedAt: now,
        };
      } else {
        Object.keys(updatedClassStates).forEach((k) => {
          updatedClassStates[k] = {
            ...updatedClassStates[k],
            status: 'FINISHED',
            startSequenceActive: false,
            targetStartTime: undefined,
            updatedAt: now,
          };
        });
      }

      const activeCs = forClass
        ? (forClass === prev.activeClass ? { status: 'FINISHED' as const, startSequenceActive: false } : getClassRaceState(prev, prev.activeClass))
        : { status: 'FINISHED' as const, startSequenceActive: false };

      const next: RaceState = {
        ...prev,
        classStates: updatedClassStates,
        status: activeCs.status,
        startSequenceActive: activeCs.startSequenceActive,
        targetStartTime: undefined,
        updatedAt: now,
      };
      deviceTrackerService.broadcastRaceState(next);
      return next;
    });

    playHornSound(880, 1500, true);

    const noticeTitle = forClass ? `RACE FINISHED (${forClass})` : 'RACE FINISHED (ALL CLASSES)';
    const noticeContent = `Race Committee has officially finished the race for ${forClass || 'all classes'}. Timers frozen and locked for official scoring.`;
    handleSendVhfNotice(noticeTitle, noticeContent, 'GENERAL_ANNOUNCEMENT');
    setShowResultsModal(true);
  };

  const handleRestartRace = (forClass?: string) => {
    soundedSecondsRef.current.clear();
    const now = serverNow();
    setBoats((prev) => {
      const updated = prev.map((b) => {
        if (!forClass || b.class === forClass) {
          return {
            ...b,
            status: 'PRE_START' as const,
            elapsedSeconds: 0,
            correctedSeconds: 0,
            markRoundings: [],
            dtw: 1.0,
          };
        }
        return b;
      });
      scheduleBoatsBroadcast();
      return updated;
    });

    setRaceState((prev) => {
      let updatedClassStates = { ...(prev.classStates || {}) };
      if (forClass) {
        updatedClassStates[forClass] = {
          status: 'PRE_START',
          countdownSeconds: 300,
          startSequenceActive: false,
          targetStartTime: undefined,
          startTime: undefined,
          updatedAt: now,
        };
      } else {
        Object.keys(updatedClassStates).forEach((k) => {
          updatedClassStates[k] = {
            status: 'PRE_START',
            countdownSeconds: 300,
            startSequenceActive: false,
            targetStartTime: undefined,
            startTime: undefined,
            updatedAt: now,
          };
        });
      }

      const activeCs = forClass
        ? (forClass === prev.activeClass ? { status: 'PRE_START' as const, countdownSeconds: 300, startSequenceActive: false } : getClassRaceState(prev, prev.activeClass))
        : { status: 'PRE_START' as const, countdownSeconds: 300, startSequenceActive: false };

      const next: RaceState = {
        ...prev,
        classStates: updatedClassStates,
        status: activeCs.status,
        countdownSeconds: activeCs.countdownSeconds,
        startSequenceActive: activeCs.startSequenceActive,
        targetStartTime: undefined,
        startTime: undefined,
        updatedAt: now,
      };
      deviceTrackerService.broadcastRaceState(next);
      return next;
    });

    playHornSound(520, 800, true);
  };
  // Actions that change race results go through a confirmation step first.
  type PendingRaceAction =
    | { kind: 'FINISH_CLASS'; forClass: string }
    | { kind: 'END_ALL' }
    | { kind: 'RESTART'; forClass: string }
    | { kind: 'RECALL'; forClass: string };
  const [pendingRaceAction, setPendingRaceAction] = useState<PendingRaceAction | null>(null);

  const requestEndRace = (forClass?: string) =>
    setPendingRaceAction(forClass ? { kind: 'FINISH_CLASS', forClass } : { kind: 'END_ALL' });
  const requestRestartRace = (forClass?: string) =>
    setPendingRaceAction({ kind: 'RESTART', forClass: forClass || raceState.activeClass });
  const requestGeneralRecall = (forClass?: string) =>
    setPendingRaceAction({ kind: 'RECALL', forClass: forClass || raceState.activeClass });

  const handleGeneralRecall = (forClass: string) => {
    handleRestartRace(forClass);
    handleSendVhfNotice(
      'GENERAL RECALL (FIRST SUBSTITUTE)',
      'General recall ordered under RRS 29.2. All boats return to pre-start area. Start sequence reset.',
      'SAFETY_WARNING'
    );
  };

  const runPendingRaceAction = () => {
    const action = pendingRaceAction;
    setPendingRaceAction(null);
    if (!action) return;
    if (action.kind === 'FINISH_CLASS') handleEndRace(action.forClass);
    else if (action.kind === 'END_ALL') handleEndRace();
    else if (action.kind === 'RESTART') handleRestartRace(action.forClass);
    else handleGeneralRecall(action.forClass);
  };

  const describePendingRaceAction = (action: PendingRaceAction) => {
    const boatCount = (cls?: string) => boats.filter((b) => !cls || b.class === cls).length;
    const boatsText = (n: number) => `${n} ${n === 1 ? 'boat' : 'boats'}`;
    switch (action.kind) {
      case 'FINISH_CLASS':
        return {
          title: `Finish ${action.forClass}?`,
          body: `Times for ${action.forClass} (${boatsText(boatCount(action.forClass))}) will be locked. Boats still racing are marked DNF and boats that never started are marked DNS. A "race finished" notice is broadcast to the fleet.`,
          confirmLabel: `Finish ${action.forClass}`,
        };
      case 'END_ALL':
        return {
          title: 'End the race for all classes?',
          body: `Every class stops and times are locked for all ${boatsText(boatCount())}. Boats still racing are marked DNF and boats that never started are marked DNS. A "race finished" notice is broadcast to the fleet.`,
          confirmLabel: 'End entire race',
        };
      case 'RESTART':
        return {
          title: `Restart ${action.forClass}?`,
          body: `Elapsed and corrected times and mark roundings for ${boatsText(boatCount(action.forClass))} in ${action.forClass} are cleared, and the start clock goes back to 5:00. This can't be undone.`,
          confirmLabel: `Restart ${action.forClass}`,
        };
      case 'RECALL':
        return {
          title: `General recall for ${action.forClass}?`,
          body: `${action.forClass} is restarted: times and mark roundings for ${boatsText(boatCount(action.forClass))} are cleared and the start clock goes back to 5:00. A General Recall safety notice is broadcast to the fleet straight away.`,
          confirmLabel: 'Signal general recall',
        };
    }
  };



  const handleOpenHeadToHead = (b1: string, b2: string) => {
    setHeadToHeadPair([b1, b2]);
    setShowHeadToHead(true);
  };

  const handleSendChatMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
  };

  const resolveTrackerPosition = (nodeId?: string | null) => {
    if (!nodeId) return null;
    // 1. Check local device GPS & tracker service
    const localNode = deviceTrackerService.getLocalNode();
    const currentGps = deviceTrackerService.getGpsState();
    const profile = deviceTrackerService.getProfile();

    if (
      nodeId === localNode.id ||
      nodeId === profile.deviceId ||
      nodeId === 'LOCAL_PHONE_GPS' ||
      nodeId === `!DEV-${profile.deviceId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}`
    ) {
      if (isValidNumber(currentGps.lat) && isValidNumber(currentGps.lng) && currentGps.lat !== 0 && currentGps.lng !== 0) {
        return {
          lat: currentGps.lat!,
          lng: currentGps.lng!,
          sog: isValidNumber(currentGps.speedKt) ? currentGps.speedKt! : 0,
          cog: isValidNumber(currentGps.headingDeg) ? currentGps.headingDeg! : 0,
        };
      }
    }

    // 2. Check nodes state. Only a fresh fix: a radio's NodeDB can hold positions from hours or
    // weeks ago (a tracker re-sends its last saved fix when it powers up), and binding or saving a
    // boat must not move it there. Without a fresh fix the boat stays put until one arrives.
    const foundNode = nodes.find((n) => sameNodeId(n.id, nodeId));
    if (foundNode && isValidNumber(foundNode.lat) && isValidNumber(foundNode.lng) && foundNode.lat !== 0 && foundNode.lng !== 0
      && isFixFresh(nodeFixTime(foundNode))) {
      return {
        lat: foundNode.lat!,
        lng: foundNode.lng!,
        sog: isValidNumber(foundNode.speedKt) ? foundNode.speedKt! : 0,
        cog: isValidNumber(foundNode.headingDeg) ? foundNode.headingDeg! : 0,
      };
    }

    // 3. Check fleet members
    const foundMember = fleetMembers.find(
      (m) =>
        m.deviceId === nodeId ||
        nodeId.includes(m.deviceId.slice(-4)) ||
        `!DEV-${m.deviceId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}` === nodeId
    );
    if (foundMember && isValidNumber(foundMember.lat) && isValidNumber(foundMember.lng) && foundMember.lat !== 0 && foundMember.lng !== 0
      && isFixFresh(foundMember.timestamp)) {
      return {
        lat: foundMember.lat,
        lng: foundMember.lng,
        sog: isValidNumber(foundMember.speedKt) ? foundMember.speedKt : 0,
        cog: isValidNumber(foundMember.headingDeg) ? foundMember.headingDeg : 0,
      };
    }

    return null;
  };

  const handleBindNodeToBoat = (nodeId: string, boatId: string) => {
    const localNode = deviceTrackerService.getLocalNode();
    const profile = deviceTrackerService.getProfile();
    const isLocalPhone =
      nodeId === localNode.id ||
      nodeId === profile.deviceId ||
      nodeId === 'LOCAL_PHONE_GPS' ||
      nodeId === `!DEV-${profile.deviceId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}`;

    const effectiveNodeId = isLocalPhone ? localNode.id : canonicalNodeId(nodeId);

    // Persist binding into both background communication services
    deviceTrackerService.setNodeBoundBoat(nodeId, boatId || null);
    deviceTrackerService.setNodeBoundBoat(effectiveNodeId, boatId || null);
    meshtasticService.setNodeBoundBoatId(nodeId, boatId || null);
    meshtasticService.setNodeBoundBoatId(effectiveNodeId, boatId || null);
    trackerRelay.forget(effectiveNodeId);

    // A tracker that was on this boat before is now unbound everywhere, or its next packet
    // would quietly bind it back
    if (boatId) {
      nodes
        .filter((n) => n.boundBoatId === boatId && !sameNodeId(n.id, effectiveNodeId))
        .forEach((n) => clearTrackerBinding(n.id));
    }

    if (isLocalPhone) {
      deviceTrackerService.updateProfile({ boundBoatId: boatId || null });
    }

    const resolved = resolveTrackerPosition(nodeId);

    setNodes((prev) =>
      prev.map((n) => {
        if (sameNodeId(n.id, nodeId) || sameNodeId(n.id, effectiveNodeId) || (isLocalPhone && n.id === localNode.id)) {
          return { ...n, boundBoatId: boatId || undefined };
        }
        // If node was previously bound to this boat, unbind it
        if (boatId && n.boundBoatId === boatId && !sameNodeId(n.id, nodeId) && !sameNodeId(n.id, effectiveNodeId)) {
          return { ...n, boundBoatId: undefined };
        }
        return n;
      })
    );

    setBoats((prev) => {
      const updated = prev.map((b) => {
        if (boatId && b.id === boatId) {
          const newLat = resolved ? resolved.lat : b.lat;
          const newLng = resolved ? resolved.lng : b.lng;
          const newSog = resolved ? resolved.sog : b.sog;
          const newCog = resolved ? resolved.cog : b.cog;
          const newTrail = resolved ? [...(b.trail || []), { lat: newLat, lng: newLng }].slice(-1000) : b.trail;

          return {
            ...b,
            nodeId: effectiveNodeId,
            lat: newLat,
            lng: newLng,
            sog: newSog,
            cog: newCog,
            heading: newCog,
            trail: newTrail,
          };
        } else if (boatId && sameNodeId(b.nodeId, effectiveNodeId) && b.id !== boatId) {
          // Clear previous boat bound to this node
          return { ...b, nodeId: null };
        } else if (!boatId || boatId === '') {
          // Unbinding this node from any boat
          if (sameNodeId(b.nodeId, nodeId) || sameNodeId(b.nodeId, effectiveNodeId) || (isLocalPhone && b.nodeId === localNode.id)) {
            return { ...b, nodeId: null };
          }
        }
        return b;
      });
      scheduleBoatsBroadcast();
      return updated;
    });
  };

  const handleOpenAddBoat = () => {
    setBoatToEdit(null);
    setShowBoatEditorModal(true);
  };

  const handleOpenBoatQr = (boatId?: string) => {
    const target = boatId || (boats.length > 0 ? boats[0].id : null);
    setBoatQrTargetId(target);
    setShowBoatQrModal(true);
  };

  const handleOpenSkipperCheckIn = (boatId?: string) => {
    if (boatId) {
      setTargetCheckInBoatId(boatId);
    }
    setShowSkipperCheckInModal(true);
  };

  const handleSkipperCheckIn = (boatId: string, skipperName?: string) => {
    // 1. If GPS is not active, activate high-accuracy mobile GPS tracking
    if (!deviceGps.active) {
      deviceTrackerService.startSharingByUser();
    }
    // 2. Set profile name
    if (skipperName) {
      deviceTrackerService.updateProfile({
        deviceName: `${skipperName} (Phone)`,
        boundBoatId: boatId,
      });
    }
    // 3. Bind local device node to target boat
    const localNode = deviceTrackerService.getLocalNode();
    if (localNode && localNode.id) {
      handleBindNodeToBoat(localNode.id, boatId);
    }
  };

  const handleEditBoat = (boat: Boat) => {
    setBoatToEdit(boat);
    setShowBoatEditorModal(true);
  };

  const handleSaveBoat = (boatData: Partial<Boat>, isEdit: boolean, originalId?: string): string | undefined => {
    if (isEdit && originalId) {
      const resolved = resolveTrackerPosition(boatData.nodeId);
      const localNode = deviceTrackerService.getLocalNode();
      const profile = deviceTrackerService.getProfile();
      const isLocalPhone =
        boatData.nodeId === localNode.id ||
        boatData.nodeId === profile.deviceId ||
        boatData.nodeId === 'LOCAL_PHONE_GPS' ||
        boatData.nodeId === `!DEV-${profile.deviceId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}`;

      const effectiveNodeId = isLocalPhone ? localNode.id : (canonicalNodeId(boatData.nodeId) || null);

      if (isLocalPhone) {
        deviceTrackerService.updateProfile({ boundBoatId: originalId });
      }

      setBoats((prev) => {
        const updated = prev.map((b) => {
          if (b.id === originalId) {
            let lat = b.lat;
            let lng = b.lng;
            let sog = b.sog;
            let cog = b.cog;
            let heading = b.heading;
            let trail = b.trail;

            // If newly bound to a tracker with coordinates, snap to tracker's live position
            if (resolved) {
              lat = resolved.lat;
              lng = resolved.lng;
              sog = resolved.sog;
              cog = resolved.cog;
              heading = cog;
              trail = [...(b.trail || []), { lat, lng }].slice(-1000);
            }

            return {
              ...b,
              ...boatData,
              nodeId: effectiveNodeId,
              lat,
              lng,
              sog,
              cog,
              heading,
              trail,
            };
          }
          return b;
        });
        scheduleBoatsBroadcast();
        return updated;
      });

      // Update node binding if provided
      if (effectiveNodeId !== undefined) {
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (effectiveNodeId && (sameNodeId(n.id, effectiveNodeId) || (isLocalPhone && n.id === localNode.id))) {
              return { ...n, boundBoatId: originalId };
            }
            if (n.boundBoatId === originalId && !sameNodeId(n.id, effectiveNodeId)) {
              return { ...n, boundBoatId: undefined };
            }
            return n;
          })
        );
      }
    } else {
      const newId = 'boat-' + Date.now();
      
      // Resolve tracker position across all sources (Phone GPS, LoRa node, Fleet member, or explicit boatData)
      const resolved = resolveTrackerPosition(boatData.nodeId);
      const isExplicitPos = typeof boatData.lat === 'number' && Number.isFinite(boatData.lat) && boatData.lat !== 0 &&
                            typeof boatData.lng === 'number' && Number.isFinite(boatData.lng) && boatData.lng !== 0;

      const initLat = isExplicitPos ? boatData.lat! : (resolved ? resolved.lat : (selectedLocation?.centerLat ?? 6.308));
      const initLng = isExplicitPos ? boatData.lng! : (resolved ? resolved.lng : (selectedLocation?.centerLng ?? 99.845));
      // No tracker yet: 0 kt until one reports (it used to show a made-up 7.5 kt)
      const initSog = resolved ? resolved.sog : (isExplicitPos && typeof boatData.sog === 'number' ? boatData.sog : 0);
      const initCog = resolved ? resolved.cog : (isExplicitPos && typeof boatData.cog === 'number' ? boatData.cog : 320);

      const localNode = deviceTrackerService.getLocalNode();
      const profile = deviceTrackerService.getProfile();
      const isLocalPhone =
        boatData.nodeId === localNode.id ||
        boatData.nodeId === profile.deviceId ||
        boatData.nodeId === 'LOCAL_PHONE_GPS' ||
        boatData.nodeId === `!DEV-${profile.deviceId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}`;

      const effectiveNodeId = isLocalPhone ? localNode.id : (canonicalNodeId(boatData.nodeId) || null);

      if (isLocalPhone) {
        deviceTrackerService.updateProfile({ boundBoatId: newId });
      }

      const newBoat: Boat = {
        id: newId,
        name: boatData.name || 'NEW RACER',
        sailNumber: boatData.sailNumber || '',
        class: boatData.class || (raceClasses[0]?.name ?? 'Class 1'),
        handicapSystem: boatData.handicapSystem || 'IRC',
        handicapRating: boatData.handicapRating || 1.0,
        skipper: boatData.skipper || '',
        nodeId: effectiveNodeId,
        lat: initLat,
        lng: initLng,
        sog: initSog,
        cog: initCog,
        vmg: typeof boatData.vmg === 'number' ? boatData.vmg : 0,
        // Worked out from the course once the boat has a position; not a made-up 1.2 NM
        dtw: typeof boatData.dtw === 'number' ? boatData.dtw : 0,
        heading: initCog,
        status: boatData.status || 'RACING',
        markRoundings: [],
        elapsedSeconds: 0,
        correctedSeconds: 0,
        color: boatData.color || '#00D4FF',
        trail: [{ lat: initLat, lng: initLng }],
      };
      setBoats((prev) => {
        const updated = [...prev, newBoat];
        scheduleBoatsBroadcast();
        return updated;
      });
      if (effectiveNodeId) {
        setNodes((prevNodes) =>
          prevNodes.map((n) =>
            sameNodeId(n.id, effectiveNodeId) ? { ...n, boundBoatId: newId } : n
          )
        );
      }
      return newId;
    }
    return originalId;
  };

  const handleDeleteBoat = (boatId: string) => {
    setBoats((prev) => {
      const updated = prev.filter((b) => b.id !== boatId);
      scheduleBoatsBroadcast();
      return updated;
    });
    setNodes((prevNodes) =>
      prevNodes.map((n) => (n.boundBoatId === boatId ? { ...n, boundBoatId: undefined } : n))
    );
    if (selectedBoatId === boatId) {
      setSelectedBoatId(null);
    }
    if (followedTargetId === boatId) {
      setFollowedTargetId(null);
    }
  };


  const handleImportCompetitors = (imported: CompetitorImportRecord[]) => {
    setBoats((prev) => {
      const updated = [...prev];
      const palette = BOAT_PALETTE;
      imported.forEach((rec, idx) => {
        const existingIdx = updated.findIndex(
          (b) => b.sailNumber.toLowerCase().trim() === rec.sailNumber.toLowerCase().trim()
        );
        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            name: rec.name || updated[existingIdx].name,
            skipper: rec.skipper || updated[existingIdx].skipper,
            class: rec.className || updated[existingIdx].class,
            handicapRating: rec.handicapRating || updated[existingIdx].handicapRating,
          };
        } else {
          const refLat = updated[0]?.lat || 6.305;
          const refLng = updated[0]?.lng || 99.845;
          const newBoat: Boat = {
            id: `boat-imp-${Date.now()}-${idx}`,
            name: rec.name,
            sailNumber: rec.sailNumber,
            skipper: rec.skipper,
            class: (rec.className as any) || 'Class 1',
            handicapSystem: 'IRC',
            handicapRating: rec.handicapRating || 1.0,
            nodeId: null,
            color: palette[updated.length % palette.length],
            lat: refLat + (Math.random() - 0.5) * 0.003,
            lng: refLng + (Math.random() - 0.5) * 0.003,
            sog: 0,
            cog: 180,
            vmg: 0,
            dtw: 0,
            heading: 180,
            headingDeg: 180,
            speedKt: 0,
            status: 'RACING',
            tack: 'STARBOARD',
            markRoundings: [],
            markSplits: [],
            elapsedSeconds: 0,
            correctedSeconds: 0,
            trail: [],
          };
          updated.push(newBoat);
        }
      });
      const deduped = deduplicateBoats(updated);
      scheduleBoatsBroadcast();
      return deduped;
    });
  };

  // Race Class Management (Add, Edit, Delete). Classes are room state, so every change goes to the room.
  const commitRaceClasses = (next: RaceClassDefinition[]) => {
    setRaceClasses(next);
    deviceTrackerService.broadcastClasses(next);
  };

  const handleAddClass = (newClassData: Omit<RaceClassDefinition, 'id'>) => {
    const newClass: RaceClassDefinition = {
      ...newClassData,
      id: 'class-' + Date.now(),
    };
    commitRaceClasses([...raceClasses, newClass]);
  };

  const handleUpdateClass = (classId: string, updated: Partial<RaceClassDefinition>) => {
    const oldClass = raceClasses.find((c) => c.id === classId);
    commitRaceClasses(raceClasses.map((c) => (c.id === classId ? { ...c, ...updated } : c)));

    // If class name changed, propagate to all boats in that class
    if (oldClass && updated.name && oldClass.name !== updated.name) {
      const oldName = oldClass.name;
      const newName = updated.name;
      setBoats((prev) => {
        const remapped = prev.map((b) => (b.class === oldName ? { ...b, class: newName } : b));
        scheduleBoatsBroadcast();
        return remapped;
      });
      if (raceState.activeClass === oldName) {
        handleUpdateRaceState({ activeClass: newName });
      }
    }
  };

  const handleDeleteClass = (classId: string, reassignToClassName?: string) => {
    const classToDelete = raceClasses.find((c) => c.id === classId);
    if (!classToDelete) return;

    const remaining = raceClasses.filter((c) => c.id !== classId);
    if (remaining.length === 0) return;
    commitRaceClasses(remaining);

    const fallbackClass = reassignToClassName || remaining[0]?.name || 'Class 1';

    // Reassign all vessels currently in this deleted class
    setBoats((prev) => {
      const updated = prev.map((b) =>
        b.class === classToDelete.name ? { ...b, class: fallbackClass } : b
      );
      scheduleBoatsBroadcast();
      return updated;
    });

    if (raceState.activeClass === classToDelete.name) {
      handleUpdateRaceState({ activeClass: fallbackClass });
    }
  };

  // Creates a boat from the Connect device flow and binds the tracker to it
  const handleCreateBoatForTracker = (nodeId: string, name: string, sailNumber: string) => {
    // Created with the tracker so it starts at the tracker's position (no jump from the map centre)
    const used = new Set(boats.map((b) => (b.color || '').toLowerCase()));
    const color = BOAT_PALETTE.find((c) => !used.has(c.toLowerCase())) || BOAT_PALETTE[boats.length % BOAT_PALETTE.length];
    const boatId = handleSaveBoat(
      {
        name,
        sailNumber,
        nodeId,
        color,
        class: raceState.activeClass && raceState.activeClass !== 'ALL' ? raceState.activeClass : undefined,
        status: 'PRE_START',
      },
      false
    );
    if (boatId) handleBindNodeToBoat(nodeId, boatId);
  };

  // A skipper's binding goes through the server, which checks it and then sends everyone the
  // fleet; this device only notes the binding locally once the server has accepted it
  const handleSkipperBind = async (nodeId: string, boatId: string) => {
    const res = await deviceTrackerService.requestSkipperBind(canonicalNodeId(nodeId), boatId);
    if (!('message' in res)) {
      deviceTrackerService.setNodeBoundBoat(res.nodeId, res.boatId);
      meshtasticService.setNodeBoundBoatId(res.nodeId, res.boatId);
      trackerRelay.forget(res.nodeId);
      setNodes((prev) => prev.map((n) => (sameNodeId(n.id, res.nodeId) ? { ...n, boundBoatId: res.boatId } : n)));
    }
    return res;
  };

  // Forget a tracker's binding in both services, so its next packet doesn't bind it again
  const clearTrackerBinding = (nodeId: string) => {
    meshtasticService.setNodeBoundBoatId(nodeId, null);
    deviceTrackerService.setNodeBoundBoat(nodeId, null);
    deviceTrackerService.setNodeBoundBoat(canonicalNodeId(nodeId), null);
    trackerRelay.forget(nodeId);
  };

  const handleDeleteNode = (nodeId: string) => {
    clearTrackerBinding(nodeId);
    setNodes((prev) => prev.filter((n) => !sameNodeId(n.id, nodeId)));
    setBoats((prev) =>
      prev.map((b) => (sameNodeId(b.nodeId, nodeId) ? { ...b, nodeId: null } : b))
    );
    if (followedTargetId === nodeId) {
      setFollowedTargetId(null);
    }
  };


  const boat1Obj = boats.find((b) => b.id === headToHeadPair?.[0]);
  const boat2Obj = boats.find((b) => b.id === headToHeadPair?.[1]);

  if (showLandingPage) {
    return (
      <div className="min-h-screen w-screen bg-white text-slate-900 font-sans">
        <FrontLandingPage
          onLoginClick={() => {
            setAuthModalInitialMode('login');
            setShowAuthModal(true);
          }}
          onRegisterClick={() => {
            setAuthModalInitialMode('register-org');
            setShowAuthModal(true);
          }}
          onViewRaceClick={(eventCode) => {
            if (eventCode) {
              // A regatta picked from the landing page's spectator picker: join it directly
              const clean = eventCode.trim().toUpperCase();
              roomService.switchRoom(clean, undefined, true);
              setActiveRoomCode(clean);
              deviceTrackerService.switchRoom(clean);
            } else {
              // Default to LOBBY if no event code was specified
              const currentRoom = roomService.getActiveRoomCode();
              const target = currentRoom && currentRoom !== 'RLIR26' ? currentRoom : 'LOBBY';
              roomService.switchRoom(target);
              setActiveRoomCode(target);
              deviceTrackerService.switchRoom(target);
            }
            setShowLandingPage(false);
            setViewMode('SPECTATOR');

            // No regatta chosen yet: show the room list once so the user can pick one
            const hasSeenLobby = localStorage.getItem('tmtrac_has_seen_room_selector');
            if (!eventCode && !hasSeenLobby) {
              localStorage.setItem('tmtrac_has_seen_room_selector', 'true');
              setShowLobbyModal(true);
            }
          }}
          onSuperAdminClick={() => setShowSuperAdminModal(true)}
          currentUser={currentUser}
          onLogoutClick={() => {
            authService.logout();
            setCurrentUser(null);
          }}
        />

        {/* Modals accessible from Landing Page */}
        <UserAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode={authModalInitialMode}
          onSuccess={(user) => {
            setCurrentUser(user);
            setShowAuthModal(false);
          }}
        />

        <SuperAdminModal
          isOpen={showSuperAdminModal}
          onClose={() => setShowSuperAdminModal(false)}
          currentUser={currentUser}
          onOpenCpanelDeploy={() => setShowCpanelDeployModal(true)}
          onViewEvent={(code) => {
            const clean = code.trim().toUpperCase();
            roomService.switchRoom(clean);
            setActiveRoomCode(clean);
            deviceTrackerService.switchRoom(clean);
            setShowLandingPage(false);
          }}
        />

        <UserDashboardModal
          isOpen={showDashboardModal}
          onClose={() => setShowDashboardModal(false)}
          user={currentUser}
          onOpenCreateRoom={() => {
            setShowDashboardModal(false);
            setShowLobbyModal(true);
          }}
        />
      </div>
    );
  }

  // Setup and race control are for people who can run this room's race
  const canRunRace = viewMode === 'RC_CONSOLE' && isUserAdminOrOfficer;
  // A skipper may connect their own tracker when the race office has turned that on
  const skipperCanConnect = isSkipper && !isUserAdminOrOfficer && raceState.skipperConnectEnabled === true;
  const setupStatus = getSetupStatus(raceClasses, boats, marks, raceState);
  const setupDoneCount = Object.values(setupStatus).filter((st) => st.done).length;

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden select-none ${
        'bg-surface text-ink'
      }`}
    >
      {saveRejection && (
        <div
          id="save-rejected-banner"
          role="alert"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,560px)] p-3 rounded-xl bg-surface/95 border border-danger-ink/50 text-ink shadow-2xl flex items-start gap-3 text-sm"
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold">
              {({
                UPDATE_MARKS: 'Course marks',
                UPDATE_BOATS: 'Fleet changes',
                UPDATE_RACE_STATE: 'Race settings',
                UPDATE_SERIES_RACES: 'Series results',
                UPDATE_CLASSES: 'Race classes',
                SEND_VHF_NOTICE: 'VHF notice',
              } as Record<string, string>)[saveRejection.action] || 'Change'}{' '}
              not saved
            </p>
            <p className="text-xs text-danger-ink/90 mt-0.5">
              This device has no Race Officer rights in room #{saveRejection.roomCode}. Unlock with the Race Officer PIN, then make the change again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSaveRejection(null);
              setShowPinUnlockModal(true);
            }}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-danger hover:brightness-110 text-on-danger text-xs font-bold cursor-pointer"
          >
            Enter PIN
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setSaveRejection(null)}
            className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-control text-danger-ink hover:brightness-110 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {trackersToReattach.length > 0 && (
        <div
          role="status"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[69] w-[min(92vw,560px)] p-3 rounded-xl bg-surface/95 border border-warning-ink/50 text-ink shadow-2xl flex items-start gap-3 text-sm"
        >
          <p className="flex-1 min-w-0">
            <span className="font-semibold">Re-attach {trackersToReattach.length === 1 ? 'a tracker' : `${trackersToReattach.length} trackers`}.</span>{' '}
            <span className="text-xs text-ink-muted">
              {trackersToReattach.slice(0, 4).join(', ')}{trackersToReattach.length > 4 ? ` and ${trackersToReattach.length - 4} more` : ''}{' '}
              {trackersToReattach.length === 1 ? 'was' : 'were'} linked to a tracker id from an older version. Connect the tracker again and pick the boat.
            </span>
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setTrackersToReattach([])}
            className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-control text-warning-ink hover:brightness-110 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Top Header with Live Peer Indicator */}
      <Header
        raceState={raceState}
        hardwareConn={hardwareConn}
        selectedLocation={selectedLocation}
        directSunlightMode={directSunlightMode}
        onToggleSunlightMode={() => setDirectSunlightMode((s) => !s)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        deviceGps={deviceGps}
        onToggleDeviceGps={handleToggleDeviceGps}
        onOpenHybridTrackers={() => setShowHybridTrackerModal(true)}
        hybridTrackerCount={fleetMembers.length + (deviceGps.active ? 1 : 0)}
        connectedPeerCount={connectedPeerCount}
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeRoomCode={activeRoomCode}
        onOpenLobby={() => setShowLobbyModal(true)}
        currentUser={currentUser}
        onOpenDashboard={() => setShowDashboardModal(true)}
        onOpenSuperAdmin={currentUser?.isSuperAdmin || authService.isSuperAdmin() ? () => setShowSuperAdminModal(true) : undefined}
        onOpenLandingPage={() => setShowLandingPage(true)}
        onOpenAuth={(mode) => {
          setAuthModalInitialMode(mode || 'login');
          setShowAuthModal(true);
        }}
        onOpenPinUnlock={() => setShowPinUnlockModal(true)}
        onOpenMqttInspector={() => setShowMqttInspector(true)}
        onOpenOfflineCache={() => setShowOfflineCache(true)}
        onOpenQrModal={() => setShowSpectatorQr(true)}
        onOpenVhfJuryModal={() => setShowVhfJuryModal(true)}
        onOpenResults={() => setShowResultsModal(true)}
        onOpenBoatQr={() => handleOpenBoatQr()}
        onOpenSkipperCheckIn={() => handleOpenSkipperCheckIn()}
        onOpenSetup={canRunRace ? () => openSetup() : undefined}
        setupDoneCount={setupDoneCount}
        onOpenMore={() => setShowMoreMenu(true)}
        onOpenCourseProfiles={() => {
          setCourseProfileCount(getSavedCourseProfiles().length);
          setShowCourseProfilesModal(true);
        }}
        showReplayBar={showReplayBar}
        onToggleReplayBar={() => setShowReplayBar((s) => !s)}
      />


      {/* Desktop RC Command Console Docked Panel (When viewMode === 'RC_CONSOLE') */}
      <div className="hidden md:block">
        {viewMode === 'RC_CONSOLE' && (
          <RcCommandConsolePanel
            raceState={raceState}
            boats={boats}
            marks={marks}
            onToggleRaceTimer={() => handleToggleRaceTimer()}
            onResetTimer={() => handleResetTimer()}
            onPlayStartSignal={() => playHornSound(880, 1200)}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onUpdateRaceState={handleUpdateRaceState}
            onUpdateBoatStatus={handleUpdateBoatStatus}
            onUpdateFleetStatus={handleUpdateFleetStatus}
            onUpdateWind={handleUpdateWind}
            onUpdateMarks={handleUpdateMarks}
            onSendVhfNotice={handleSendVhfNotice}
            onEndRace={requestEndRace}
            onRestartRace={requestRestartRace}
            onGeneralRecall={requestGeneralRecall}
            raceClasses={raceClasses}
            onOpenClassManager={() => openSetup('CLASSES')}
            onOpenResults={() => setShowResultsModal(true)}
            onEditCourse={() => openSetup('COURSE')}
            showSequenceSignal={sequenceSignal}
          />
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* DESKTOP / TABLET VIEW: Collapsible Sliding Sidebar + Map Canvas */}
        <div className="hidden md:flex flex-1 w-full h-full overflow-hidden relative">
          {mapSize !== 'FULLSCREEN' && (
            <div
              className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden flex z-20 ${
                isSidebarOpen ? 'w-80 lg:w-88' : 'w-0'
              }`}
            >
              <div className="w-80 lg:w-88 h-full">
                <LeaderboardSidebar
                  boats={boats}
                  nodes={nodes}
                  raceState={raceState}
                  selectedBoatId={selectedBoatId}
                  onSelectBoat={(id) => setSelectedBoatId(id)}
                  onConnectTracker={openConnectDevice}
                  onOpenConnectDevice={() => openConnectDevice()}
                  onOpenHybridTrackers={() => setShowHybridTrackerModal(true)}
                  followedTargetId={followedTargetId}
                  onToggleFollow={handleToggleFollow}
                  onOpenNodeInspector={handleOpenNodeInspector}
                  deviceGps={deviceGps}
                  onToggleDeviceGps={handleToggleDeviceGps}
                  onDeleteNode={handleDeleteNode}
                  onOpenAddBoat={handleOpenAddBoat}
                  onEditBoat={handleEditBoat}
                  onDeleteBoat={handleDeleteBoat}
                  raceClasses={raceClasses}
                  onOpenResults={() => setShowResultsModal(true)}
                  onOpenBoatQr={handleOpenBoatQr}
                  onEndRace={requestEndRace}
                  onCollapse={() => setIsSidebarOpen(false)}
                  viewMode={viewMode}
                  isAdmin={isUserAdminOrOfficer}
                  skipperCanConnect={skipperCanConnect}
                />
              </div>
            </div>
          )}

          <div className="flex-1 h-full relative overflow-hidden">
            <MarineMapCanvas
              boats={boats}
              marks={marks}
              nodes={nodes}
              selectedBoatId={selectedBoatId}
              onSelectBoat={(id) => setSelectedBoatId(id)}
              onOpenHeadToHead={handleOpenHeadToHead}
              basemap={basemap}
              onSelectBasemap={setBasemap}
              overlays={overlays}
              onToggleOverlay={handleToggleOverlay}
              zoomLevel={zoomLevel}
              onZoomIn={() => setZoomLevel((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
              onZoomOut={() => setZoomLevel((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))}
              onResetZoom={() => setZoomLevel(1)}
              mapSize={mapSize}
              onChangeMapSize={setMapSize}
              directSunlightMode={directSunlightMode}
              followedTargetId={followedTargetId}
              onOpenNodeInspector={handleOpenNodeInspector}
              selectedLocation={selectedLocation}
              playbackTimeSec={playback.currentTimeSec}
              maxPlaybackDurationSec={playback.maxDurationSec}
              deviceGps={deviceGps}
              showReplayBar={showReplayBar}
              onToggleReplayBar={() => setShowReplayBar((s) => !s)}
              onToggleSidebar={() => setIsSidebarOpen((s) => !s)}
              isSidebarOpen={isSidebarOpen}
              onAddMark={handleAddMark}
              onDeleteMark={handleDeleteMark}
              onMoveMarkPosition={handleMoveMarkPosition}
              onMoveBoatPosition={handleMoveBoatPosition}
              onUpdateMarkSettings={handleUpdateMarkSettings}
              onMoveMarkOrder={handleMoveMarkOrder}
              onEditCourse={canRunRace ? () => openSetup('COURSE') : undefined}
              viewMode={viewMode}
            />

            {/* Translucent Manager Console Overlay on Map */}

            {/* Translucent Rank (Leaderboard & Mesh Topo) Overlay on Map */}
          </div>
        </div>

        {/* MOBILE VIEW (Tab-driven, 100% full screen for active view) */}
        <div className="flex md:hidden flex-1 w-full h-full overflow-hidden">
          {/* TAB 1: FULL-SCREEN MAP */}
          {mobileTab === 'MAP' && (
            <div className="w-full h-full relative">
              <MarineMapCanvas
                boats={boats}
                marks={marks}
                nodes={nodes}
                selectedBoatId={selectedBoatId}
                onSelectBoat={(id) => setSelectedBoatId(id)}
                onOpenHeadToHead={handleOpenHeadToHead}
                basemap={basemap}
                onSelectBasemap={setBasemap}
                overlays={overlays}
                onToggleOverlay={handleToggleOverlay}
                zoomLevel={zoomLevel}
                onZoomIn={() => setZoomLevel((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                onZoomOut={() => setZoomLevel((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))}
                onResetZoom={() => setZoomLevel(1)}
                mapSize={mapSize}
                onChangeMapSize={setMapSize}
                directSunlightMode={directSunlightMode}
                followedTargetId={followedTargetId}
                onOpenNodeInspector={handleOpenNodeInspector}
                selectedLocation={selectedLocation}
                playbackTimeSec={playback.currentTimeSec}
                maxPlaybackDurationSec={playback.maxDurationSec}
                deviceGps={deviceGps}
                showReplayBar={showReplayBar}
                onToggleReplayBar={() => setShowReplayBar((s) => !s)}
                onAddMark={handleAddMark}
                onDeleteMark={handleDeleteMark}
                onMoveMarkPosition={handleMoveMarkPosition}
                onMoveBoatPosition={handleMoveBoatPosition}
                onUpdateMarkSettings={handleUpdateMarkSettings}
                onMoveMarkOrder={handleMoveMarkOrder}
                onEditCourse={canRunRace ? () => openSetup('COURSE') : undefined}
                viewMode={viewMode}
              />

              {/* Translucent Manager Console Mobile Overlay on Map */}

              {/* Translucent Rank (Leaderboard & Mesh Topo) Mobile Overlay on Map */}
            </div>
          )}

          {/* TAB 2: MOBILE LEADERBOARD */}
          {mobileTab === 'LEADERBOARD' && (
            <div className="w-full h-full flex flex-col bg-canvas text-ink overflow-hidden">
              <div className="p-3 bg-surface border-b border-line flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-accent" />
                  <span className="text-xs font-bold text-ink">
                    IRC Corrected Leaderboard
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <LeaderboardSidebar
                  boats={boats}
                  nodes={nodes}
                  raceState={raceState}
                  selectedBoatId={selectedBoatId}
                  onSelectBoat={(id) => {
                    setSelectedBoatId(id);
                    setMobileTab('MAP');
                  }}
                  onConnectTracker={openConnectDevice}
                  onOpenConnectDevice={() => openConnectDevice()}
                  onOpenHybridTrackers={() => setShowHybridTrackerModal(true)}
                  followedTargetId={followedTargetId}
                  onToggleFollow={handleToggleFollow}
                  onOpenNodeInspector={handleOpenNodeInspector}
                  deviceGps={deviceGps}
                  onToggleDeviceGps={handleToggleDeviceGps}
                  onDeleteNode={handleDeleteNode}
                  onOpenAddBoat={handleOpenAddBoat}
                  onEditBoat={handleEditBoat}
                  onDeleteBoat={handleDeleteBoat}
                  raceClasses={raceClasses}
                  onOpenResults={() => setShowResultsModal(true)}
                  onOpenBoatQr={handleOpenBoatQr}
                  onEndRace={requestEndRace}
                  viewMode={viewMode}
                  isAdmin={isUserAdminOrOfficer}
                  skipperCanConnect={skipperCanConnect}
                />
              </div>
            </div>
          )}

          {/* TAB 3: MOBILE FLEET GPS */}
          {mobileTab === 'FLEET_GPS' && (
            <div className="w-full h-full flex flex-col bg-canvas text-ink overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-accent" />
                  <div>
                    <h2 className="text-sm font-bold text-ink">
                      Hybrid Fleet GPS Tracker
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setMobileTab('MAP')}
                  className="px-2.5 py-1 bg-raised text-accent rounded-lg text-xs font-bold"
                >
                  Back to Map
                </button>
              </div>

              {/* My Device GPS Card */}
              <div className="p-4 rounded-2xl bg-surface border border-line space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-accent/20 text-accent flex items-center justify-center font-bold">
                      <Navigation className={`w-5 h-5 ${deviceGps.active ? '' : ''}`} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-ink">This Device (My Phone)</h4>
                      <p className="text-xs text-ink-muted">
                        {deviceGps.active ? 'Broadcasting live GPS coordinates' : 'Tracking inactive'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleDeviceGps}
                    className={`px-3 py-1.5 rounded-xl  text-xs font-bold transition-all ${
                      deviceGps.active
                        ? 'bg-danger text-on-danger shadow-md'
                        : 'bg-accent text-on-accent shadow-md'
                    }`}
                  >
                    {deviceGps.active ? 'Stop GPS' : 'Start GPS'}
                  </button>
                </div>

                {deviceGps.active && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-line text-center">
                    <div className="p-2 rounded-xl bg-canvas border border-line">
                      <span className="text-xs text-ink-muted block">SOG Speed</span>
                      <span className="text-xs font-bold text-success-ink">
                        {Number(deviceGps?.speedKt ?? 0).toFixed(1)} kt
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-canvas border border-line">
                      <span className="text-xs text-ink-muted block">COG Heading</span>
                      <span className="text-xs font-bold text-accent">
                        {Math.round(deviceGps.headingDeg || 0)}°
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-canvas border border-line">
                      <span className="text-xs text-ink-muted block">Accuracy</span>
                      <span className="text-xs font-bold text-ink">
                        ±{Math.round(deviceGps.accuracy || 5)}m
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Connected Fleet Nodes */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-ink-muted">
                  Live Fleet Members ({fleetMembers.length + (deviceGps.active ? 1 : 0)})
                </h3>

                {fleetMembers.length === 0 && !deviceGps.active ? (
                  <div className="p-4 rounded-xl bg-surface border border-dashed border-line text-center">
                    <p className="text-xs text-ink-muted">
                      No other devices connected yet. Open this URL on other phones or tablets to view together in real-time.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fleetMembers.map((member) => (
                      <div
                        key={member.deviceId}
                        className="p-3 rounded-xl bg-surface border border-line flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-canvas text-xs"
                            style={{ backgroundColor: member.color || '#00D4FF' }}
                          >
                            {member.deviceType === 'PHONE' ? 'Ph' : member.deviceType === 'TABLET' ? 'Tab' : 'PC'}
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-ink">
                              {member.deviceName}
                            </h5>
                            <p className="text-xs text-ink-muted">
                              Role: {member.role} • Battery: {formatBattery(member.battery)}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (member.lat && member.lng) {
                              setFollowedTargetId(member.deviceId);
                              setMobileTab('MAP');
                            }
                          }}
                          className="px-2.5 py-1 bg-raised text-accent hover:text-ink rounded-lg text-xs font-bold"
                        >
                          Locate
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MOBILE RC RACE CONSOLE */}
          {mobileTab === 'RC_CONSOLE' && (
            <div className="w-full h-full flex flex-col bg-canvas text-ink overflow-y-auto">
              <div className="flex-1">
                <RcCommandConsolePanel
                  raceState={raceState}
                  boats={boats}
                  marks={marks}
                  onToggleRaceTimer={() => handleToggleRaceTimer()}
                  onResetTimer={() => handleResetTimer()}
                  onPlayStartSignal={() => playHornSound(880, 1200)}
                  isMuted={isMuted}
                  onToggleMute={handleToggleMute}
                  onUpdateRaceState={handleUpdateRaceState}
                  onUpdateBoatStatus={handleUpdateBoatStatus}
                  onUpdateFleetStatus={handleUpdateFleetStatus}
                  onUpdateWind={handleUpdateWind}
                  onUpdateMarks={handleUpdateMarks}
                  onSendVhfNotice={handleSendVhfNotice}
                  onEndRace={requestEndRace}
                  onRestartRace={requestRestartRace}
            onGeneralRecall={requestGeneralRecall}
                  raceClasses={raceClasses}
                  onOpenClassManager={() => openSetup('CLASSES')}
                  onOpenResults={() => setShowResultsModal(true)}
                  onEditCourse={() => openSetup('COURSE')}
                  showSequenceSignal={sequenceSignal}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Phone navigation */}
      <MobileBottomBar
        activeTab={mobileTab}
        onSelectTab={setMobileTab}
        showRace={canRunRace}
        onOpenSetup={() => openSetup()}
        setupDoneCount={setupDoneCount}
        onOpenResults={() => setShowResultsModal(true)}
        onOpenMore={() => setShowMoreMenu(true)}
      />

      {/* Race Replay Scrubber for Spectator / Analysis mode - Slides open on demand */}
      {showReplayBar && (
        <RacePlaybackScrubber
          playback={playback}
          highlights={raceHighlights}
          onTogglePlay={() => setPlayback((p) => ({ ...p, isPlaying: !p.isPlaying }))}
          onSetSpeed={(speedMultiplier) => setPlayback((p) => ({ ...p, speedMultiplier }))}
          onSeek={(currentTimeSec) => setPlayback((p) => ({ ...p, currentTimeSec }))}
          onReset={() => setPlayback((p) => ({ ...p, currentTimeSec: 0, isPlaying: false }))}
          onClose={() => setShowReplayBar(false)}
        />
      )}

      {/* Desktop Bottom Status Footer */}
      <div className="hidden md:block">
        <Footer
          raceState={raceState}
          classNames={raceClasses.map((c) => c.name)}
          nodes={nodes}
        />
      </div>



      {/* Setup: classes, fleet, trackers, course. Its dialogs render after it, so they sit on top. */}
      {setupOpen && canRunRace && (
        <SetupPanel
          onClose={() => setSetupOpen(null)}
          initialSection={setupOpen.section}
          activeRoomCode={activeRoomCode}
          raceState={raceState}
          raceClasses={raceClasses}
          boats={boats}
          nodes={nodes}
          marks={marks}
          deviceGps={deviceGps}
          onToggleDeviceGps={handleToggleDeviceGps}
          onAddClass={handleAddClass}
          onUpdateClass={handleUpdateClass}
          onDeleteClass={handleDeleteClass}
          onOpenBoatEditor={(b) => (b ? handleEditBoat(b) : handleOpenAddBoat())}
          onOpenRosterImport={() => setShowRosterImport(true)}
          onOpenBoatQr={() => handleOpenBoatQr()}
          onOpenConnectDevice={openConnectDevice}
          onSetSkipperConnect={(enabled) => handleUpdateRaceState({ skipperConnectEnabled: enabled })}
          onLoadCourse={handleLoadCourse}
          onManageCourses={() => {
            setCourseProfileCount(getSavedCourseProfiles().length);
            setShowCourseProfilesModal(true);
          }}
          courseProfileCount={courseProfileCount}
          onUpdateMarks={handleUpdateMarks}
          onAddCourseMark={handleAddCourseMarkNearView}
          onFinish={() => {
            setSetupOpen(null);
            setMobileTab('RC_CONSOLE');
            setSequenceSignal((n) => n + 1);
          }}
        />
      )}

      {showRosterImport && (
        <RosterImportDialog onClose={() => setShowRosterImport(false)} onImport={handleImportCompetitors} />
      )}

      {/* Everything that isn't setup or racing */}
      {showMoreMenu && (
        <MoreMenu
          onClose={() => setShowMoreMenu(false)}
          onOpenResults={() => setShowResultsModal(true)}
          onOpenVhfJury={() => setShowVhfJuryModal(true)}
          onOpenSpectatorQr={() => setShowSpectatorQr(true)}
          onOpenHeadToHead={
            boats.length >= 2
              ? () => {
                  setHeadToHeadPair([boats[0].id, boats[1].id]);
                  setShowHeadToHead(true);
                }
              : undefined
          }
          onOpenChat={FEATURES.aiTactician ? () => setShowGeminiChat(true) : undefined}
          onOpenMqttInspector={() => setShowMqttInspector(true)}
          onOpenOfflineCache={() => setShowOfflineCache(true)}
          onOpenLocations={() => setShowNmeaMalaysiaModal(true)}
          onOpenClub={isUserAdminOrOfficer ? () => setShowTenantDashboard(true) : undefined}
          onOpenAbout={() => setShowAboutModal(true)}
        />
      )}

      {/* The one way to connect a tracker: method → connect → which boat */}
      {showConnectDevice && (
        <ConnectDeviceDialog
          nodes={nodes}
          boats={boats}
          onBindNodeToBoat={handleBindNodeToBoat}
          onCreateBoatForTracker={handleCreateBoatForTracker}
          onUnbindNode={(nodeId) => handleBindNodeToBoat(nodeId, '')}
          onSkipperBind={isUserAdminOrOfficer ? undefined : handleSkipperBind}
          initialNodeId={connectTarget.nodeId}
          initialBoatId={connectTarget.boatId}
          onClose={() => setShowConnectDevice(false)}
        />
      )}

      {/* Digital VHF Bulletins & Jury Protest Modal */}
      {showVhfJuryModal && (
        <VhfAndJuryProtestModal
          boats={boats}
          bulletins={bulletins}
          onSendBulletin={(b) => setBulletins((prev) => [b, ...prev])}
          mobAlert={mobAlert}
          onTriggerMobAlert={handleTriggerMobAlert}
          onClearMobAlert={handleClearMobAlert}
          protestSnapshots={protestSnapshots}
          onCreateProtestSnapshot={handleCreateProtestSnapshot}
          onClose={() => setShowVhfJuryModal(false)}
        />
      )}

      {/* Malaysia public LoRa / MQTT window */}
      {showNmeaMalaysiaModal && (
        <NmeaAndMalaysiaMeshModal
          hardwareConn={hardwareConn}
          onUpdateHardwareConn={(partial) =>
            setHardwareConn((prev) => ({ ...prev, ...partial }))
          }
          selectedLocation={selectedLocation}
          onSelectLocation={handleSelectLocation}
          nodes={nodes}
          onClose={() => setShowNmeaMalaysiaModal(false)}
        />
      )}

      {/* Standard Modals */}

      {showHeadToHead && boat1Obj && boat2Obj && (
        <HeadToHeadModal
          boat1={boat1Obj}
          boat2={boat2Obj}
          onClose={() => setShowHeadToHead(false)}
        />
      )}

      {FEATURES.aiTactician && showGeminiChat && (
        <GeminiChatModal
          messages={chatMessages}
          onSendMessage={handleSendChatMessage}
          onClose={() => setShowGeminiChat(false)}
        />
      )}

      {showMqttInspector && (
        <MqttPacketInspectorModal onClose={() => setShowMqttInspector(false)} />
      )}

      {showOfflineCache && (
        <OfflineCacheModal onClose={() => setShowOfflineCache(false)} />
      )}

      {showSpectatorQr && (
        <SpectatorQrModal
          onClose={() => setShowSpectatorQr(false)}
          onOpenSpectatorView={() => setViewMode('SPECTATOR')}
          onOpenRcConsoleView={() => setViewMode('RC_CONSOLE')}
          currentViewMode={viewMode}
          boats={boats}
          raceState={raceState}
          courseMarks={marks}
          onSeekReplay={(timeSec) => {
            setShowReplayBar(true);
            setPlayback((p) => ({ ...p, currentTimeSec: timeSec, isPlaying: true }));
          }}
        />
      )}

      {/* Meshtastic Node Telemetry Inspector Modal */}
      {inspectorTarget && (
        <NodeTelemetryModal
          node={inspectorTarget.node}
          boat={inspectorTarget.boat}
          isOpen={!!inspectorTarget}
          followedTargetId={followedTargetId}
          onToggleFollow={handleToggleFollow}
          onDeleteNode={handleDeleteNode}
          onClose={() => setInspectorTarget(null)}
        />
      )}

      {/* Vessel Fleet Management: Add, Edit, Delete Boat Modal */}
      {showBoatEditorModal && (
        <BoatEditorModal
          isOpen={showBoatEditorModal}
          boatToEdit={boatToEdit}
          nodes={nodes}
          boats={boats}
          deviceGps={deviceGps}
          onClose={() => {
            setShowBoatEditorModal(false);
            setBoatToEdit(null);
          }}
          onSaveBoat={handleSaveBoat}
          onDeleteBoat={handleDeleteBoat}
          raceClasses={raceClasses}
          onOpenClassManager={() => setShowClassManager(true)}
        />
      )}

      {/* Race Class Management Modal (Add, Edit, Delete Race Classes) */}
      {showClassManager && (
        <ClassManagerModal
          isOpen={showClassManager}
          classes={raceClasses}
          boats={boats}
          onClose={() => setShowClassManager(false)}
          onAddClass={handleAddClass}
          onUpdateClass={handleUpdateClass}
          onDeleteClass={handleDeleteClass}
          onOpenCourseProfiles={() => {
            setShowClassManager(false);
            setShowCourseProfilesModal(true);
          }}
        />
      )}

      {/* Multi-Device Hybrid Fleet GPS Tracker Modal */}
      <DeviceGpsTrackerModal
        isOpen={showHybridTrackerModal}
        onClose={() => setShowHybridTrackerModal(false)}
        boats={boats}
        nodes={nodes}
        deviceGps={deviceGps}
        fleetMembers={fleetMembers}
        viewMode={viewMode}
        onBindBoat={(boatId) => handleBindNodeToBoat(deviceTrackerService.getLocalNode().id, boatId)}
        onToggleDeviceGps={handleToggleDeviceGps}
        onFollowTarget={handleToggleFollow}
      />

      {/* Official Race Results & Scoring Modal (Phase 4 Automation) */}
      <RaceResultsModal
        isOpen={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        boats={boats}
        raceState={raceState}
        raceClasses={raceClasses}
        seriesRaces={seriesRaces}
        onUpdateBoatStatus={handleUpdateBoatStatus}
        onSaveRaceToSeries={handleSaveRaceToSeries}
        onDeleteRaceFromSeries={handleDeleteRaceFromSeries}
        onResetForNextRace={handleResetForNextRace}
        onClearSeries={handleClearSeries}
        onNewSeries={handleNewSeries}
        viewMode={viewMode}
      />

      {/* Course Profiles & Mark Layouts Manager Modal (Max 10) */}
      <CourseProfileModal
        isOpen={showCourseProfilesModal}
        onClose={() => {
          setCourseProfileCount(getSavedCourseProfiles().length);
          setShowCourseProfilesModal(false);
        }}
        currentMarks={marks}
        currentLocation={selectedLocation}
        deviceGps={deviceGps}
        currentWindDir={raceState.windDirectionDeg}
        currentWindSpeed={raceState.windSpeedKt}
        activeProfileId={activeCourseProfileId}
        onApplyCourse={handleApplyCourseProfile}
      />

      {/* About Developer & System Information Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />

      {/* Regatta Multi-Tenant Lobby & Room Switcher Modal */}
      <RegattaLobbyModal
        isOpen={showLobbyModal}
        onClose={() => setShowLobbyModal(false)}
        activeRoomCode={activeRoomCode}
        isOrganizer={isOrganizer}
        onSetViewMode={setViewMode}
        connectedPeerCount={connectedPeerCount}
        currentUser={currentUser}
        onOpenAuth={(mode) => {
          setAuthModalInitialMode(mode === 'register' ? 'register-participant' : 'login');
          setShowAuthModal(true);
        }}
      />

      {/* User Authentication Modal (Sign In & Register) */}
      <UserAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalInitialMode}
        onSuccess={(user) => {
          setCurrentUser(user);
          setShowAuthModal(false);
        }}
      />

      {/* User Dashboard & Room Management Modal */}
      <UserDashboardModal
        isOpen={showDashboardModal}
        onClose={() => setShowDashboardModal(false)}
        user={currentUser}
        onOpenCreateRoom={() => {
          setShowDashboardModal(false);
          setShowLobbyModal(true);
        }}
      />

      {/* Super Admin Master Management Suite Modal */}
      <SuperAdminModal
        isOpen={showSuperAdminModal}
        onClose={() => setShowSuperAdminModal(false)}
        currentUser={currentUser}
        onOpenCpanelDeploy={() => setShowCpanelDeployModal(true)}
        onViewEvent={(code) => {
          const clean = code.trim().toUpperCase();
          roomService.switchRoom(clean);
          setActiveRoomCode(clean);
          deviceTrackerService.switchRoom(clean);
          setShowLandingPage(false);
        }}
      />

      {/* Organization Tenant Dashboard (Events, Members, Audit Logs, Plan Limits) */}
      <TenantDashboardModal
        isOpen={showTenantDashboard}
        onClose={() => setShowTenantDashboard(false)}
        onSelectEvent={(code) => {
          roomService.switchRoom(code);
        }}
        onCreateEvent={() => {
          setShowTenantDashboard(false);
          setShowLobbyModal(true);
        }}
      />

      {/* Subscription & Plan Limits Upgrade Modal */}
      <SubscriptionUpgradeModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        currentTier={currentTenant?.planTier || currentUser?.planTier || 'FREE'}
        onSuccess={() => {
          tenantService.fetchCurrentTenant();
        }}
      />

      {/* cPanel Deployment Center Modal for tmtrac.my */}
      <CpanelDeployModal
        isOpen={showCpanelDeployModal}
        onClose={() => setShowCpanelDeployModal(false)}
      />

      {pendingCourseLoad && (
        <ConfirmDialog
          title={`Replace ${marks.length} ${marks.length === 1 ? 'mark' : 'marks'} with ${pendingCourseLoad.name}?`}
          body={`The current course${raceState.courseName ? ` (${raceState.courseName})` : ''} is removed and the fleet's course updates. This can't be undone. To keep it, save it first (Setup, Course: Save, rename or import courses).`}
          confirmLabel="Replace course"
          onConfirm={() => {
            const load = pendingCourseLoad;
            setPendingCourseLoad(null);
            load.apply();
          }}
          onCancel={() => setPendingCourseLoad(null)}
        />
      )}

      {pendingRaceAction && (
        <ConfirmDialog
          {...describePendingRaceAction(pendingRaceAction)}
          onConfirm={runPendingRaceAction}
          onCancel={() => setPendingRaceAction(null)}
        />
      )}

      {/* Race Officer PIN Unlock Dialog for Spectator Mode */}
      <PinUnlockModal
        isOpen={showPinUnlockModal}
        onClose={() => setShowPinUnlockModal(false)}
        roomCode={activeRoomCode}
        onSuccess={() => {
          setIsOrganizer(true);
          setViewMode('RC_CONSOLE');
        }}
      />

      {/* Smart Boat QR Generator & Print Modal (for Race Officers & Race Management) */}
      {showBoatQrModal && (
        <BoatCheckInQrModal
          isOpen={showBoatQrModal}
          onClose={() => {
            setShowBoatQrModal(false);
            setBoatQrTargetId(null);
          }}
          boats={boats}
          selectedBoatId={boatQrTargetId || undefined}
          activeRoomCode={activeRoomCode}
          isAdmin={isUserAdminOrOfficer}
        />
      )}

      {/* Skipper 1-Tap Check-In & Auto-Binding Modal (for Sailors via Smart QR or Direct Link) */}
      {showSkipperCheckInModal && (
        <SkipperCheckInModal
          isOpen={showSkipperCheckInModal}
          onClose={() => {
            setShowSkipperCheckInModal(false);
            setTargetCheckInBoatId(null);
            setTargetCheckInSail(null);
          }}
          boats={boats}
          targetBoatId={targetCheckInBoatId}
          targetSailNumber={targetCheckInSail}
          deviceGps={deviceGps}
          isAdmin={isUserAdminOrOfficer}
          onBindAndStartGps={handleSkipperCheckIn}
        />
      )}
    </div>
  );
}
