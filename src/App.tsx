import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Boat,
  BoatStatus,
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
import { UnifiedHubModal, HubTab } from './components/UnifiedHubModal';
import { NodeBindingModal } from './components/NodeBindingModal';
import { HeadToHeadModal } from './components/HeadToHeadModal';
import { GeminiChatModal } from './components/GeminiChatModal';
import { GeminiImageModal } from './components/GeminiImageModal';
import { MqttPacketInspectorModal } from './components/MqttPacketInspectorModal';
import { OfflineCacheModal } from './components/OfflineCacheModal';
import { SpectatorQrModal } from './components/SpectatorQrModal';
import { BluetoothUsbScanModal } from './components/BluetoothUsbScanModal';
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
import { getSavedCourseProfiles } from './services/courseProfileService';
import { generateRaceHighlights, recordedRaceDurationSec } from './services/highlightService';
import { meshtasticService } from './services/meshtasticBleMqttService';
import { deviceTrackerService, getDefaultDeviceProfile } from './services/deviceTrackerService';
import { roomService } from './services/roomService';
import { serverNow } from './services/serverClock';
import { getClassRaceState } from './services/classRaceState';
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
import { Navigation, Trophy, X } from 'lucide-react';

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
    if (!seenIds.has(n.id)) {
      seenIds.add(n.id);
      result.push(n);
    }
  }
  return result;
}


/**
 * Automatically computes live boat status with full RRS compliance:
 * - If race concludes or ends: unfinished racing boats become DNF, boats in pre-start become DNS.
 * - If boat crosses finish line: becomes FINISHED.
 * - Preserves existing final statuses (FINISHED, DSQ, RET, DNF, DNS).
 */
export function computeLiveBoatStatus(
  currentStatus: BoatStatus,
  progress: { isFinished: boolean; isOcs: boolean },
  classState: { status: string; countdownSeconds?: number; startSequenceActive?: boolean },
  elapsedSec?: number,
  roundingsCount?: number
): BoatStatus {
  // Preserve final locked outcomes
  if (
    currentStatus === 'FINISHED' ||
    currentStatus === 'DSQ' ||
    currentStatus === 'RET' ||
    currentStatus === 'DNF' ||
    currentStatus === 'DNS'
  ) {
    return currentStatus;
  }

  // If boat crossed finish line
  if (progress.isFinished) {
    return 'FINISHED';
  }

  // If race class has concluded/finished
  if (classState.status === 'FINISHED') {
    const hasStarted =
      (elapsedSec && elapsedSec > 0) ||
      (roundingsCount && roundingsCount > 0) ||
      currentStatus === 'RACING' ||
      currentStatus === 'OCS' ||
      currentStatus === 'CLEARED_OCS';
    return currentStatus === 'PRE_START' || !hasStarted ? 'DNS' : 'DNF';
  }

  // In Pre-start or countdown
  const isPreStartOrCountdown =
    classState.status === 'PRE_START' ||
    classState.status === 'COUNTDOWN' ||
    (typeof classState.countdownSeconds === 'number' && classState.countdownSeconds > 0);

  if (isPreStartOrCountdown) {
    return 'PRE_START';
  }

  if (currentStatus === 'CLEARED_OCS') {
    return 'CLEARED_OCS';
  }

  if (progress.isOcs) {
    return 'OCS';
  }

  if (currentStatus === 'OCS' && !progress.isOcs) {
    return 'RACING';
  }

  if (currentStatus === 'PRE_START' && classState.status === 'RACING') {
    return 'RACING';
  }

  return currentStatus;
}

