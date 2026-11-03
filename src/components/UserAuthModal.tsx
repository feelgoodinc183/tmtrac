import React, { useState } from 'react';
import {
  X,
  User,
  Lock,
  Mail,
  Anchor,
  Compass,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
  Award,
  Crown,
  ArrowRight,
} from 'lucide-react';
import { authService } from '../services/authService';
import { tenantService } from '../services/tenantService';
import { UserAccount } from '../types/regatta';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register-participant' | 'register-org';
  onSuccess?: (user: UserAccount) => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register-participant' | 'register-org'>(initialMode);
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');

  // Participant form fields
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [sailingClub, setSailingClub] = useState('');
  const [sailNumber, setSailNumber] = useState('');
  const [handicapRating, setHandicapRating] = useState('IRC 1.000');
  const [role, setRole] = useState<'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR'>('SKIPPER');

  // Organization registration fields
  const [orgName, setOrgName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set after club sign-up: the first room's random PINs are shown once before continuing
  const [createdRoom, setCreatedRoom] = useState<{ code: string; adminPin: string; participantPin: string; user: UserAccount } | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await authService.login(loginInput, password);
    setLoading(false);
    if (res.success && res.user) {
      await tenantService.fetchCurrentTenant();
      onSuccess?.(res.user);
      onClose();
    } else {
      setError(res.error || 'Failed to sign in. Please verify credentials.');
    }
  };

  const handleRegisterParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await authService.register({
      email,
      username,
      password,
      fullName,
      sailingClub,
      sailNumber,
      handicapRating,
      role,
    });
    setLoading(false);
    if (res.success && res.user) {
      onSuccess?.(res.user);
      onClose();
    } else {
      setError(res.error || 'Registration failed. Please check your inputs.');
    }
  };

  const handleRegisterOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await tenantService.registerOrganization({
      organizationName: orgName,
      adminEmail: email,
      adminUsername: username,
      password,
      fullName,
      sailingClub: orgName,
    });
    setLoading(false);
    if (res.success && res.user) {
      if (res.defaultEventCode && res.defaultRoomPins) {
        setCreatedRoom({ code: res.defaultEventCode, ...res.defaultRoomPins, user: res.user });
        return;
      }
      onSuccess?.(res.user);
      onClose();
    } else {
      setError(res.error || 'Failed to create organization. Please verify details.');
    }
  };

  const finishClubSetup = () => {
    if (createdRoom) onSuccess?.(createdRoom.user);
    setCreatedRoom(null);
    onClose();
  };

  if (createdRoom) {
    return (
      <div
        id="user-auth-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/85 backdrop-blur-md overflow-y-auto"
      >
        <div
          id="club-created-pins"
          className="bg-surface border border-line/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto flex flex-col text-ink"
        >
          <div className="p-4 sm:p-6 border-b border-line/80 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-success-ink/10 border border-success-ink/30 text-success-ink">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-ink">Club created</h2>
              <p className="text-xs text-ink-muted">Your first regatta room is ready. Note these PINs now.</p>
            </div>
          </div>
          <div className="p-6 space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-canvas/60 border border-line">
                <div className="text-xs text-ink-muted">Room code</div>
                <div className="text-lg font-bold text-accent">{createdRoom.code}</div>
              </div>
              <div className="p-3 rounded-xl bg-canvas/60 border border-line">
                <div className="text-xs text-ink-muted">Race Officer PIN</div>
                <div className="text-lg font-bold text-success-ink">{createdRoom.adminPin}</div>
              </div>
              <div className="p-3 rounded-xl bg-canvas/60 border border-line">
                <div className="text-xs text-ink-muted">Skipper PIN</div>
                <div className="text-lg font-bold text-warning-ink">{createdRoom.participantPin}</div>
              </div>
            </div>
            <ul className="text-xs text-ink-muted space-y-1.5 list-disc pl-4">
              <li>Give the Race Officer PIN only to people who run the race. It unlocks the RC Console.</li>
              <li>The Skipper PIN is built into the boat check-in QR cards, so skippers never type it.</li>
              <li>You can edit this room from your club account without a PIN.</li>
            </ul>
            <button
              type="button"
              onClick={finishClubSetup}
              className="w-full py-2.5 rounded-xl bg-accent hover:brightness-110 text-on-accent font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              I've noted the PINs <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="user-auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/85 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="user-auth-modal-container"
        className="bg-surface border border-line/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col text-ink"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-surface via-surface to-surface p-4 sm:p-6 border-b border-line/80 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent">
              {mode === 'register-org' ? <Building2 className="w-5 h-5" /> : <Anchor className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-ink">
                {mode === 'login' && 'Sign In to TMTRAC'}
                {mode === 'register-participant' && 'Participant Registration'}
                {mode === 'register-org' && 'Register Organization / Club'}
              </h2>
              <p className="text-xs text-ink-muted">
                {mode === 'login' && 'Access your organization events or participant vessel telemetry.'}
                {mode === 'register-participant' && 'Register your skipper or race crew account for live boat tracking.'}
                {mode === 'register-org' && 'Create your sailing club tenant with isolated regattas and plan limits.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-muted hover:text-ink rounded-lg hover:bg-raised transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 border-b border-line bg-canvas/40 text-xs">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`py-2.5 px-2 text-center transition-colors font-semibold cursor-pointer ${
              mode === 'login'
                ? 'border-b-2 border-accent text-accent bg-accent/5'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register-participant'); setError(null); }}
            className={`py-2.5 px-2 text-center transition-colors font-semibold cursor-pointer ${
              mode === 'register-participant'
                ? 'border-b-2 border-accent text-accent bg-accent/5'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Join as Sailor
          </button>
          <button
            type="button"
            onClick={() => { setMode('register-org'); setError(null); }}
            className={`py-2.5 px-2 text-center transition-colors font-semibold cursor-pointer ${
              mode === 'register-org'
                ? 'border-b-2 border-accent text-accent bg-accent/5'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Create Club
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-danger/15 border border-danger-ink/30 text-danger-ink text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-ink mb-1.5">Username or Email</label>
                <div className="relative">
                  <User className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="me@email.com"
                    className="w-full bg-canvas border border-line rounded-xl pl-9 pr-3 py-2.5 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-canvas border border-line rounded-xl pl-9 pr-3 py-2.5 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-accent to-accent hover:from-accent hover:to-accent text-ink font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* MODE 2: REGISTER PARTICIPANT */}
          {mode === 'register-participant' && (
            <form onSubmit={handleRegisterParticipant} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Captain Jack"
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="sailor_jack"
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jack@yacht.com"
                  className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-ink mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink mb-1">Sail Number</label>
                  <input
                    type="text"
                    value={sailNumber}
                    onChange={(e) => setSailNumber(e.target.value)}
                    placeholder="MAS 88"
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink mb-1">Participant Role</label>
                  <select
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  >
                    <option value="SKIPPER">Skipper / Helm</option>
                    <option value="RACE_OFFICER">Race Officer / Jury (your club admin approves)</option>
                    <option value="SPECTATOR">Spectator Only</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-success-ink to-accent hover:from-success-ink hover:to-accent text-ink font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Registering...' : 'Register as Participant'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* MODE 3: REGISTER ORGANIZATION (TENANT) */}
          {mode === 'register-org' && (
            <form onSubmit={handleRegisterOrg} className="space-y-3.5">
              <div className="p-3 rounded-xl bg-surface/30 border border-accent/40 text-xs text-accent">
                Creates an isolated <strong>Organization Tenant</strong> with Free tier limits (1 active event, 10 boats). You can upgrade anytime.
              </div>

              <div>
                <label className="block text-xs text-ink mb-1">Club or Organization Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Royal Selangor Yacht Club"
                    className="w-full bg-canvas border border-line rounded-xl pl-9 pr-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink mb-1">Admin Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Commodore Smith"
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink mb-1">Admin Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="rsyc_admin"
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink mb-1">Admin Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@rsyc.com.my"
                  className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-ink mb-1">Admin Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-accent to-accent hover:from-accent hover:to-accent text-ink font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Creating Tenant...' : 'Create Organization (Free Starter)'}
                <Crown className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
