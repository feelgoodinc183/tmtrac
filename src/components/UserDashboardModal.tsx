import React, { useState, useEffect } from 'react';
import {
  X,
  Trophy,
  Anchor,
  Shield,
  Calendar,
  MapPin,
  KeyRound,
  Trash2,
  ExternalLink,
  Plus,
  LogOut,
  Edit3,
  Award,
  BarChart2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { UserAccount, RegattaRoomSummary } from '../types/regatta';
import { authService } from '../services/authService';
import { roomService } from '../services/roomService';
import { RoomPinModal, RoomDeleteModal } from './RoomManagementModals';
import { AdminUserManagement } from './AdminUserManagement';

interface UserDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount | null;
  onOpenCreateRoom: () => void;
}

export const UserDashboardModal: React.FC<UserDashboardModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenCreateRoom,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'my_rooms' | 'history' | 'profile' | 'admin_users'>('overview');
  const [myRooms, setMyRooms] = useState<RegattaRoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Profile edit states
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [sailingClub, setSailingClub] = useState(user?.sailingClub || '');
  const [sailNumber, setSailNumber] = useState(user?.sailNumber || '');
  const [handicapRating, setHandicapRating] = useState(user?.handicapRating || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Pin & Delete Modals for specific rooms
  const [selectedRoomForPin, setSelectedRoomForPin] = useState<RegattaRoomSummary | null>(null);
  const [selectedRoomForDelete, setSelectedRoomForDelete] = useState<RegattaRoomSummary | null>(null);

  const loadUserRooms = async () => {
    setLoadingRooms(true);
    const rooms = await roomService.fetchMyRooms();
    setMyRooms(rooms);
    setLoadingRooms(false);
  };

  useEffect(() => {
    if (isOpen && user) {
      setFullName(user.fullName);
      setSailingClub(user.sailingClub);
      setSailNumber(user.sailNumber || '');
      setHandicapRating(user.handicapRating || '');
      loadUserRooms();
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const isUniversalAdmin = !!user.isSuperAdmin;
  // Club admins manage their own club's members; the server limits what each admin can see and change
  const canManageUsers = isUniversalAdmin || !!user.isSuperAdmin || user.role === 'ADMIN';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(false);
    const res = await authService.updateProfile({
      fullName,
      sailingClub,
      sailNumber,
      handicapRating,
    });
    setProfileSaving(false);
    if (res.success) {
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    onClose();
  };

  const handleJoinRoom = async (code: string) => {
    await roomService.switchRoom(code);
    onClose();
  };

  if (!isOpen || !user) return null;

  return (
    <div
      id="user-dashboard-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-canvas/85 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="user-dashboard-modal-card"
        className="bg-surface border border-line/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col text-ink"
      >
        {/* Top Profile Banner - Responsive for Mobile & Desktop */}
        <div className="bg-gradient-to-r from-canvas via-surface to-canvas px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 relative">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-8 sm:pr-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-accent to-accent p-0.5 shadow shrink-0">
              <div className="w-full h-full bg-surface rounded-[10px] flex items-center justify-center text-accent font-bold text-sm sm:text-base">
                {user.fullName.charAt(0) || 'S'}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-base font-bold text-ink truncate max-w-[160px] sm:max-w-none">
                  {user.fullName}
                </h2>
                <span className="px-2 py-0.5 bg-accent/10 border border-accent/40 text-accent text-xs sm:text-xs font-bold rounded-md shadow-sm shrink-0 inline-flex items-center">
                  {user.role === 'ADMIN'
                    ? 'Administrator'
                    : user.role === 'RACE_OFFICER'
                    ? 'Race Officer'
                    : user.role === 'SKIPPER'
                    ? 'Skipper'
                    : 'Member'}
                </span>
              </div>
              <p className="text-xs sm:text-xs text-ink-muted flex flex-wrap items-center gap-1 sm:gap-1.5 min-w-0 mt-0.5">
                <span className="text-accent/90 font-medium shrink-0">@{user.username}</span>
                <span className="text-ink-muted shrink-0">•</span>
                <span className="text-ink truncate max-w-[140px] sm:max-w-[220px] md:max-w-none">{user.sailingClub || 'Maritime Club'}</span>
                {user.sailNumber && (
                  <>
                    <span className="text-ink-muted shrink-0">•</span>
                    <span className="px-1.5 py-0.5 bg-surface/70 border border-accent/70 text-accent rounded font-semibold text-xs sm:text-xs shrink-0 inline-flex items-center">
                      {user.sailNumber}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end sm:justify-start gap-1.5 sm:gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-line/60">
            <button
              id="dashboard-host-room-btn"
              onClick={() => {
                onClose();
                onOpenCreateRoom();
              }}
              className="px-2.5 py-1.5 bg-gradient-to-r from-accent to-accent hover:from-accent hover:to-accent text-ink text-xs font-semibold rounded-lg transition shadow flex items-center justify-center gap-1 flex-1 sm:flex-initial"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Host Room</span>
            </button>
            <button
              id="dashboard-logout-btn"
              onClick={handleLogout}
              className="px-2.5 py-1.5 bg-raised/80 hover:bg-surface/50 hover:text-danger-ink border border-line text-ink text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1 flex-1 sm:flex-initial"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
            <button
              id="dashboard-close-btn"
              onClick={onClose}
              className="p-1.5 text-ink-muted hover:text-ink rounded-lg hover:bg-raised transition absolute top-2.5 right-2.5 sm:static sm:top-auto sm:right-auto sm:ml-0.5"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation - Scrollable on mobile vertical / horizontal */}
        <div className="flex border-b border-line bg-canvas/60 px-3 sm:px-6 gap-1 overflow-x-auto no-scrollbar">
          <button
            id="tab-dashboard-overview"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Overview & Performance
          </button>
          <button
            id="tab-dashboard-myrooms"
            onClick={() => {
              setActiveTab('my_rooms');
              loadUserRooms();
            }}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'my_rooms'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Anchor className="w-4 h-4" />
            My Hosted Rooms ({myRooms.length})
          </button>
          <button
            id="tab-dashboard-history"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Trophy className="w-4 h-4 text-warning-ink" />
            Race History & Logbook
          </button>
          <button
            id="tab-dashboard-profile"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            Profile & Yacht Specs
          </button>

          {canManageUsers && (
            <button
              id="tab-dashboard-admin-users"
              onClick={() => setActiveTab('admin_users')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                activeTab === 'admin_users'
                  ? 'border-warning-ink text-warning-ink bg-surface/20'
                  : 'border-transparent text-warning-ink/80 hover:text-warning-ink'
              }`}
            >
              <Shield className="w-4 h-4 text-warning-ink" />
              <span>User Directory</span>
              <span className="px-1.5 py-0.2 rounded bg-warning-ink/20 text-warning-ink text-xs font-bold border border-warning-ink/30">
                ADMIN
              </span>
            </button>
          )}
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: OVERVIEW & PERFORMANCE */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Performance tiles. Only Hosted Rooms is backed by real data today; the others are
                  not recorded by the app yet, so they say so instead of showing a number. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-canvas/70 border border-line p-3 sm:p-4 rounded-xl">
                  <div className="text-xs sm:text-xs text-ink-muted font-semibold">
                    Hosted Rooms
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-ink mt-1">{myRooms.length}</div>
                  <div className="text-xs text-accent mt-0.5">Regattas you host</div>
                </div>

                {[
                  'Participated',
                  'Podiums',
                  'Distance Logged',
                  'VMG Efficiency',
                  'Win / Podium Rate',
                ].map((label) => (
                  <div key={label} className="bg-canvas/70 border border-line p-3 sm:p-4 rounded-xl">
                    <div className="text-xs sm:text-xs text-ink-muted font-semibold">
                      {label}
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-ink-muted mt-1" aria-label="Not tracked yet">
                      —
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">Not tracked yet</div>
                  </div>
                ))}
              </div>

              {/* Sailor Status Card */}
              <div className="bg-gradient-to-br from-canvas to-surface border border-line rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-ink flex items-center gap-2">
                      <Award className="w-5 h-5 text-warning-ink" />
                      Regatta Accreditation & Yacht Dossier
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Authoritative status for international regattas and club races
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-surface/60 border border-success-ink/60 text-success-ink text-xs font-semibold rounded-full self-start sm:self-auto flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Skipper / RC
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
                  <div className="p-3 bg-surface/80 rounded-xl border border-line">
                    <div className="text-ink-muted mb-1">Affiliated Club</div>
                    <div className="text-ink font-semibold">{user.sailingClub || 'Independent'}</div>
                  </div>
                  <div className="p-3 bg-surface/80 rounded-xl border border-line">
                    <div className="text-ink-muted mb-1">Registered Sail Number</div>
                    <div className="text-accent font-bold">{user.sailNumber || 'Unassigned'}</div>
                  </div>
                  <div className="p-3 bg-surface/80 rounded-xl border border-line">
                    <div className="text-ink-muted mb-1">Handicap Certificate</div>
                    <div className="text-warning-ink font-bold">{user.handicapRating || 'Standard IRC'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MY HOSTED ROOMS */}
          {activeTab === 'my_rooms' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-ink">
                    Hosted Regatta Sessions
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Rooms created under your account. You can launch, edit PINs, or delete sessions.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="refresh-my-rooms-btn"
                    onClick={loadUserRooms}
                    disabled={loadingRooms}
                    className="p-2 text-ink-muted hover:text-ink bg-raised hover:bg-raised rounded-xl transition"
                    title="Refresh rooms"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingRooms ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    id="myrooms-host-btn"
                    onClick={() => {
                      onClose();
                      onOpenCreateRoom();
                    }}
                    className="px-3 py-2 bg-accent hover:brightness-110 text-on-accent text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Host New Regatta
                  </button>
                </div>
              </div>

              {loadingRooms ? (
                <div className="p-8 text-center text-ink-muted text-xs">
                  Loading your hosted regatta rooms...
                </div>
              ) : myRooms.length === 0 ? (
                <div className="p-8 text-center bg-canvas/60 border border-line rounded-2xl">
                  <Anchor className="w-8 h-8 text-ink-muted mx-auto mb-2" />
                  <p className="text-sm text-ink font-semibold">No hosted rooms yet</p>
                  <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
                    Create a regatta room to start hosting live fleet tracking, course mark layout, and race signals.
                  </p>
                  <button
                    id="empty-host-room-btn"
                    onClick={() => {
                      onClose();
                      onOpenCreateRoom();
                    }}
                    className="mt-4 px-4 py-2 bg-accent hover:brightness-110 text-on-accent text-xs font-semibold rounded-xl inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Host Your First Regatta
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {myRooms.map((room) => (
                    <div
                      key={room.code}
                      className="p-4 bg-canvas/70 border border-line rounded-2xl flex flex-col justify-between hover:border-line transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-surface border border-accent/80 text-accent font-bold text-xs rounded-md">
                            #{room.code}
                          </span>
                          <span className="px-2 py-0.5 bg-raised text-ink text-xs font-semibold rounded">
                            {room.raceStatus || 'PRE_START'}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-ink mb-1">
                          {room.title}
                        </h4>
                        <div className="text-xs text-ink-muted flex items-center gap-1.5 mb-3">
                          <MapPin className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                          <span className="truncate">{room.locationName}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 p-2 bg-surface/80 rounded-xl text-center text-xs mb-4">
                          <div>
                            <div className="text-ink-muted text-xs">Boats</div>
                            <div className="font-bold text-ink">{room.boatCount || 0}</div>
                          </div>
                          <div>
                            <div className="text-ink-muted text-xs">Marks</div>
                            <div className="font-bold text-ink">{room.markCount || 0}</div>
                          </div>
                          <div>
                            <div className="text-ink-muted text-xs">Active</div>
                            <div className="font-bold text-accent">{room.activeClients || 1}</div>
                          </div>
                        </div>
                      </div>

                      {/* Management Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-line/80">
                        <button
                          id={`join-myroom-${room.code}`}
                          onClick={() => handleJoinRoom(room.code)}
                          className="flex-1 py-1.5 px-3 bg-accent hover:brightness-110 text-on-accent text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Launch Room
                        </button>

                        <button
                          id={`edit-pin-myroom-${room.code}`}
                          onClick={() => setSelectedRoomForPin(room)}
                          className="p-1.5 text-ink hover:text-warning-ink bg-raised hover:bg-slate-750 border border-line rounded-lg transition"
                          title="Edit Room PIN"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        <button
                          id={`delete-myroom-${room.code}`}
                          onClick={() => setSelectedRoomForDelete(room)}
                          className="p-1.5 text-ink hover:text-danger-ink bg-raised hover:bg-slate-750 border border-line rounded-lg transition"
                          title="Delete Room"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RACE HISTORY & LOGBOOK */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-ink">
                    Sailing Regatta Logbook
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Official race participation, finish rankings, and race committee service
                  </p>
                </div>
              </div>

              {!user.raceHistory || user.raceHistory.length === 0 ? (
                <div className="p-8 text-center bg-canvas/60 border border-line rounded-2xl text-ink-muted text-xs">
                  No historic regatta records found for this account.
                </div>
              ) : (
                <div className="space-y-3">
                  {user.raceHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 bg-canvas/70 border border-line rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-ink">
                            {item.regattaName}
                          </span>
                          <span className="px-1.5 py-0.5 bg-raised text-accent text-xs rounded">
                            #{item.roomCode}
                          </span>
                          {item.rank && (
                            <span
                              className={`px-2 py-0.5 text-xs font-bold rounded flex items-center gap-1 ${
                                item.rank === 1
                                  ? 'bg-warning-ink/20 text-warning-ink border border-warning-ink/40'
                                  : item.rank === 2
                                  ? 'bg-ink/20 text-ink border border-line/40'
                                  : 'bg-warning-ink/20 text-warning-ink border border-warning-ink/40'
                              }`}
                            >
                              <Trophy className="w-3 h-3" />
                              Rank {item.rank} of {item.totalEntries || 10}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-ink-muted flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-ink-muted" />
                            {item.date}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-ink-muted" />
                            {item.locationName}
                          </span>
                          {item.boatName && (
                            <>
                              <span>•</span>
                              <span className="text-ink font-medium">{item.boatName}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto text-right">
                        <div>
                          <div className="text-xs font-semibold text-ink">
                            {item.role === 'RACE_OFFICER' ? 'Race Officer' : 'Skipper'}
                          </div>
                          {item.elapsedTime && (
                            <div className="text-xs text-accent">
                              {item.elapsedTime}
                            </div>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-bold rounded-lg ${
                            item.status === 'PODIUM'
                              ? 'bg-surface/80 text-warning-ink border border-warning-ink'
                              : item.status === 'ORGANIZED'
                              ? 'bg-surface/80 text-accent border border-accent'
                              : 'bg-raised text-ink'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROFILE & YACHT SPECS */}
          {activeTab === 'profile' && (
            <div className="max-w-xl mx-auto space-y-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-ink">
                  Edit Sailor Profile & Specifications
                </h3>
                <p className="text-xs text-ink-muted">
                  Update your display name, affiliated sailing club, and handicap rating.
                </p>
              </div>

              {profileSuccess && (
                <div className="p-3 bg-surface/60 border border-success-ink text-success-ink text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success-ink shrink-0" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4 bg-canvas/60 p-4 sm:p-5 rounded-2xl border border-line">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="profile-fullname-input"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Sailing Club or Association
                  </label>
                  <input
                    id="profile-club-input"
                    type="text"
                    value={sailingClub}
                    onChange={(e) => setSailingClub(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      Default Sail Number
                    </label>
                    <input
                      id="profile-sailnumber-input"
                      type="text"
                      value={sailNumber}
                      onChange={(e) => setSailNumber(e.target.value)}
                      placeholder="e.g. MAS 2026"
                      className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      Handicap / Rating
                    </label>
                    <input
                      id="profile-handicap-input"
                      type="text"
                      value={handicapRating}
                      onChange={(e) => setHandicapRating(e.target.value)}
                      placeholder="e.g. IRC 1.000"
                      className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <button
                  id="save-profile-btn"
                  type="submit"
                  disabled={profileSaving}
                  className="w-full py-2.5 px-4 bg-accent hover:brightness-110 text-on-accent font-semibold rounded-xl text-xs sm:text-sm transition shadow disabled:opacity-50"
                >
                  {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 5: USER MANAGEMENT (club admins: own club; Super Admin: everyone) */}
          {activeTab === 'admin_users' && canManageUsers && (
            <AdminUserManagement currentUser={user} />
          )}
        </div>
      </div>

      {/* Sub-modals for Room Management */}
      {selectedRoomForPin && (
        <RoomPinModal
          isOpen={!!selectedRoomForPin}
          onClose={() => setSelectedRoomForPin(null)}
          roomCode={selectedRoomForPin.code}
          roomTitle={selectedRoomForPin.title}
          isOwner={true}
          onUpdated={loadUserRooms}
        />
      )}

      {selectedRoomForDelete && (
        <RoomDeleteModal
          isOpen={!!selectedRoomForDelete}
          onClose={() => setSelectedRoomForDelete(null)}
          roomCode={selectedRoomForDelete.code}
          roomTitle={selectedRoomForDelete.title}
          isOwner={true}
          onDeleted={loadUserRooms}
        />
      )}
    </div>
  );
};