export default function App() {
  const [raceState, setRaceState] = useState<RaceState>(INITIAL_RACE_STATE);
  const [raceClasses, setRaceClasses] = useState<RaceClassDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('regatta_race_classes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load saved race classes:', e);
    }
    return INITIAL_RACE_CLASSES;
  });
  const [boats, setBoats] = useState<Boat[]>([]);
  const [nodes, setNodes] = useState<MeshtasticNode[]>([]);
  const [marks, setMarks] = useState<CourseMark[]>(INITIAL_MARKS);
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
  // Shown when the server refuses an edit, so a change never looks saved when it wasn't
  const [saveRejection, setSaveRejection] = useState<{ action: string; roomCode: string; at: number } | null>(null);

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
  const [showRcConsoleOverlay, setShowRcConsoleOverlay] = useState<boolean>(false);
  const [showLeaderboardOverlay, setShowLeaderboardOverlay] = useState<boolean>(false);
  const [showToolsDrawer, setShowToolsDrawer] = useState<boolean>(false);
  const [showHubModal, setShowHubModal] = useState<boolean>(false);
  const [activeHubTab, setActiveHubTab] = useState<HubTab>('FLEET');

  const handleOpenHub = (hub: HubTab = 'FLEET') => {
    setActiveHubTab(hub);
    setShowHubModal(true);
  };
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
    batteryLevel: 90,
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
        const targetBoatId = gps.profile.boundBoatId;
        const targetDeviceId = gps.profile.deviceId;
        const localNodeId = localNode.id;
        setBoats((prevBoats) => {
          let hasChange = false;
          const updated = prevBoats.map((b) => {
            if (b.id === targetBoatId || b.nodeId === targetDeviceId || b.nodeId === localNodeId) {
              hasChange = true;
              const oldTrail = b.trail || [];
              const sog = isValidNumber(gps.speedKt) ? gps.speedKt! : b.sog;
              const cog = isValidNumber(gps.headingDeg) ? gps.headingDeg! : b.cog;
              const newTrail = [...oldTrail, { lat: gps.lat!, lng: gps.lng! }].slice(-1000);
              
              const boatClassState = getClassRaceState(raceState, b.class);
              const tempBoat = { ...b, lat: gps.lat!, lng: gps.lng!, sog, cog, trail: newTrail };
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
                nodeId: b.nodeId || localNodeId,
                lat: gps.lat!,
                lng: gps.lng!,
                sog,
                cog,
                heading: cog,
                trail: newTrail,
                markRoundings: progress.updatedRoundings,
                dtw: progress.dtwNm,
                status: updatedStatus,
              };
            }
            return b;
          });
          if (hasChange) {
            deviceTrackerService.broadcastBoats(updated);
          }
          return updated;
        });
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
              setBoats((prevBoats) => {
                let hasChange = false;
                const updated = prevBoats.map((b) => {
                  if (b.id === member.boundBoatId || b.nodeId === member.deviceId) {
                    hasChange = true;
                    const oldTrail = b.trail || [];
                    const sog = isValidNumber(member.speedKt) ? member.speedKt : b.sog;
                    const cog = isValidNumber(member.headingDeg) ? member.headingDeg : b.cog;
                    const newTrail = [...oldTrail, { lat: member.lat, lng: member.lng }].slice(-1000);

                    const boatClassState = getClassRaceState(raceState, b.class);
                    const tempBoat = { ...b, lat: member.lat, lng: member.lng, sog, cog, trail: newTrail };
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
                      nodeId: b.nodeId || member.deviceId,
                      lat: member.lat,
                      lng: member.lng,
                      sog,
                      cog,
                      heading: cog,
                      trail: newTrail,
                      markRoundings: progress.updatedRoundings,
                      dtw: progress.dtwNm,
                      status: updatedStatus,
                    };
                  }
                  return b;
                });
                if (hasChange) {
                  deviceTrackerService.broadcastBoats(updated);
                }
                return updated;
              });
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

    const unsubRemoteBoats = deviceTrackerService.onRemoteBoats((syncedBoats) => {
      if (Array.isArray(syncedBoats)) {
        const clean = syncedBoats.filter((b) => b && isValidNumber(b.lat) && isValidNumber(b.lng));
        setBoats(deduplicateBoats(clean));
      }
    });

    const unsubRemoteVhf = deviceTrackerService.onRemoteVhf((bulletin) => {
      setBulletins((prev) => [bulletin, ...prev]);
    });

    const unsubRemoteSeries = deviceTrackerService.onRemoteSeriesRaces((syncedSeries) => {
      if (Array.isArray(syncedSeries)) {
        setSeriesRaces(syncedSeries);
      }
    });

    const unsubRoom = roomService.onRoomChange((code, isOrg) => {
      setActiveRoomCode(code);
      setIsOrganizer(isOrg);
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
      if (session.boats && Array.isArray(session.boats)) {
        const cleanBoats = session.boats.filter((b) => b && isValidNumber(b.lat) && isValidNumber(b.lng));
        setBoats(deduplicateBoats(cleanBoats));
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
          const initialTrail = [{ lat: remoteNode.lat!, lng: remoteNode.lng! }];
          return [remoteNode, ...prevNodes];
        }
      });
    });

    // Meshtastic BLE & MQTT live hardware node stream
    const unsubMeshtasticNode = meshtasticService.onNodeUpdate((node) => {
      if (!node) return;
      setNodes((prevNodes) => {
        const idx = prevNodes.findIndex((n) => n.id === node.id);
        if (idx >= 0) {
          const updated = [...prevNodes];
          const oldTrail = prevNodes[idx].trail || [];
          const validLat = isValidNumber(node.lat) && node.lat !== 0 ? node.lat : prevNodes[idx].lat;
          const validLng = isValidNumber(node.lng) && node.lng !== 0 ? node.lng : prevNodes[idx].lng;
          const newTrail = (validLat && validLng) 
            ? [...oldTrail, { lat: validLat, lng: validLng }].slice(-1000)
            : oldTrail;
          const boundBoatId = (node.boundBoatId !== undefined && node.boundBoatId !== null) ? node.boundBoatId : prevNodes[idx].boundBoatId;
          updated[idx] = { ...prevNodes[idx], ...node, boundBoatId, lat: validLat, lng: validLng, trail: newTrail };
          return updated;
        } else {
          return [node, ...prevNodes];
        }
      });

      // Update bound boat's live telemetry if available
      if (isValidNumber(node.lat) && isValidNumber(node.lng) && node.lat !== 0 && node.lng !== 0) {
        // Broadcast hardware node to the server so all remote spectators & fleet members see it publicly
        deviceTrackerService.broadcastHardwareNode(node);

        setBoats((prevBoats) => {
          let hasChange = false;
          const updated = prevBoats.map((b) => {
            if (b.nodeId === node.id || (node.boundBoatId && b.id === node.boundBoatId)) {
              hasChange = true;
              const oldTrail = b.trail || [];
              const sog = isValidNumber(node.speedKt) && node.speedKt! > 0 ? node.speedKt! : b.sog;
              const cog = isValidNumber(node.headingDeg) ? node.headingDeg! : b.cog;
              const newTrail = [...oldTrail, { lat: node.lat!, lng: node.lng! }].slice(-1000);

              const boatClassState = getClassRaceState(raceState, b.class);
              const tempBoat = { ...b, lat: node.lat!, lng: node.lng!, sog, cog, trail: newTrail };
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
                nodeId: b.nodeId || node.id,
                lat: node.lat!,
                lng: node.lng!,
                sog,
                cog,
                heading: cog,
                trail: newTrail,
                markRoundings: progress.updatedRoundings,
                dtw: progress.dtwNm,
                status: updatedStatus,
              };
            }
            return b;
          });
          if (hasChange) {
            deviceTrackerService.broadcastBoats(updated);
          }
          return updated;
        });
      }
    });

    const unsubMeshtasticPacket = meshtasticService.onPacketLog((_pkt) => {
      // Packet stream active
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
          if (b.nodeId === payload.deviceId || (payload.boundBoatId && b.id === payload.boundBoatId)) {
            hasChange = true;
            const oldTrail = b.trail || [];
            const newCoords = payload.points.map((p) => ({ lat: p.lat, lng: p.lng }));
            const mergedTrail = [...oldTrail, ...newCoords].slice(-2000);

            const boatClassState = getClassRaceState(raceState, b.class);
            const replayedBoat = replayBatchThroughCourseProgress(
              { ...b, trail: mergedTrail },
              marks,
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

    // Check initial server MQTT bridge status
    meshtasticService.checkServerMqttStatus().then((connected) => {
      setRaceState((prev) => ({ ...prev, mqttConnected: connected }));
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
      unsubSessionSync();
      unsubRemoteNode();
      unsubMeshtasticNode();
      unsubMeshtasticPacket();
      unsubMqttStatus();
      unsubBatchBackfill();
    };
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
  const [showNodeBinding, setShowNodeBinding] = useState(false);
  const [bindingTargetNodeId, setBindingTargetNodeId] = useState<string | undefined>(undefined);
  const [bindingTargetBoatId, setBindingTargetBoatId] = useState<string | undefined>(undefined);
  const [showHeadToHead, setShowHeadToHead] = useState(false);
  const [headToHeadPair, setHeadToHeadPair] = useState<[string, string] | null>(null);
  const [showGeminiChat, setShowGeminiChat] = useState(false);
  const [showGeminiImage, setShowGeminiImage] = useState(false);
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
  const [showHardwareScan, setShowHardwareScan] = useState(false);
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

  const handleRestoreSampleSeries = () => {
    setSeriesRaces(INITIAL_SERIES_RACES);
    try {
      localStorage.setItem(`regatta_race_series_${activeRoomCode}`, JSON.stringify(INITIAL_SERIES_RACES));
      localStorage.setItem('regatta_race_series', JSON.stringify(INITIAL_SERIES_RACES));
    } catch (e) {
      console.warn('Failed to restore sample series:', e);
    }
    deviceTrackerService.broadcastSeriesRaces(INITIAL_SERIES_RACES);
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

  const handleOpenNodeBindingWithSelection = (nodeId?: string, boatId?: string) => {
    setBindingTargetNodeId(nodeId);
    setBindingTargetBoatId(boatId);
    setShowNodeBinding(true);
  };

  // Sync raceClasses to local storage
  useEffect(() => {
    try {
      localStorage.setItem('regatta_race_classes', JSON.stringify(raceClasses));
    } catch (e) {
      console.warn('Failed to save race classes:', e);
    }
  }, [raceClasses]);

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
              deviceTrackerService.broadcastBoats(updated);
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
      deviceTrackerService.broadcastBoats(updated);
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

  const handleMoveNodePosition = (nodeId: string, lat: number, lng: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let boundBoatId: string | undefined;
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          boundBoatId = n.boundBoatId;
          const nextTrail = [...(n.trail || []), { lat, lng }].slice(-1000);
          return { ...n, lat, lng, trail: nextTrail, lastHeard: Date.now() };
        }
        return n;
      })
    );

    if (boundBoatId) {
      handleMoveBoatPosition(boundBoatId, lat, lng);
    }
  };

  const handleUpdateMarkSettings = (markId: string, updates: Partial<CourseMark>) => {
    const updated = updateMarkSettings(marks, markId, updates);
    handleUpdateMarks(updated);
  };

  const handleMoveMarkOrder = (markId: string, dir: 'UP' | 'DOWN') => {
    const updated = moveMarkOrder(marks, markId, dir);
    handleUpdateMarks(updated);
  };

  const handleApplyCoursePreset = (preset: 'WINDWARD_LEEWARD' | 'TRIANGLE' | 'TRAPEZOID') => {
    const centerLat = selectedLocation?.centerLat ?? 6.308;
    const centerLng = selectedLocation?.centerLng ?? 99.845;
    const updated = generateCoursePreset(preset, centerLat, centerLng, raceState.windDirectionDeg);
    handleUpdateMarks(updated);
  };

  const handleApplyCourseProfile = (newMarks: CourseMark[], profileName: string, profileId?: string) => {
    handleUpdateMarks(newMarks);
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
          updatedAt: now,
        };
        deviceTrackerService.broadcastRaceState(next);
        return next;
      }

      // If updating status/countdown/sequence on currently active class
      if (partial.status !== undefined || partial.countdownSeconds !== undefined || partial.startSequenceActive !== undefined) {
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
              deviceTrackerService.broadcastBoats(updated);
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
            deviceTrackerService.broadcastBoats(updated);
            return updated;
          }
          return prevBoats;
        });
      }

      const updatedClassStates = {
        ...(prev.classStates || {}),
        [targetClass]: {
          ...curClsState,
          countdownSeconds: nextCountdown,
          startSequenceActive: nextSequenceActive,
          status: nextStatus,
          targetStartTime,
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
      deviceTrackerService.broadcastBoats(updated);
      return updated;
    });

    setRaceState((prev) => {
      const now = serverNow();
      const curClsState = getClassRaceState(prev, targetClass);
      const updatedClassStates = {
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
      deviceTrackerService.broadcastBoats(updated);
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
      deviceTrackerService.broadcastBoats(updated);
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

  const handleTriggerMobAlert = (boatId: string, name: string, lat: number, lng: number) => {
    setMobAlert({
      id: 'mob-' + Date.now(),
      boatId,
      boatName: name,
      lat,
      lng,
      triggeredAt: Date.now(),
      active: true,
      interceptingBoats: [],
    });
    playHornSound(990, 2000, true);
  };

  const handleClearMobAlert = () => {
    setMobAlert(null);
  };

  const handleCreateProtestSnapshot = (boat1Id: string, boat2Id: string, rule: string, notes: string) => {
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
      deviceTrackerService.broadcastBoats(updated);
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
      deviceTrackerService.broadcastBoats(updated);
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


  const handleToggleTelemetryRate = () => {
    handleUpdateRaceState({
      telemetryRate: raceState.telemetryRate === 'HIGH_FREQUENCY' ? 'OFFSHORE_LEG' : 'HIGH_FREQUENCY',
    });
  };

  const handleOpenHeadToHead = (b1: string, b2: string) => {
    setHeadToHeadPair([b1, b2]);
    setShowHeadToHead(true);
  };

  const handleSendChatMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
  };

  const handleAnalyzeImage = (dataUrl: string, promptText: string) => {
    // Handled in GeminiImageModal
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

    // 2. Check nodes state
    const foundNode = nodes.find((n) => n.id === nodeId);
    if (foundNode && isValidNumber(foundNode.lat) && isValidNumber(foundNode.lng) && foundNode.lat !== 0 && foundNode.lng !== 0) {
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
    if (foundMember && isValidNumber(foundMember.lat) && isValidNumber(foundMember.lng) && foundMember.lat !== 0 && foundMember.lng !== 0) {
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

    const effectiveNodeId = isLocalPhone ? localNode.id : nodeId;

    // Persist binding into both background communication services
    deviceTrackerService.setNodeBoundBoat(nodeId, boatId || null);
    deviceTrackerService.setNodeBoundBoat(effectiveNodeId, boatId || null);
    meshtasticService.setNodeBoundBoatId(nodeId, boatId || null);
    meshtasticService.setNodeBoundBoatId(effectiveNodeId, boatId || null);

    if (isLocalPhone) {
      deviceTrackerService.updateProfile({ boundBoatId: boatId || null });
    }

    const resolved = resolveTrackerPosition(nodeId);

    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId || n.id === effectiveNodeId || (isLocalPhone && n.id === localNode.id)) {
          return { ...n, boundBoatId: boatId || undefined };
        }
        // If node was previously bound to this boat, unbind it
        if (boatId && n.boundBoatId === boatId && n.id !== nodeId && n.id !== effectiveNodeId) {
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
        } else if (boatId && b.nodeId === effectiveNodeId && b.id !== boatId) {
          // Clear previous boat bound to this node
          return { ...b, nodeId: null };
        } else if (!boatId || boatId === '') {
          // Unbinding this node from any boat
          if (b.nodeId === nodeId || b.nodeId === effectiveNodeId || (isLocalPhone && b.nodeId === localNode.id)) {
            return { ...b, nodeId: null };
          }
        }
        return b;
      });
      deviceTrackerService.broadcastBoats(updated);
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

  const handleSaveBoat = (boatData: Partial<Boat>, isEdit: boolean, originalId?: string) => {
    if (isEdit && originalId) {
      const resolved = resolveTrackerPosition(boatData.nodeId);
      const localNode = deviceTrackerService.getLocalNode();
      const profile = deviceTrackerService.getProfile();
      const isLocalPhone =
        boatData.nodeId === localNode.id ||
        boatData.nodeId === profile.deviceId ||
        boatData.nodeId === 'LOCAL_PHONE_GPS' ||
        boatData.nodeId === `!DEV-${profile.deviceId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}`;

      const effectiveNodeId = isLocalPhone ? localNode.id : (boatData.nodeId || null);

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
        deviceTrackerService.broadcastBoats(updated);
        return updated;
      });

      // Update node binding if provided
      if (effectiveNodeId !== undefined) {
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (effectiveNodeId && (n.id === effectiveNodeId || (isLocalPhone && n.id === localNode.id))) {
              return { ...n, boundBoatId: originalId };
            }
            if (n.boundBoatId === originalId && n.id !== effectiveNodeId) {
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

      const effectiveNodeId = isLocalPhone ? localNode.id : (boatData.nodeId || null);

      if (isLocalPhone) {
        deviceTrackerService.updateProfile({ boundBoatId: newId });
      }

      const newBoat: Boat = {
        id: newId,
        name: boatData.name || 'NEW RACER',
        sailNumber: boatData.sailNumber || 'MAS 99',
        class: boatData.class || (raceClasses[0]?.name ?? 'Class 1'),
        handicapSystem: boatData.handicapSystem || 'IRC',
        handicapRating: boatData.handicapRating || 1.0,
        skipper: boatData.skipper || 'Skipper',
        nodeId: effectiveNodeId,
        lat: initLat,
        lng: initLng,
        sog: initSog,
        cog: initCog,
        vmg: typeof boatData.vmg === 'number' ? boatData.vmg : 0,
        dtw: typeof boatData.dtw === 'number' ? boatData.dtw : 1.2,
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
        deviceTrackerService.broadcastBoats(updated);
        return updated;
      });
      if (effectiveNodeId) {
        setNodes((prevNodes) =>
          prevNodes.map((n) =>
            n.id === effectiveNodeId ? { ...n, boundBoatId: newId } : n
          )
        );
      }
    }
  };

  const handleDeleteBoat = (boatId: string) => {
    setBoats((prev) => {
      const updated = prev.filter((b) => b.id !== boatId);
      deviceTrackerService.broadcastBoats(updated);
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

  const handleClearDemoBoats = () => {
    setBoats((prev) => {
      // Remove demo boats: boat-1, boat-2, boat-3, boat-4, boat-5, boat-6
      const updated = prev.filter(
        (b) =>
          b.id !== 'boat-1' &&
          b.id !== 'boat-2' &&
          b.id !== 'boat-3' &&
          b.id !== 'boat-4' &&
          b.id !== 'boat-5' &&
          b.id !== 'boat-6'
      );
      deviceTrackerService.broadcastBoats(updated);
      return updated;
    });
    setNodes((prevNodes) =>
      prevNodes.map((n) =>
        n.boundBoatId && ['boat-1', 'boat-2', 'boat-3', 'boat-4', 'boat-5', 'boat-6'].includes(n.boundBoatId)
          ? { ...n, boundBoatId: undefined }
          : n
      )
    );
  };

  const handleCreateNewBoat = (boatData: Partial<Boat>) => {
    handleSaveBoat(boatData, false);
  };

  const handleImportCompetitors = (imported: CompetitorImportRecord[]) => {
    setBoats((prev) => {
      const updated = [...prev];
      const palette = ['#00D4FF', '#00FF9D', '#FBBC04', '#EA4335', '#A142F4', '#FF8A80', '#38BDF8', '#F43F5E'];
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
      deviceTrackerService.broadcastBoats(deduped);
      return deduped;
    });
  };

  // Race Class Management (Add, Edit, Delete)
  const handleAddClass = (newClassData: Omit<RaceClassDefinition, 'id'>) => {
    const newClass: RaceClassDefinition = {
      ...newClassData,
      id: 'class-' + Date.now(),
    };
    setRaceClasses((prev) => [...prev, newClass]);
  };

  const handleUpdateClass = (classId: string, updated: Partial<RaceClassDefinition>) => {
    const oldClass = raceClasses.find((c) => c.id === classId);
    setRaceClasses((prev) =>
      prev.map((c) => (c.id === classId ? { ...c, ...updated } : c))
    );

    // If class name changed, propagate to all boats in that class
    if (oldClass && updated.name && oldClass.name !== updated.name) {
      const oldName = oldClass.name;
      const newName = updated.name;
      setBoats((prev) => {
        const remapped = prev.map((b) => (b.class === oldName ? { ...b, class: newName } : b));
        deviceTrackerService.broadcastBoats(remapped);
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
    setRaceClasses(remaining);

    const fallbackClass = reassignToClassName || remaining[0]?.name || 'Class 1';

    // Reassign all vessels currently in this deleted class
    setBoats((prev) => {
      const updated = prev.map((b) =>
        b.class === classToDelete.name ? { ...b, class: fallbackClass } : b
      );
      deviceTrackerService.broadcastBoats(updated);
      return updated;
    });

    if (raceState.activeClass === classToDelete.name) {
      handleUpdateRaceState({ activeClass: fallbackClass });
    }
  };

  const handleAddScannedNode = (newNode: MeshtasticNode) => {
    let boundBoatId = newNode.boundBoatId;
    const cleanNodeTag = (newNode.shortName || newNode.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4)).toUpperCase();
    const cleanNodeKey = newNode.id.replace(/^!+/, '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const newBoatId = `boat-${cleanNodeKey}`;

    const fallbackLat = (newNode.lat && newNode.lat !== 0) ? newNode.lat : selectedLocation.centerLat;
    const fallbackLng = (newNode.lng && newNode.lng !== 0) ? newNode.lng : selectedLocation.centerLng;

    const autoBoat: Boat = {
      id: newBoatId,
      name: newNode.longName.replace(/LilyGO /i, '').slice(0, 20) || `T-Echo (${cleanNodeTag})`,
      sailNumber: `TE-${cleanNodeTag}`,
      class: raceState.activeClass && raceState.activeClass !== 'ALL' ? raceState.activeClass : 'IRC RACING',
      handicapSystem: 'IRC',
      handicapRating: 1.000,
      skipper: 'T-Echo Pilot',
      color: '#00D4FF',
      nodeId: newNode.id,
      status: 'RACING',
      lat: fallbackLat,
      lng: fallbackLng,
      sog: newNode.speedKt || 0.0,
      cog: newNode.headingDeg || 0,
      heading: newNode.headingDeg || 0,
      vmg: 0,
      dtw: 0,
      markRoundings: [],
      elapsedSeconds: 0,
      correctedSeconds: 0,
      trail: [{ lat: fallbackLat, lng: fallbackLng }],
    };

    setBoats((prev) => {
      // Find if boat already exists for this node or boat id
      const existingIdx = prev.findIndex(
        (b) => b.id === newBoatId || b.nodeId === newNode.id || (boundBoatId && b.id === boundBoatId)
      );

      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        const updated = [...prev];
        updated[existingIdx] = {
          ...existing,
          nodeId: existing.nodeId || newNode.id,
          lat: (newNode.lat && newNode.lat !== 0) ? newNode.lat : existing.lat,
          lng: (newNode.lng && newNode.lng !== 0) ? newNode.lng : existing.lng,
          sog: (newNode.speedKt !== undefined && newNode.speedKt > 0) ? newNode.speedKt : existing.sog,
          cog: (newNode.headingDeg !== undefined) ? newNode.headingDeg : existing.cog,
        };
        const deduped = deduplicateBoats(updated);
        deviceTrackerService.broadcastBoats(deduped);
        return deduped;
      }

      const next = deduplicateBoats([autoBoat, ...prev]);
      deviceTrackerService.broadcastBoats(next);
      return next;
    });

    const finalizedNode = { ...newNode, boundBoatId: boundBoatId || newBoatId };

    setNodes((prev) => {
      const idx = prev.findIndex((n) => n.id === finalizedNode.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...prev[idx], ...finalizedNode };
        return deduplicateNodes(updated);
      }
      return deduplicateNodes([finalizedNode, ...prev]);
    });
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setBoats((prev) =>
      prev.map((b) => (b.nodeId === nodeId ? { ...b, nodeId: null } : b))
    );
    if (followedTargetId === nodeId) {
      setFollowedTargetId(null);
    }
  };

  const handleClearDemoNodes = () => {
    setNodes((prev) =>
      prev.filter((n) => {
        // Keep real connected phones, tablets, web GPS devices, or connected BLE/USB hardware
        if (
          n.isDeviceGps ||
          n.connectionType === 'PHONE' ||
          n.connectionType === 'TABLET' ||
          n.connectionType === 'DEVICE_GPS'
        ) {
          return true;
        }
        if (n.isBluetoothConnected || n.connectionType === 'USB') {
          return true;
        }
        // Filter out dummy/demo nodes (node-rc-01, node-safety-01, !TECHO- simulated nodes, mock nodes)
        if (n.id.startsWith('node-') || n.id.startsWith('!TECHO-') || n.id.startsWith('mock-')) {
          return false;
        }
        return false;
      })
    );
    setBoats((prev) =>
      prev.map((b) =>
        b.nodeId &&
        (b.nodeId.startsWith('node-') || b.nodeId.startsWith('!TECHO-') || b.nodeId.startsWith('mock-'))
          ? { ...b, nodeId: null }
          : b
      )
    );
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
          onOpenLobby={() => {
            setShowDashboardModal(false);
            setShowLobbyModal(true);
          }}
          onOpenSuperAdmin={() => setShowSuperAdminModal(true)}
        />
      </div>
    );
  }

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
        boatCount={boats.length}
        connectedPeerCount={connectedPeerCount}
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeRoomCode={activeRoomCode}
        onOpenLobby={() => setShowLobbyModal(true)}
        currentUser={currentUser}
        onOpenDashboard={() => setShowDashboardModal(true)}
        onOpenTenantDashboard={isUserAdminOrOfficer ? () => setShowTenantDashboard(true) : undefined}
        onOpenSubscriptionModal={isUserAdminOrOfficer ? () => setShowSubscriptionModal(true) : undefined}
        onOpenSuperAdmin={currentUser?.isSuperAdmin || authService.isSuperAdmin() ? () => setShowSuperAdminModal(true) : undefined}
        onOpenLandingPage={() => setShowLandingPage(true)}
        tenantName={currentTenant?.name || currentUser?.tenantName || 'RLYC'}
        planTier={currentTenant?.planTier || currentUser?.planTier || 'FREE'}
        onOpenAuth={(mode) => {
          setAuthModalInitialMode(mode || 'login');
          setShowAuthModal(true);
        }}
        onOpenPinUnlock={() => setShowPinUnlockModal(true)}
        onOpenChat={() => setShowGeminiChat(true)}
        onOpenImageAnalysis={() => setShowGeminiImage(true)}
        onOpenNodeBinding={() => handleOpenNodeBindingWithSelection()}
        onOpenMqttInspector={() => setShowMqttInspector(true)}
        onOpenOfflineCache={() => setShowOfflineCache(true)}
        onOpenQrModal={() => setShowSpectatorQr(true)}
        onOpenHardwareScan={() => setShowHardwareScan(true)}
        onOpenVhfJuryModal={() => setShowVhfJuryModal(true)}
        onOpenNmeaMalaysiaModal={() => setShowNmeaMalaysiaModal(true)}
        onOpenResults={() => setShowResultsModal(true)}
        onOpenBoatQr={() => handleOpenBoatQr()}
        onOpenSkipperCheckIn={() => handleOpenSkipperCheckIn()}
        onOpenTools={() => handleOpenHub('FLEET')}
        onOpenHub={handleOpenHub}
        isToolsOpen={showHubModal}
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
            directSunlightMode={directSunlightMode}
            raceClasses={raceClasses}
            onOpenClassManager={() => setShowClassManager(true)}
            onOpenResults={() => setShowResultsModal(true)}
            onOpenCourseProfiles={() => {
              setCourseProfileCount(getSavedCourseProfiles().length);
              setShowCourseProfilesModal(true);
            }}
            courseProfileCount={courseProfileCount}
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
                  onOpenNodeBinding={handleOpenNodeBindingWithSelection}
                  onOpenHardwareScan={() => setShowHardwareScan(true)}
                  onOpenHybridTrackers={() => setShowHybridTrackerModal(true)}
                  followedTargetId={followedTargetId}
                  onToggleFollow={handleToggleFollow}
                  onOpenNodeInspector={handleOpenNodeInspector}
                  deviceGps={deviceGps}
                  onToggleDeviceGps={handleToggleDeviceGps}
                  onDeleteNode={handleDeleteNode}
                  onClearDemoNodes={handleClearDemoNodes}
                  onOpenAddBoat={handleOpenAddBoat}
                  onEditBoat={handleEditBoat}
                  onDeleteBoat={handleDeleteBoat}
                  onClearDemoBoats={handleClearDemoBoats}
                  raceClasses={raceClasses}
                  onOpenClassManager={() => setShowClassManager(true)}
                  onOpenResults={() => setShowResultsModal(true)}
                  onOpenBoatQr={handleOpenBoatQr}
                  onOpenSkipperCheckIn={handleOpenSkipperCheckIn}
                  onEndRace={requestEndRace}
                  onCollapse={() => setIsSidebarOpen(false)}
                  viewMode={viewMode}
                  isAdmin={isUserAdminOrOfficer}
                />
              </div>
            </div>
          )}

          <div className="flex-1 h-full relative overflow-hidden">
            <MarineMapCanvas
              boats={boats}
              marks={marks}
              nodes={nodes}
              raceState={raceState}
              selectedBoatId={selectedBoatId}
              onSelectBoat={(id) => setSelectedBoatId(id)}
              onToggleTelemetryRate={handleToggleTelemetryRate}
              onOpenHeadToHead={handleOpenHeadToHead}
              onPlayStartSignal={() => playHornSound(880, 1200)}
              onToggleRaceTimer={() =>
                handleUpdateRaceState({
                  startSequenceActive: !raceState.startSequenceActive,
                })
              }
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
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
              onToggleFollow={handleToggleFollow}
              onOpenNodeInspector={handleOpenNodeInspector}
              selectedLocation={selectedLocation}
              playbackTimeSec={playback.currentTimeSec}
              maxPlaybackDurationSec={playback.maxDurationSec}
              deviceGps={deviceGps}
              onToggleDeviceGps={handleToggleDeviceGps}
              showReplayBar={showReplayBar}
              onToggleReplayBar={() => setShowReplayBar((s) => !s)}
              showRcConsoleOverlay={showRcConsoleOverlay}
              showLeaderboardOverlay={showLeaderboardOverlay}
              showToolsDrawer={showToolsDrawer}
              onOpenTools={() => setShowToolsDrawer((prev) => !prev)}
              isToolsOpen={showToolsDrawer}
              onToggleSidebar={() => setIsSidebarOpen((s) => !s)}
              isSidebarOpen={isSidebarOpen}
              onAddMark={handleAddMark}
              onDeleteMark={handleDeleteMark}
              onMoveMarkPosition={handleMoveMarkPosition}
              onMoveBoatPosition={handleMoveBoatPosition}
              onMoveNodePosition={handleMoveNodePosition}
              onUpdateMarkSettings={handleUpdateMarkSettings}
              onMoveMarkOrder={handleMoveMarkOrder}
              onApplyCoursePreset={handleApplyCoursePreset}
              onOpenCourseProfiles={() => {
                setCourseProfileCount(getSavedCourseProfiles().length);
                setShowCourseProfilesModal(true);
              }}
              onOpenHub={handleOpenHub}
              viewMode={viewMode}
            />

            {/* Translucent Manager Console Overlay on Map */}
            {showRcConsoleOverlay && (
              <div className="absolute inset-x-4 top-14 bottom-6 landscape:top-1.5 landscape:bottom-2 landscape:inset-x-6 z-30 flex justify-center items-start pointer-events-none">
                <div className="pointer-events-auto w-full max-w-2xl h-full max-h-full flex flex-col min-h-0">
                  <RcCommandConsolePanel
                    raceState={raceState}
                    boats={boats}
                    marks={marks}
                    onToggleRaceTimer={() =>
                      handleUpdateRaceState({
                        startSequenceActive: !raceState.startSequenceActive,
                      })
                    }
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
                    directSunlightMode={directSunlightMode}
                    raceClasses={raceClasses}
                    onOpenClassManager={() => setShowClassManager(true)}
                    onOpenResults={() => setShowResultsModal(true)}
                    onOpenCourseProfiles={() => {
                      setCourseProfileCount(getSavedCourseProfiles().length);
                      setShowCourseProfilesModal(true);
                    }}
                    courseProfileCount={courseProfileCount}
                    isOverlay={true}
                    onClose={() => setShowRcConsoleOverlay(false)}
                  />
                </div>
              </div>
            )}

            {/* Translucent Rank (Leaderboard & Mesh Topo) Overlay on Map */}
            {showLeaderboardOverlay && (
              <div className="absolute inset-x-4 top-14 bottom-6 landscape:top-1.5 landscape:bottom-2 landscape:inset-x-6 z-30 flex justify-center items-start pointer-events-none">
                <div className="pointer-events-auto w-full max-w-lg h-full max-h-full flex flex-col min-h-0">
                  <LeaderboardSidebar
                    boats={boats}
                    nodes={nodes}
                    raceState={raceState}
                    selectedBoatId={selectedBoatId}
                    onSelectBoat={(id) => {
                      setSelectedBoatId(id);
                      setShowLeaderboardOverlay(false);
                    }}
                    onOpenNodeBinding={handleOpenNodeBindingWithSelection}
                    onOpenHardwareScan={() => setShowHardwareScan(true)}
                    onOpenHybridTrackers={() => setShowHybridTrackerModal(true)}
                    followedTargetId={followedTargetId}
                    onToggleFollow={handleToggleFollow}
                    onOpenNodeInspector={handleOpenNodeInspector}
                    deviceGps={deviceGps}
                    onToggleDeviceGps={handleToggleDeviceGps}
                    onDeleteNode={handleDeleteNode}
                    onClearDemoNodes={handleClearDemoNodes}
                    onOpenAddBoat={handleOpenAddBoat}
                    onEditBoat={handleEditBoat}
                    onDeleteBoat={handleDeleteBoat}
                    onClearDemoBoats={handleClearDemoBoats}
                    raceClasses={raceClasses}
                    onOpenClassManager={() => setShowClassManager(true)}
                    onOpenResults={() => setShowResultsModal(true)}
                    onOpenBoatQr={handleOpenBoatQr}
                    onOpenSkipperCheckIn={handleOpenSkipperCheckIn}
                    onEndRace={requestEndRace}
                    viewMode={viewMode}
                    isOverlay={true}
                    isAdmin={isUserAdminOrOfficer}
                    onClose={() => setShowLeaderboardOverlay(false)}
                  />
                </div>
              </div>
            )}
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
                raceState={raceState}
                selectedBoatId={selectedBoatId}
                onSelectBoat={(id) => setSelectedBoatId(id)}
                onToggleTelemetryRate={handleToggleTelemetryRate}
                onOpenHeadToHead={handleOpenHeadToHead}
                onPlayStartSignal={() => playHornSound(880, 1200)}
                onToggleRaceTimer={() =>
                  handleUpdateRaceState({
                    startSequenceActive: !raceState.startSequenceActive,
                  })
                }
                isMuted={isMuted}
                onToggleMute={handleToggleMute}
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
                onToggleFollow={handleToggleFollow}
                onOpenNodeInspector={handleOpenNodeInspector}
                selectedLocation={selectedLocation}
                playbackTimeSec={playback.currentTimeSec}
                maxPlaybackDurationSec={playback.maxDurationSec}
                deviceGps={deviceGps}
                onToggleDeviceGps={handleToggleDeviceGps}
                showReplayBar={showReplayBar}
                onToggleReplayBar={() => setShowReplayBar((s) => !s)}
                showRcConsoleOverlay={showRcConsoleOverlay}
                showLeaderboardOverlay={showLeaderboardOverlay}
                showToolsDrawer={showToolsDrawer}
                onOpenTools={() => setShowToolsDrawer((prev) => !prev)}
                isToolsOpen={showToolsDrawer}
                onAddMark={handleAddMark}
                onDeleteMark={handleDeleteMark}
                onMoveMarkPosition={handleMoveMarkPosition}
                onMoveBoatPosition={handleMoveBoatPosition}
                onMoveNodePosition={handleMoveNodePosition}
                onUpdateMarkSettings={handleUpdateMarkSettings}
                onMoveMarkOrder={handleMoveMarkOrder}
                onApplyCoursePreset={handleApplyCoursePreset}
                onOpenCourseProfiles={() => {
                  setCourseProfileCount(getSavedCourseProfiles().length);
                  setShowCourseProfilesModal(true);
                }}
                onOpenHub={handleOpenHub}
                viewMode={viewMode}
              />

              {/* Translucent Manager Console Mobile Overlay on Map */}
              {showRcConsoleOverlay && (
                <div className="absolute inset-x-2 top-12 bottom-20 landscape:top-1.5 landscape:bottom-2 landscape:inset-x-6 z-30 flex justify-center items-start pointer-events-none">
                  <div className="pointer-events-auto w-full max-h-full flex flex-col min-h-0">
                    <RcCommandConsolePanel
                      raceState={raceState}
                      boats={boats}
                      marks={marks}
                      onToggleRaceTimer={() =>
                        handleUpdateRaceState({
                          startSequenceActive: !raceState.startSequenceActive,
                        })
                      }
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
                      directSunlightMode={directSunlightMode}
                      raceClasses={raceClasses}
                      onOpenClassManager={() => setShowClassManager(true)}
                      onOpenResults={() => setShowResultsModal(true)}
                      onOpenCourseProfiles={() => {
                        setCourseProfileCount(getSavedCourseProfiles().length);
                        setShowCourseProfilesModal(true);
                      }}
                      courseProfileCount={courseProfileCount}
                      isOverlay={true}
                      onClose={() => setShowRcConsoleOverlay(false)}
                    />
                  </div>
                </div>
              )}

              {/* Translucent Rank (Leaderboard & Mesh Topo) Mobile Overlay on Map */}
              {showLeaderboardOverlay && (
                <div className="absolute inset-x-2 top-12 bottom-20 landscape:top-1.5 landscape:bottom-2 landscape:inset-x-6 z-30 flex justify-center items-start pointer-events-none">
                  <div className="pointer-events-auto w-full max-h-full flex flex-col min-h-0">
                    <LeaderboardSidebar
                      boats={boats}
                      nodes={nodes}
                      raceState={raceState}
                      selectedBoatId={selectedBoatId}
                      onSelectBoat={(id) => {
                        setSelectedBoatId(id);
                        setShowLeaderboardOverlay(false);
                      }}
                      onOpenNodeBinding={handleOpenNodeBindingWithSelection}
                      onOpenHardwareScan={() => setShowHardwareScan(true)}
                      onOpenHybridTrackers={() => setShowHybridTrackerModal(true)}
                      followedTargetId={followedTargetId}
                      onToggleFollow={handleToggleFollow}
                      onOpenNodeInspector={handleOpenNodeInspector}
                      deviceGps={deviceGps}
                      onToggleDeviceGps={handleToggleDeviceGps}
                      onDeleteNode={handleDeleteNode}
                      onClearDemoNodes={handleClearDemoNodes}
                      onOpenAddBoat={handleOpenAddBoat}
                      onEditBoat={handleEditBoat}
                      onDeleteBoat={handleDeleteBoat}
                      onClearDemoBoats={handleClearDemoBoats}
                      raceClasses={raceClasses}
                      onOpenClassManager={() => setShowClassManager(true)}
                      onOpenResults={() => setShowResultsModal(true)}
                      onOpenBoatQr={handleOpenBoatQr}
                      onOpenSkipperCheckIn={handleOpenSkipperCheckIn}
                      onEndRace={requestEndRace}
                      viewMode={viewMode}
                      isOverlay={true}
                      isAdmin={isUserAdminOrOfficer}
                      onClose={() => setShowLeaderboardOverlay(false)}
                    />
                  </div>
                </div>
              )}
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
                  onOpenNodeBinding={handleOpenNodeBindingWithSelection}
                  onOpenHardwareScan={() => setShowHardwareScan(true)}
                  onOpenHybridTrackers={() => setShowHybridTrackerModal(true)}
                  followedTargetId={followedTargetId}
                  onToggleFollow={handleToggleFollow}
                  onOpenNodeInspector={handleOpenNodeInspector}
                  deviceGps={deviceGps}
                  onToggleDeviceGps={handleToggleDeviceGps}
                  onDeleteNode={handleDeleteNode}
                  onClearDemoNodes={handleClearDemoNodes}
                  onOpenAddBoat={handleOpenAddBoat}
                  onEditBoat={handleEditBoat}
                  onDeleteBoat={handleDeleteBoat}
                  onClearDemoBoats={handleClearDemoBoats}
                  raceClasses={raceClasses}
                  onOpenClassManager={() => setShowClassManager(true)}
                  onOpenResults={() => setShowResultsModal(true)}
                  onOpenBoatQr={handleOpenBoatQr}
                  onOpenSkipperCheckIn={handleOpenSkipperCheckIn}
                  onEndRace={requestEndRace}
                  viewMode={viewMode}
                  isAdmin={isUserAdminOrOfficer}
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
                              Role: {member.role} • Battery: {member.battery ?? 85}%
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
                  directSunlightMode={directSunlightMode}
                  raceClasses={raceClasses}
                  onOpenClassManager={() => setShowClassManager(true)}
                  onOpenResults={() => setShowResultsModal(true)}
                  onOpenCourseProfiles={() => {
                    setCourseProfileCount(getSavedCourseProfiles().length);
                    setShowCourseProfilesModal(true);
                  }}
                  courseProfileCount={courseProfileCount}
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
        showRace={viewMode === 'RC_CONSOLE' && isUserAdminOrOfficer}
        onOpenResults={() => setShowResultsModal(true)}
        onOpenTools={() => handleOpenHub('FLEET')}
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



      {/* Unified 4-Hub Control Modal */}
      <UnifiedHubModal
        isOpen={showHubModal}
        onClose={() => setShowHubModal(false)}
        onOpenMqttInspector={() => setShowMqttInspector(true)}
        initialHub={activeHubTab}
        boats={boats}
        nodes={nodes}
        deviceGps={deviceGps}
        onToggleDeviceGps={handleToggleDeviceGps}
        hybridTrackerCount={fleetMembers.length + (deviceGps.active ? 1 : 0)}
        onOpenSkipperCheckIn={() => handleOpenSkipperCheckIn()}
        onOpenBoatQr={() => handleOpenBoatQr()}
        onOpenNodeBinding={handleOpenNodeBindingWithSelection}
        onOpenHardwareScan={() => setShowHardwareScan(true)}
        onOpenBoatEditor={(b) => (b ? handleEditBoat(b) : handleOpenAddBoat())}
        onSelectBoat={(id) => {
          setSelectedBoatId(id);
          setMobileTab('MAP');
        }}
        onOpenHeadToHead={() => {
          if (boats.length >= 2) {
            setHeadToHeadPair([boats[0].id, boats[1].id]);
            setShowHeadToHead(true);
          }
        }}
        raceState={raceState}
        raceClasses={raceClasses}
        marks={marks}
        viewMode={viewMode}
        onStartSequence={() => handleToggleRaceTimer()}
        onStopSequence={() => handleToggleRaceTimer()}
        onPostpone={() => handleUpdateRaceState({ status: 'PRE_START', startSequenceActive: false, countdownSeconds: 300 })}
        onGeneralRecall={() => requestGeneralRecall(raceState.activeClass)}
        onAbandon={() => handleUpdateRaceState({ status: 'PRE_START', startSequenceActive: false, countdownSeconds: 300 })}
        onSelectClass={(cls) => handleUpdateRaceState({ activeClass: cls })}
        onOpenCourseProfiles={() => {
          setCourseProfileCount(getSavedCourseProfiles().length);
          setShowCourseProfilesModal(true);
        }}
        onOpenClassManager={() => setShowClassManager(true)}
        onOpenVhfJuryModal={() => setShowVhfJuryModal(true)}
        onOpenChat={() => setShowGeminiChat(true)}
        onOpenResults={() => setShowResultsModal(true)}
        showReplayBar={showReplayBar}
        onToggleReplayBar={() => setShowReplayBar((s) => !s)}
        seriesRaces={seriesRaces}
        activeRoomCode={activeRoomCode}
        connectedPeerCount={connectedPeerCount}
        onOpenLobby={() => setShowLobbyModal(true)}
        onOpenSpectatorQr={() => setShowSpectatorQr(true)}
        onOpenNmeaMalaysiaModal={() => setShowNmeaMalaysiaModal(true)}
        onOpenOfflineCache={() => setShowOfflineCache(true)}
        directSunlightMode={directSunlightMode}
        onToggleSunlightMode={() => setDirectSunlightMode((s) => !s)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        currentUser={currentUser}
        onOpenDashboard={() => setShowDashboardModal(true)}
        onOpenAuth={(mode) => {
          setAuthModalInitialMode(mode || 'login');
          setShowAuthModal(true);
        }}
        onOpenAbout={() => setShowAboutModal(true)}
        onOpenTenantDashboard={isUserAdminOrOfficer ? () => setShowTenantDashboard(true) : undefined}
        tenantName={currentTenant?.name || currentUser?.tenantName || 'Royal Langkawi Yacht Club (RLYC)'}
        planTier={currentTenant?.planTier || currentUser?.planTier || 'CLUB'}
      />

      {/* Hardware Node BLE & USB Serial Scanner Modal */}
      {showHardwareScan && (
        <BluetoothUsbScanModal
          nodes={nodes}
          boats={boats}
          hardwareConn={hardwareConn}
          onUpdateHardwareConn={(partial) =>
            setHardwareConn((prev) => ({ ...prev, ...partial }))
          }
          onAddScannedNode={handleAddScannedNode}
          onDeleteNode={handleDeleteNode}
          onClearDemoNodes={handleClearDemoNodes}
          onClose={() => setShowHardwareScan(false)}
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

      {/* NMEA Instruments & Malaysia Public Mesh Modal */}
      {showNmeaMalaysiaModal && (
        <NmeaAndMalaysiaMeshModal
          hardwareConn={hardwareConn}
          onUpdateHardwareConn={(partial) =>
            setHardwareConn((prev) => ({ ...prev, ...partial }))
          }
          selectedLocation={selectedLocation}
          onSelectLocation={handleSelectLocation}
          nodes={nodes}
          onAddScannedNode={handleAddScannedNode}
          onClose={() => setShowNmeaMalaysiaModal(false)}
        />
      )}

      {/* Standard Modals */}
      {showNodeBinding && (
        <NodeBindingModal
          nodes={nodes}
          boats={boats}
          initialNodeId={bindingTargetNodeId}
          initialBoatId={bindingTargetBoatId}
          onClose={() => {
            setShowNodeBinding(false);
            setBindingTargetNodeId(undefined);
            setBindingTargetBoatId(undefined);
          }}
          onBindNodeToBoat={handleBindNodeToBoat}
          onUnbindNode={(nodeId) => handleBindNodeToBoat(nodeId, '')}
          onCreateNewBoat={handleCreateNewBoat}
          raceClasses={raceClasses}
          onOpenBoatQr={(boatId) => handleOpenBoatQr(boatId)}
          isAdmin={isUserAdminOrOfficer}
        />
      )}

      {showHeadToHead && boat1Obj && boat2Obj && (
        <HeadToHeadModal
          boat1={boat1Obj}
          boat2={boat2Obj}
          onClose={() => setShowHeadToHead(false)}
        />
      )}

      {showGeminiChat && (
        <GeminiChatModal
          messages={chatMessages}
          raceState={raceState}
          boats={boats}
          onSendMessage={handleSendChatMessage}
          onClose={() => setShowGeminiChat(false)}
        />
      )}

      {showGeminiImage && (
        <GeminiImageModal
          onAnalyzeImage={handleAnalyzeImage}
          onClose={() => setShowGeminiImage(false)}
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
          activeRoomCode={activeRoomCode}
          onOpenBoatQr={() => {
            setShowSpectatorQr(false);
            handleOpenBoatQr();
          }}
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
        onOpenNodeInspector={handleOpenNodeInspector}
      />

      {/* Official Race Results & Scoring Modal (Phase 4 Automation) */}
      <RaceResultsModal
        isOpen={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        boats={boats}
        raceState={raceState}
        raceClasses={raceClasses}
        courseMarks={marks}
        seriesRaces={seriesRaces}
        onUpdateBoatStatus={handleUpdateBoatStatus}
        onSaveRaceToSeries={handleSaveRaceToSeries}
        onDeleteRaceFromSeries={handleDeleteRaceFromSeries}
        onResetForNextRace={handleResetForNextRace}
        onClearSeries={handleClearSeries}
        onNewSeries={handleNewSeries}
        onRestoreSampleSeries={handleRestoreSampleSeries}
        onImportCompetitors={handleImportCompetitors}
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
        directSunlightMode={directSunlightMode}
      />

      {/* About Developer & System Information Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
        directSunlightMode={directSunlightMode}
      />

      {/* Regatta Multi-Tenant Lobby & Room Switcher Modal */}
      <RegattaLobbyModal
        isOpen={showLobbyModal}
        onClose={() => setShowLobbyModal(false)}
        activeRoomCode={activeRoomCode}
        isOrganizer={isOrganizer}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        connectedPeerCount={connectedPeerCount}
        currentUser={currentUser}
        onOpenAuth={(mode) => {
          setAuthModalInitialMode(mode || 'login');
          setShowAuthModal(true);
        }}
        onOpenDashboard={() => setShowDashboardModal(true)}
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
        onOpenLobby={() => {
          setShowDashboardModal(false);
          setShowLobbyModal(true);
        }}
        onOpenSuperAdmin={() => setShowSuperAdminModal(true)}
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
          activeRoomCode={activeRoomCode}
          deviceGps={deviceGps}
          isAdmin={isUserAdminOrOfficer}
          onBindAndStartGps={handleSkipperCheckIn}
        />
      )}
    </div>
  );
}
