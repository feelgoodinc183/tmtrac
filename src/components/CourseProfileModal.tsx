import React, { useState, useEffect } from 'react';
import { CourseMark, CourseProfile, RegattaLocation, DeviceGpsState } from '../types/regatta';
import {
  MAX_COURSE_PROFILES,
  getSavedCourseProfiles,
  saveCourseProfile,
  updateCourseProfile,
  deleteCourseProfile,
  duplicateCourseProfile,
  exportCourseProfilesJson,
  importCourseProfilesJson,
  resetToDefaultProfiles,
  calculateTotalDistanceNm,
  relocateCourseMarksToLocation,
} from '../services/courseProfileService';
import { safeFixed } from '../utils/formatters';
import {
  MapPin,
  X,
  Plus,
  Save,
  Trash2,
  Copy,
  Edit2,
  Download,
  Upload,
  Check,
  AlertCircle,
  Wind,
  Navigation,
  RotateCcw,
  CheckCircle2,
  Crosshair,
  Globe,
  AlertTriangle,
} from 'lucide-react';

interface CourseProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMarks: CourseMark[];
  currentLocation?: RegattaLocation;
  deviceGps?: DeviceGpsState;
  currentWindDir?: number;
  currentWindSpeed?: number;
  activeProfileId?: string | null;
  onApplyCourse: (marks: CourseMark[], profileName: string, profileId?: string) => void;
}

