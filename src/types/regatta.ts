export type HandicapSystem = 'IRC' | 'ORC' | 'PY';
export type RaceClass = string;

export interface RaceClassDefinition {
  id: string;
  name: string;
  description?: string;
  ratingSystem?: HandicapSystem;
  defaultRating?: number;
  color?: string;
  courseProfileId?: string; // Linked course profile ID (e.g. 'profile-rlir-wl')
  courseProfileName?: string; // Linked course profile title for display
}

export type TelemetryRate = 'HIGH_FREQUENCY' | 'OFFSHORE_LEG'; // HIGH=5-10s, OFFSHORE=1-2m
export type MqttBridgeMode = 'CELLULAR' | 'SATELLITE' | 'OFFLINE_BUFFER';
export type BoatStatus = 'PRE_START' | 'RACING' | 'OCS' | 'CLEARED_OCS' | 'FINISHED' | 'DNS' | 'DNF' | 'RET' | 'DSQ';

export type MapBasemap = 'DARK_VECTOR' | 'OPEN_STREET_MAP' | 'OPEN_SEA_MAP' | 'OPEN_TOPO_BATHYMETRY';
export type MapViewSize = 'STANDARD' | 'EXPANDED' | 'FULLSCREEN';

export interface RegattaLocation {
  id: string;
  name: string;
  organizer?: string;
  region: string;
  country: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  publicMqttTopic: string;
  isMalaysiaPublicMesh: boolean;
}

export interface WeatherOverlays {
  windParticles: boolean;
  windBarbs: boolean;
  isobars: boolean;
  oceanCurrents: boolean;
  waveHeatmap: boolean;
  openSeaMapLayers: boolean;
}

export interface HardwareConnection {
  bluetoothConnected: boolean;
  bluetoothDeviceName: string | null;
  usbConnected: boolean;
  usbPortName: string | null;
  baudRate: number;
  activePort: 'BLE' | 'USB' | 'MQTT' | 'OFFLINE';
  nmeaBridgeActive: boolean;
  nmeaSentencesPerSec: number;
  malaysiaPublicMeshActive: boolean;
}

export interface NmeaData {
  twsKt: number;       // True Wind Speed
  twdDeg: number;      // True Wind Direction
  awsKt: number;       // Apparent Wind Speed
  awaDeg: number;      // Apparent Wind Angle
  depthMeters: number; // Water Depth
  waterTempC: number;  // Water Temp
  headingDeg: number;  // Magnetic Heading
  rawSentence: string; // e.g. "$MWWV,215,T,14.2,N,A*2C"
}

export interface MobDistressAlert {
  id: string;
  active: boolean;
  triggeredAt: number;
  boatId: string | null;
  boatName: string;
  lat: number;
  lng: number;
  interceptingBoats: Array<{
    boatId: string;
    boatName: string;
    distanceNm: number;
    bearingDeg: number;
    etaMinutes: number;
  }>;
}

export interface VhfBulletin {
  id: string;
  timestamp: number;
  type: 'POSTPONEMENT' | 'COURSE_CHANGE' | 'SAFETY_WARNING' | 'GENERAL_ANNOUNCEMENT';
  title: string;
  content: string;
  sender: string;
  deliveryMatrix: Array<{
    boatId: string;
    boatName: string;
    status: 'RECEIVED' | 'ACKNOWLEDGED' | 'PENDING';
    ackTime?: number;
  }>;
}

export interface JuryIncidentSnapshot {
  id: string;
  timestamp: number;
  protestingBoatId: string;
  protestingBoatName: string;
  respondentBoatId: string;
  respondentBoatName: string;
  ruleInfringement: string;
  lat: number;
  lng: number;
  telemetryLog5Min: Array<{
    timeSecAgo: number;
    boat1: { lat: number; lng: number; sog: number; cog: number };
    boat2: { lat: number; lng: number; sog: number; cog: number };
  }>;
  status: 'LOCKED' | 'UNDER_REVIEW' | 'DECIDED';
  hearingStatus?: 'LODGED' | 'HEARING_SCHEDULED' | 'IN_DELIBERATION' | 'DECIDED' | 'DISMISSED' | 'WITHDRAWN';
  hearingTime?: string;
  hearingRoom?: string;
  witnessBoats?: string[];
  incidentDescription?: string;
  juryDecision?: string;
  penaltyType?: 'NONE' | 'DSQ' | 'RAF' | 'DNE' | 'REDRESS_GRANTED';
  juryMembers?: string[];
}

