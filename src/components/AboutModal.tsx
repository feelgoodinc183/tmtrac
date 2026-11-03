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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          directSunlightMode
            ? 'bg-black text-white border-white'
            : 'bg-[#0B111E] text-[#E0E6ED] border-[#1E293B] shadow-[0_20px_60px_rgba(0,0,0,0.8)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B] bg-[#0E1726]/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00D4FF]/15 border border-[#00D4FF]/40 text-[#00D4FF] flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white font-mono tracking-wide">
                About the System
              </h2>
              <p className="text-[11px] text-[#94A3B8] font-mono">
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
            className="group p-2 rounded-xl bg-[#1E293B]/70 hover:bg-rose-500/20 active:bg-rose-500/30 border border-slate-700/60 hover:border-rose-500/40 text-slate-400 hover:text-rose-200 active:scale-95 transition-all duration-150 cursor-pointer shadow-xs focus:outline-none"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="w-5 h-5 pointer-events-none transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110 stroke-[2.2]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Main Developer Info Card */}
          <div className="p-4 rounded-2xl bg-[#131E33]/90 border border-[#00D4FF]/30 space-y-2.5 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 inline-flex items-center gap-1 mb-1.5">
                  <ShieldCheck className="w-3 h-3" />
                  Official System Developer
                </span>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Tom Manas Technologies Sdn. Bhd.
                </h3>
                <p className="text-xs text-[#00D4FF] font-mono font-semibold">
                  Registered Company in Malaysia
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00D4FF]/30 to-[#1A73E8]/20 border border-[#00D4FF]/40 flex items-center justify-center shrink-0">
                <Sailboat className="w-5 h-5 text-[#00D4FF]" />
              </div>
            </div>

            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              This system is proudly developed by{' '}
              <strong className="text-white">Tom Manas Technologies Sdn. Bhd.</strong>, a Malaysian technology enterprise providing consultation, creative engineering, and high-performance software solutions for IoT telemetry, sports race management, marine timing networks, mobile systems, and digital platforms.
            </p>
          </div>

          {/* Quick Contact & Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* WhatsApp Contact */}
            <a
              href="https://wa.me/601111344522"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-2xl bg-[#0F291E] border border-[#00FF9D]/40 hover:bg-[#133827] transition-all flex items-center gap-3 group text-left shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-[#00FF9D] text-black flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MessageCircle className="w-5 h-5 fill-black" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-[#00FF9D] font-bold block">
                  WhatsApp Contact
                </span>
                <span className="text-xs font-mono font-bold text-white truncate block">
                  +601111344522
                </span>
              </div>
            </a>

            {/* Email Contact */}
            <a
              href="mailto:info@istmalaysia.my"
              className="p-3 rounded-2xl bg-[#1A263D] border border-[#00D4FF]/40 hover:bg-[#1E3050] transition-all flex items-center gap-3 group text-left shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-[#00D4FF] text-black flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-[#00D4FF] font-bold block">
                  Email Support
                </span>
                <span className="text-xs font-mono font-bold text-white truncate block">
                  info@istmalaysia.my
                </span>
              </div>
            </a>
          </div>

          {/* Marine Partner & Affiliations */}
          <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#1E293B] space-y-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#FBBC04]" />
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                Marine Partner & Technical Collaboration
              </h4>
            </div>

            <div className="space-y-2 text-xs text-[#94A3B8]">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-[#FBBC04]/20 text-[#FBBC04] flex items-center justify-center shrink-0 mt-0.5">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-white block">IST Malaysia (istmalaysia.my)</strong>
                  <span>
                    Founded in 2017, bringing premier marine, diving, snorkeling, and watersports equipment to Malaysia.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-[#00D4FF]/20 text-[#00D4FF] flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-white block">Location & Operations</strong>
                  <span className="text-[11px] font-mono">
                    Unit 11 Block A Ground Floor, Flat PKNS, Jalan Tun Razak, 50400 Kuala Lumpur, Malaysia
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-[#81C995]/20 text-[#81C995] flex items-center justify-center shrink-0 mt-0.5">
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-white block">Marine Solutions & IoT</strong>
                  <span>
                    Specialized in LoRa Meshtastic long-range offshore radio telemetry, NMEA 0183 & AIS integration, and hybrid GPS tracking for sailing regattas.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between text-[11px] font-mono">
              <a
                href="https://istmalaysia.my"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00D4FF] hover:underline flex items-center gap-1 font-bold"
              >
                Visit istmalaysia.my <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-[#64748B]">v4.8 • Regatta Engine</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1E293B] bg-[#0E1726]/70 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-mono font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
