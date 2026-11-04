import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Boat,
  CourseMark,
  CourseEditMode,
  MeshtasticNode,
  MapBasemap,
  WeatherOverlays,
  MapViewSize,
  RegattaLocation,
  DeviceGpsState,
} from '../types/regatta';
import { MapLayersControl } from './MapLayersControl';
import { MarkDetailModal } from './MarkDetailModal';
import { calculateCourseLegs, getOrderedCourseSequence, calculateBearingDeg } from '../services/courseService';
import {
  Crosshair,
  Zap,
  Plus,
  Flag,
  Target,
  SlidersHorizontal,
  Check,
  RotateCcw,
  Minimize2,
  Smartphone,
  Route,
} from 'lucide-react';

// Strict Coordinate Validation Helper to prevent Leaflet LatLng NaN crashes
const isValidCoord = (lat: any, lng: any): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
};

// Helper function to calculate interpolated position and trails during replay
function getInterpolatedTrajectory(
  trail: Array<{ lat: number; lng: number }> | undefined,
  fallbackLat: number,
  fallbackLng: number,
  fallbackHeading: number,
  progressRatio: number,
  isReplayActive: boolean
): {
  lat: number;
  lng: number;
  heading: number;
  activeTrail: Array<[number, number]>;
  ghostTrail: Array<[number, number]>;
} {
  const cleanTrail = (trail || []).filter((pt) => pt && isValidCoord(pt.lat, pt.lng));

  if (!isReplayActive || cleanTrail.length < 2) {
    const active: Array<[number, number]> = cleanTrail.map((pt) => [pt.lat, pt.lng]);
    return {
      lat: fallbackLat,
      lng: fallbackLng,
      heading: fallbackHeading,
      activeTrail: active,
      ghostTrail: [],
    };
  }

  const ratio = Math.max(0, Math.min(1, progressRatio));
  const totalSegments = cleanTrail.length - 1;
  const indexFloat = ratio * totalSegments;
  const idx0 = Math.floor(indexFloat);
  const idx1 = Math.min(cleanTrail.length - 1, idx0 + 1);
  const fraction = indexFloat - idx0;

  const p0 = cleanTrail[idx0];
  const p1 = cleanTrail[idx1];

  const currentLat = p0.lat + (p1.lat - p0.lat) * fraction;
  const currentLng = p0.lng + (p1.lng - p0.lng) * fraction;

  let currentHeading = fallbackHeading;
  if (idx0 < idx1 || cleanTrail.length > 1) {
    const prev = idx0 > 0 ? cleanTrail[idx0 - 1] : p0;
    const next = p1;
    const bearing = calculateBearingDeg(prev.lat, prev.lng, next.lat, next.lng);
    if (bearing !== 0 || prev.lat !== next.lat || prev.lng !== next.lng) {
      currentHeading = bearing;
    }
  }

  const activePoints: Array<[number, number]> = cleanTrail
    .slice(0, idx0 + 1)
    .map((pt) => [pt.lat, pt.lng]);
  activePoints.push([currentLat, currentLng]);

  const ghostPoints: Array<[number, number]> = [[currentLat, currentLng]];
  for (let i = idx1; i < cleanTrail.length; i++) {
    ghostPoints.push([cleanTrail[i].lat, cleanTrail[i].lng]);
  }

  return {
    lat: currentLat,
    lng: currentLng,
    heading: currentHeading,
    activeTrail: activePoints,
    ghostTrail: ghostPoints,
  };
}

interface MarineMapCanvasProps {
  boats: Boat[];
  marks: CourseMark[];
  nodes: MeshtasticNode[];
  selectedBoatId: string | null;
  onSelectBoat: (boatId: string) => void;
  onOpenHeadToHead: (boat1Id: string, boat2Id: string) => void;
  basemap: MapBasemap;
  onSelectBasemap: (basemap: MapBasemap) => void;
  overlays: WeatherOverlays;
  onToggleOverlay: (key: keyof WeatherOverlays) => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  mapSize: MapViewSize;
  onChangeMapSize: (size: MapViewSize) => void;
  directSunlightMode: boolean;
  followedTargetId: string | null;
  onOpenNodeInspector: (node: MeshtasticNode | null, boat: Boat | null) => void;
  selectedLocation?: RegattaLocation;
  playbackTimeSec?: number;
  maxPlaybackDurationSec?: number;
  deviceGps?: DeviceGpsState;
  showReplayBar?: boolean;
  onToggleReplayBar?: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;

  // Course Customization & Interactive Mark Props
  onAddMark?: (lat: number, lng: number, type?: CourseMark['type'], name?: string) => void;
  onDeleteMark?: (markId: string) => void;
  onMoveMarkPosition?: (markId: string, lat: number, lng: number) => void;
  onMoveBoatPosition?: (boatId: string, lat: number, lng: number) => void;
  onMoveNodePosition?: (nodeId: string, lat: number, lng: number) => void;
  onUpdateMarkSettings?: (markId: string, updates: Partial<CourseMark>) => void;
  onMoveMarkOrder?: (markId: string, direction: 'UP' | 'DOWN') => void;
  onApplyCoursePreset?: (preset: 'WINDWARD_LEEWARD' | 'TRIANGLE' | 'TRAPEZOID') => void;
  onOpenCourseProfiles?: () => void;
  onOpenHub?: (hub?: 'FLEET' | 'RACE' | 'RESULTS' | 'SYSTEM') => void;
  viewMode?: 'RC_CONSOLE' | 'SPECTATOR';
}