export interface NoticeBoardPost {
  id: string;
  title: string;
  category: 'SI_AMENDMENT' | 'NOTICE_TO_COMPETITORS' | 'SAFETY' | 'SCHEDULE' | 'JURY_DECISION';
  content: string;
  postedAt: number;
  author: string;
  referenceNumber: string;
  urgent?: boolean;
}

export type LoraCommandFlag =
  | 'AP_POSTPONE'
  | 'GENERAL_RECALL'
  | 'INDIVIDUAL_RECALL'
  | 'BLACK_FLAG'
  | 'U_FLAG'
  | 'P_FLAG'
  | 'S_SHORTEN'
  | 'N_ABANDON'
  | 'SAFETY_RETURN';

export interface LoraBroadcastMessage {
  id: string;
  flag: LoraCommandFlag;
  title: string;
  soundSignal: string;
  meaning: string;
  sentAt: number;
  targetClass: string;
  acknowledgedNodeIds: string[];
  status: 'BROADCASTING' | 'SENT' | 'EXPIRED';
}

export interface AdaptiveThrottleConfig {
  mode: 'DYNAMIC_PROXIMITY' | 'BALANCED' | 'BATTERY_SAVER' | 'RACE_BURST';
  nearMarkRateHz: number;      // e.g. 2Hz or 5Hz near start/finish/marks
  openWaterRateHz: number;     // e.g. 0.2Hz or 0.5Hz on open course legs
  proximityThresholdMeters: number; // e.g. 150m from marks/start line
  dutyCycleLimitPercent: number;    // e.g. 1.0% (MCMC Malaysia standard)
  currentDutyCycle: number;         // e.g. 0.42%
  batteryThresholdWarning: number;  // e.g. 20%
}

export interface RaceHighlightMoment {
  id: string;
  title: string;
  subtitle?: string;
  timeSec: number;
  timestampSec?: number;
  icon?: 'START' | 'MARK' | 'DUEL' | 'FINISH';
  type?: 'START_GUN' | 'MARK_ROUNDING' | 'OVERTAKE' | 'OCS_PENALTY' | 'FINISH_DUEL';
  boatsInvolved?: string[];
  boatIds?: string[];
  markId?: string;
  badgeColor?: string;
  description: string;
}

export interface CompetitorImportRecord {
  name: string;
  sailNumber: string;
  skipper: string;
  crew?: string;
  className: string;
  handicapRating?: number; // PY or IRC rating (default 1000 or 1.000)
  country?: string;
  club?: string;
}

export interface RacePlaybackState {
  isPlaying: boolean;
  speedMultiplier: 1 | 2 | 5 | 10;
  currentTimeSec: number; // 0 to 1800 (30 mins)
  maxDurationSec: number;
}

export interface MeshtasticNode {
  id: string;             // Meshtastic: "!" + 8 lowercase hex, e.g. "!a1b2c3d4" (see utils/nodeId); phones: "!DEV-1A2B"
  longName: string;       // e.g. "T-Echo-WindRunner" or "LilyGO T-Echo nRF52840"
  shortName: string;      // e.g. "7A2C"
  mac: string;            // e.g. "24:6F:28:7A:2C:10"
  battery?: number;       // 0-100%, missing until the tracker reports it
  voltage?: number;       // e.g. 4.15 V
  satsInView?: number;    // e.g. 11
  satsInFix?: number;     // e.g. 9
  gpsFix?: boolean;
  altitudeMeters?: number;// e.g. 14 m
  speedKt?: number;       // e.g. 8.4 kt
  headingDeg?: number;    // e.g. 312°
  lat?: number;
  lng?: number;
  snr?: number;           // dB, e.g. +4.5; missing until a packet reports it
  rssi?: number;          // dBm, e.g. -78
  hops?: number;          // 0-4
  boundBoatId: string | null; // e.g. "boat-1"
  status: 'OPTIMAL' | 'DEGRADED' | 'OFFLINE';
  connectionType?: 'BLE' | 'USB' | 'LORA_MESH' | 'MALAYSIA_PUBLIC_LORA' | 'MQTT' | 'DEVICE_GPS' | 'PHONE' | 'TABLET' | 'PC';
  lastPingTime: number;   // timestamp
  locationRegion?: string;
  hardwareModel?: string; // e.g. "LilyGO T-Echo (nRF52840 / SX1262)" or "Apple iPhone 15 Pro GPS"
  firmwareVersion?: string;// e.g. "v2.5.4.a89f" or "iOS 18 WebGPS"
  channelUtil?: number;   // e.g. 1.8%
  airUtilTx?: number;     // e.g. 0.4%
  isBluetoothConnected?: boolean;
  isDeviceGps?: boolean;
  deviceRole?: TrackerVesselRole;
  trail?: Array<{ lat: number; lng: number }>;

