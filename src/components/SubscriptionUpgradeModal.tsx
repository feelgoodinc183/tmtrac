import React, { useState, useEffect, useId } from 'react';
import {
  X,
  Check,
  Building2,
  ShieldCheck,
  ArrowRight,
  Crown,
  CreditCard,
  ExternalLink,
  Ticket,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { PlanTier, PricingPackage, Tenant } from '../types/regatta';
import { tenantService } from '../services/tenantService';
import { DialogFrame } from './ui/Dialog';

interface SubscriptionUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: PlanTier;
  onSuccess?: () => void;
}

export const SubscriptionUpgradeModal: React.FC<SubscriptionUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentTier = 'FREE',
  onSuccess,
}) => {
  const titleId = useId();
  const [billingTab, setBillingTab] = useState<'SUBSCRIPTION' | 'EVENT_PASS'>('SUBSCRIPTION');
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [serverPackages, setServerPackages] = useState<PricingPackage[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(tenantService.getCurrentTenant());
  const [stripeConfig, setStripeConfig] = useState<{
    configured: boolean;
    isLive: boolean;
    mode: 'live' | 'test' | 'simulator';
    publishableKey?: string;
  }>({
    configured: false,
    isLive: false,
    mode: 'simulator',
  });

  // Keep tenant state synced
  useEffect(() => {
    const unsub = tenantService.onTenantChange((t) => {
      setActiveTenant(t);
    });
    return unsub;
  }, []);

  // Fetch live packages and Stripe status
  useEffect(() => {
    if (!isOpen) return;

    tenantService.fetchStripeConfig().then((cfg) => {
      setStripeConfig(cfg);
    });

    const fetchLivePackages = () => {
      fetch('/api/packages')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.packages) && data.packages.length > 0) {
            setServerPackages(data.packages);
          }
        })
        .catch(() => {});
    };

    fetchLivePackages();

    const handleUpdate = () => fetchLivePackages();
    window.addEventListener('packages-updated', handleUpdate);
    return () => window.removeEventListener('packages-updated', handleUpdate);
  }, [isOpen]);

  // Handle return from Stripe Checkout (?stripe=success&session_id=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const stripeParam = url.searchParams.get('stripe');
    const sessionId = url.searchParams.get('session_id');

    if (stripeParam === 'success' && sessionId) {
      setLoading(true);
      tenantService.verifyStripeSession(sessionId).then((res) => {
        setLoading(false);
        if (res.success && res.activated) {
          if (res.type === 'EVENT_PASS') {
            setSuccessMsg('Stripe payment confirmed! +1 Single Regatta Event Pass has been added to your balance.');
          } else {
            setSuccessMsg(`Stripe payment confirmed! Your organization has been upgraded to ${res.targetTier || 'Club'} plan.`);
          }
          // Clean URL params without reloading
          url.searchParams.delete('stripe');
          url.searchParams.delete('session_id');
          url.searchParams.delete('type');
          window.history.replaceState({}, '', url.toString());
          onSuccess?.();
        } else if (res.error) {
          setError(res.error);
        }
      });
    } else if (stripeParam === 'cancelled') {
      setError('Stripe checkout was cancelled. No charges were made.');
      url.searchParams.delete('stripe');
      window.history.replaceState({}, '', url.toString());
    }
  }, [onSuccess]);

  const defaultPlans = [
    {
      id: 'FREE' as PlanTier,
      packageId: 'pkg-free',
      name: 'Starter Club',
      subtitle: 'For independent race officers & local clubs',
      monthlyPrice: 0,
      annualPrice: 0,
      period: 'Forever free',
      color: 'slate',
      accent: 'border-line bg-surface/60',
      features: [
        '1 Active concurrent regatta event',
        'Up to 15 boats tracked live simultaneously',
        '2 Race Officer / Admin seats',
        'Standard 4G / Web telemetry feed',
        'Live spectator race view',
        'Standard finish line & elapsed timing',
      ],
      notIncluded: [
        'Multi-day multi-room regattas',
        'LoRa hardware priority routing',
        'Regulatory audit logs',
      ],
    },
    {
      id: 'CLUB' as PlanTier,
      packageId: 'pkg-club',
      name: 'Yacht Club & Fleet',
      subtitle: 'For active sailing clubs & national associations',
      monthlyPrice: 49,
      annualPrice: 39,
      period: 'per month',
      badge: 'Most Popular',
      color: 'cyan',
      accent: 'border-accent/80 bg-gradient-to-b from-surface/40 via-surface/80 to-surface shadow-xl ',
      features: [
        'Up to 10 Concurrent Regatta Rooms',
        'Up to 60 boats tracked per fleet',
        '5 Race Committee & Officer seats',
        'Meshtastic LoRa radio mesh priority',
        'Automated IRC / PHRF corrected scoring',
        'Club race history & participant audit log',
        'Live weather & wind layline overlays',
        'Public event code sharing & spectator links',
      ],
      notIncluded: [
        'Custom domain & club white-labeling',
      ],
    },
    {
      id: 'EVENT_PRO' as PlanTier,
      packageId: 'pkg-event-pro',
      name: 'Championship / Event Pro',
      subtitle: 'For major grand prix regattas & offshore passages',
      monthlyPrice: 149,
      annualPrice: 119,
      period: 'per month',
      badge: 'Pro Grade',
      color: 'amber',
      accent: 'border-warning-ink/80 bg-gradient-to-b from-surface/30 via-surface/80 to-surface shadow-xl ',
      features: [
        'Up to 30 Concurrent Regattas & Flights',
        'Up to 250 boats per race division',
        '20 Race Committee, Jury & Umpire seats',
        'Dual-band LoRa mesh + cellular fallback',
        'Custom club branding & sponsor logos',
        'Android offline GNSS store-and-forward',
        'Raw NMEA / AIS integration support',
        'Dedicated database export & priority support',
      ],
      notIncluded: [],
    },
  ];

  // Merge live server package pricing & titles
  const plans = defaultPlans.map((defaultPlan) => {
    const livePkg = serverPackages.find(
      (p) => p.tierKey === defaultPlan.id || p.id === defaultPlan.id || p.id === defaultPlan.packageId
    );
    if (!livePkg) return defaultPlan;

    return {
      ...defaultPlan,
      packageId: livePkg.id,
      name: livePkg.displayTitle || defaultPlan.name,
      subtitle: livePkg.description || defaultPlan.subtitle,
      monthlyPrice: livePkg.priceAmount,
      annualPrice: Math.round(livePkg.priceAmount * 0.8), // 20% discount on annual
      badge: livePkg.badge || defaultPlan.badge,
      features: livePkg.features && livePkg.features.length > 0 ? livePkg.features : defaultPlan.features,
    };
  });

  const handleCheckout = async (pkgId: string, tier: PlanTier) => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (tier === 'FREE') {
      const res = await tenantService.upgradePlan('FREE');
      setLoading(false);
      if (res.success) {
        setSuccessMsg('Your organization plan has been updated to Starter Club!');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'Failed to update plan.');
      }
      return;
    }

    // Initiate Stripe Hosted Checkout
    const res = await tenantService.createStripeCheckout({
      packageId: pkgId,
      billingInterval,
    });

    setLoading(false);

    if (res.success && res.checkoutUrl) {
      // Redirect user to Stripe Hosted Checkout
      window.location.href = res.checkoutUrl;
    } else {
      setError(res.error || 'Failed to initiate Stripe Checkout.');
    }
  };

  const handleBuyEventPass = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const res = await tenantService.createStripeCheckout({
      packageId: 'pkg-event-pass',
      billingInterval: 'event',
    });

    setLoading(false);

    if (res.success && res.checkoutUrl) {
      window.location.href = res.checkoutUrl;
    } else {
      setError(res.error || 'Failed to initiate Event Pass checkout.');
    }
  };

  const handleOpenCustomerPortal = async () => {
    setError(null);
    setPortalLoading(true);

    const res = await tenantService.createStripePortal();
    setPortalLoading(false);

    if (res.success && res.portalUrl) {
      window.location.href = res.portalUrl;
    } else {
      setError(res.error || 'Could not open billing portal. Please subscribe first.');
    }
  };

  if (!isOpen) return null;

  const currentOrgTier = activeTenant?.planTier || currentTier;
  const eventPasses = activeTenant?.eventPassesBalance || 0;
  const hasStripeProfile = !!activeTenant?.stripeCustomerId;

  return (
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      closeOnBackdrop
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/85 backdrop-blur-md overflow-y-auto"
      className="bg-surface border border-line/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col text-ink animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-surface via-surface to-surface border-b border-line flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id={titleId} className="text-lg sm:text-xl font-bold text-ink">
                Club Subscriptions & Regatta Passes
              </h2>
              {stripeConfig.configured && (
                <span className={`text-xs   px-2 py-0.5 rounded-full border ${
                  stripeConfig.isLive
                    ? 'bg-success-ink/15 border-success-ink/40 text-success-ink'
                    : 'bg-warning-ink/15 border-warning-ink/40 text-warning-ink'
                }`}>
                  {stripeConfig.isLive ? 'Stripe Live' : 'Stripe Test'}
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Powered by Stripe Hosted Checkout. Instant activation for sailing clubs and regatta committees.
            </p>
          </div>
        </div>
        <button
          aria-label="Close"
          onClick={onClose}
          className="p-1.5 text-ink-muted hover:text-ink rounded-lg hover:bg-raised transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Top Controls & Navigation Tabs */}
      <div className="px-6 py-3 bg-surface/90 border-b border-line flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Tab Selector */}
        <div className="flex items-center p-1 bg-canvas/80 rounded-xl border border-line w-full sm:w-auto">
          <button
            onClick={() => setBillingTab('SUBSCRIPTION')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              billingTab === 'SUBSCRIPTION'
                ? 'bg-accent text-on-accent shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Club Memberships
          </button>
          <button
            onClick={() => setBillingTab('EVENT_PASS')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              billingTab === 'EVENT_PASS'
                ? 'bg-warning-ink text-canvas shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            Single Event Passes {eventPasses > 0 && `(${eventPasses})`}
          </button>
        </div>

        {/* Billing Interval Toggle or Customer Portal Link */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {billingTab === 'SUBSCRIPTION' ? (
            <div className="flex items-center bg-canvas/60 p-0.5 rounded-lg border border-line text-xs">
              <button
                onClick={() => setBillingInterval('month')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  billingInterval === 'month' ? 'bg-raised text-ink font-medium' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('year')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  billingInterval === 'year' ? 'bg-raised text-ink font-medium' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Annual
                <span className="text-xs bg-success-ink/20 text-success-ink px-1 py-0.2 rounded font-bold">
                  Save 20%
                </span>
              </button>
            </div>
          ) : null}

          {hasStripeProfile && (
            <button
              onClick={handleOpenCustomerPortal}
              disabled={portalLoading}
              className="px-3 py-1.5 rounded-lg bg-raised hover:bg-raised border border-line text-ink text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Manage credit cards, invoices, and active subscriptions in Stripe"
            >
              <CreditCard className="w-3.5 h-3.5 text-accent" />
              {portalLoading ? 'Opening Portal...' : 'Billing Portal'}
              <ExternalLink className="w-3 h-3 text-ink-muted" />
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-danger/15 border border-danger-ink/30 text-danger-ink text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-danger-ink" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-success-ink/15 border border-success-ink/30 text-success-ink text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-success-ink" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Content Body */}
      <div className="p-6 overflow-y-auto flex-1">
        {billingTab === 'SUBSCRIPTION' ? (
          /* Recurring Plans Grid */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => {
              const isCurrent = currentOrgTier === p.id;
              const price = billingInterval === 'year' ? p.annualPrice : p.monthlyPrice;
              const formattedPrice = price === 0 ? 'Free' : `$${price}`;

              return (
                <div
                  key={p.id}
                  className={`p-5 rounded-xl border flex flex-col justify-between transition-all relative ${p.accent}`}
                >
                  {p.badge && (
                    <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
                      {p.badge}
                    </span>
                  )}

                  <div>
                    <div className="mb-3">
                      <h3 className="text-base font-bold text-ink">{p.name}</h3>
                      <p className="text-xs text-ink-muted mt-0.5 leading-snug">{p.subtitle}</p>
                    </div>

                    <div className="mb-4 pb-4 border-b border-line">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-ink">{formattedPrice}</span>
                        <span className="text-xs text-ink-muted">
                          {price === 0 ? 'Forever' : `/ month ${billingInterval === 'year' ? '(billed yearly)' : ''}`}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <p className="text-xs text-ink-muted font-semibold">
                        Included Capabilities
                      </p>
                      {p.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-ink">
                          <Check className="w-3.5 h-3.5 text-success-ink shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                      {p.notIncluded.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-ink-muted line-through">
                          <X className="w-3.5 h-3.5 text-ink-muted shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    {isCurrent ? (
                      <div className="w-full py-2.5 px-4 rounded-lg bg-raised border border-line text-ink text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success-ink" />
                        Current Active Plan
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCheckout(p.packageId, p.id)}
                        disabled={loading}
                        className={`w-full py-2.5 px-4 rounded-lg  text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
                          p.id === 'CLUB'
                            ? 'bg-accent hover:brightness-110 text-on-accent '
                            : p.id === 'EVENT_PRO'
                            ? 'bg-warning-ink hover:brightness-110 text-canvas '
                            : 'bg-raised hover:bg-raised text-ink'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        {loading ? 'Opening Stripe...' : p.id === 'FREE' ? 'Switch to Starter' : `Checkout via Stripe`}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Single Regatta Event Pass View */
          <div className="max-w-2xl mx-auto py-2">
            <div className="p-6 rounded-2xl border border-warning-ink/50 bg-gradient-to-b from-surface/30 via-surface to-surface shadow-xl">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="text-xs px-2.5 py-1 rounded bg-warning-ink/20 text-warning-ink border border-warning-ink/40 font-bold">
                    Pay-As-You-Go Regatta Unlock
                  </span>
                  <h3 className="text-xl font-bold text-ink mt-2">
                    Single Regatta Event Pass
                  </h3>
                  <p className="text-xs text-ink mt-1">
                    Ideal for clubs or regattas that only host one or two major events per year and don't need a monthly subscription.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-warning-ink">$29</div>
                  <div className="text-xs text-ink-muted">per regatta event</div>
                </div>
              </div>

              {/* Event Pass Balance Indicator */}
              <div className="mb-6 p-3.5 rounded-xl bg-canvas/70 border border-line flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Ticket className="w-5 h-5 text-warning-ink" />
                  <div>
                    <div className="text-xs font-semibold text-ink">Your Available Event Passes:</div>
                    <div className="text-xs text-ink-muted">Auto-consumed when creating rooms beyond Starter limit</div>
                  </div>
                </div>
                <span className="text-xl font-bold text-success-ink bg-success-ink/10 px-3 py-1 rounded-lg border border-success-ink/20">
                  {eventPasses}
                </span>
              </div>

              <div className="space-y-2.5 mb-6 text-xs text-ink">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success-ink shrink-0" />
                  <span>Unlocks 1 additional active concurrent regatta room with full race management features</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success-ink shrink-0" />
                  <span>Up to 60 live-tracked boats per event with full 4G and LoRa telemetry ingestion</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success-ink shrink-0" />
                  <span>Live spectator broadcast map and real-time mark-rounding calculation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success-ink shrink-0" />
                  <span>Passes never expire and can be redeemed whenever your regatta begins</span>
                </div>
              </div>

              <button
                onClick={handleBuyEventPass}
                disabled={loading}
                className="w-full py-3 px-6 rounded-xl text-sm font-bold bg-warning-ink hover:brightness-110 text-canvas flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                {loading ? 'Opening Stripe...' : 'Purchase Event Pass with Stripe ($29)'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-canvas/80 border-t border-line text-xs text-ink-muted flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-success-ink" />
          <span>256-bit SSL encrypted checkout handled securely by Stripe. We never store credit card numbers.</span>
        </div>
        <span className="text-ink-muted text-xs">
          VISA • Mastercard • Apple Pay • Google Pay
        </span>
      </div>
    </DialogFrame>
  );
};
