import { CourseMark, CourseProfile } from '../types/regatta';
import { calculateCourseLegs, generateCoursePreset } from './courseService';

export const MAX_COURSE_PROFILES = 10;
const STORAGE_KEY = 'tmtrac_saved_course_profiles';

/**
 * Default seeded course profiles if user has no stored profiles yet.
 */
export const DEFAULT_COURSE_PROFILES: CourseProfile[] = [
  {
    id: 'profile-rlir-wl',
    name: 'RLIR Windward-Leeward Standard',
    description: 'Championship 2-lap Windward/Leeward course with Leeward Gate and separate Windward Finish Pin.',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 3,
    locationName: 'Royal Langkawi Yacht Club (RLIR)',
    windDirectionDeg: 45,
    windSpeedKt: 14.5,
    totalDistanceNm: 2.85,
    // Built from the same geometry as the Windward-Leeward preset, laid to the profile's wind
    marks: generateCoursePreset('WINDWARD_LEEWARD', 6.308, 99.845, 45),
  },
  {
    id: 'profile-olympic-triangle',
    name: 'Kuah Bay Olympic Triangle',
    description: 'Classic 3-mark Olympic Triangle featuring a 45° reaching leg to Jibe Mark 2, followed by a broad reach to Mark 3.',
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
    locationName: 'Kuah Harbour, Langkawi',
    windDirectionDeg: 60,
    windSpeedKt: 12.0,
    totalDistanceNm: 3.42,
    marks: [
      {
        id: 'pin-end',
        name: 'Start Pin End (Orange Buoy)',
        shortName: 'SP',
        type: 'PIN_END',
        lat: 6.3055,
        lng: 99.8415,
        radiusMeters: 30,
        requiredRounding: 'LINE',
        color: '#FF4D4D',
        orderIndex: 0,
      },
      {
        id: 'rc-boat',
        name: 'RC Signal Vessel (Flagship)',
        shortName: 'RC',
        type: 'RC_BOAT',
        lat: 6.3075,
        lng: 99.8445,
        radiusMeters: 30,
        requiredRounding: 'LINE',
        color: '#00D4FF',
        orderIndex: 0,
      },
      {
        id: 'mark-1',
        name: 'Mark 1 (Windward Top)',
        shortName: '1',
        type: 'WINDWARD',
        lat: 6.3185,
        lng: 99.8540,
        radiusMeters: 45,
        requiredRounding: 'PORT',
        color: '#FBBC04',
        orderIndex: 1,
      },
      {
        id: 'mark-2',
        name: 'Mark 2 (Jibe Reach)',
        shortName: '2',
        type: 'WING',
        lat: 6.3120,
        lng: 99.8630,
        radiusMeters: 45,
        requiredRounding: 'PORT',
        color: '#FBBC04',
        orderIndex: 2,
      },
      {
        id: 'mark-3',
        name: 'Mark 3 (Leeward Base)',
        shortName: '3',
        type: 'LEEWARD',
        lat: 6.3040,
        lng: 99.8490,
        radiusMeters: 45,
        requiredRounding: 'PORT',
        color: '#FBBC04',
        orderIndex: 3,
      },
      {
        id: 'finish-pin',
        name: 'Finish Line Pin',
        shortName: 'FP',
        type: 'FINISH_PIN',
        lat: 6.3090,
        lng: 99.8430,
        radiusMeters: 35,
        requiredRounding: 'LINE',
        color: '#00FF9D',
        orderIndex: 999,
      },
    ],
  },
  {
    id: 'profile-trapezoid-quad',
    name: 'Penang Strait Trapezoid Quad',
    description: '4-mark Trapezoid layout separating inner and outer loops to reduce fleet interference during fleet racing.',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    locationName: 'Strait of Malacca (Penang)',
    windDirectionDeg: 30,
    windSpeedKt: 16.0,
    totalDistanceNm: 4.15,
    marks: [
      {
        id: 'pin-end',
        name: 'Start Pin End',
        shortName: 'SP',
        type: 'PIN_END',
        lat: 6.3050,
        lng: 99.8420,
        radiusMeters: 30,
        requiredRounding: 'LINE',
        color: '#FF4D4D',
        orderIndex: 0,
      },
      {
        id: 'rc-boat',
        name: 'RC Signal Vessel',
        shortName: 'RC',
        type: 'RC_BOAT',
        lat: 6.3070,
        lng: 99.8450,
        radiusMeters: 30,
        requiredRounding: 'LINE',
        color: '#00D4FF',
        orderIndex: 0,
      },
      {
        id: 'mark-1',
        name: 'Mark 1 (Outer Windward)',
        shortName: '1',
        type: 'WINDWARD',
        lat: 6.3200,
        lng: 99.8520,
        radiusMeters: 45,
        requiredRounding: 'PORT',
        color: '#FBBC04',
        orderIndex: 1,
      },
      {
        id: 'mark-2',
        name: 'Mark 2 (Reach Spreader)',
        shortName: '2',
        type: 'WING',
        lat: 6.3190,
        lng: 99.8620,
        radiusMeters: 45,
        requiredRounding: 'PORT',
        color: '#FBBC04',
        orderIndex: 2,
      },
      {
        id: 'mark-3',
        name: 'Mark 3 (Outer Leeward)',
        shortName: '3',
        type: 'LEEWARD',
        lat: 6.3070,
        lng: 99.8600,
        radiusMeters: 45,
        requiredRounding: 'PORT',
        color: '#FBBC04',
        orderIndex: 3,
      },
      {
        id: 'mark-4',
        name: 'Mark 4 (Inner Gate)',
        shortName: '4',
        type: 'GATE',
        lat: 6.3060,
        lng: 99.8470,
        radiusMeters: 45,
        requiredRounding: 'PORT',
        color: '#FBBC04',
        orderIndex: 4,
      },
      {
        id: 'finish-pin',
        name: 'Finish Line Pin',
        shortName: 'FP',
        type: 'FINISH_PIN',
        lat: 6.3090,
        lng: 99.8430,
        radiusMeters: 35,
        requiredRounding: 'LINE',
        color: '#00FF9D',
        orderIndex: 999,
      },
    ],
  },
];

