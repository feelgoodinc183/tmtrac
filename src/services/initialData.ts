import { Boat, CourseMark, MeshtasticNode, RaceClassDefinition, RaceState, RegattaLocation, VhfBulletin, ClassRaceStatus } from '../types/regatta';

// Initial Dynamic Race Classes
export const INITIAL_RACE_CLASSES: RaceClassDefinition[] = [
  {
    id: 'class-1',
    name: 'Class 1',
    description: 'IRC Racing / Performance Monohull',
    ratingSystem: 'IRC',
    defaultRating: 1.000,
    color: '#00D4FF',
    courseProfileId: 'profile-rlir-wl',
    courseProfileName: 'RLIR Windward-Leeward Standard',
  },
  {
    id: 'class-2',
    name: 'Class 2',
    description: 'Club Cruiser / Keelboat',
    ratingSystem: 'IRC',
    defaultRating: 1.000,
    color: '#00FF9D',
    courseProfileId: 'profile-olympic-triangle',
    courseProfileName: 'Kuah Bay Olympic Triangle',
  },
  {
    id: 'class-3',
    name: 'Class 3',
    description: 'Multihull / Sportsboat / One-Design',
    ratingSystem: 'PY',
    defaultRating: 1.000,
    color: '#FBBC04',
    courseProfileId: 'profile-rlir-wl',
    courseProfileName: 'RLIR Windward-Leeward Standard',
  },
];

// Regional Preset Locations
export const REGATTA_LOCATIONS: RegattaLocation[] = [
  {
    id: 'MALAYSIA_NATIONWIDE_MESHMAP',
    name: 'TRACK, MANAGE AND SPECTATE BOAT RACE',
    organizer: 'Meshtastic Malaysia & MeshMap.net Federation',
    region: 'Selangor / Klang Valley / Penang / Langkawi / Johor / Sabah',
    country: 'Malaysia',
    centerLat: 3.139,
    centerLng: 101.686,
    zoom: 1,
    publicMqttTopic: 'msh/MY/#',
    isMalaysiaPublicMesh: true,
  },
  {
    id: 'RSYC_RAJA_MUDA',
    name: 'Raja Muda Selangor International Regatta (RMSIR)',
    organizer: 'Royal Selangor Yacht Club (RSYC)',
    region: 'Port Klang → Pangkor → Penang → Langkawi Passage',
    country: 'Malaysia',
    centerLat: 3.001,
    centerLng: 101.378,
    zoom: 1,
    publicMqttTopic: 'msh/MY_919/2/e/RSYC_RajaMuda/#',
    isMalaysiaPublicMesh: true,
  },
  {
    id: 'RSYC_PLATU_MATCH',
    name: 'Platu Match Racing Championship',
    organizer: 'Royal Selangor Yacht Club (RSYC)',
    region: 'Port Klang Waters / Selat Klang',
    country: 'Malaysia',
    centerLat: 2.998,
    centerLng: 101.372,
    zoom: 1,
    publicMqttTopic: 'msh/MY_919/2/e/RSYC_PlatuMatch/#',
    isMalaysiaPublicMesh: true,
  },
  {
    id: 'LANGKAWI_MALAYSIA',
    name: 'Royal Langkawi International Regatta',
    organizer: 'Royal Langkawi Yacht Club (RLYC)',
    region: 'Kedah / Andaman Sea',
    country: 'Malaysia',
    centerLat: 6.308,
    centerLng: 99.845,
    zoom: 1,
    publicMqttTopic: 'msh/MY_919/2/e/LangkawiMarine/#',
    isMalaysiaPublicMesh: true,
  },
  {
    id: 'MALACCA_STRAITS_MALAYSIA',
    name: 'Straits of Malacca Offshore Marine Sector',
    organizer: 'Royal Selangor Yacht Club & MSF',
    region: 'Port Klang / Selangor Waters',
    country: 'Malaysia',
    centerLat: 2.950,
    centerLng: 101.350,
    zoom: 1,
    publicMqttTopic: 'msh/MY_919/2/e/StraitsOfMalacca/#',
    isMalaysiaPublicMesh: true,
  },
  {
    id: 'PENANG_STRAIT_MALAYSIA',
    name: 'Penang Strait Marine Passage Regatta',
    organizer: 'Penang Sailing Association',
    region: 'Georgetown / Penang Island',
    country: 'Malaysia',
    centerLat: 5.416,
    centerLng: 100.350,
    zoom: 1,
    publicMqttTopic: 'msh/MY_919/2/e/PenangStrait/#',
    isMalaysiaPublicMesh: true,
  },
  {
    id: 'KL_KLANG_MALAYSIA',
    name: 'Kuala Lumpur & Port Klang Marine Hub',
    organizer: 'Royal Selangor Yacht Club Base',
    region: 'Klang Valley / Selangor Coast',
    country: 'Malaysia',
    centerLat: 3.139,
    centerLng: 101.686,
    zoom: 1,
    publicMqttTopic: 'msh/MY_919/2/e/KualaLumpurMesh/#',
    isMalaysiaPublicMesh: true,
  },
];

// Initial Per-Class Independent Race States
export const INITIAL_CLASS_STATES: Record<string, ClassRaceStatus> = {
  'Class 1': {
    status: 'PRE_START',
    countdownSeconds: 300,
    startSequenceActive: false,
  },
  'Class 2': {
    status: 'PRE_START',
    countdownSeconds: 300,
    startSequenceActive: false,
  },
  'Class 3': {
    status: 'PRE_START',
    countdownSeconds: 300,
    startSequenceActive: false,
  },
};

// Base coordinates default
export const INITIAL_RACE_STATE: RaceState = {
  name: 'Regatta Race',
  locationName: 'Coastal Waters',
  status: 'PRE_START',
  countdownSeconds: 300,
  activeClass: 'Class 1',
  startSequenceActive: false,
  classStates: INITIAL_CLASS_STATES,
  telemetryRate: 'HIGH_FREQUENCY',
  mqttBridgeMode: 'CELLULAR',
  mqttConnected: false,
  airtimePercent: 0,
  windSpeedKt: 12.0,
  windDirectionDeg: 210,
  deadReckoningEnabled: true,
  offlineCacheActive: true,
  syncProgress: 100,
  pendingSyncBuffer: 0,
};


export function generateMultiLegTrail(
  startLat: number,
  startLng: number,
  legs: Array<{ dLat: number; dLng: number; steps: number; tackVariance?: number }>
): Array<{ lat: number; lng: number }> {
  const trail: Array<{ lat: number; lng: number }> = [{ lat: +startLat.toFixed(6), lng: +startLng.toFixed(6) }];
  let currentLat = startLat;
  let currentLng = startLng;

  for (const leg of legs) {
    const stepLat = leg.dLat / leg.steps;
    const stepLng = leg.dLng / leg.steps;
    const tack = leg.tackVariance ?? 0.00004;

    for (let s = 1; s <= leg.steps; s++) {
      const wiggle = Math.sin((s / leg.steps) * Math.PI * 3.5) * tack;
      currentLat += stepLat + wiggle * 0.5;
      currentLng += stepLng + wiggle;
      trail.push({ lat: +currentLat.toFixed(6), lng: +currentLng.toFixed(6) });
    }
  }

  return trail;
}

export const INITIAL_MARKS: CourseMark[] = [];

export const INITIAL_BOATS: Boat[] = [];

export const INITIAL_NODES: MeshtasticNode[] = [];

export const INITIAL_VHF_BULLETINS: VhfBulletin[] = [];
