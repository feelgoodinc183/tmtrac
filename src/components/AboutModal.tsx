import React from 'react';
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  ExternalLink,
  ShieldCheck,
  Compass,
  Radio,
  Sailboat,
  MessageCircle,
} from 'lucide-react';
import { APP_VERSION } from '../appVersion';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  directSunlightMode?: boolean;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  directSunlightMode = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-lb-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          'bg-lb-0b111e text-lt-e0e6ed border-ll-1e293b shadow-[0_20px_60px_rgba(0,0,0,0.8)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ll-1e293b bg-lb-0e1726/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-lb-00d4ff/15 border border-ll-00d4ff/40 text-lt-00d4ff flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-lt-white font-mono tracking-wide">
                About the System
              </h2>
              <p className="text-xs text-lt-94a3b8 font-mono">
                Regatta Live Telemetry & Tracking Platform
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="group p-2 rounded-xl bg-lb-1e293b/70 hover:bg-lb-rose-500/20 active:bg-lb-rose-500/30 border border-ll-slate-700/60 hover:border-ll-rose-500/40 text-lt-slate-400 hover:text-lt-rose-200 active:scale-95 transition-all duration-150 cursor-pointer shadow-xs focus:outline-none"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="w-5 h-5 pointer-events-none transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110 stroke-[2.2]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Main Developer Info Card */}
          <div className="p-4 rounded-2xl bg-lb-131e33/90 border border-ll-00d4ff/30 space-y-2.5 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-lb-00d4ff/20 text-lt-00d4ff border border-ll-00d4ff/40 inline-flex items-center gap-1 mb-1.5">
                  <ShieldCheck className="w-3 h-3" />
                  Official System Developer
                </span>
                <h3 className="text-base font-bold text-lt-white tracking-tight">
                  Tom Manas Technologies Sdn. Bhd.
                </h3>
                <p className="text-xs text-lt-00d4ff font-mono font-semibold">
                  Registered Company in Malaysia
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-lb-00d4ff/30 to-lb-1a73e8/20 border border-ll-00d4ff/40 flex items-center justify-center shrink-0">
                <Sailboat className="w-5 h-5 text-lt-00d4ff" />
              </div>
            </div>

            <p className="text-xs text-lt-cbd5e1 leading-relaxed">
              This system is proudly developed by{' '}
              <strong className="text-lt-white">Tom Manas Technologies Sdn. Bhd.</strong>, a Malaysian technology enterprise providing consultation, creative engineering, and high-performance software solutions for IoT telemetry, sports race management, marine timing networks, mobile systems, and digital platforms.
            </p>
          </div>

          {/* Quick Contact & Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* WhatsApp Contact */}
            <a
              href="https://wa.me/601111344522"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-2xl bg-lb-0f291e border border-ll-00ff9d/40 hover:bg-lb-133827 transition-all flex items-center gap-3 group text-left shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-lb-00ff9d text-lt-black flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MessageCircle className="w-5 h-5 fill-lt-black" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-mono text-lt-00ff9d font-bold block">
                  WhatsApp Contact
                </span>
                <span className="text-xs font-mono font-bold text-lt-white truncate block">
                  +601111344522
                </span>
              </div>
            </a>

            {/* Email Contact */}
            <a
              href="mailto:info@istmalaysia.my"
              className="p-3 rounded-2xl bg-lb-1a263d border border-ll-00d4ff/40 hover:bg-lb-1e3050 transition-all flex items-center gap-3 group text-left shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-lb-00d4ff text-lt-black flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-mono text-lt-00d4ff font-bold block">
                  Email Support
                </span>
                <span className="text-xs font-mono font-bold text-lt-white truncate block">
                  info@istmalaysia.my
                </span>
              </div>
            </a>
          </div>

          {/* Marine Partner & Affiliations */}
          <div className="p-4 rounded-2xl bg-lb-0f172a border border-ll-1e293b space-y-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-lt-fbbc04" />
              <h4 className="text-xs font-bold text-lt-white font-mono uppercase tracking-wider">
                Marine Partner & Technical Collaboration
              </h4>
            </div>

            <div className="space-y-2 text-xs text-lt-94a3b8">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-lb-fbbc04/20 text-lt-fbbc04 flex items-center justify-center shrink-0 mt-0.5">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-lt-white block">IST Malaysia (istmalaysia.my)</strong>
                  <span>
                    Founded in 2017, bringing premier marine, diving, snorkeling, and watersports equipment to Malaysia.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-lb-00d4ff/20 text-lt-00d4ff flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-lt-white block">Location & Operations</strong>
                  <span className="text-xs font-mono">
                    Unit 11 Block A Ground Floor, Flat PKNS, Jalan Tun Razak, 50400 Kuala Lumpur, Malaysia
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-lb-81c995/20 text-lt-81c995 flex items-center justify-center shrink-0 mt-0.5">
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-lt-white block">Marine Solutions & IoT</strong>
                  <span>
                    Specialized in LoRa Meshtastic long-range offshore radio telemetry, NMEA 0183 & AIS integration, and hybrid GPS tracking for sailing regattas.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-ll-1e293b flex items-center justify-between text-xs font-mono">
              <a
                href="https://istmalaysia.my"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lt-00d4ff hover:underline flex items-center gap-1 font-bold"
              >
                Visit istmalaysia.my <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-lt-64748b">v{APP_VERSION}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-ll-1e293b bg-lb-0e1726/70 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-lb-1e293b hover:bg-lb-334155 text-lt-white text-xs font-mono font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