/**
 * Calculates total course distance in NM from marks list.
 */
export function calculateTotalDistanceNm(marks: CourseMark[]): number {
  try {
    const legs = calculateCourseLegs(marks);
    const total = legs.reduce((sum, leg) => sum + (leg.distanceNm || 0), 0);
    return Math.round(total * 100) / 100;
  } catch (e) {
    return 0;
  }
}

/**
 * Earlier builds seeded 'RLIR Windward-Leeward Standard' with no marks. Browsers that stored
 * that copy keep showing "No marks saved in this course" for the classes linked to it, so a
 * seeded profile that is still empty gets the default marks back. Profiles the officer saved
 * themselves are never empty (saving requires marks) and are left alone.
 * Returns the same array when nothing needed repairing.
 */
export function repairEmptySeededProfiles(profiles: CourseProfile[]): CourseProfile[] {
  let changed = false;
  const repaired = profiles.map((p) => {
    if (!p || (Array.isArray(p.marks) && p.marks.length > 0)) return p;
    const seed = DEFAULT_COURSE_PROFILES.find((d) => d.id === p.id);
    if (!seed || seed.marks.length === 0) return p;
    changed = true;
    return { ...p, marks: JSON.parse(JSON.stringify(seed.marks)), totalDistanceNm: seed.totalDistanceNm };
  });
  return changed ? repaired : profiles;
}

/**
 * Loads all saved course profiles from localStorage.
 */
export function getSavedCourseProfiles(): CourseProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed default profiles
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_COURSE_PROFILES));
      return DEFAULT_COURSE_PROFILES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const repaired = repairEmptySeededProfiles(parsed);
      if (repaired !== parsed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(repaired));
        } catch {
          // Still return the repaired list; it is rebuilt on every read until it can be stored
        }
      }
      return repaired.slice(0, MAX_COURSE_PROFILES);
    }
  } catch (err) {
    console.error('Error loading course profiles from localStorage:', err);
  }
  return DEFAULT_COURSE_PROFILES;
}

/**
 * Saves or updates a course profile. Max 10 profiles allowed.
 */
