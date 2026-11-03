import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Trophy,
  Anchor,
  Wind,
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
  onOpenLobby: () => void;
  onOpenSuperAdmin?: () => void;
}

export const UserDashboardModal: React.FC<UserDashboardModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenCreateRoom,
  onOpenLobby,
  onOpenSuperAdmin,
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

  const isUniversalAdmin = user.email?.toLowerCase().trim() === 'irsyadismail@gmail.com';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="user-dashboard-modal-card"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col text-slate-100"
      >
        {/* Top Profile Banner - Responsive for Mobile & Desktop */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 relative">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-8 sm:pr-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 p-0.5 shadow shrink-0">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-cyan-400 font-bold text-sm sm:text-base">
                {user.fullName.charAt(0) || 'S'}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[160px] sm:max-w-none">
                  {user.fullName}
                </h2>
                <span className="px-2 py-0.5 bg-[#00D4FF]/10 border border-[#00D4FF]/40 text-[#00D4FF] text-[9px] sm:text-[10px] font-mono font-bold rounded-md uppercase tracking-wider shadow-sm shrink-0 inline-flex items-center">
                  {user.role === 'ADMIN'
                    ? 'Administrator'
                    : user.role === 'RACE_OFFICER'
                    ? 'Race Officer'
                    : user.role === 'SKIPPER'
                    ? 'Skipper'
                    : 'Member'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 flex flex-wrap items-center gap-1 sm:gap-1.5 font-mono min-w-0 mt-0.5">
                <span className="text-[#00D4FF]/90 font-medium shrink-0">@{user.username}</span>
                <span className="text-slate-600 shrink-0">•</span>
                <span className="text-slate-200 truncate max-w-[140px] sm:max-w-[220px] md:max-w-none">{user.sailingClub || 'Maritime Club'}</span>
                {user.sailNumber && (
                  <>
                    <span className="text-slate-600 shrink-0">•</span>
                    <span className="px-1.5 py-0.5 bg-cyan-950/70 border border-cyan-800/70 text-cyan-300 rounded font-semibold text-[9px] sm:text-[10px] shrink-0 inline-flex items-center">
                      {user.sailNumber}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end sm:justify-start gap-1.5 sm:gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
            {user?.isSuperAdmin && onOpenSuperAdmin && (
              <button
                id="dashboard-superadmin-btn"
                onClick={() => {
                  onClose();
                  onOpenSuperAdmin();
                }}
                className="px-2.5 py-1.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/70 text-purple-200 text-xs font-semibold rounded-lg transition shadow flex items-center justify-center gap-1 flex-1 sm:flex-initial"
              >
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>Super Admin</span>
              </button>
            )}
            <button
              id="dashboard-host-room-btn"
              onClick={() => {
                onClose();
                onOpenCreateRoom();
              }}
              className="px-2.5 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg transition shadow flex items-center justify-center gap-1 flex-1 sm:flex-initial"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Host Room</span>
            </button>
            <button
              id="dashboard-logout-btn"
              onClick={handleLogout}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-red-950/50 hover:text-red-300 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1 flex-1 sm:flex-initial"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
            <button
              id="dashboard-close-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition absolute top-2.5 right-2.5 sm:static sm:top-auto sm:right-auto sm:ml-0.5"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation - Scrollable on mobile vertical / horizontal */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-3 sm:px-6 gap-1 overflow-x-auto no-scrollbar">
          <button
            id="tab-dashboard-overview"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
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
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
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
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            Race History & Logbook
          </button>
          <button
            id="tab-dashboard-profile"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
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
                  ? 'border-amber-400 text-amber-400 bg-amber-950/20'
                  : 'border-transparent text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span>User Directory</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
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
                <div className="bg-slate-950/70 border border-slate-800 p-3 sm:p-4 rounded-xl">
                  <div className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Hosted Rooms
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white mt-1">{myRooms.length}</div>
                  <div className="text-[10px] text-cyan-400 mt-0.5">Regattas you host</div>
                </div>

                {[
                  'Participated',
                  'Podiums',
                  'Distance Logged',
                  'VMG Efficiency',
                  'Win / Podium Rate',
                ].map((label) => (
                  <div key={label} className="bg-slate-950/70 border border-slate-800 p-3 sm:p-4 rounded-xl">
                    <div className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      {label}
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-500 mt-1" aria-label="Not tracked yet">
                      —
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Not tracked yet</div>
                  </div>
                ))}
              </div>

              {/* Sailor Status Card */}
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      Regatta Accreditation & Yacht Dossier
                    </h3>
                    <p className="text-xs text-slate-400">
                      Authoritative status for international regattas and club races
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold rounded-full self-start sm:self-auto flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Skipper / RC
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <div className="text-slate-400 mb-1">Affiliated Club</div>
                    <div className="text-white font-semibold">{user.sailingClub || 'Independent'}</div>
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <div className="text-slate-400 mb-1">Registered Sail Number</div>
                    <div className="text-cyan-400 font-mono font-bold">{user.sailNumber || 'Unassigned'}</div>
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <div className="text-slate-400 mb-1">Handicap Certificate</div>
                    <div className="text-amber-300 font-mono font-bold">{user.handicapRating || 'Standard IRC'}</div>
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
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Hosted Regatta Sessions
                  </h3>
                  <p className="text-xs text-slate-400">
                    Rooms created under your account. You can launch, edit PINs, or delete sessions.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="refresh-my-rooms-btn"
                    onClick={loadUserRooms}
                    disabled={loadingRooms}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
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
                    className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Host New Regatta
                  </button>
                </div>
              </div>

              {loadingRooms ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Loading your hosted regatta rooms...
                </div>
              ) : myRooms.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-2xl">
                  <Anchor className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 font-semibold">No hosted rooms yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Create a regatta room to start hosting live fleet tracking, course mark layout, and race signals.
                  </p>
                  <button
                    id="empty-host-room-btn"
                    onClick={() => {
                      onClose();
                      onOpenCreateRoom();
                    }}
                    className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
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
                      className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-cyan-950 border border-cyan-800/80 text-cyan-300 font-mono font-bold text-xs rounded-md">
                            #{room.code}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-semibold rounded uppercase">
                            {room.raceStatus || 'PRE_START'}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white mb-1">
                          {room.title}
                        </h4>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-3">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{room.locationName}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 p-2 bg-slate-900/80 rounded-xl text-center text-xs mb-4">
                          <div>
                            <div className="text-slate-500 text-[10px]">Boats</div>
                            <div className="font-bold text-white">{room.boatCount || 0}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-[10px]">Marks</div>
                            <div className="font-bold text-white">{room.markCount || 0}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-[10px]">Active</div>
                            <div className="font-bold text-cyan-400">{room.activeClients || 1}</div>
                          </div>
                        </div>
                      </div>

                      {/* Management Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          id={`join-myroom-${room.code}`}
                          onClick={() => handleJoinRoom(room.code)}
                          className="flex-1 py-1.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Launch Room
                        </button>

                        <button
                          id={`edit-pin-myroom-${room.code}`}
                          onClick={() => setSelectedRoomForPin(room)}
                          className="p-1.5 text-slate-300 hover:text-amber-400 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition"
                          title="Edit Room PIN"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        <button
                          id={`delete-myroom-${room.code}`}
                          onClick={() => setSelectedRoomForDelete(room)}
                          className="p-1.5 text-slate-300 hover:text-red-400 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition"
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
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Sailing Regatta Logbook
                  </h3>
                  <p className="text-xs text-slate-400">
                    Official race participation, finish rankings, and race committee service
                  </p>
                </div>
              </div>

              {!user.raceHistory || user.raceHistory.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                  No historic regatta records found for this account.
                </div>
              ) : (
                <div className="space-y-3">
                  {user.raceHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {item.regattaName}
                          </span>
                          <span className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 font-mono text-[10px] rounded">
                            #{item.roomCode}
                          </span>
                          {item.rank && (
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 ${
                                item.rank === 1
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : item.rank === 2
                                  ? 'bg-slate-300/20 text-slate-200 border border-slate-400/40'
                                  : 'bg-amber-700/20 text-amber-400 border border-amber-700/40'
                              }`}
                            >
                              <Trophy className="w-3 h-3" />
                              Rank {item.rank} of {item.totalEntries || 10}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {item.date}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            {item.locationName}
                          </span>
                          {item.boatName && (
                            <>
                              <span>•</span>
                              <span className="text-slate-300 font-medium">{item.boatName}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto text-right">
                        <div>
                          <div className="text-xs font-semibold text-white uppercase">
                            {item.role === 'RACE_OFFICER' ? 'Race Officer' : 'Skipper'}
                          </div>
                          {item.elapsedTime && (
                            <div className="text-[11px] font-mono text-cyan-400">
                              {item.elapsedTime}
                            </div>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-bold rounded-lg ${
                            item.status === 'PODIUM'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                              : item.status === 'ORGANIZED'
                              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                              : 'bg-slate-800 text-slate-300'
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
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Edit Sailor Profile & Specifications
                </h3>
                <p className="text-xs text-slate-400">
                  Update your display name, affiliated sailing club, and handicap rating.
                </p>
              </div>

              {profileSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4 bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="profile-fullname-input"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Sailing Club or Association
                  </label>
                  <input
                    id="profile-club-input"
                    type="text"
                    value={sailingClub}
                    onChange={(e) => setSailingClub(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Default Sail Number
                    </label>
                    <input
                      id="profile-sailnumber-input"
                      type="text"
                      value={sailNumber}
                      onChange={(e) => setSailNumber(e.target.value)}
                      placeholder="e.g. MAS 2026"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Handicap / Rating
                    </label>
                    <input
                      id="profile-handicap-input"
                      type="text"
                      value={handicapRating}
                      onChange={(e) => setHandicapRating(e.target.value)}
                      placeholder="e.g. IRC 1.000"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <button
                  id="save-profile-btn"
                  type="submit"
                  disabled={profileSaving}
                  className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl text-xs sm:text-sm transition shadow disabled:opacity-50"
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