export const MarineMapCanvas: React.FC<MarineMapCanvasProps> = ({
  boats,
  marks,
  nodes,
  selectedBoatId,
  onSelectBoat,
  onOpenHeadToHead,
  basemap,
  onSelectBasemap,
  overlays,
  onToggleOverlay,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  mapSize,
  onChangeMapSize,
  directSunlightMode,
  followedTargetId,
  onOpenNodeInspector,
  selectedLocation,
  playbackTimeSec = 0,
  maxPlaybackDurationSec = 1800,
  deviceGps,
  showReplayBar = false,
  onToggleReplayBar,
  onToggleSidebar,
  isSidebarOpen,
  onAddMark,
  onDeleteMark,
  onMoveMarkPosition,
  onMoveBoatPosition,
  onMoveNodePosition,
  onUpdateMarkSettings,
  onMoveMarkOrder,
  onApplyCoursePreset,
  onOpenCourseProfiles,
  onOpenHub,
  viewMode = 'RC_CONSOLE',
}) => {
  // Only move boats along their trails when there is a recorded race to replay.
  const replayActive = showReplayBar && (maxPlaybackDurationSec || 0) > 0;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const seaMapTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const courseLinesGroupRef = useRef<L.LayerGroup | null>(null);

  // Drag state lock: Prevents telemetry ticks and state re-renders from destroying active dragging markers
  const isDraggingRef = useRef<boolean>(false);
  const activeDraggingEntityIdRef = useRef<string | null>(null);

  // Interactive Mark Management State
  const [courseEditMode, setCourseEditMode] = useState<CourseEditMode>('NONE');
  const [activeEditMarkId, setActiveEditMarkId] = useState<string | null>(null);
  const activeEditMark = activeEditMarkId ? marks.find((m) => m.id === activeEditMarkId) || null : null;
  const [showCourseLegs, setShowCourseLegs] = useState<boolean>(true);
  const [isCourseBarOpen, setIsCourseBarOpen] = useState<boolean>(false);

  // Default Center (Malaysia KL / Langkawi or Selected Location)
  const defaultLat = selectedLocation?.centerLat ?? 6.308;
  const defaultLng = selectedLocation?.centerLng ?? 99.845;

  // INITIALIZE LEAFLET MAP
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenterLat = isValidCoord(defaultLat, defaultLng) ? defaultLat : 6.308;
    const initialCenterLng = isValidCoord(defaultLat, defaultLng) ? defaultLng : 99.845;

    let map: L.Map;
    try {
      map = L.map(mapContainerRef.current, {
        center: [initialCenterLat, initialCenterLng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      courseLinesGroupRef.current = L.layerGroup().addTo(map);
      markersGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    } catch {
      return;
    }

    // Set up ResizeObserver to automatically update map dimensions safely
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          try {
            mapRef.current.invalidateSize({ debounceMoveend: true });
          } catch {
            // ignore
          }
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    // Trigger initial invalidation after mount
    const timer = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {
        // ignore
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      try {
        map.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    };
  }, []);

  // Invalidate map size when mapSize or directSunlightMode changes
  useEffect(() => {
    if (mapRef.current) {
      try {
        mapRef.current.invalidateSize();
      } catch {
        // ignore
      }
    }
  }, [mapSize, directSunlightMode]);

  // UPDATE TILE BASEMAP
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (seaMapTileLayerRef.current) {
      map.removeLayer(seaMapTileLayerRef.current);
      seaMapTileLayerRef.current = null;
    }

    let baseTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; OpenStreetMap contributors';

    if (basemap === 'DARK_VECTOR') {
      baseTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
      attribution = '&copy; CARTO & OpenStreetMap';
    } else if (basemap === 'OPEN_TOPO_BATHYMETRY') {
      baseTileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenTopoMap & OpenStreetMap';
    } else if (basemap === 'OPEN_SEA_MAP' || basemap === 'OPEN_STREET_MAP') {
      baseTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }

    const baseLayer = L.tileLayer(baseTileUrl, {
      maxZoom: 19,
      attribution,
    }).addTo(map);
    baseTileLayerRef.current = baseLayer;

    if (basemap === 'OPEN_SEA_MAP' || basemap === 'OPEN_TOPO_BATHYMETRY' || overlays.openSeaMapLayers) {
      const seaMapOverlay = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        maxZoom: 18,
        opacity: 0.9,
      }).addTo(map);
      seaMapTileLayerRef.current = seaMapOverlay;
    }
  }, [basemap, overlays.openSeaMapLayers]);

  // FLY TO SELECTED LOCATION ON LOCATION CHANGE
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;
    if (isValidCoord(selectedLocation.centerLat, selectedLocation.centerLng)) {
      map.flyTo([selectedLocation.centerLat, selectedLocation.centerLng], 12, { duration: 1.2 });
    }
  }, [selectedLocation?.id]);

  // HANDLE CAMERA FOLLOW TARGET
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !followedTargetId) return;

    let targetLat: number | null = null;
    let targetLng: number | null = null;

    const targetBoat = boats.find((b) => b.id === followedTargetId);
    if (targetBoat) {
      // Only the real recorded track; no made-up wake
      const boatTrail = targetBoat.trail || [];
      const ratio = replayActive ? ((playbackTimeSec || 0) / (maxPlaybackDurationSec || 1800)) : 0;
      const interp = getInterpolatedTrajectory(
        boatTrail,
        targetBoat.lat,
        targetBoat.lng,
        targetBoat.heading || targetBoat.cog || 0,
        ratio,
        replayActive
      );
      targetLat = interp.lat;
      targetLng = interp.lng;
    } else {
      const targetNode = nodes.find((n) => n.id === followedTargetId);
      if (targetNode && typeof targetNode.lat === 'number' && typeof targetNode.lng === 'number') {
        const ratio = replayActive ? ((playbackTimeSec || 0) / (maxPlaybackDurationSec || 1800)) : 0;
        const interp = getInterpolatedTrajectory(
          targetNode.trail,
          targetNode.lat,
          targetNode.lng,
          targetNode.headingDeg || 0,
          ratio,
          replayActive
        );
        targetLat = interp.lat;
        targetLng = interp.lng;
      }
    }

    if (isValidCoord(targetLat, targetLng)) {
      map.panTo([targetLat!, targetLng!], { animate: true });
    }
  }, [followedTargetId, boats, nodes, playbackTimeSec, replayActive, maxPlaybackDurationSec]);

  // HANDLE INTERACTIVE MAP CLICK FOR DROPPING MARKS / LINES
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (courseEditMode === 'NONE') return;

      const clickLat = e.latlng.lat;
      const clickLng = e.latlng.lng;

      if (!isValidCoord(clickLat, clickLng)) return;

      if (courseEditMode === 'DROP_MARK') {
        onAddMark?.(clickLat, clickLng, 'WINDWARD');
        setCourseEditMode('NONE');
      } else if (courseEditMode === 'SET_START_PIN') {
        const pin = marks.find((m) => m.type === 'PIN_END');
        if (pin && onMoveMarkPosition) {
          onMoveMarkPosition(pin.id, clickLat, clickLng);
        } else if (onAddMark) {
          onAddMark(clickLat, clickLng, 'PIN_END', 'Start Pin End');
        }
        setCourseEditMode('NONE');
      } else if (courseEditMode === 'SET_START_RC') {
        const rc = marks.find((m) => m.type === 'RC_BOAT');
        if (rc && onMoveMarkPosition) {
          onMoveMarkPosition(rc.id, clickLat, clickLng);
        } else if (onAddMark) {
          onAddMark(clickLat, clickLng, 'RC_BOAT', 'RC Signal Vessel');
        }
        setCourseEditMode('NONE');
      } else if (courseEditMode === 'SET_FINISH_PIN') {
        const fp = marks.find((m) => m.type === 'FINISH_PIN' || m.type === 'FINISH');
        if (fp && onMoveMarkPosition) {
          onMoveMarkPosition(fp.id, clickLat, clickLng);
        } else if (onAddMark) {
          onAddMark(clickLat, clickLng, 'FINISH_PIN', 'Finish Line Pin');
        }
        setCourseEditMode('NONE');
      } else if (courseEditMode === 'SET_FINISH_RC') {
        const fr = marks.find((m) => m.type === 'FINISH_RC');
        if (fr && onMoveMarkPosition) {
          onMoveMarkPosition(fr.id, clickLat, clickLng);
        } else if (onAddMark) {
          onAddMark(clickLat, clickLng, 'FINISH_RC', 'Finish RC Boat');
        }
        setCourseEditMode('NONE');
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [courseEditMode, marks, onAddMark, onMoveMarkPosition]);

  // RENDER MARKERS, DRAGGABLE BUOYS, START/FINISH LINES & COURSE LEGS
  useEffect(() => {
    const map = mapRef.current;
    const group = markersGroupRef.current;
    const lineGroup = courseLinesGroupRef.current;
    if (!map || !group || !lineGroup) return;

    // CRITICAL: If the user is currently dragging a mark, boat, or node with the mouse,
    // do NOT clear layers or recreate DOM elements mid-drag, as that destroys pointer capture!
    if (isDraggingRef.current) return;

    group.clearLayers();
    lineGroup.clearLayers();

    // 1. Draw Course Lines & Legs
    const validMarks = (marks || []).filter((m) => m && isValidCoord(m.lat, m.lng));
    const pinMark = validMarks.find((m) => m.type === 'PIN_END');
    const rcMark = validMarks.find((m) => m.type === 'RC_BOAT');
    const finishPin = validMarks.find((m) => m.type === 'FINISH_PIN' || m.type === 'FINISH');
    const finishRc = validMarks.find((m) => m.type === 'FINISH_RC');

    // Draw Start Line (Cyan dashed line with label)
    if (pinMark && rcMark && isValidCoord(pinMark.lat, pinMark.lng) && isValidCoord(rcMark.lat, rcMark.lng)) {
      L.polyline([[pinMark.lat, pinMark.lng], [rcMark.lat, rcMark.lng]], {
        color: '#00D4FF',
        weight: 3.5,
        dashArray: '8, 6',
        opacity: 0.9,
      }).addTo(lineGroup);

      // Start Line Center Label
      const startCenterLat = (pinMark.lat + rcMark.lat) / 2;
      const startCenterLng = (pinMark.lng + rcMark.lng) / 2;
      if (isValidCoord(startCenterLat, startCenterLng)) {
        const startHtml = `
          <div style="background: rgba(0,212,255,0.9); color: #020408; font-weight: 900; font-family: monospace; font-size: 12px; padding: 1px 4px; border-radius: 3px; transform: translate(-50%, -50%); border: 1px solid white; box-shadow: 0 0 8px rgba(0,212,255,0.6); white-space: nowrap;">
            START LINE
          </div>
        `;
        L.marker([startCenterLat, startCenterLng], {
          icon: L.divIcon({ html: startHtml, iconSize: [0, 0], className: 'start-line-label' }),
          interactive: false,
        }).addTo(lineGroup);
      }
    }

    // Draw Finish Line (Emerald green dashed line with label)
    if (finishPin && finishRc && isValidCoord(finishPin.lat, finishPin.lng) && isValidCoord(finishRc.lat, finishRc.lng)) {
      L.polyline([[finishPin.lat, finishPin.lng], [finishRc.lat, finishRc.lng]], {
        color: '#00FF9D',
        weight: 3.5,
        dashArray: '8, 6',
        opacity: 0.9,
      }).addTo(lineGroup);

      const finishCenterLat = (finishPin.lat + finishRc.lat) / 2;
      const finishCenterLng = (finishPin.lng + finishRc.lng) / 2;
      if (isValidCoord(finishCenterLat, finishCenterLng)) {
        const finishHtml = `
          <div style="background: rgba(0,255,157,0.9); color: #020408; font-weight: 900; font-family: monospace; font-size: 12px; padding: 1px 4px; border-radius: 3px; transform: translate(-50%, -50%); border: 1px solid white; box-shadow: 0 0 8px rgba(0,255,157,0.6); white-space: nowrap;">
            FINISH LINE
          </div>
        `;
        L.marker([finishCenterLat, finishCenterLng], {
          icon: L.divIcon({ html: finishHtml, iconSize: [0, 0], className: 'finish-line-label' }),
          interactive: false,
        }).addTo(lineGroup);
      }
    }

    // Draw Course Legs & Sequential Waypoints Routing Path
    if (showCourseLegs) {
      const courseSequence = getOrderedCourseSequence(validMarks);
      if (courseSequence.length >= 2) {
        const polylinePoints: [number, number][] = courseSequence
          .filter((pt) => pt && isValidCoord(pt.lat, pt.lng))
          .map((pt) => [pt.lat, pt.lng]);

        if (polylinePoints.length >= 2) {
          L.polyline(polylinePoints, {
            color: '#FBBC04',
            weight: 2,
            dashArray: '5, 8',
            opacity: 0.7,
          }).addTo(lineGroup);
        }

        // Draw Leg Distance / Heading Badges at midpoints
        const legs = calculateCourseLegs(validMarks);
        legs.forEach((leg) => {
          if (!leg.fromMark || !leg.toMark) return;
          const midLat = (leg.fromMark.lat + leg.toMark.lat) / 2;
          const midLng = (leg.fromMark.lng + leg.toMark.lng) / 2;

          if (!isValidCoord(midLat, midLng)) return;

          const legHtml = `
            <div style="background: rgba(10,15,30,0.85); color: #FBBC04; border: 1px solid #FBBC04; font-size: 12px; font-family: monospace; padding: 1px 4px; border-radius: 3px; transform: translate(-50%, -50%); white-space: nowrap; box-shadow: 0 0 6px rgba(0,0,0,0.8);">
              ${leg.distanceNm} NM (${leg.bearingDeg}°)
            </div>
          `;

          L.marker([midLat, midLng], {
            icon: L.divIcon({ html: legHtml, iconSize: [0, 0], className: 'leg-badge-icon' }),
            interactive: false,
          }).addTo(lineGroup);
        });
      }
    }

    // 2. Draw Interactive Draggable Course Marks (with sequential numbers 1, 2, 3...)
    validMarks.forEach((m) => {
      if (!isValidCoord(m.lat, m.lng)) return;
      const isPin = m.type === 'PIN_END';
      const isRC = m.type === 'RC_BOAT';
      const isFinishMark = m.type === 'FINISH' || m.type === 'FINISH_PIN' || m.type === 'FINISH_RC';

      const color = isPin ? '#FF4D4D' : isRC ? '#00D4FF' : isFinishMark ? '#00FF9D' : '#FBBC04';
      const badgeText = m.shortName || (isPin ? 'SP' : isRC ? 'RC' : isFinishMark ? 'FP' : `#${m.orderIndex || 1}`);

      // Draw Rounding Radius Geofence Circle
      if (m.radiusMeters && m.radiusMeters > 0) {
        L.circle([m.lat, m.lng], {
          radius: m.radiusMeters,
          color,
          fillColor: color,
          fillOpacity: 0.08,
          weight: 1,
          dashArray: '3, 3',
        }).addTo(group);
      }

      const markHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%); cursor: grab;" title="Click to edit mark settings or drag & drop anywhere on the water">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: ${color}; border: 2.5px solid white; box-shadow: 0 0 12px ${color}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; color: #020408; font-family: monospace; transition: transform 0.15s ease;">
            ${badgeText}
          </div>
          <div style="background: rgba(6,11,22,0.92); color: white; padding: 2px 6px; border-radius: 5px; font-size: 12px; font-family: monospace; font-weight: bold; white-space: nowrap; margin-top: 3px; border: 1.5px solid ${color}; box-shadow: 0 2px 8px rgba(0,0,0,0.8); display: flex; align-items: center; gap: 3px;">
            <span>${m.name}</span>
            <span style="color: ${m.requiredRounding === 'STARBOARD' ? '#00FF9D' : '#FF4D4D'}; font-size: 12px;">(${m.requiredRounding === 'STARBOARD' ? 'STBD' : m.requiredRounding === 'PORT' ? 'PORT' : 'LINE'})</span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-mark-draggable-icon',
        html: markHtml,
        iconSize: [0, 0],
      });

      const markMarker = L.marker([m.lat, m.lng], {
        icon,
        draggable: true,
      }).addTo(group);

      // Lock drag state to protect against cancellation during live background ticks
      markMarker.on('dragstart', () => {
        isDraggingRef.current = true;
        activeDraggingEntityIdRef.current = m.id;
      });

      // Drag event to reposition mark
      markMarker.on('dragend', (e: any) => {
        isDraggingRef.current = false;
        activeDraggingEntityIdRef.current = null;
        const newLatLng = e.target.getLatLng();
        if (isValidCoord(newLatLng.lat, newLatLng.lng)) {
          onMoveMarkPosition?.(m.id, newLatLng.lat, newLatLng.lng);
        }
      });

      // Click event to open Mark Detail / Edit Modal
      markMarker.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        setActiveEditMarkId(m.id);
      });
    });

    // 3. Draw Vessels & Breadcrumb Trails (with Replay Interpolation & Tracker Indicator Badges)
    const validBoats = (boats || []).filter((b) => b && isValidCoord(b.lat, b.lng));

    validBoats.forEach((b) => {
      if (!isValidCoord(b.lat, b.lng)) return;
      const isSelected = b.id === selectedBoatId;

      // Identify if this boat is bound to a physical LoRa Node or Phone/Tablet/Device GPS
      const boundNode = (nodes || []).find((n) => n.boundBoatId === b.id || (b.nodeId && n.id === b.nodeId));
      const isPhoneGpsBound =
        boundNode?.connectionType === 'PHONE' ||
        boundNode?.isDeviceGps ||
        (deviceGps?.active && (deviceGps.profile?.boundBoatId === b.id || b.nodeId === deviceGps.profile?.deviceId || b.nodeId === 'device-phone-local'));

      // Only the real recorded track; a boat without one shows no trail
      const boatTrail = Array.isArray(b.trail) ? b.trail : [];

      const replayRatio = (playbackTimeSec || 0) / (maxPlaybackDurationSec || 1800);
      const {
        lat: boatLat,
        lng: boatLng,
        heading: boatHeading,
        activeTrail,
        ghostTrail,
      } = getInterpolatedTrajectory(
        boatTrail,
        b.lat,
        b.lng,
        b.heading || b.cog || 0,
        replayRatio,
        replayActive
      );

      // Draw Active Historical Breadcrumb Trail (solid)
      if (activeTrail.length > 1) {
        L.polyline(activeTrail, {
          color: b.color || '#00D4FF',
          weight: isSelected ? 3.5 : 2.5,
          opacity: 0.85,
        }).addTo(group);
      }

      // In Replay Mode, draw Ghost Future Trail (dashed, subtle)
      if (replayActive && ghostTrail.length > 1) {
        L.polyline(ghostTrail, {
          color: b.color || '#00D4FF',
          weight: isSelected ? 2 : 1.5,
          opacity: 0.3,
          dashArray: '4, 6',
        }).addTo(group);
      }

      const trackerBadgeHtml = boundNode
        ? `<span style="background: ${isPhoneGpsBound ? 'rgba(0,212,255,0.25)' : 'rgba(0,255,157,0.25)'}; color: ${isPhoneGpsBound ? '#00D4FF' : '#00FF9D'}; font-size: 12px; font-weight: 800; padding: 1px 4px; border-radius: 3px; border: 1px solid ${isPhoneGpsBound ? 'rgba(0,212,255,0.5)' : 'rgba(0,255,157,0.5)'}; display: inline-flex; align-items: center; gap: 2px;">${isPhoneGpsBound ? 'PHONE GPS' : `${boundNode.shortName || boundNode.id.slice(-4)}`}</span>`
        : '';

      const statusBadgeHtml = b.status === 'OCS'
        ? `<span style="background: #EA4335; color: white; font-size: 12px; font-weight: 900; padding: 1px 4px; border-radius: 3px; animation: pulse 1s infinite;">OCS</span>`
        : b.status === 'PRE_START'
        ? `<span style="background: rgba(251,188,4,0.25); color: #FBBC04; border: 1px solid rgba(251,188,4,0.6); font-size: 12px; font-weight: 800; padding: 0.5px 3px; border-radius: 3px;">PRE</span>`
        : b.status === 'FINISHED'
        ? `<span style="background: rgba(168,85,247,0.3); color: #C084FC; border: 1px solid rgba(168,85,247,0.6); font-size: 12px; font-weight: 800; padding: 0.5px 3px; border-radius: 3px;">FIN</span>`
        : b.status && b.status !== 'RACING' && b.status !== 'CLEARED_OCS'
        ? `<span style="background: rgba(239,68,68,0.25); color: #FCA5A5; border: 1px solid rgba(239,68,68,0.5); font-size: 12px; font-weight: 800; padding: 0.5px 3px; border-radius: 3px;">${b.status}</span>`
        : '';

      const boatHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%); cursor: grab;" title="Drag boat to relocate position or click to select">
          <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
            ${isSelected ? `<div style="position: absolute; inset: -4px; border-radius: 50%; border: 2px solid #00D4FF; animation: pulse 1.5s infinite;"></div>` : ''}
            <div style="transform: rotate(${boatHeading}deg); transform-origin: center; transition: transform 0.15s ease-out;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="${b.color || '#00D4FF'}" stroke="white" stroke-width="1.6">
                <path d="M12 2L18 20L12 17L6 20L12 2Z" />
              </svg>
            </div>
          </div>
          <div style="background: rgba(6,11,22,0.92); border: 1.5px solid ${isSelected ? '#00D4FF' : b.color || 'rgba(255,255,255,0.3)'}; padding: 2px 6px; border-radius: 6px; color: white; font-size: 12px; font-weight: bold; white-space: nowrap; font-family: monospace; text-align: center; margin-top: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center; gap: 1px;">
            <div style="display: flex; align-items: center; gap: 3px;">
              <span>${b.name}</span>
              ${statusBadgeHtml}
              ${trackerBadgeHtml}
            </div>
            <div style="font-size: 12px; color: #00FF9D;">${(b.sog || 0).toFixed(1)} kt • DTW: ${(b.dtw || 0).toFixed(2)}NM</div>
          </div>
        </div>
      `;

      const boatIcon = L.divIcon({
        className: 'custom-boat-icon',
        html: boatHtml,
        iconSize: [0, 0],
      });

      const marker = L.marker([boatLat, boatLng], {
        icon: boatIcon,
        draggable: !showReplayBar,
      }).addTo(group);

      if (!showReplayBar) {
        marker.on('dragstart', () => {
          isDraggingRef.current = true;
          activeDraggingEntityIdRef.current = b.id;
        });

        marker.on('dragend', (e: any) => {
          isDraggingRef.current = false;
          activeDraggingEntityIdRef.current = null;
          const newLatLng = e.target.getLatLng();
          if (isValidCoord(newLatLng.lat, newLatLng.lng)) {
            onMoveBoatPosition?.(b.id, newLatLng.lat, newLatLng.lng);
          }
        });
      }

      marker.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        onSelectBoat(b.id);
      });
    });

    // 4. Draw Standalone Hardware Nodes (Hidden if bound to a boat, as the boat marker already represents it)
    const validNodes = (nodes || []).filter((n) => n && isValidCoord(n.lat, n.lng));

    validNodes.forEach((node) => {
      if (!isValidCoord(node.lat, node.lng)) return;
      
      // If this node is bound to a registered boat in the fleet, do NOT render a duplicate standalone node pin
      const isBoundToActiveBoat =
        (node.boundBoatId && validBoats.some((b) => b.id === node.boundBoatId)) ||
        validBoats.some((b) => b.nodeId === node.id);

      if (isBoundToActiveBoat) return;

      const isBle = node.connectionType === 'BLE' || node.isBluetoothConnected;
      const isUsb = node.connectionType === 'USB';
      const isMqtt = node.connectionType === 'MQTT';
      const isPhone = node.connectionType === 'PHONE';
      const isTablet = node.connectionType === 'TABLET';
      const isDeviceGps = node.connectionType === 'DEVICE_GPS' || node.isDeviceGps;

      let color = '#00FF9D';
      let badgeLabel = 'LoRa';

      if (isPhone) {
        color = '#00D4FF';
        badgeLabel = 'PHONE';
      } else if (isTablet) {
        color = '#38BDF8';
        badgeLabel = 'TABLET';
      } else if (isDeviceGps) {
        color = '#00D4FF';
        badgeLabel = 'GPS';
      } else if (isBle) {
        color = '#00D4FF';
        badgeLabel = 'BLE';
      } else if (isUsb) {
        color = '#38BDF8';
        badgeLabel = 'USB';
      } else if (isMqtt) {
        color = '#C084FC';
        badgeLabel = 'MQTT';
      }

      const replayRatio = (playbackTimeSec || 0) / (maxPlaybackDurationSec || 1800);
      const {
        lat: nodeLat,
        lng: nodeLng,
        heading: nodeHeading,
        activeTrail,
      } = getInterpolatedTrajectory(
        node.trail,
        node.lat!,
        node.lng!,
        node.headingDeg || 0,
        replayRatio,
        replayActive
      );

      // Draw node trail if available
      if (activeTrail.length > 1) {
        L.polyline(activeTrail, {
          color: color,
          weight: 1.5,
          opacity: 0.6,
          dashArray: '3, 4',
        }).addTo(group);
      }

      const hasMovement = (node.speedKt || 0) > 0.3;
      const headingDeg = replayActive ? nodeHeading : (node.headingDeg || 0);

      const nodeHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%); cursor: grab;" title="Drag mesh node to relocate position or click to inspect">
          <div style="position: relative; width: 26px; height: 26px; border-radius: 7px; background: rgba(10,15,30,0.95); border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px ${color};">
            ${
              isPhone || isTablet || isDeviceGps
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`
                : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg>`
            }
            ${hasMovement ? `<div style="position: absolute; top: -6px; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 6px solid ${color}; transform: rotate(${headingDeg}deg); transform-origin: 50% 19px;"></div>` : ''}
          </div>
          <div style="background: rgba(6,11,22,0.92); border: 1px solid ${color}; padding: 2px 6px; border-radius: 5px; color: white; font-size: 12px; font-family: monospace; white-space: nowrap; margin-top: 2px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.8);">
            <span style="color: ${color}; font-weight: bold; margin-right: 3px;">[${badgeLabel}]</span>
            <span>${node.shortName || node.longName.slice(0, 10)} (${typeof node.speedKt === 'number' ? node.speedKt.toFixed(1) + 'kt' : (node.battery || 85) + '%'})</span>
          </div>
        </div>
      `;

      const nodeIcon = L.divIcon({
        className: 'custom-node-icon',
        html: nodeHtml,
        iconSize: [0, 0],
      });

      const nodeMarker = L.marker([nodeLat, nodeLng], {
        icon: nodeIcon,
        draggable: !showReplayBar,
      }).addTo(group);

      if (!showReplayBar) {
        nodeMarker.on('dragstart', () => {
          isDraggingRef.current = true;
          activeDraggingEntityIdRef.current = node.id;
        });

        nodeMarker.on('dragend', (e: any) => {
          isDraggingRef.current = false;
          activeDraggingEntityIdRef.current = null;
          const newLatLng = e.target.getLatLng();
          if (isValidCoord(newLatLng.lat, newLatLng.lng)) {
            onMoveNodePosition?.(node.id, newLatLng.lat, newLatLng.lng);
          }
        });
      }

      nodeMarker.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        onOpenNodeInspector(node, null);
      });
    });

    // 5. Draw User Device Native GPS Marker (only if NOT bound to a boat to prevent duplicate pins)
    const isDeviceGpsBoundToBoat =
      deviceGps?.profile?.boundBoatId &&
      validBoats.some((b) => b.id === deviceGps.profile?.boundBoatId || b.nodeId === deviceGps.profile?.deviceId);

    if (deviceGps?.active && isValidCoord(deviceGps.lat, deviceGps.lng) && !isDeviceGpsBoundToBoat) {
      if (typeof deviceGps.accuracy === 'number' && !isNaN(deviceGps.accuracy) && deviceGps.accuracy > 0) {
        L.circle([deviceGps.lat!, deviceGps.lng!], {
          radius: Math.min(deviceGps.accuracy, 500),
          color: '#38BDF8',
          fillColor: '#38BDF8',
          fillOpacity: 0.15,
          weight: 1.5,
          dashArray: '4, 4',
        }).addTo(group);
      }

      const gpsHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%); cursor: pointer;">
          <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: -6px; border-radius: 50%; border: 2px solid #38BDF8; animation: pulse 1.2s infinite; background: rgba(56,189,248,0.2);"></div>
            <div style="transform: rotate(${deviceGps.headingDeg || 0}deg); transform-origin: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#38BDF8" stroke="white" stroke-width="2">
                <polygon points="12 2 19 21 12 17 5 21 12 2" />
              </svg>
            </div>
          </div>
          <div style="background: rgba(6,11,22,0.95); border: 1.5px solid #38BDF8; padding: 3px 7px; border-radius: 6px; color: white; font-size: 12px; font-weight: bold; white-space: nowrap; font-family: monospace; text-align: center; margin-top: 3px; box-shadow: 0 0 12px rgba(56,189,248,0.5);">
            <div style="color: #38BDF8;">MY DEVICE GPS (UNBOUND)</div>
            <div style="font-size: 12px; color: #00FF9D;">${(deviceGps.speedKt || 0).toFixed(1)} kt • ±${deviceGps.accuracy || 5}m</div>
          </div>
        </div>
      `;

      const gpsIcon = L.divIcon({
        className: 'custom-user-device-gps-icon',
        html: gpsHtml,
        iconSize: [0, 0],
      });

      L.marker([deviceGps.lat!, deviceGps.lng!], { icon: gpsIcon }).addTo(group);
    }
  }, [boats, marks, nodes, selectedBoatId, followedTargetId, playbackTimeSec, maxPlaybackDurationSec, replayActive, deviceGps, showCourseLegs, onMoveMarkPosition, onMoveBoatPosition, onMoveNodePosition]);

  // Handle Zoom In/Out manually
  const handleMapZoomIn = () => {
    mapRef.current?.zoomIn();
    onZoomIn();
  };

  const handleMapZoomOut = () => {
    mapRef.current?.zoomOut();
    onZoomOut();
  };


  const handleFitAllFleet = () => {
    if (!mapRef.current) return;
    const validPoints: [number, number][] = [];
    boats.forEach((b) => {
      if (isValidCoord(b.lat, b.lng)) validPoints.push([b.lat, b.lng]);
    });
    marks.forEach((m) => {
      if (isValidCoord(m.lat, m.lng)) validPoints.push([m.lat, m.lng]);
    });
    nodes.forEach((n) => {
      if (isValidCoord(n.lat, n.lng)) validPoints.push([n.lat!, n.lng!]);
    });
    if (deviceGps?.active && isValidCoord(deviceGps.lat, deviceGps.lng)) {
      validPoints.push([deviceGps.lat!, deviceGps.lng!]);
    }
    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(validPoints);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  };

  const mobileNodes = (nodes || []).filter(
    (n) => (n.connectionType === 'PHONE' || n.connectionType === 'TABLET' || n.isDeviceGps) && isValidCoord(n.lat, n.lng)
  );

  const sequentialMarksCount = marks.filter((m) => m.type !== 'PIN_END' && m.type !== 'RC_BOAT' && m.type !== 'FINISH' && m.type !== 'FINISH_PIN' && m.type !== 'FINISH_RC').length;

  return (
    <section
      className={`flex-1 relative overflow-hidden select-none flex flex-col h-full w-full ${
        'bg-surface text-ink'
      } ${courseEditMode !== 'NONE' ? 'cursor-crosshair' : ''}`}
    >
      {/* LEAFLET TILE MAP CONTAINER */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* HISTORICAL REPLAY STATUS HUD INDICATOR (below the top toolbars so it doesn't cover them) */}
      {showReplayBar && (maxPlaybackDurationSec || 0) > 0 && (
        <div className="hidden md:flex absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-canvas/95 border border-line px-4 py-1.5 rounded-full items-center gap-2.5 text-xs text-ink-muted">
          <span className="font-bold text-ink">Replay</span>
          <span className="text-accent font-bold">
            {((sec: number) => `${Math.floor(sec / 60).toString().padStart(2, '0')}:${Math.floor(sec % 60).toString().padStart(2, '0')}`)(playbackTimeSec || 0)}
          </span>
          <span>/ {((sec: number) => `${Math.floor(sec / 60).toString().padStart(2, '0')}:${Math.floor(sec % 60).toString().padStart(2, '0')}`)(maxPlaybackDurationSec || 0)}</span>
        </div>
      )}

      {/* FLOATING ACTIVE PLACEMENT BANNER HUD */}
      {courseEditMode !== 'NONE' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 pointer-events-auto bg-canvas/95 border-2 border-warning-ink text-ink px-5 py-2.5 rounded-2xl backdrop-blur-md flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-warning-ink text-canvas font-bold text-xs flex items-center justify-center">
            {courseEditMode === 'DROP_MARK' ? `#${sequentialMarksCount + 1}` : '+'}
          </div>
          <div>
            <div className="text-xs font-bold text-warning-ink">
              {courseEditMode === 'DROP_MARK' && `Click anywhere on map to drop Mark #${sequentialMarksCount + 1}`}
              {courseEditMode === 'SET_START_PIN' && 'Click on map to place Start Pin End (Port)'}
              {courseEditMode === 'SET_START_RC' && 'Click on map to place Start RC Vessel (Starboard)'}
              {courseEditMode === 'SET_FINISH_PIN' && 'Click on map to place Finish Line Pin'}
              {courseEditMode === 'SET_FINISH_RC' && 'Click on map to place Finish RC Vessel'}
            </div>
            <div className="text-xs text-ink-muted">
              Draggable buoy markers can be moved and reordered at any time.
            </div>
          </div>
          <button
            onClick={() => setCourseEditMode('NONE')}
            className="ml-2 px-2.5 py-1 bg-raised hover:bg-raised text-ink-muted hover:text-ink rounded-lg text-xs font-bold transition-colors"
          >
            Cancel (ESC)
          </button>
        </div>
      )}

      {/* FLOATING HEADER CONTROLS HUD */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 sm:gap-2 max-w-[calc(100vw-80px)] landscape:max-w-[calc(100vw-180px)] sm:max-w-none overflow-x-auto no-scrollbar py-0.5 pointer-events-auto">
        {/* Fleet Dashboard Sidebar Toggle for Tablets / Horizontal Screens (Icon Button) */}
        {/* The sidebar collapses from its own button; this is the way back */}
        {onToggleSidebar && !isSidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="px-2.5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 backdrop-blur-md bg-canvas/90 hover:bg-raised border border-accent/70 text-accent"
          >
            <Minimize2 className="w-4 h-4" />
            <span>Show sidebar</span>
          </button>
        )}

        {/* Fit All Fleet Button (Sized like Replay icon button) */}
        <button
          onClick={handleFitAllFleet}
          className="min-h-10 px-2.5 rounded-control text-xs font-bold transition-colors shadow-lg flex items-center justify-center bg-surface/95 hover:bg-raised border border-line text-ink"
          title="Fit All Fleet & Marks (Zoom to view fleet)"
        >
          <Crosshair className="w-4 h-4" />
          <span className="hidden md:inline ml-1.5">Fit all</span>
        </button>

        {/* Active Device Quick Finder Button (Sized like Replay icon button) */}
        {mobileNodes.length > 0 && (
          <button
            onClick={() => {
              const target = mobileNodes[0];
              if (target && target.lat && target.lng && mapRef.current) {
                mapRef.current.flyTo([target.lat, target.lng], 15);
              }
            }}
            className="p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center backdrop-blur-md bg-canvas/90 hover:bg-accent/20 border border-accent text-accent relative"
            title={`Zoom to Active Mobile Device: ${mobileNodes[0].shortName || mobileNodes[0].longName.slice(0, 8)} (${mobileNodes.length} active)`}
          >
            <Smartphone className="w-4 h-4 text-accent" />
            {mobileNodes.length > 1 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-3.5 h-3.5 rounded-full bg-accent text-on-accent text-xs font-bold flex items-center justify-center">
                {mobileNodes.length}
              </span>
            )}
          </button>
        )}

        {/* Race Control Console Floating Map Trigger (Race Manager icon) */}

        {/* Rank (Leaderboard & Fleet) Floating Map Trigger */}

        {/* Course Designer Floating Map Trigger (Dotted Track Route icon) */}
        {viewMode !== 'SPECTATOR' && (
          <button
            onClick={() => setIsCourseBarOpen((prev) => !prev)}
            className={`min-h-10 px-2.5 rounded-control text-xs font-bold transition-colors shadow-lg flex items-center justify-center relative ${
              isCourseBarOpen
                ? 'bg-accent text-on-accent border border-accent'
                : 'bg-surface/95 hover:bg-raised border border-line text-ink'
            }`}
            title={isCourseBarOpen ? 'Close Course Editor' : 'Open Course Tools & Mark Layouts'}
          >
            <Route className="w-4 h-4" />
            <span className="hidden md:inline ml-1.5">Course</span>
            {marks.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-3.5 h-3.5 rounded-full bg-warning-ink text-canvas text-xs font-bold flex items-center justify-center">
                {marks.length}
              </span>
            )}
          </button>
        )}

        {/* Head-to-Head Comparison trigger */}
        {boats.length >= 2 && (
          <button
            onClick={() => onOpenHeadToHead(boats[0].id, boats[1].id)}
            className="p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center bg-accent hover:brightness-110 text-on-accent"
            title="Open Head-to-Head Comparison"
          >
            <Zap className="w-4 h-4" />
          </button>
        )}

        {/* Race Replay Scrubber trigger button */}
        {onToggleReplayBar && (
          <button
            onClick={onToggleReplayBar}
            className={`min-h-10 px-2.5 rounded-control text-xs font-bold transition-colors shadow-lg flex items-center justify-center ${
              showReplayBar
                ? 'bg-accent text-on-accent border border-accent'
                : 'bg-surface/95 hover:bg-raised border border-line text-ink'
            }`}
            title={showReplayBar ? 'Close Race Replay Controls' : 'Open Race Replay Timeline & Controls'}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden md:inline ml-1.5">Replay</span>
          </button>
        )}
      </div>

      {/* FLOATING TOP-RIGHT MAP CONTROLS & BASEMAP SELECTOR */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2 pointer-events-auto">
        {/* Floating Control Hub Button */}
        {onOpenHub && (
          <button
            id="map-control-hub-btn"
            onClick={() => onOpenHub('FLEET')}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs  font-bold transition-all shadow-xl flex items-center gap-1.5 backdrop-blur-md cursor-pointer group shrink-0 ${
              'bg-canvas/90 border border-accent/50 hover:border-accent text-accent hover:bg-raised '
            }`}
            title="Open Control Hub: Fleet, Racing, Results & System"
            aria-label="Open Control Hub"
          >
            <SlidersHorizontal className="w-4 h-4 text-accent group-hover:scale-110 transition-transform shrink-0" />
            <span className="hidden sm:inline text-ink group-hover:text-ink text-xs">
              Control Hub
            </span>
            {boats.length > 0 && (
              <span className="text-xs text-accent bg-accent/20 px-1.5 py-0.5 rounded-full font-bold">
                {boats.length}
              </span>
            )}
          </button>
        )}

        <MapLayersControl
          basemap={basemap}
          onSelectBasemap={onSelectBasemap}
          overlays={overlays}
          onToggleOverlay={onToggleOverlay}
          zoomLevel={zoomLevel}
          onZoomIn={handleMapZoomIn}
          onZoomOut={handleMapZoomOut}
          mapSize={mapSize}
          onChangeMapSize={onChangeMapSize}
        />
      </div>

      {/* FLOATING TOP COURSE CUSTOMIZATION SLIDING TOOLBAR */}
      {viewMode !== 'SPECTATOR' && isCourseBarOpen && (
        <div className="absolute top-14 left-2 sm:left-3 z-20 pointer-events-auto flex items-center max-w-[calc(100vw-16px)] sm:max-w-2xl transition-all animate-in slide-in-from-top-2 duration-200">
          <div className="bg-canvas/95 border border-warning-ink/70 backdrop-blur-md p-1.5 sm:p-2 rounded-2xl flex flex-wrap items-center gap-1 sm:gap-1.5">
            <div className="px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center gap-1.5 border-r border-line mr-0.5">
              <Route className="w-3.5 h-3.5 text-warning-ink" />
              <span className="text-xs sm:text-xs font-bold text-ink">
                Course ({marks.length})
              </span>
            </div>

            {/* Drop Mark Button */}
            <button
              onClick={() => setCourseEditMode(courseEditMode === 'DROP_MARK' ? 'NONE' : 'DROP_MARK')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all ${
                courseEditMode === 'DROP_MARK'
                  ? 'bg-accent text-on-accent'
                  : 'bg-raised text-ink hover:brightness-110'
              }`}
              title="Click to drop next sequential mark buoy"
            >
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>+ Mark #{sequentialMarksCount + 1}</span>
            </button>

            {/* Set Start Line */}
            <button
              onClick={() => setCourseEditMode(courseEditMode === 'SET_START_PIN' ? 'NONE' : 'SET_START_PIN')}
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs sm:text-xs font-bold flex items-center gap-1 transition-all ${
                courseEditMode === 'SET_START_PIN'
                  ? 'bg-accent text-on-accent '
                  : 'bg-raised text-accent hover:bg-raised'
              }`}
              title="Click map to relocate Start Line Pin"
            >
              <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xs:inline">Start</span>
            </button>

            {/* Set Finish Line */}
            <button
              onClick={() => setCourseEditMode(courseEditMode === 'SET_FINISH_PIN' ? 'NONE' : 'SET_FINISH_PIN')}
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs sm:text-xs font-bold flex items-center gap-1 transition-all ${
                courseEditMode === 'SET_FINISH_PIN'
                  ? 'bg-success-ink text-canvas '
                  : 'bg-raised text-success-ink hover:bg-raised'
              }`}
              title="Click map to relocate Finish Line Pin"
            >
              <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xs:inline">Finish</span>
            </button>

            {/* Toggle Course Legs Overlay */}
            <button
              onClick={() => setShowCourseLegs(!showCourseLegs)}
              className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs sm:text-xs font-bold  transition-all ${
                showCourseLegs
                  ? 'bg-raised text-warning-ink border border-warning-ink/40'
                  : 'bg-surface text-ink-muted hover:text-ink'
              }`}
              title="Toggle Course Legs & Distance Badges"
            >
              Legs {showCourseLegs ? 'ON' : 'OFF'}
            </button>

            {/* Course Presets Dropdown / Quick Switch */}
            {onApplyCoursePreset && (
              <div className="hidden sm:flex items-center gap-1 border-l border-line pl-1.5 ml-0.5">
                <button
                  onClick={() => onApplyCoursePreset('WINDWARD_LEEWARD')}
                  className="px-2 py-1 rounded-lg bg-raised hover:bg-raised text-ink-muted hover:text-ink text-xs transition-colors"
                  title="Apply Windward-Leeward Preset Course"
                >
                  W/L
                </button>
                <button
                  onClick={() => onApplyCoursePreset('TRIANGLE')}
                  className="px-2 py-1 rounded-lg bg-raised hover:bg-raised text-ink-muted hover:text-ink text-xs transition-colors"
                  title="Apply Olympic Triangle Preset Course"
                >
                  Triangle
                </button>
                <button
                  onClick={() => onApplyCoursePreset('TRAPEZOID')}
                  className="px-2 py-1 rounded-lg bg-raised hover:bg-raised text-ink-muted hover:text-ink text-xs transition-colors"
                  title="Apply 4-Mark Trapezoid Preset Course"
                >
                  Trapezoid
                </button>
              </div>
            )}

            {/* Saved Course Profiles Button (Moved to Course Tool Menu) */}
            {onOpenCourseProfiles && (
              <button
                onClick={onOpenCourseProfiles}
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-warning-ink/20 hover:bg-warning-ink/30 border border-warning-ink/50 text-warning-ink text-xs sm:text-xs font-bold flex items-center gap-1 transition-all"
                title="Manage Saved Course Profiles & Buoy Layouts (Max 10)"
              >
                <Route className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Profiles</span>
              </button>
            )}

            {/* Slide Back In / Done Button */}
            <button
              onClick={() => {
                setIsCourseBarOpen(false);
                setCourseEditMode('NONE');
              }}
              className="px-2.5 py-1 sm:py-1.5 rounded-xl bg-warning-ink text-canvas hover:brightness-110 font-bold text-xs flex items-center gap-1 shadow-md transition-all ml-1"
              title="Done editing course (Slide bar back in)"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>
      )}

      {/* MARK DETAIL / EDIT MODAL */}
      <MarkDetailModal
        mark={activeEditMark}
        isOpen={Boolean(activeEditMark)}
        onClose={() => setActiveEditMarkId(null)}
        onUpdateMark={(markId, updates) => {
          onUpdateMarkSettings?.(markId, updates);
        }}
        onDeleteMark={(markId) => {
          onDeleteMark?.(markId);
        }}
        onMoveOrder={(markId, direction) => {
          onMoveMarkOrder?.(markId, direction);
        }}
        deviceGps={deviceGps}
        totalSequentialMarks={sequentialMarksCount}
      />
    </section>
  );
};