export function saveCourseProfile(
  name: string,
  marks: CourseMark[],
  options?: {
    id?: string;
    description?: string;
    locationName?: string;
    windDirectionDeg?: number;
    windSpeedKt?: number;
  }
): { success: boolean; profile?: CourseProfile; error?: string } {
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Course profile name is required.' };
  }

  if (!marks || marks.length === 0) {
    return { success: false, error: 'Cannot save an empty course. Please place course marks first.' };
  }

  const profiles = getSavedCourseProfiles();
  const trimmedName = name.trim();
  const targetId = options?.id;
  const totalDistance = calculateTotalDistanceNm(marks);

  if (targetId) {
    // Update existing profile
    const existingIdx = profiles.findIndex((p) => p.id === targetId);
    if (existingIdx >= 0) {
      const updatedProfile: CourseProfile = {
        ...profiles[existingIdx],
        name: trimmedName,
        description: options?.description !== undefined ? options.description.trim() : profiles[existingIdx].description,
        locationName: options?.locationName || profiles[existingIdx].locationName,
        windDirectionDeg: options?.windDirectionDeg ?? profiles[existingIdx].windDirectionDeg,
        windSpeedKt: options?.windSpeedKt ?? profiles[existingIdx].windSpeedKt,
        marks: JSON.parse(JSON.stringify(marks)),
        totalDistanceNm: totalDistance,
        updatedAt: Date.now(),
      };
      profiles[existingIdx] = updatedProfile;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        return { success: true, profile: updatedProfile };
      } catch (e: any) {
        return { success: false, error: 'Failed to write to local storage: ' + (e.message || String(e)) };
      }
    }
  }

  // Create new profile
  if (profiles.length >= MAX_COURSE_PROFILES) {
    return {
      success: false,
      error: `Maximum limit of ${MAX_COURSE_PROFILES} course profiles reached. Please delete an existing profile to save a new one.`,
    };
  }

  const newProfile: CourseProfile = {
    id: `profile-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: trimmedName,
    description: options?.description?.trim() || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    locationName: options?.locationName || 'Custom Regatta Area',
    windDirectionDeg: options?.windDirectionDeg,
    windSpeedKt: options?.windSpeedKt,
    totalDistanceNm: totalDistance,
    marks: JSON.parse(JSON.stringify(marks)),
  };

  profiles.unshift(newProfile);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.slice(0, MAX_COURSE_PROFILES)));
    return { success: true, profile: newProfile };
  } catch (e: any) {
    return { success: false, error: 'Failed to save course profile: ' + (e.message || String(e)) };
  }
}

/**
 * Updates metadata of an existing course profile.
 */
export function updateCourseProfile(
  id: string,
  updates: Partial<Omit<CourseProfile, 'id' | 'createdAt'>>
): { success: boolean; profile?: CourseProfile; error?: string } {
  const profiles = getSavedCourseProfiles();
  const idx = profiles.findIndex((p) => p.id === id);

  if (idx < 0) {
    return { success: false, error: 'Course profile not found.' };
  }

  const current = profiles[idx];
  const updatedMarks = updates.marks || current.marks;
  const updatedTotalDist = updates.marks ? calculateTotalDistanceNm(updatedMarks) : current.totalDistanceNm;

  const updatedProfile: CourseProfile = {
    ...current,
    ...updates,
    marks: updatedMarks,
    totalDistanceNm: updatedTotalDist,
    updatedAt: Date.now(),
  };

  profiles[idx] = updatedProfile;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    return { success: true, profile: updatedProfile };
  } catch (e: any) {
    return { success: false, error: 'Failed to update course profile: ' + (e.message || String(e)) };
  }
}

/**
 * Deletes a course profile by ID.
 */
export function deleteCourseProfile(id: string): { success: boolean; error?: string } {
  const profiles = getSavedCourseProfiles();
  const filtered = profiles.filter((p) => p.id !== id);

  if (filtered.length === profiles.length) {
    return { success: false, error: 'Course profile not found.' };
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: 'Failed to delete course profile: ' + (e.message || String(e)) };
  }
}

/**
 * Duplicates a course profile. Max 10 limit applies.
 */
export function duplicateCourseProfile(id: string): {
  success: boolean;
  profile?: CourseProfile;
  error?: string;
} {
  const profiles = getSavedCourseProfiles();
  if (profiles.length >= MAX_COURSE_PROFILES) {
    return {
      success: false,
      error: `Maximum limit of ${MAX_COURSE_PROFILES} course profiles reached. Please delete an existing profile first.`,
    };
  }

  const target = profiles.find((p) => p.id === id);
  if (!target) {
    return { success: false, error: 'Course profile to duplicate not found.' };
  }

  const copyName = `${target.name} (Copy)`;
  const duplicated: CourseProfile = {
    ...JSON.parse(JSON.stringify(target)),
    id: `profile-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: copyName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  profiles.unshift(duplicated);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.slice(0, MAX_COURSE_PROFILES)));
    return { success: true, profile: duplicated };
  } catch (e: any) {
    return { success: false, error: 'Failed to duplicate course profile: ' + (e.message || String(e)) };
  }
}