  // Environmental & BME280 Sensor Telemetry
  temperature?: number;         // e.g. 28.4 °C
  humidity?: number;            // e.g. 74.2 % RH (BME280 relative humidity)
  relativeHumidity?: number;    // alias for relative humidity (%)
  barometricPressure?: number;  // e.g. 1012.8 hPa / mbar
  gasResistance?: number;       // e.g. 45200 Ohms
  iaq?: number;                 // Air Quality Index
  sensorModel?: string;         // e.g. "BME280", "BMP280", "BME680"
}

export interface MarkRounding {
  markId: string;
  markName: string;
  roundedAt: number;      // timestamp
  elapsedAtSec?: number;  // Race elapsed time in seconds when mark rounded (e.g. 245s = 04:05)
  legDurationSec?: number;// Time taken to sail this leg from previous mark (e.g. 245s)
  legSpeedKt?: number;    // Average/entry SOG on this leg
  roundingDirection: 'PORT' | 'STARBOARD' | 'LINE';
  isValid: boolean;
}

export interface BoatRaceResult {
  boatId: string;
  boatName: string;
  sailNumber: string;
  class: RaceClass;
  handicapSystem: HandicapSystem;
  handicapRating: number;
  skipper: string;
  status: BoatStatus;
  elapsedSeconds: number;
  correctedSeconds: number;
  rank: number;
  rrsPoints: number;      // 1.0, 2.0, 3.0, or penalty points
  markRoundings: MarkRounding[];
  color?: string;
  note?: string;
}

export interface CompletedRace {
  id: string;             // e.g. 'race-1', 'race-2', 'race-3'
  raceNumber: number;     // 1, 2, 3...
  raceTitle: string;      // e.g. "Race 1 - Windward/Leeward"
  raceClass?: string;     // specific class or 'ALL'
  completedAt: number;    // timestamp
  windSpeedKt?: number;
  windDirectionDeg?: number;
  results: BoatRaceResult[];
  status?: 'COMPLETED' | 'IN_PROGRESS' | 'SCHEDULED';
}

export interface SeriesScoreEntry {
  raceNumber: number;
  raceId: string;
  points: number;
  rank: number;
  status: BoatStatus;
  isDiscarded: boolean;
  correctedSeconds?: number;
  elapsedSeconds?: number;
}

export interface SeriesStanding {
  boatId: string;
  boatName: string;
  sailNumber: string;
  class: RaceClass;
  skipper: string;
  handicapSystem: HandicapSystem;
  handicapRating: number;
  color?: string;
  raceScores: SeriesScoreEntry[];
  totalPoints: number;    // Gross points before discard
  nettPoints: number;     // Nett points after discard
  seriesRank: number;     // Final series place (1st, 2nd, 3rd...)
}

export interface Boat {
  id: string;
  name: string;
  sailNumber: string;
  class: RaceClass;
  handicapSystem: HandicapSystem;
  handicapRating: number;  // e.g. IRC 1.042
  skipper: string;
  nodeId: string | null;   // Meshtastic node ID
  lat: number;             // decimal degrees
  lng: number;
  sog: number;             // Speed Over Ground in knots
  cog: number;             // Course Over Ground in degrees
  vmg: number;             // Velocity Made Good in knots
  dtw: number;             // Distance to Windward mark in NM
  heading: number;         // compass heading
  headingDeg?: number;
  speedKt?: number;
  rank?: number;
  tack?: 'PORT' | 'STARBOARD';
  status: BoatStatus;
  markRoundings: MarkRounding[];
  markSplits?: any[];
  elapsedSeconds: number;  // raw time
  correctedSeconds: number; // elapsedSeconds * handicapRating
  color: string;
  trail: Array<{ lat: number; lng: number }>;
}

