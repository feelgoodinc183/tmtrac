import React, { useState, useEffect, useRef, useId } from 'react';
import {
  Compass,
  Radio,
  Trophy,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Eye,
  LogIn,
  CheckCircle2,
  Wind,
  Play,
  Map,
  Server,
  Zap,
} from 'lucide-react';
import { PricingPackage, UserAccount } from '../types/regatta';
import { APP_VERSION } from '../appVersion';
import { DialogFrame } from './ui/Dialog';

interface FrontLandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: (selectedTier?: string) => void;
  onViewRaceClick: (eventCode?: string) => void;
  onSuperAdminClick?: () => void;
  currentUser: UserAccount | null;
  onLogoutClick?: () => void;
}

export const FrontLandingPage: React.FC<FrontLandingPageProps> = ({
  onLoginClick,
  onRegisterClick,
  onViewRaceClick,
  onSuperAdminClick,
  currentUser,
  onLogoutClick,
}) => {
  const spectatorTitleId = useId();
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [activeEvents, setActiveEvents] = useState<Array<{ code: string; title: string; locationName: string; boatCount: number; status: string }>>([]);
  const [spectatorModalOpen, setSpectatorModalOpen] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load packages from server
  useEffect(() => {
    fetch('/api/packages')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.packages)) {
          setPackages(data.packages);
        }
      })
      .catch((err) => console.warn('Failed to load packages:', err))
      .finally(() => setLoadingPackages(false));

    const reloadPackages = () => {
      fetch('/api/packages')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.packages)) {
            setPackages(data.packages);
          }
        })
        .catch(() => {});
    };

    window.addEventListener('packages-updated', reloadPackages);

    // Load active public rooms for instant spectator picker
    fetch('/api/rooms/summary')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.rooms)) {
          setActiveEvents(
            data.rooms.map((r: any) => ({
              code: r.code,
              title: r.title,
              locationName: r.locationName,
              boatCount: r.boatCount || 0,
              status: r.raceStatus || 'PRE_START',
            }))
          );
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('packages-updated', reloadPackages);
    };
  }, []);

  // Canvas Regatta Radar Simulation (Apple/Google aesthetic interactive radar)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let t = 0;

    // Simulated boats
    const simulatedBoats = [
      { id: 'b1', name: 'Zuhal MAS 101', color: '#38bdf8', speed: 9.4, x: 220, y: 190, heading: 45, sail: 'MAS 101' },
      { id: 'b2', name: 'Team Hollywood', color: '#f59e0b', speed: 10.2, x: 200, y: 210, heading: 42, sail: 'AUS 88' },
      { id: 'b3', name: 'Mata Hari', color: '#10b981', speed: 8.9, x: 250, y: 170, heading: 48, sail: 'MAS 777' },
      { id: 'b4', name: 'Uranus MAS 8', color: '#ec4899', speed: 9.1, x: 180, y: 230, heading: 44, sail: 'MAS 8' },
    ];

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight || 340;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      t += 0.015;
      const w = canvas.width;
      const h = canvas.height;

      // Clean marine chart backdrop
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      // Fine coordinate lines
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.55)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Windward / Leeward Course Marks
      const centerX = w * 0.52;
      const centerY = h * 0.5;

      const markTop = { x: centerX + 110, y: centerY - 90, label: 'Windward Mark (W1)' };
      const markBottom = { x: centerX - 120, y: centerY + 90, label: 'Leeward Gate (L1)' };
      const pinStart = { x: centerX - 140, y: centerY + 50, label: 'Start Pin' };
      const committeeBoat = { x: centerX - 100, y: centerY + 70, label: 'RC Signal' };

      // Layline corridor
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.25)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(markTop.x, markTop.y);
      ctx.lineTo(markBottom.y ? markBottom.x : centerX, markBottom.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Start line
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pinStart.x, pinStart.y);
      ctx.lineTo(committeeBoat.x, committeeBoat.y);
      ctx.stroke();

      // Draw marks
      [markTop, markBottom].forEach((m) => {
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(m.label, m.x + 9, m.y + 3);
      });

      // Animated Boats
      simulatedBoats.forEach((b, i) => {
        const offset = i * 0.6;
        const progress = (t + offset) % 6;
        const ratio = progress / 6;

        // Waypoint interpolation from bottom to top mark
        const bx = markBottom.x + (markTop.x - markBottom.x) * ratio + Math.sin(t * 2 + i) * 15;
        const by = markBottom.y + (markTop.y - markBottom.y) * ratio + Math.cos(t * 2 + i) * 10;

        // Wake trail
        ctx.strokeStyle = b.color + '44';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(b.heading) * 35, by - Math.sin(b.heading) * 35);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Boat icon (triangle hull)
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(0.6 + Math.sin(t + i) * 0.1);

        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(5, 7);
        ctx.lineTo(-5, 7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();

        // Label
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(`${b.sail} • ${b.speed.toFixed(1)}kt`, bx + 10, by - 4);
      });

      // Wind Vector Indicator in Top-Right
      const windBoxX = w - 130;
      const windBoxY = 24;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.9)';
      ctx.lineWidth = 1;
      ctx.roundRect(windBoxX, windBoxY, 110, 46, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText('WIND: 13.8 kt', windBoxX + 12, windBoxY + 18);
      ctx.fillStyle = '#64748b';
      ctx.fillText('DIR: 215° SSW', windBoxX + 12, windBoxY + 34);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const handleJoinSpectator = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    const clean = inputCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!clean) {
      setCodeError('Please enter a regatta access code.');
      return;
    }

    setIsValidatingCode(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(clean)}/validate`);
      const data = await res.json();
      if (res.ok && data.valid && data.exists) {
        onViewRaceClick(clean);
        setSpectatorModalOpen(false);
      } else {
        setCodeError(data.error || `Regatta room code "${clean}" does not exist. Please check the code.`);
      }
    } catch (err) {
      setCodeError('Unable to connect to server to verify room code.');
    } finally {
      setIsValidatingCode(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-cyan-500 selection:text-white antialiased">
      {/* Top Floating Glass Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 border-b border-slate-200/90 px-4 sm:px-8 py-3.5 transition-all shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 ring-1 ring-black/5">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold tracking-tight text-lg text-slate-950">TMTRAC</span>
              </div>
            </div>
          </div>

          {/* Center Links (Minimal) */}
          <nav className="hidden md:flex items-center space-x-7 text-xs font-semibold text-slate-600">
            <a href="#features" className="hover:text-cyan-600 transition-colors">Platform</a>
            <a href="#radar" className="hover:text-cyan-600 transition-colors">Live Radar</a>
            <a href="#pricing" className="hover:text-cyan-600 transition-colors">Pricing & Plans</a>
            <button
              onClick={() => {
                setCodeError(null);
                setSpectatorModalOpen(true);
              }}
              className="hover:text-cyan-600 transition-colors flex items-center space-x-1"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-600" />
              <span>Watch Live</span>
            </button>
          </nav>

          {/* Right Action Stack */}
          <div className="flex items-center space-x-2.5">
            {currentUser?.isSuperAdmin && (
              <button
                onClick={onSuperAdminClick}
                className="hidden sm:flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all shadow-xs"
              >
                <Server className="w-3.5 h-3.5 text-purple-600" />
                <span>Super Admin</span>
              </button>
            )}

            {currentUser ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onViewRaceClick()}
                  className="flex items-center space-x-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-orange-700 hover:bg-orange-800 text-white border border-orange-800 transition-all shadow-sm shadow-orange-900/20"
                >
                  <Map className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>ENTER</span>
                </button>
                {onLogoutClick && (
                  <button
                    onClick={onLogoutClick}
                    className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1.5 transition-colors font-medium"
                  >
                    Logout
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onLoginClick}
                  className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-sm shadow-cyan-600/20"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section (Apple / Google Minimalist Style) */}
      <section className="relative pt-16 sm:pt-24 pb-14 px-4 sm:px-8 overflow-hidden bg-white">
        {/* Subtle Ambient Radial Lighting on White */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[360px] bg-gradient-to-tr from-cyan-400/15 via-sky-300/15 to-blue-400/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Live Status Pill */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/90 text-xs font-semibold text-slate-700 mb-6 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Next-Gen Satellite, LoRa & Cellular Sailing Telemetry</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 mb-6 leading-[1.12]">
            Precision Sailboat Tracker. <br />
            <span className="bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 bg-clip-text text-transparent">
              Offshore & Inshore.
            </span>
          </h1>

          {/* Subtitle with Minimalist Tags */}
          <p className="text-base sm:text-lg text-slate-600 font-normal max-w-2xl mx-auto mb-10 leading-relaxed">
            The multi-tenant sailing command platform. Live GNSS boat tracking, automated IRC handicap scoring, and spectator broadcast for yacht clubs and championship regattas worldwide.
          </p>

          {/* CORE USER CHOICES (View Race & Login) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto mb-12">
            {/* View Race (Spectator) */}
            <button
              onClick={() => {
                setCodeError(null);
                setSpectatorModalOpen(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 text-sm font-semibold px-7 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Eye className="w-4 h-4 text-white" />
              <span>View Race (Spectator)</span>
            </button>

            {/* Login */}
            <button
              onClick={onLoginClick}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 text-sm font-semibold px-7 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4 text-slate-500" />
              <span>Login</span>
            </button>
          </div>

          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto pt-6 border-t border-slate-200 text-left">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs">
              <div className="text-lg font-bold text-slate-950 flex items-center space-x-1.5">
                <span>Smart Race Control</span>
                <Zap className="w-3.5 h-3.5 text-cyan-600" />
              </div>
              <div className="text-xs text-slate-500 font-medium">Virtual Boundary Sensor </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs">
              <div className="text-lg font-bold text-slate-950 flex items-center space-x-1.5">
                <span>Mesh Network</span>
                <Radio className="w-3.5 h-3.5 text-sky-600" />
              </div>
              <div className="text-xs text-slate-500 font-medium">Dual LoRa + 5G Mobile</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs">
              <div className="text-lg font-bold text-slate-950 flex items-center space-x-1.5">
                <span>Auto-Rank</span>
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xs text-slate-500 font-medium">IRC / PHRF Corrected Time</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs">
              <div className="text-lg font-bold text-slate-950 flex items-center space-x-1.5">
                <span>Share Live Race</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xs text-slate-500 font-medium">Live Data Telemetry</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Live Radar Showcase */}
      <section id="radar" className="py-12 px-4 sm:px-8 max-w-6xl mx-auto w-full">
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          {/* Radar Header Bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-800">Interactive Telemetry Radar Simulator</span>
              <span className="text-slate-500 font-mono">| Kuah Bay Regatta Course (RLIR)</span>
            </div>
            <button
              onClick={() => onViewRaceClick()}
              className="text-xs text-cyan-600 hover:text-cyan-700 font-semibold flex items-center space-x-1"
            >
              <span>Launch Live Race Console</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Canvas Radar Container */}
          <div className="relative h-80 sm:h-96 w-full">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* Radar Overlay Bottom Ribbon */}
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg text-xs">
              <div className="flex items-center space-x-4">
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-semibold">Active Regatta</span>
                  <span className="text-slate-900 font-bold">Royal Langkawi International (RLIR26)</span>
                </div>
                <div className="hidden sm:block border-l border-slate-200 pl-4">
                  <span className="text-slate-500 block text-xs uppercase font-semibold">Course Layout</span>
                  <span className="text-slate-800 font-medium">Windward-Leeward (2.4 NM)</span>
                </div>
              </div>
              <button
                onClick={() => onViewRaceClick('RLIR26')}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors flex items-center space-x-1.5 shadow-sm"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Spectate This Race</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Feature Highlights (Clean, White Theme) */}
      <section id="features" className="py-16 px-4 sm:px-8 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
            Engineered for Ocean Racing
          </h2>
          <p className="text-slate-600 text-sm max-w-xl mx-auto">
            Everything your sailing club, jury, race officer, and spectators need in one unified, portable platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Feature 1 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center mb-4">
                <Radio className="w-5 h-5 text-cyan-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Dual-Path LoRa + 5G Mesh</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect long-range Meshtastic LoRa radios over Bluetooth or USB. Boats transmit offshore position fixes over miles of open water without needing cellular towers.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-cyan-700 font-semibold">
              868 / 915 MHz Zero-SIM Fallback
            </div>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                <Trophy className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Automated Corrected Scoring</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Instant virtual finish line detection with millisecond precision. Automatically computes corrected times under IRC, ORC, and Portsmouth Yardstick rating rules.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-amber-700 font-semibold">
              Real-Time Leaderboard Publishing
            </div>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Multi-Tenant Club Privacy</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Each yacht club is a fully isolated organization with its own events, members, and custom billing tier. Nothing is cross-shared or leaked between clubs.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-purple-700 font-semibold">
              Role Gates (Admin, Skipper, Spectator)
            </div>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Android & Mobile Ready</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Architected with store-and-forward telemetry buffers. When skippers sail through cellular blindspots, fixes buffer locally and automatically backfill upon reconnection.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-emerald-700 font-semibold">
              Native Android GPS & Deep Links
            </div>
          </div>

          {/* Feature 5 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-4">
                <Wind className="w-5 h-5 text-sky-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Tactical Laylines & Polar VMG</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Live wind vector arrows, current layline cones, mark rounding angle indicators, and Velocity Made Good (VMG) efficiency calculations for strategic race debriefs.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-sky-700 font-semibold">
              Tactical Race Replay Engine
            </div>
          </div>

          {/* Feature 6 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
                <Server className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Fast Registration</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Share boat registration QR code and viewer link to participants and viewers. Register and login on-the go with fast and easy boat to tracker binder. 
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-rose-700 font-semibold">
              Self-Service Registration
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Pricing Packages Section */}
      <section id="pricing" className="py-16 px-4 sm:px-8 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
            Simple and Transparent Plans
          </h2>
          <p className="text-slate-600 text-sm max-w-xl mx-auto">
            Choose the package that fits your yacht club, fleet size, and championship calendar. Upgrade or adjust anytime.
          </p>
        </div>

        {loadingPackages ? (
          <div className="text-center py-12 text-slate-500 text-xs">Loading live package tiers...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {packages.map((pkg) => {
              const isPopular = pkg.tierKey === 'CLUB' || pkg.badge?.toLowerCase().includes('popular');
              return (
                <div
                  key={pkg.id}
                  className={`relative p-7 rounded-2xl flex flex-col justify-between transition-all ${
                    isPopular
                      ? 'bg-white border-2 border-cyan-500 shadow-xl shadow-cyan-500/10'
                      : 'bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300'
                  }`}
                >
                  {pkg.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm">
                      {pkg.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{pkg.displayTitle}</h3>
                      <span className="text-xs text-slate-400 font-mono uppercase">{pkg.tierKey}</span>
                    </div>

                    <p className="text-xs text-slate-600 mb-6 min-h-[36px]">{pkg.description}</p>

                    <div className="flex items-baseline space-x-1 mb-6">
                      <span className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                        {pkg.priceAmount === 0 ? 'Free' : `${pkg.currencySymbol || '$'}${pkg.priceAmount}`}
                      </span>
                      {pkg.priceAmount > 0 && (
                        <span className="text-xs text-slate-500 font-medium">
                          /{pkg.billingInterval === 'event' ? 'event' : 'month'}
                        </span>
                      )}
                    </div>

                    {/* Limits Badge List */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 mb-6 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-500">Active Regattas:</span>
                        <span className="font-semibold text-slate-900">{pkg.maxActiveRooms} concurrently</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-500">Boats per Fleet:</span>
                        <span className="font-semibold text-slate-900">Up to {pkg.maxBoatsPerRoom} boats</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-500">Officer Seats:</span>
                        <span className="font-semibold text-slate-900">{pkg.maxAdminSeats} admins</span>
                      </div>
                    </div>

                    {/* Features checklist */}
                    <ul className="space-y-2.5 mb-8 text-xs text-slate-700">
                      {pkg.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => onRegisterClick(pkg.tierKey)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      isPopular
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {pkg.priceAmount === 0 ? 'Start Free' : `Choose ${pkg.displayTitle}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Spectator Quick Modal */}
      {spectatorModalOpen && (
        <DialogFrame
          onClose={() => setSpectatorModalOpen(false)}
          labelledBy={spectatorTitleId}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-slate-900"
        >
          <button
            aria-label="Close"
            onClick={() => setSpectatorModalOpen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-sm"
          >
            ✕
          </button>

          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 id={spectatorTitleId} className="text-base font-bold text-slate-900">Watch Regatta (Spectator)</h3>
              <p className="text-xs text-slate-500">No account required. Instant read-only telemetry.</p>
            </div>
          </div>

          <form onSubmit={handleJoinSpectator} className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Enter Regatta Access Code
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    setCodeError(null);
                  }}
                  placeholder="e.g. RLIR26 or LANGKAWI"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 uppercase placeholder-slate-400 focus:outline-none focus:border-cyan-500 font-mono tracking-wider"
                />
                <button
                  type="submit"
                  disabled={isValidatingCode}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs shadow-sm min-w-[70px] flex items-center justify-center"
                >
                  {isValidatingCode ? 'Checking...' : 'View'}
                </button>
              </div>
              {codeError && (
                <div className="mt-2 text-xs text-rose-600 font-medium flex items-start gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-2 animate-fade-in">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>{codeError}</span>
                </div>
              )}
            </div>
          </form>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Active Public Regattas
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeEvents.length === 0 ? (
                <div
                  onClick={() => {
                    onViewRaceClick('RLIR26');
                    setSpectatorModalOpen(false);
                  }}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/40 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xs text-slate-900">Royal Langkawi Regatta (RLIR26)</span>
                    <span className="text-xs text-cyan-700 font-mono font-medium">DEFAULT</span>
                  </div>
                  <div className="text-xs text-slate-500">Kuah Bay, Langkawi (RLYC)</div>
                </div>
              ) : (
                activeEvents.map((ev) => (
                  <div
                    key={ev.code}
                    onClick={() => {
                      onViewRaceClick(ev.code);
                      setSpectatorModalOpen(false);
                    }}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/40 cursor-pointer transition-colors flex justify-between items-center"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{ev.title}</div>
                      <div className="text-xs text-slate-500">{ev.locationName}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 font-mono font-semibold">
                      {ev.code}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogFrame>
      )}

      {/* Minimal Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-slate-50 py-8 px-4 sm:px-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-cyan-600" />
            <span className="font-semibold text-slate-700">TMTRAC by tmtecq.com </span>
            <span>• v{APP_VERSION}</span>
          </div>

          <div className="flex items-center space-x-6 text-slate-600">
            <button onClick={() => setSpectatorModalOpen(true)} className="hover:text-cyan-600 transition-colors">Spectator View</button>
            <button onClick={onLoginClick} className="hover:text-cyan-600 transition-colors">Club Admin</button>
            {currentUser?.isSuperAdmin ? (
              <button onClick={onSuperAdminClick} className="text-purple-600 font-semibold hover:text-purple-700 transition-colors">
                Super Admin Panel
              </button>
            ) : (
              <button onClick={onLoginClick} className="hover:text-slate-900 text-xs transition-colors">
                Super Admin Access
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