export const CourseProfileModal: React.FC<CourseProfileModalProps> = ({
  isOpen,
  onClose,
  currentMarks,
  currentLocation,
  deviceGps,
  currentWindDir,
  currentWindSpeed,
  activeProfileId,
  onApplyCourse,
}) => {
  const [profiles, setProfiles] = useState<CourseProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Course Placement Mode: 'USER_LOCATION' (relocate marks to active user location) vs 'ORIGINAL_GPS'
  const [placementMode, setPlacementMode] = useState<'USER_LOCATION' | 'ORIGINAL_GPS'>('USER_LOCATION');

  // Interactive inline confirmations (replaces window.confirm for iframe reliability)
  const [pendingDeleteProfile, setPendingDeleteProfile] = useState<CourseProfile | null>(null);
  const [pendingOverwriteProfile, setPendingOverwriteProfile] = useState<CourseProfile | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // Save new profile state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Notification message
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Import JSON file input ref
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Resolve user target coordinates
  const hasLiveGps = Boolean(deviceGps?.active && deviceGps.lat && deviceGps.lng);
  const userLat = hasLiveGps && deviceGps?.lat ? deviceGps.lat : (currentLocation?.centerLat ?? 6.308);
  const userLng = hasLiveGps && deviceGps?.lng ? deviceGps.lng : (currentLocation?.centerLng ?? 99.845);
  const userLocationLabel = hasLiveGps
    ? 'Live Device GPS'
    : (currentLocation?.name || 'Current Active Area');

  // Refresh profile list
  const refreshProfiles = () => {
    const loaded = getSavedCourseProfiles();
    setProfiles(loaded);
  };

  useEffect(() => {
    if (isOpen) {
      refreshProfiles();
      setIsCreatingNew(false);
      setEditingProfileId(null);
      setPendingDeleteProfile(null);
      setPendingOverwriteProfile(null);
      setShowRestoreConfirm(false);
      setStatusMessage(null);
    }
  }, [isOpen]);

  const showNotification = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  if (!isOpen) return null;

  const currentMarksDistance = calculateTotalDistanceNm(currentMarks);
  const isMaxReached = profiles.length >= MAX_COURSE_PROFILES;

  // Handle Save Current Map Marks as New Profile
  const handleSaveCurrentAsNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showNotification('Please enter a name for the course profile.', 'error');
      return;
    }

    if (currentMarks.length === 0) {
      showNotification('Cannot save an empty course. Please place marks on the map first.', 'error');
      return;
    }

    const result = saveCourseProfile(newName, currentMarks, {
      description: newDesc,
      locationName: userLocationLabel,
      windDirectionDeg: currentWindDir,
      windSpeedKt: currentWindSpeed,
    });

    if (result.success && result.profile) {
      refreshProfiles();
      setIsCreatingNew(false);
      setNewName('');
      setNewDesc('');
      showNotification(`Saved "${result.profile.name}" to course profiles (${profiles.length + 1}/${MAX_COURSE_PROFILES}).`, 'success');
    } else {
      showNotification(result.error || 'Failed to save course profile.', 'error');
    }
  };

  // Handle Overwrite / Update Existing Profile with Current Map Marks
  const executeOverwrite = (profile: CourseProfile) => {
    const result = saveCourseProfile(profile.name, currentMarks, {
      id: profile.id,
      description: profile.description,
      locationName: userLocationLabel,
      windDirectionDeg: currentWindDir ?? profile.windDirectionDeg,
      windSpeedKt: currentWindSpeed ?? profile.windSpeedKt,
    });

    setPendingOverwriteProfile(null);

    if (result.success) {
      refreshProfiles();
      showNotification(`Updated "${profile.name}" with current map marks (${currentMarks.length} marks, ${currentMarksDistance} NM).`, 'success');
    } else {
      showNotification(result.error || 'Failed to update profile.', 'error');
    }
  };

  // Handle Edit Profile Details
  const handleStartEdit = (profile: CourseProfile) => {
    setEditingProfileId(profile.id);
    setEditName(profile.name);
    setEditDesc(profile.description || '');
  };

  const handleSaveEdit = (profileId: string) => {
    if (!editName.trim()) {
      showNotification('Profile name cannot be empty.', 'error');
      return;
    }
    const result = updateCourseProfile(profileId, {
      name: editName.trim(),
      description: editDesc.trim(),
    });
    if (result.success) {
      refreshProfiles();
      setEditingProfileId(null);
      showNotification('Course profile details updated.', 'success');
    } else {
      showNotification(result.error || 'Failed to update profile.', 'error');
    }
  };

  // Handle Delete (Instant inline execution without broken window.confirm)
  const executeDelete = (profile: CourseProfile) => {
    const result = deleteCourseProfile(profile.id);
    setPendingDeleteProfile(null);
    if (result.success) {
      refreshProfiles();
      showNotification(`Deleted course profile "${profile.name}".`, 'info');
    } else {
      showNotification(result.error || 'Failed to delete profile.', 'error');
    }
  };

  // Handle Duplicate
  const handleDuplicate = (profile: CourseProfile) => {
    if (isMaxReached) {
      showNotification(`Cannot duplicate: Maximum limit of ${MAX_COURSE_PROFILES} profiles reached. Please delete one first.`, 'error');
      return;
    }
    const result = duplicateCourseProfile(profile.id);
    if (result.success && result.profile) {
      refreshProfiles();
      showNotification(`Duplicated as "${result.profile.name}".`, 'success');
    } else {
      showNotification(result.error || 'Failed to duplicate profile.', 'error');
    }
  };

  // Handle Load / Apply Course
  const handleApply = (profile: CourseProfile, forceLocationMode?: 'USER_LOCATION' | 'ORIGINAL_GPS') => {
    const effectiveMode = forceLocationMode || placementMode;
    let targetMarks: CourseMark[] = profile.marks;

    if (effectiveMode === 'USER_LOCATION') {
      targetMarks = relocateCourseMarksToLocation(profile.marks, userLat, userLng);
      onApplyCourse(targetMarks, profile.name, profile.id);
      showNotification(
        `Applied "${profile.name}" (${targetMarks.length} marks) relocated to ${userLocationLabel} (${safeFixed(userLat, 3)}°, ${safeFixed(userLng, 3)}°).`,
        'success'
      );
    } else {
      onApplyCourse(targetMarks, profile.name, profile.id);
      showNotification(
        `Applied "${profile.name}" (${targetMarks.length} marks) at original saved GPS coordinates.`,
        'success'
      );
    }
  };

  // Handle JSON Export
  const handleExportJson = () => {
    const jsonStr = exportCourseProfilesJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tmtrac_course_profiles_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported course profiles JSON file.', 'success');
  };

  // Handle JSON Import
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const res = importCourseProfilesJson(content);
        if (res.success) {
          refreshProfiles();
          showNotification(`Successfully imported ${res.count} course profiles!`, 'success');
        } else {
          showNotification(res.error || 'Failed to import course profiles.', 'error');
        }
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // Handle Reset to Default
  const executeRestoreDefaults = () => {
    resetToDefaultProfiles();
    refreshProfiles();
    setShowRestoreConfirm(false);
    showNotification('Restored factory default course profiles.', 'info');
  };

  const filteredProfiles = profiles.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query)) ||
      (p.locationName && p.locationName.toLowerCase().includes(query))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 bg-canvas/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl max-h-[calc(100vh-120px)] sm:max-h-[85vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0 flex flex-col rounded-3xl landscape:rounded-2xl border shadow-2xl overflow-hidden ${
          'bg-surface/95 backdrop-blur-md text-ink border-line/80'
        }`}
      >
        {/* MODAL HEADER */}
        <div className="px-5 py-4 landscape:py-2.5 border-b border-line bg-canvas/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-warning-ink/15 border border-warning-ink/40 flex items-center justify-center text-warning-ink shadow-sm shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2 truncate">
                  Course Profiles
                </h2>
                <span
                  className={`text-xs  font-bold px-2.5 py-0.5 rounded-full border ${
                    isMaxReached
                      ? 'bg-danger/20 text-danger-ink border-danger-ink/40'
                      : 'bg-accent/15 text-accent border-accent/30'
                  }`}
                >
                  {profiles.length} / {MAX_COURSE_PROFILES} SAVED
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-raised/80 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STATUS NOTIFICATION BANNER */}
        {statusMessage && (
          <div
            className={`px-5 py-2.5 text-xs  font-bold flex items-center justify-between transition-all border-b ${
              statusMessage.type === 'success'
                ? 'bg-success-ink/15 text-success-ink border-success-ink/30'
                : statusMessage.type === 'error'
                ? 'bg-danger/15 text-danger-ink border-danger-ink/30'
                : 'bg-accent/15 text-accent border-accent/30'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* GLOBAL RESTORE FACTORY DEFAULTS CONFIRMATION BANNER */}
        {showRestoreConfirm && (
          <div className="px-5 py-3 bg-danger/15 border-b border-danger-ink/40 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2 text-xs text-danger-ink">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Restore factory presets (RLIR W/L, Olympic Triangle, Trapezoid)? Custom courses will be reset.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                className="px-3 py-1 bg-raised hover:bg-raised text-xs text-ink rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestoreDefaults}
                className="px-3 py-1 bg-danger hover:brightness-110 text-xs font-bold text-on-danger rounded-lg shadow-sm"
              >
                Yes, Restore Presets
              </button>
            </div>
          </div>
        )}

        {/* CAPACITY PROGRESS BAR */}
        <div className="w-full bg-surface h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              profiles.length >= 10
                ? 'bg-danger'
                : profiles.length >= 8
                ? 'bg-warning-ink'
                : 'bg-accent'
            }`}
            style={{ width: `${(profiles.length / MAX_COURSE_PROFILES) * 100}%` }}
          />
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {/* LOCATION PLACEMENT SELECTOR BANNER */}
          <div className="bg-surface border border-accent/30 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent">
                <Crosshair className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-ink flex items-center gap-2">
                  <span>Course Placement Location</span>
                  <span className="text-xs px-2 py-0.2 rounded-full bg-success-ink/15 text-success-ink border border-success-ink/30">
                    {userLocationLabel} ({safeFixed(userLat, 3)}°, ${safeFixed(userLng, 3)}°)
                  </span>
                </div>
                <p className="text-xs text-ink-muted">
                  {placementMode === 'USER_LOCATION'
                    ? 'Loading a course will automatically position the start line & marks at your current location.'
                    : 'Loading a course will use the original saved GPS coordinates.'}
                </p>
              </div>
            </div>

            {/* Toggle Modes */}
            <div className="flex items-center bg-surface p-1 rounded-xl border border-line">
              <button
                type="button"
                onClick={() => setPlacementMode('USER_LOCATION')}
                className={`px-3 py-1.5 rounded-lg text-xs  font-bold flex items-center gap-1.5 transition-all ${
                  placementMode === 'USER_LOCATION'
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
                title="Relocates course marks to your current location/venue"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>At My Location (Default)</span>
              </button>
              <button
                type="button"
                onClick={() => setPlacementMode('ORIGINAL_GPS')}
                className={`px-3 py-1.5 rounded-lg text-xs  font-bold flex items-center gap-1.5 transition-all ${
                  placementMode === 'ORIGINAL_GPS'
                    ? 'bg-warning-ink text-canvas shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
                title="Preserve exact original recorded coordinates"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Original Coordinates</span>
              </button>
            </div>
          </div>

          {/* TOP CONTROLS & NEW PROFILE ACCORDION */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-line p-3.5 rounded-2xl">
            <div className="flex-1 min-w-[240px]">
              <input
                type="text"
                placeholder="Search saved course profiles by name, notes, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-line rounded-xl px-3.5 py-2 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreatingNew((prev) => !prev)}
                disabled={isMaxReached && !isCreatingNew}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                  isCreatingNew
                    ? 'bg-raised text-ink'
                    : isMaxReached
                    ? 'bg-raised text-ink-muted cursor-not-allowed'
                    : 'bg-warning-ink hover:brightness-110 text-canvas'
                }`}
                title={isMaxReached ? 'Maximum of 10 course profiles reached' : 'Save current map course as a new profile'}
              >
                {isCreatingNew ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isCreatingNew ? 'Cancel' : 'Save Current Course (+)'}</span>
              </button>
            </div>
          </div>

          {/* SAVE CURRENT COURSE FORM ACCORDION */}
          {isCreatingNew && (
            <form
              onSubmit={handleSaveCurrentAsNew}
              className="bg-surface border-2 border-warning-ink/70 p-4 sm:p-5 rounded-2xl space-y-4 animate-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-warning-ink">
                  <Save className="w-4 h-4" />
                  <span>Save Current Active Course as New Profile</span>
                </div>
                <div className="text-xs text-ink-muted flex items-center gap-2">
                  <span>{currentMarks.length} Marks on Map</span>
                  <span>•</span>
                  <span>{currentMarksDistance} NM Total</span>
                  <span>•</span>
                  <span className="text-accent">{userLocationLabel}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">
                    Course Profile Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Langkawi 2-Lap Windward/Leeward"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder-ink-muted focus:border-warning-ink focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-ink-muted mb-1">
                    Description & Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1.2 NM beat to windward mark, port rounding"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder-ink-muted focus:border-warning-ink focus:outline-none"
                  />
                </div>
              </div>

              {/* Mark Chips Preview */}
              <div>
                <span className="block text-xs text-ink-muted mb-1.5">
                  Course Marks to be saved:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentMarks.map((m, idx) => (
                    <span
                      key={m.id || idx}
                      className="px-2 py-0.5 rounded-lg bg-surface border border-line text-xs text-accent flex items-center gap-1"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color || '#FBBC04' }} />
                      {m.shortName || m.name} ({m.type})
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 rounded-xl bg-surface border border-line text-xs text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-warning-ink hover:brightness-110 text-canvas text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Save className="w-3.5 h-3.5" /> Save Course Profile
                </button>
              </div>
            </form>
          )}

          {/* PROFILES GRID */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>Saved Course Profiles ({filteredProfiles.length})</span>
              <span>Sorted by Most Recent</span>
            </div>

            {filteredProfiles.length === 0 ? (
              <div className="p-8 text-center bg-surface border border-dashed border-line rounded-2xl space-y-2">
                <MapPin className="w-8 h-8 text-ink-muted mx-auto opacity-50" />
                <p className="text-sm text-ink-muted">No course profiles match your search.</p>
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  className="text-xs text-accent hover:underline"
                >
                  Restore default course presets
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredProfiles.map((profile) => {
                  const isActive = activeProfileId === profile.id;
                  const isEditingThis = editingProfileId === profile.id;
                  const isDeletingThis = pendingDeleteProfile?.id === profile.id;
                  const isOverwritingThis = pendingOverwriteProfile?.id === profile.id;
                  const totalDist = profile.totalDistanceNm || calculateTotalDistanceNm(profile.marks);

                  return (
                    <div
                      key={profile.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                        isActive
                          ? 'bg-surface border-accent '
                          : 'bg-surface border-line hover:border-line'
                      }`}
                    >
                      {/* CARD TOP: NAME & BADGES */}
                      <div>
                        {isEditingThis ? (
                          <div className="space-y-2 mb-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full bg-surface border border-accent rounded-lg px-2.5 py-1 text-xs text-ink focus:outline-none"
                              placeholder="Course Profile Name"
                            />
                            <input
                              type="text"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              className="w-full bg-surface border border-line rounded-lg px-2.5 py-1 text-xs text-ink-muted focus:outline-none"
                              placeholder="Description..."
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => setEditingProfileId(null)}
                                className="px-2.5 py-1 rounded bg-raised text-xs text-ink-muted"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(profile.id)}
                                className="px-3 py-1 rounded bg-accent text-xs font-bold text-on-accent"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-sm text-ink flex items-center gap-1.5">
                                  {profile.name}
                                </h3>
                                {isActive && (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-accent/20 text-accent border border-accent/40">
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              {profile.description && (
                                <p className="text-xs text-ink-muted font-sans mt-0.5 line-clamp-2">
                                  {profile.description}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(profile)}
                              className="p-1 rounded text-ink-muted hover:text-accent hover:bg-raised transition-colors"
                              title="Edit profile name & notes"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* METRICS & MARKS SUMMARY */}
                        <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-ink-muted">
                          <span className="px-2 py-0.5 rounded bg-surface border border-line text-ink font-bold flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-warning-ink" />
                            {profile.marks.length} Marks
                          </span>

                          <span className="px-2 py-0.5 rounded bg-surface border border-line text-success-ink font-bold">
                            {totalDist} NM
                          </span>

                          {profile.windDirectionDeg !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-surface border border-line text-success-ink flex items-center gap-1">
                              <Wind className="w-3 h-3" />
                              {profile.windDirectionDeg}°
                            </span>
                          )}

                          {profile.locationName && (
                            <span className="px-2 py-0.5 rounded bg-surface border border-line text-ink-muted truncate max-w-[150px]">
                              {profile.locationName}
                            </span>
                          )}
                        </div>

                        {/* MARK CHIPS VISUALIZER */}
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {profile.marks.slice(0, 7).map((m, idx) => (
                            <span
                              key={m.id || idx}
                              className="px-1.5 py-0.5 rounded text-xs bg-surface border border-line text-ink flex items-center gap-1"
                              title={`${m.name} (${m.type}) - ${safeFixed(m.lat, 4)}, ${safeFixed(m.lng, 4)}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color || '#FBBC04' }} />
                              {m.shortName || m.name}
                            </span>
                          ))}
                          {profile.marks.length > 7 && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-surface text-ink-muted">
                              +{profile.marks.length - 7} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* INLINE CONFIRMATION OVERLAYS FOR ROBUST ACTION HANDLING */}
                      {isDeletingThis ? (
                        <div className="p-2.5 rounded-xl bg-danger/20 border border-danger-ink/50 flex items-center justify-between gap-2 animate-in fade-in">
                          <div className="text-xs font-bold text-danger-ink flex items-center gap-1.5">
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Delete this course profile?</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPendingDeleteProfile(null)}
                              className="px-2 py-1 rounded bg-raised text-xs text-ink"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => executeDelete(profile)}
                              className="px-2.5 py-1 rounded bg-danger hover:brightness-110 text-xs font-bold text-on-danger shadow-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : isOverwritingThis ? (
                        <div className="p-2.5 rounded-xl bg-warning-ink/20 border border-warning-ink/50 flex items-center justify-between gap-2 animate-in fade-in">
                          <div className="text-xs font-bold text-warning-ink flex items-center gap-1.5">
                            <Save className="w-3.5 h-3.5 shrink-0" />
                            <span>Overwrite with current {currentMarks.length} map marks?</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPendingOverwriteProfile(null)}
                              className="px-2 py-1 rounded bg-raised text-xs text-ink"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => executeOverwrite(profile)}
                              className="px-2.5 py-1 rounded bg-warning-ink text-xs font-bold text-canvas shadow-sm"
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* CARD BOTTOM ACTION BUTTONS */
                        <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                          {/* PRIMARY LOAD BUTTON */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleApply(profile)}
                              className={`px-3 py-1.5 text-canvas text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all ${
                                placementMode === 'USER_LOCATION'
                                  ? 'bg-accent hover:brightness-110'
                                  : 'bg-warning-ink hover:brightness-110'
                              }`}
                              title={
                                placementMode === 'USER_LOCATION'
                                  ? `Load & center at ${userLocationLabel} (${safeFixed(userLat, 3)}, ${safeFixed(userLng, 3)})`
                                  : 'Load at original saved GPS coordinates'
                              }
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>
                                {placementMode === 'USER_LOCATION'
                                  ? 'Load @ My Location'
                                  : 'Load Course'}
                              </span>
                            </button>

                            {/* Alternate Direct Load Option Toggle */}
                            <button
                              type="button"
                              onClick={() =>
                                handleApply(
                                  profile,
                                  placementMode === 'USER_LOCATION' ? 'ORIGINAL_GPS' : 'USER_LOCATION'
                                )
                              }
                              className="p-1.5 rounded-lg bg-surface hover:bg-raised border border-line text-ink-muted hover:text-accent transition-colors"
                              title={
                                placementMode === 'USER_LOCATION'
                                  ? 'Load at original GPS coordinates instead'
                                  : `Load at ${userLocationLabel} instead`
                              }
                            >
                              {placementMode === 'USER_LOCATION' ? (
                                <Globe className="w-3.5 h-3.5" />
                              ) : (
                                <Crosshair className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* OVERWRITE WITH CURRENT MAP MARKS */}
                            <button
                              type="button"
                              onClick={() => setPendingOverwriteProfile(profile)}
                              className="p-1.5 rounded-lg bg-surface hover:bg-raised border border-line text-warning-ink transition-colors"
                              title="Overwrite this profile with marks currently placed on the map"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>

                            {/* DUPLICATE */}
                            <button
                              type="button"
                              onClick={() => handleDuplicate(profile)}
                              disabled={isMaxReached}
                              className="p-1.5 rounded-lg bg-surface hover:bg-raised border border-line text-ink-muted hover:text-ink disabled:opacity-30 transition-colors"
                              title="Duplicate profile"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* DELETE */}
                            <button
                              type="button"
                              onClick={() => setPendingDeleteProfile(profile)}
                              className="p-1.5 rounded-lg bg-danger/15 hover:bg-danger/30 border border-danger-ink/30 text-danger-ink transition-colors"
                              title="Delete profile"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER: BACKUP & PRESETS */}
        <div className="px-5 py-3.5 border-t border-line bg-surface/90 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-xl bg-surface hover:bg-raised border border-line text-ink-muted hover:text-ink flex items-center gap-1.5 transition-colors"
              title="Export all course profiles as a backup JSON file"
            >
              <Download className="w-3.5 h-3.5 text-accent" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-surface hover:bg-raised border border-line text-ink-muted hover:text-ink flex items-center gap-1.5 transition-colors"
              title="Import course profiles from a JSON file"
            >
              <Upload className="w-3.5 h-3.5 text-success-ink" />
              <span>Import JSON</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleImportJsonFile}
              className="hidden"
            />

            <button
              onClick={() => setShowRestoreConfirm(true)}
              className="px-3 py-1.5 rounded-xl bg-surface hover:bg-raised border border-line text-ink-muted hover:text-warning-ink flex items-center gap-1.5 transition-colors"
              title="Restore original factory presets"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Factory Presets</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-ink-muted">Max 10 course profiles</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-raised hover:bg-raised text-ink font-bold rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