export interface CourseMark {
  id: string;
  orderIndex?: number;    // Sequential 1, 2, 3, 4 for course marks; 0 for start; 999 for finish
  name: string;           // e.g. "Mark 1", "Start Pin", "Mark 2 (Wing)"
  shortName?: string;     // e.g. "1", "2", "3", "SP", "RC", "FP", "FR"
  type: 'PIN_END' | 'RC_BOAT' | 'WINDWARD' | 'WING' | 'LEEWARD' | 'GATE' | 'FINISH' | 'FINISH_PIN' | 'FINISH_RC' | 'CUSTOM_MARK';
  lat: number;
  lng: number;
  radiusMeters: number;
  requiredRounding: 'PORT' | 'STARBOARD' | 'LINE';
  color?: string;
}

export interface CourseProfile {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  locationName?: string;
  windDirectionDeg?: number;
  windSpeedKt?: number;
  totalDistanceNm?: number;
  marks: CourseMark[];
}

export type CourseEditMode = 'NONE' | 'DROP_MARK' | 'SET_START_PIN' | 'SET_START_RC' | 'SET_FINISH_PIN' | 'SET_FINISH_RC';

export interface CourseLeg {
  fromMark: CourseMark;
  toMark: CourseMark;
  distanceNm: number;
  bearingDeg: number;
  legNumber: number;
  label: string;
}

export interface ClassRaceStatus {
  status: 'PRE_START' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
  countdownSeconds: number; // e.g. 300 for 5-min start
  startSequenceActive: boolean;
  targetStartTime?: number; // Target epoch millisecond timestamp when gun fires (0:00)
  startTime?: number;       // Epoch millisecond timestamp when race officially started
  updatedAt?: number;
}

export interface RaceState {
  name: string;
  locationName: string;
  status: 'PRE_START' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
  countdownSeconds: number; // e.g. 300 for 5-min start
  activeClass: RaceClass;
  startSequenceActive: boolean;
  targetStartTime?: number; // Target epoch millisecond timestamp when gun fires (0:00)
  classStates?: Record<string, ClassRaceStatus>;
  telemetryRate: TelemetryRate;
  mqttBridgeMode: MqttBridgeMode;
  mqttConnected: boolean;
  airtimePercent: number;
  windSpeedKt: number;
  windDirectionDeg: number;
  deadReckoningEnabled: boolean;
  offlineCacheActive: boolean;
  syncProgress: number; // 0-100
  pendingSyncBuffer: number; // count of local SQLite pings
  elapsedSeconds?: number;
  elapsedTimeSeconds?: number;
  startTime?: number;
  activeRaceClass?: RaceClass;
  updatedAt?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  imageUri?: string;
  analysis?: string;
}

export type TrackerDeviceType = 'PHONE' | 'TABLET' | 'PC' | 'SMARTWATCH' | 'LORA_TECHO' | 'LORA_HELTEC' | 'LORA_RAK' | 'CUSTOM_MQTT';
export type TrackerVesselRole = 'COMPETITOR' | 'SAFETY_BOAT' | 'RACE_COMMITTEE' | 'SPECTATOR' | 'VIP_CHASE' | 'MEDIA';

export interface DeviceTrackerProfile {
  deviceId: string;
  deviceName: string;
  deviceType: TrackerDeviceType;
  role: TrackerVesselRole;
  boundBoatId: string | null;
  sailNumber?: string;
  color: string;
  isBroadcasting: boolean;
  updateIntervalSec: number; // 1s, 2s, 5s
  lastBroadcastTime?: number;
  packetsTransmitted: number;
}

export interface HybridFleetMember {
  deviceId: string;
  deviceName: string;
  deviceType: TrackerDeviceType;
  role: TrackerVesselRole;
  lat: number;
  lng: number;
  // Missing when the device didn't report it
  accuracy?: number;
  speedKt?: number;
  headingDeg?: number;
  altitudeMeters?: number;
  battery?: number;
  timestamp: number;
  isLocalUser: boolean;
  boundBoatId?: string | null;
  color: string;
  trail?: Array<{ lat: number; lng: number }>;
}

export interface DeviceGpsState {
  active: boolean;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  speedKt: number | null;
  headingDeg: number | null;
  altitudeMeters?: number | null;
  batteryLevel?: number | null;
  timestamp: number | null;
  error: string | null;
  isSharing: boolean;
  packetsSent: number;
  profile: DeviceTrackerProfile;
}

