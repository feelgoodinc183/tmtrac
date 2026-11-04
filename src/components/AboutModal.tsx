import React from 'react';
import {
  X,
  Building2,
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
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          'bg-surface text-ink border-line shadow-[0_20px_60px_rgba(0,0,0,0.8)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-surface/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/40 text-accent flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-ink">
                About the System
              </h2>
              <p className="text-xs text-ink-muted">
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
            className="group p-2 rounded-xl bg-raised/70 hover:bg-danger/20 active:bg-danger/30 border border-line/60 hover:border-danger-ink/40 text-ink-muted hover:text-danger-ink active:scale-95 transition-all duration-150 cursor-pointer shadow-xs focus:outline-none"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="w-5 h-5 pointer-events-none transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110 stroke-[2.2]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Main Developer Info Card */}
          <div className="p-4 rounded-2xl bg-raised/90 border border-accent/30 space-y-2.5 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent/20 text-accent border border-accent/40 inline-flex items-center gap-1 mb-1.5">
                  <ShieldCheck className="w-3 h-3" />
                  Official System Developer
                </span>
                <h3 className="text-base font-bold text-ink tracking-tight">
                  Tom Manas Technologies Sdn. Bhd.
                </h3>
                <p className="text-xs text-accent font-semibold">
                  Registered Company in Malaysia
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/20 border border-accent/40 flex items-center justify-center shrink-0">
                <Sailboat className="w-5 h-5 text-accent" />
              </div>
            </div>

            <p className="text-xs text-ink leading-relaxed">
              This system is proudly developed by{' '}
              <strong className="text-ink">Tom Manas Technologies Sdn. Bhd.</strong>, a Malaysian technology enterprise providing consultation, creative engineering, and high-performance software solutions for IoT telemetry, sports race management, marine timing networks, mobile systems, and digital platforms.
            </p>
          </div>

          {/* Quick Contact & Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* WhatsApp Contact */}
            <a
              href="https://wa.me/601111344522"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-2xl bg-raised border border-success-ink/40 hover:bg-surface transition-all flex items-center gap-3 group text-left shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-success-ink text-canvas flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MessageCircle className="w-5 h-5 fill-canvas" />
              </div>
              <div className="min-w-0">
                <span className="text-xs text-success-ink font-bold block">
                  WhatsApp Contact
                </span>
                <span className="text-xs font-bold text-ink truncate block">
                  +601111344522
                </span>
              </div>
            </a>

            {/* Email Contact */}
            <a
              href="mailto:info@istmalaysia.my"
              className="p-3 rounded-2xl bg-raised border border-accent/40 hover:bg-surface transition-all flex items-center gap-3 group text-left shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-accent text-on-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs text-accent font-bold block">
                  Email Support
                </span>
                <span className="text-xs font-bold text-ink truncate block">
                  info@istmalaysia.my
                </span>
              </div>
            </a>
          </div>

          {/* Marine Partner & Affiliations */}
          <div className="p-4 rounded-2xl bg-surface border border-line space-y-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-warning-ink" />
              <h4 className="text-xs font-bold text-ink">
                Marine Partner & Technical Collaboration
              </h4>
            </div>

            <div className="space-y-2 text-xs text-ink-muted">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-warning-ink/20 text-warning-ink flex items-center justify-center shrink-0 mt-0.5">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-ink block">IST Malaysia (istmalaysia.my)</strong>
                  <span>
                    Founded in 2017, bringing premier marine, diving, snorkeling, and watersports equipment to Malaysia.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-accent/20 text-accent flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-ink block">Location & Operations</strong>
                  <span className="text-xs">
                    Unit 11 Block A Ground Floor, Flat PKNS, Jalan Tun Razak, 50400 Kuala Lumpur, Malaysia
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-success-ink/20 text-success-ink flex items-center justify-center shrink-0 mt-0.5">
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-ink block">Marine Solutions & IoT</strong>
                  <span>
                    Specialized in LoRa Meshtastic long-range offshore radio telemetry, NMEA 0183 & AIS integration, and hybrid GPS tracking for sailing regattas.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
              <a
                href="https://istmalaysia.my"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline flex items-center gap-1 font-bold"
              >
                Visit istmalaysia.my <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-ink-muted">v{APP_VERSION}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line bg-surface/70 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-raised hover:bg-raised text-ink text-xs font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
