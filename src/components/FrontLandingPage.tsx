import React, { useState, useEffect, useRef, useId } from 'react';
import {
  Compass,
  Radio,
  Trophy,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Eye,
  CheckCircle2,
  Wind,
  X,
  AlertTriangle,
  CloudOff,
  Play,
  Map,
  Server,
} from 'lucide-react';
import { PricingPackage, UserAccount } from '../types/regatta';
import { APP_VERSION } from '../appVersion';
import { DialogFrame } from './ui/Dialog';
import { formatPrice } from '../utils/pricing';

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
  const codeInputId = useId();
  const codeErrorId = useId();
  const publicListId = useId();
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

  // Demo radar: simulated boats beating up a Windward-Leeward course. Drawn at the screen's pixel
  // density, still for people who ask for reduced motion, and only animated while on screen.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Made-up boats for the demo: no real names or sail numbers. Heading in degrees.
    const boats = [
      { color: '#0284c7', speed: 9.4, heading: 45, sail: 'Boat A' },
      { color: '#d97706', speed: 10.2, heading: 42, sail: 'Boat B' },
      { color: '#059669', speed: 8.9, heading: 48, sail: 'Boat C' },
      { color: '#db2777', speed: 9.1, heading: 44, sail: 'Boat D' },
    ];
    const font = '600 11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let w = 0;
    let h = 0;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = parent.clientWidth;
      h = parent.clientHeight || 340;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(203, 213, 225, 0.55)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }

      // On a narrow screen the course is tighter, so labels stay inside the drawing
      const scale = Math.min(1, w / 560);
      const cx = w * 0.5;
      const cy = h * 0.42;
      const markTop = { x: cx + 110 * scale, y: cy - 90 * scale, label: 'Windward mark' };
      const markBottom = { x: cx - 120 * scale, y: cy + 90 * scale, label: 'Leeward gate' };
      const pin = { x: cx - 140 * scale, y: cy + 50 * scale };
      const rc = { x: cx - 100 * scale, y: cy + 70 * scale };

      ctx.strokeStyle = 'rgba(2, 132, 199, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(markTop.x, markTop.y);
      ctx.lineTo(markBottom.x, markBottom.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pin.x, pin.y);
      ctx.lineTo(rc.x, rc.y);
      ctx.stroke();

      ctx.font = font;
      for (const m of [markTop, markBottom]) {
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#1e293b';
        ctx.fillText(m.label, m.x + 10, m.y + 4);
      }

      boats.forEach((b, i) => {
        // Spread along the beat so labels don't sit on top of each other
        const ratio = ((t + i * 1.5) % 6) / 6;
        const bx = markBottom.x + (markTop.x - markBottom.x) * ratio + Math.sin(t * 2 + i) * 15 * scale;
        const by = markBottom.y + (markTop.y - markBottom.y) * ratio + Math.cos(t * 2 + i) * 10 * scale;
        // Bearing (0 = north, clockwise) to screen direction; the wake trails behind the boat
        const rad = (b.heading * Math.PI) / 180;
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);

        ctx.strokeStyle = b.color + '55';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bx - dx * 30, by - dy * 30);
        ctx.lineTo(bx, by);
        ctx.stroke();

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rad);
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

        ctx.fillStyle = '#0f172a';
        ctx.fillText(`${b.sail} · ${b.speed.toFixed(1)} kt`, bx + 10, by - 4);
      });

      // Wind, top left, away from the boats' path
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(12, 12, 116, 44, 8);
      else ctx.rect(12, 12, 116, 44);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0369a1';
      ctx.fillText('Wind 13.8 kt', 24, 30);
      ctx.fillStyle = '#475569';
      ctx.fillText('From 215° SSW', 24, 47);
    };

    let animationId = 0;
    let running = false;
    let visible = true;
    let t = 1.2;
    const loop = () => {
      t += 0.015;
      draw(t);
      animationId = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduceMotion || !visible || document.hidden) return;
      running = true;
      animationId = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(animationId);
    };

    resize();
    draw(t);
    const onResize = () => {
      resize();
      draw(t);
    };
    window.addEventListener('resize', onResize);
    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) start();
          else stop();
        });
    observer?.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stop();
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
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

  // The free plan's limits, from the live plan so the hero never promises more than it gives
  const freePkg = packages.find((p) => p.priceAmount === 0 && p.isActive !== false);
  const freeLine = freePkg
    ? `Free for ${freePkg.maxActiveRooms === 1 ? 'one regatta' : `${freePkg.maxActiveRooms} regattas`} and up to ${freePkg.maxBoatsPerRoom} boats.`
    : 'Free to start.';

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-cyan-500 selection:text-white antialiased">
      {/* Top Floating Glass Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 border-b border-slate-200/90 px-4 sm:px-8 py-3.5 transition-all shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand */}
          <button type="button" aria-label="TMTRAC, back to top" className="flex items-center space-x-3 min-h-11" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 ring-1 ring-black/5">
              <Compass className="w-5 h-5 text-white motion-safe:animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold tracking-tight text-lg text-slate-950">TMTRAC</span>
              </div>
            </div>
          </button>

          {/* Center Links (Minimal) */}
          <nav className="hidden md:flex items-center space-x-5 text-sm font-semibold text-slate-600">
            <a href="#features" className="inline-flex items-center min-h-11 px-1 hover:text-cyan-800 transition-colors">Features</a>
            <a href="#radar" className="inline-flex items-center min-h-11 px-1 hover:text-cyan-800 transition-colors">Demo</a>
            <a href="#pricing" className="inline-flex items-center min-h-11 px-1 hover:text-cyan-800 transition-colors">Plans</a>
            <button
              onClick={() => {
                setCodeError(null);
                setSpectatorModalOpen(true);
              }}
              className="min-h-11 px-1 hover:text-cyan-800 transition-colors flex items-center space-x-1"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-700" />
              <span>Watch a race</span>
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
                  className="min-h-11 flex items-center space-x-1.5 text-sm font-bold px-3.5 rounded-lg bg-orange-700 hover:bg-orange-800 text-white border border-orange-800 transition-all shadow-sm shadow-orange-900/20"
                >
                  <Map className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>Open the app</span>
                </button>
                {onLogoutClick && (
                  <button
                    onClick={onLogoutClick}
                    className="min-h-11 text-sm text-slate-600 hover:text-slate-900 px-2 transition-colors font-medium"
                  >
                    Sign out
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onLoginClick}
                  className="min-h-11 text-sm font-semibold px-4 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white transition-all shadow-sm shadow-cyan-600/20"
                >
                  Sign in
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
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Sailing telemetry over LoRa radio and mobile data</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 mb-6 leading-[1.12] text-balance">
            Run your regatta <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 bg-clip-text text-transparent">
              from one screen.
            </span>
          </h1>

          {/* Subtitle with Minimalist Tags */}
          <p className="text-base sm:text-lg text-slate-600 font-normal max-w-2xl mx-auto mb-10 leading-relaxed">
            Track every boat over LoRa radio or a phone, run starts, recalls and finishes, and score IRC, ORC and Portsmouth. Families and sponsors follow the race live.
          </p>

          {/* Clubs start here; spectators have their own way in */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto mb-4">
            <button
              onClick={() => onRegisterClick('FREE')}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 text-sm font-semibold px-7 py-3 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white shadow-lg shadow-cyan-600/20 transition-all motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]"
            >
              <span>Start free</span>
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => {
                setCodeError(null);
                setSpectatorModalOpen(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 text-sm font-semibold px-7 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs transition-all motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]"
            >
              <Eye className="w-4 h-4 text-slate-500" />
              <span>Watch a race</span>
            </button>
          </div>
          <p className="text-sm text-slate-600 mb-12">
            {freeLine} Already have an account?{' '}
            <button onClick={onLoginClick} className="font-semibold text-cyan-700 hover:underline">
              Sign in
            </button>
          </p>

          {/* What sets it apart, in the race office's own terms */}
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto pt-6 border-t border-slate-200 text-left">
            {[
              {
                icon: <Radio className="w-4 h-4 text-cyan-700" />,
                title: 'Tracks without phone signal',
                body: 'Meshtastic LoRa radios carry positions across open water. Any phone can be a tracker too.',
              },
              {
                icon: <Trophy className="w-4 h-4 text-amber-600" />,
                title: 'Starts, recalls and finishes',
                body: 'Start sequence with AP, X flag and general recall. Finishes by GPS or one tap, timed from each class start.',
              },
              {
                icon: <CloudOff className="w-4 h-4 text-emerald-600" />,
                title: 'Keeps working when signal drops',
                body: 'Changes made offline are kept on the device and sent when the connection is back.',
              },
            ].map((d) => (
              <li key={d.title} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 font-bold text-slate-950">
                  {d.icon}
                  <span>{d.title}</span>
                </div>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{d.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Interactive Live Radar Showcase */}
      <section id="radar" className="py-12 px-4 sm:px-8 max-w-6xl mx-auto w-full">
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          {/* Radar Header Bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 text-xs">
            <div className="flex items-center space-x-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold uppercase tracking-wide">Demo</span>
              <span className="font-semibold text-slate-800">Simulated boats on a Windward-Leeward course</span>
            </div>
            <button
              onClick={() => onViewRaceClick()}
              className="min-h-11 text-sm text-cyan-700 hover:text-cyan-800 font-semibold flex items-center space-x-1"
            >
              <span>Open the race console</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Canvas Radar Container */}
          <div className="relative w-full">
            <div className="h-72 sm:h-96 w-full">
            <canvas
              ref={canvasRef}
              className="w-full h-full block"
              role="img"
              aria-label="Demo: four simulated boats sailing from the leeward gate up to the windward mark, each labelled with its speed."
            />
            </div>

            {/* Radar Overlay Bottom Ribbon */}
            {/* Under the drawing on phones, over its lower edge on wider screens */}
            <div className="m-3 sm:m-0 sm:absolute sm:bottom-4 sm:left-4 sm:right-4 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg text-sm">
              <div className="flex items-center space-x-4">
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-semibold">Demo</span>
                  <span className="text-slate-900 font-bold">This is a simulation, not a live race</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setCodeError(null);
                  setSpectatorModalOpen(true);
                }}
                className="min-h-11 px-4 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold transition-colors flex items-center space-x-1.5 shadow-sm"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Watch a real race</span>
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
          <p className="text-slate-600 text-base max-w-xl mx-auto">
            Everything your sailing club, jury, race officer, and spectators need in one unified, portable platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Feature 1 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center mb-4">
                <Radio className="w-5 h-5 text-cyan-700" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">LoRa Radio + Mobile Data</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Connect long-range Meshtastic LoRa radios over Bluetooth or USB. Boats transmit offshore position fixes over miles of open water without needing cellular towers.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-cyan-700 font-semibold">
              Meshtastic radios, no SIM needed
            </div>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                <Trophy className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Automated Corrected Scoring</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Finishes are timed from each class's start: by GPS when a tracker crosses the line, or with one tap from the race officer. Corrected times under IRC, ORC and Portsmouth Yardstick.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-amber-700 font-semibold">
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
              <p className="text-sm text-slate-600 leading-relaxed">
                Each yacht club is a fully isolated organization with its own events, members, and custom billing tier. Nothing is cross-shared or leaked between clubs.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-purple-700 font-semibold">
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
              <p className="text-sm text-slate-600 leading-relaxed">
                Architected with store-and-forward telemetry buffers. When skippers sail through cellular blindspots, fixes buffer locally and automatically backfill upon reconnection.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-emerald-700 font-semibold">
              Android app & phone browser tracking
            </div>
          </div>

          {/* Feature 5 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-4">
                <Wind className="w-5 h-5 text-sky-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">VMG, Head-to-Head & Replay</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Velocity Made Good for every boat on the leaderboard, a head-to-head comparison of any two boats, and a full race replay for debriefs.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-sky-700 font-semibold">
              Race replay for debriefs
            </div>
          </div>

          {/* Feature 6 */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
                <Server className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Fast Registration</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Share boat registration QR code and viewer link to participants and viewers. Register and login on-the go with fast and easy boat to tracker binder. 
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-rose-700 font-semibold">
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
          <p className="text-slate-600 text-base max-w-xl mx-auto">
            Choose the package that fits your yacht club, fleet size, and championship calendar. Upgrade or adjust anytime.
          </p>
        </div>

        {loadingPackages ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading plans…</div>
        ) : packages.length === 0 ? (
          <div className="text-center py-12 text-slate-600 text-sm">
            Plans couldn't be loaded. Refresh the page, or{' '}
            <button onClick={() => onRegisterClick('FREE')} className="font-semibold text-cyan-700 hover:underline">
              start free
            </button>{' '}
            and see them after signing up.
          </div>
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
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{pkg.displayTitle}</h3>

                    <p className="text-sm text-slate-600 mb-6 min-h-[36px]">{pkg.description}</p>

                    <div className="flex items-baseline space-x-1 mb-6">
                      <span className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                        {formatPrice(pkg.priceAmount, pkg.currencySymbol)}
                      </span>
                      {pkg.priceAmount > 0 && (
                        <span className="text-xs text-slate-500 font-medium">
                          /{pkg.billingInterval === 'event' ? 'event' : 'month'}
                        </span>
                      )}
                    </div>

                    {/* Limits Badge List */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 mb-6 space-y-1.5 text-sm">
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
                    <ul className="space-y-2.5 mb-8 text-sm text-slate-700">
                      {pkg.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => onRegisterClick(pkg.tierKey)}
                    className={`w-full min-h-11 rounded-xl text-sm font-bold transition-all shadow-sm ${
                      isPopular
                        ? 'bg-cyan-700 hover:bg-cyan-800 text-white shadow-cyan-600/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {pkg.priceAmount === 0 ? 'Start free' : `Choose ${pkg.displayTitle}`}
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
            className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>

          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 id={spectatorTitleId} className="text-base font-bold text-slate-900">Watch a race</h3>
              <p className="text-sm text-slate-600">No account needed. You see the race live; you can't change it.</p>
            </div>
          </div>

          <form onSubmit={handleJoinSpectator} className="space-y-4 mb-6">
            <div>
              <label htmlFor={codeInputId} className="block text-sm font-medium text-slate-700 mb-1.5">
                Event code
              </label>
              <div className="flex space-x-2">
                <input
                  id={codeInputId}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  aria-invalid={!!codeError}
                  aria-describedby={codeError ? codeErrorId : undefined}
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    setCodeError(null);
                  }}
                  placeholder="e.g. RLIR26 or LANGKAWI"
                  className="flex-1 min-w-0 min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-base text-slate-900 uppercase placeholder-slate-500 focus:border-cyan-600 font-mono tracking-wider"
                />
                <button
                  type="submit"
                  disabled={isValidatingCode}
                  className="min-h-11 px-4 rounded-xl bg-cyan-700 hover:bg-cyan-800 disabled:opacity-50 text-white font-bold text-sm shadow-sm min-w-[70px] flex items-center justify-center"
                >
                  {isValidatingCode ? 'Checking…' : 'Watch'}
                </button>
              </div>
              {codeError && (
                <div id={codeErrorId} role="alert" className="mt-2 text-sm text-rose-700 font-medium flex items-start gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{codeError}</span>
                </div>
              )}
            </div>
          </form>

          <div>
            <h4 id={publicListId} className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Public races
            </h4>
            {activeEvents.length === 0 ? (
              <p className="text-sm text-slate-600">No public races right now. Ask the race office for the event code.</p>
            ) : (
              <ul aria-labelledby={publicListId} className="space-y-2 max-h-48 overflow-y-auto">
                {activeEvents.map((ev) => (
                  <li key={ev.code}>
                    <button
                      type="button"
                      onClick={() => {
                        onViewRaceClick(ev.code);
                        setSpectatorModalOpen(false);
                      }}
                      className="w-full text-left p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-cyan-600 hover:bg-cyan-50/40 transition-colors flex justify-between items-center gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{ev.title}</span>
                        <span className="block text-sm text-slate-600">{ev.locationName}</span>
                      </span>
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 font-mono font-semibold">
                        {ev.code}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogFrame>
      )}

      {/* Minimal Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-slate-50 py-8 px-4 sm:px-8 text-sm text-slate-600">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-cyan-700" />
            <span className="font-semibold text-slate-700">TMTRAC by tmtecq.com </span>
            <span>• v{APP_VERSION}</span>
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-600">
            <button onClick={() => setSpectatorModalOpen(true)} className="min-h-11 px-1 hover:text-cyan-800 transition-colors">Watch a race</button>
            {!currentUser && (
              <button onClick={onLoginClick} className="min-h-11 px-1 hover:text-cyan-800 transition-colors">Sign in</button>
            )}
            {currentUser?.isSuperAdmin && (
              <button onClick={onSuperAdminClick} className="min-h-11 px-1 text-purple-700 font-semibold hover:text-purple-800 transition-colors">
                Super Admin Panel
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