export interface RegattaRoom {
  code: string;               // Unique room code e.g. 'RLIR26'
  title: string;              // e.g. 'Royal Langkawi International Regatta'
  locationName: string;       // e.g. 'Kuah, Langkawi (RLYC)'
  adminPin: string;           // 4-digit PIN for Race Committee / Organizer
  participantPin?: string;    // Optional PIN for participants (Skippers/Crew)
  isPublic: boolean;          // Listed in public lobby directory
  tenantId?: string;          // Multi-tenant organization ID
  tenantName?: string;        // Sponsoring Club / Organization display name
  ownerId?: string;           // User ID of room creator
  ownerEmail?: string;        // Creator's email
  ownerName?: string;         // Creator's display name
  createdAt: number;
  lastActive: number;
  raceState: RaceState;
  marks: CourseMark[];
  boats: Boat[];
  trackers?: any[];
  vhfBulletins?: VhfBulletin[];
  seriesRaces?: CompletedRace[];
}

export type PlanTier = 'FREE' | 'CLUB' | 'EVENT_PRO';

export interface PlanLimits {
  maxActiveRooms: number;
  maxBoatsPerRoom: number;
  maxAdminSeats: number;
  loraPriority: boolean;
  customBranding: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  ownerEmail?: string;
  planTier: PlanTier;
  limits: PlanLimits;
  activeRoomsCount: number;
  membersCount: number;
  createdAt: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  subscriptionCurrentPeriodEnd?: number;
  eventPassesBalance?: number;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  eventId?: string;
  roomCode?: string;
  userId: string;
  userEmail?: string;
  userRole: string;
  action: string;
  platform: 'WEB' | 'ANDROID';
  details: Record<string, any>;
  timestamp: number;
}

export interface RegattaRoomSummary {
  code: string;
  title: string;
  locationName: string;
  isPublic: boolean;
  tenantId?: string;
  tenantName?: string;
  ownerId?: string;
  ownerName?: string;
  isOwner?: boolean;
  boatCount: number;
  markCount: number;
  raceStatus: 'PRE_START' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
  activeClients: number;
  createdAt: number;
  lastActive: number;
  hasPassword?: boolean;
  hasParticipantPin?: boolean;
}

export interface UserProfileStats {
  racesOrganized: number;
  racesParticipated: number;
  podiumFinishes: number;
  totalNauticalMiles: number;
  vmgEfficiency: number;
  winRate: number;
}

export interface UserRaceHistoryRecord {
  id: string;
  regattaName: string;
  roomCode: string;
  date: string;
  locationName: string;
  role: 'RACE_OFFICER' | 'SKIPPER' | 'CREW';
  boatName?: string;
  sailNumber?: string;
  raceClass?: string;
  rank?: number;
  totalEntries?: number;
  status: 'PODIUM' | 'FINISHED' | 'DNS' | 'DNF' | 'ORGANIZED';
  pointsAwarded?: number;
  elapsedTime?: string;
}

export interface UserAccount {
  id: string;
  // Set by the club user list when someone asked for Race Officer at sign-up
  requestedRole?: 'RACE_OFFICER';
  tenantId?: string;
  tenantName?: string;
  email: string;
  username: string;
  fullName: string;
  sailingClub: string;
  sailNumber?: string;
  handicapRating?: string;
  role: 'ADMIN' | 'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR';
  participantType?: 'SKIPPER' | 'CREW' | 'RACE_OFFICER';
  status?: 'ACTIVE' | 'SUSPENDED';
  token?: string;
  planTier?: PlanTier;
  createdAt: number;
  roomsHostedCount?: number;
  isSuperAdmin?: boolean;
  stats: UserProfileStats;
  raceHistory: UserRaceHistoryRecord[];
}

export interface PricingPackage {
  id: string;
  tierKey: PlanTier | string;
  displayTitle: string;
  badge?: string;
  priceAmount: number;
  currency: string;
  currencySymbol: string;
  billingInterval: 'month' | 'year' | 'event';
  description?: string;
  maxActiveRooms: number;
  maxBoatsPerRoom: number;
  maxAdminSeats: number;
  loraPriority: boolean;
  customBranding: boolean;
  features: string[];
  isActive: boolean;
  sortOrder: number;
  stripePriceId?: string;
  updatedAt?: number;
}

export interface BackfillPoint {
  lat: number;
  lng: number;
  speedKt?: number;
  headingDeg?: number;
  timestamp: number; // Hardware GNSS/GPS UTC timestamp (ms since epoch)
  accuracy?: number;
  altitudeMeters?: number | null;
}

export interface GpsBatchBackfillPayload {
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  boundBoatId?: string | null;
  points: BackfillPoint[];
  // Set on offline replays; the server answers GPS_BATCH_ACK or GPS_BATCH_REJECTED with it
  batchId?: string;
}




