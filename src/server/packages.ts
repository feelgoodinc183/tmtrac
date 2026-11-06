// The plans shown on the front page and in Upgrade, as first stored, and the one-off change of
// the stored defaults from US dollars to ringgit (with features the product doesn't have removed).

export interface PackageRow {
  id: string;
  tier_key: string;
  display_title: string;
  badge: string;
  price_amount: number;
  currency: string;
  currency_symbol: string;
  billing_interval: string;
  description: string;
  max_active_rooms: number;
  max_boats_per_room: number;
  max_admin_seats: number;
  lora_priority: number;
  custom_branding: number;
  features_json: string;
  is_active: number;
  sort_order: number;
  updated_at?: number;
}

import { DEFAULT_CURRENCY, DEFAULT_CURRENCY_SYMBOL } from '../utils/pricing';
export { DEFAULT_CURRENCY, DEFAULT_CURRENCY_SYMBOL };

export function defaultPackages(now: number): PackageRow[] {
  const base = { currency: DEFAULT_CURRENCY, currency_symbol: DEFAULT_CURRENCY_SYMBOL, is_active: 1, updated_at: now };
  return [
    {
      ...base,
      id: 'pkg-free',
      tier_key: 'FREE',
      display_title: 'Starter Club',
      badge: 'Free Forever',
      price_amount: 0,
      billing_interval: 'month',
      description: 'Essential regatta tracking for local sailing clubs and trial events.',
      max_active_rooms: 1,
      max_boats_per_room: 15,
      max_admin_seats: 2,
      lora_priority: 0,
      custom_branding: 0,
      features_json: JSON.stringify([
        '1 Active Regatta Room at a time',
        'Up to 15 boats tracked live simultaneously',
        '2 Race Officer / Admin seats',
        'Standard 4G / Web telemetry feed',
        'Live spectator race view',
        'Standard finish line & elapsed timing',
      ]),
      sort_order: 1,
    },
    {
      ...base,
      id: 'pkg-club',
      tier_key: 'CLUB',
      display_title: 'Yacht Club & Fleet',
      badge: 'Most Popular',
      price_amount: 199,
      billing_interval: 'month',
      description: 'Full-featured race management for clubs running seasonal series and fleets.',
      max_active_rooms: 10,
      max_boats_per_room: 60,
      max_admin_seats: 5,
      lora_priority: 1,
      custom_branding: 0,
      features_json: JSON.stringify([
        'Up to 10 Concurrent Regatta Rooms',
        'Up to 60 boats tracked per fleet',
        '5 Race Committee & Officer seats',
        'Meshtastic LoRa radio mesh priority',
        'Automated IRC, ORC & Portsmouth corrected scoring',
        'Club race history & participant audit log',
        'Public event code sharing & spectator links',
      ]),
      sort_order: 2,
    },
    {
      ...base,
      id: 'pkg-event-pro',
      tier_key: 'EVENT_PRO',
      display_title: 'Championship / Event Pro',
      badge: 'Pro Grade',
      price_amount: 599,
      billing_interval: 'event',
      description: 'Heavy-duty telemetry infrastructure for major regattas, offshore passages, and national championships.',
      max_active_rooms: 30,
      max_boats_per_room: 250,
      max_admin_seats: 20,
      lora_priority: 1,
      custom_branding: 0,
      features_json: JSON.stringify([
        'Up to 30 Concurrent Regattas & Flights',
        'Up to 250 boats per race division',
        '20 Race Committee, Jury & Umpire seats',
        'Android offline GNSS store-and-forward',
        'Dedicated database export & priority support',
      ]),
      sort_order: 3,
    },
  ];
}

/** The US-dollar prices the defaults were first stored with, and their ringgit prices */
const USD_TO_MYR: Record<string, { usd: number; myr: number }> = {
  'pkg-free': { usd: 0, myr: 0 },
  'pkg-club': { usd: 49, myr: 199 },
  'pkg-event-pro': { usd: 149, myr: 599 },
};

/** Feature lines the first defaults listed that the product doesn't have (or not as worded) */
const FEATURE_FIXES: Record<string, string | null> = {
  'Automated IRC / PHRF corrected scoring': 'Automated IRC, ORC & Portsmouth corrected scoring',
  'Live weather & wind layline overlays': null,
  'Dual-band LoRa mesh + cellular fallback': null,
  'Custom club branding & sponsor logos': null,
  'Raw NMEA / AIS integration support': null,
};

/**
 * The stored row with the defaults changed, or null when nothing applies. The price moves to
 * ringgit only while a default plan still has its first US-dollar price, so a plan an admin has
 * repriced is left as it is. Feature lines are fixed by exact text in any plan.
 */
export function migratePackageRow(row: PackageRow): PackageRow | null {
  let changed = false;
  const next: PackageRow = { ...row };

  const conv = USD_TO_MYR[row.id];
  if (conv && row.currency === 'USD' && Number(row.price_amount) === conv.usd) {
    next.currency = DEFAULT_CURRENCY;
    next.currency_symbol = DEFAULT_CURRENCY_SYMBOL;
    next.price_amount = conv.myr;
    changed = true;
  }

  let features: unknown;
  try {
    features = JSON.parse(row.features_json || '[]');
  } catch {
    features = null;
  }
  if (Array.isArray(features)) {
    const fixed = features
      .map((f) => (typeof f === 'string' && f in FEATURE_FIXES ? FEATURE_FIXES[f] : f))
      .filter((f) => f !== null);
    if (fixed.length !== features.length || fixed.some((f, i) => f !== features[i])) {
      next.features_json = JSON.stringify(fixed);
      changed = true;
    }
  }
  return changed ? next : null;
}