/**
 * Exports all saved course profiles to JSON string.
 */
export function exportCourseProfilesJson(): string {
  const profiles = getSavedCourseProfiles();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'TMTRAC Regatta Tracking',
      version: '2.5',
      count: profiles.length,
      profiles,
    },
    null,
    2
  );
}

/**
 * Imports course profiles from JSON string.
 */
export function importCourseProfilesJson(
  jsonStr: string
): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    const rawList: CourseProfile[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.profiles)
      ? parsed.profiles
      : null;

    if (!rawList || rawList.length === 0) {
      return { success: false, count: 0, error: 'Invalid JSON: No course profiles found.' };
    }

    const validProfiles: CourseProfile[] = rawList
      .filter((p) => p && typeof p.name === 'string' && Array.isArray(p.marks))
      .map((p) => ({
        id: p.id || `profile-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: p.name.trim(),
        description: p.description || '',
        createdAt: p.createdAt || Date.now(),
        updatedAt: Date.now(),
        locationName: p.locationName || 'Imported Course',
        windDirectionDeg: p.windDirectionDeg,
        windSpeedKt: p.windSpeedKt,
        totalDistanceNm: calculateTotalDistanceNm(p.marks),
        marks: p.marks,
      }))
      .slice(0, MAX_COURSE_PROFILES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(validProfiles));
    return { success: true, count: validProfiles.length };
  } catch (e: any) {
    return { success: false, count: 0, error: 'Failed to parse JSON file: ' + (e.message || String(e)) };
  }
}

/**
 * Resets back to the factory preset profiles.
 */
export function resetToDefaultProfiles(): CourseProfile[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_COURSE_PROFILES));
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_COURSE_PROFILES;
}

/**
 * Relocates a list of course marks so they are centered / anchored around a target latitude and longitude (e.g. user's current location or selected venue).
 * Keeps relative distance, leg angles, and course geometry intact.
 */
export function relocateCourseMarksToLocation(
  marks: CourseMark[],
  targetLat: number,
  targetLng: number
): CourseMark[] {
  if (!marks || marks.length === 0) return [];
  if (typeof targetLat !== 'number' || typeof targetLng !== 'number' || isNaN(targetLat) || isNaN(targetLng)) {
    return marks;
  }

  // Determine course anchor point:
  // 1. If start line marks exist (PIN_END, RC_BOAT), use the start line center.
  // 2. Otherwise, use the bounding centroid of all marks.
  const startMarks = marks.filter((m) => m.type === 'PIN_END' || m.type === 'RC_BOAT');
  let anchorLat: number;
  let anchorLng: number;

  if (startMarks.length > 0) {
    anchorLat = startMarks.reduce((sum, m) => sum + m.lat, 0) / startMarks.length;
    anchorLng = startMarks.reduce((sum, m) => sum + m.lng, 0) / startMarks.length;
  } else {
    anchorLat = marks.reduce((sum, m) => sum + m.lat, 0) / marks.length;
    anchorLng = marks.reduce((sum, m) => sum + m.lng, 0) / marks.length;
  }

  const dLat = targetLat - anchorLat;
  const dLng = targetLng - anchorLng;

  return marks.map((m) => ({
    ...m,
    lat: Number((m.lat + dLat).toFixed(6)),
    lng: Number((m.lng + dLng).toFixed(6)),
  }));
}

