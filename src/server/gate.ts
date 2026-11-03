import express from 'express';
import { db, insertAuditLog } from './db';
import { Tenant, PlanTier, UserAccount } from '../types/regatta';

export interface GateContext {
  user: UserAccount | null;
  tenant: Tenant | null;
  platform: 'WEB' | 'ANDROID';
  isUniversalAdmin: boolean;
  isSuperAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      gate?: GateContext;
    }
  }
}

export function extractPlatform(req: express.Request): 'WEB' | 'ANDROID' {
  const customHeader = (req.headers['x-device-platform'] as string || '').toUpperCase();
  if (customHeader.includes('ANDROID')) return 'ANDROID';
  const ua = req.headers['user-agent'] || '';
  if (/Android/i.test(ua)) return 'ANDROID';
  return 'WEB';
}

export function resolveGateContext(req: express.Request): GateContext {
  const rawAuthHeader = (req.headers.authorization || req.headers.Authorization || (req.headers as any)['http_authorization'] || req.headers['x-forwarded-authorization'] || '') as string;
  let token = '';
  if (typeof rawAuthHeader === 'string' && rawAuthHeader.toLowerCase().startsWith('bearer ')) {
    token = rawAuthHeader.substring(7).trim();
  } else if (typeof rawAuthHeader === 'string' && rawAuthHeader.trim().length > 0) {
    token = rawAuthHeader.trim();
  } else if (typeof req.query.token === 'string') {
    token = req.query.token.trim();
  } else if (typeof req.headers['x-auth-token'] === 'string') {
    token = (req.headers['x-auth-token'] as string).trim();
  } else if (typeof req.headers['x-super-admin-token'] === 'string') {
    token = (req.headers['x-super-admin-token'] as string).trim();
  }

  const platform = extractPlatform(req);

  // Strict session token validation: reject if token is missing or insufficient length
  if (!token || typeof token !== 'string' || token.trim().length < 16) {
    return {
      user: null,
      tenant: null,
      platform,
      isUniversalAdmin: false,
      isSuperAdmin: false,
    };
  }

  try {
    let userRow: any = null;

    try {
      // Strictly resolve user by active cryptographic session token only
      userRow = db.prepare(`
        SELECT * FROM users
        WHERE token = ? AND (status = 'ACTIVE' OR status IS NULL)
      `).get(token) as any;
    } catch (err) {
      console.warn('[Gate] Notice: User query by token:', err);
    }

    if (!userRow) {
      return {
        user: null,
        tenant: null,
        platform,
        isUniversalAdmin: false,
        isSuperAdmin: false,
      };
    }

    // Safely retrieve tenant record with resilient SELECT *
    let tenantRow: any = null;
    if (userRow.tenant_id) {
      try {
        tenantRow = db.prepare('SELECT * FROM tenants WHERE id = ?').get(userRow.tenant_id) as any;
      } catch (err) {
        console.warn('[Gate] Notice: Tenant query by id:', err);
      }
    }
    if (!tenantRow) {
      try {
        tenantRow = db.prepare(`SELECT * FROM tenants ORDER BY (id = 'tenant-rlyc-default') DESC, created_at ASC LIMIT 1`).get() as any;
      } catch (e) {}
    }

    const userEmail = (userRow.email || '').toLowerCase().trim();
    const isSuperAdmin = !!userRow.is_super_admin || (userEmail === 'irsyadismail@gmail.com' && userRow.role === 'ADMIN');
    const isUniversalAdmin = isSuperAdmin && (userRow.role === 'ADMIN' || userEmail === 'irsyadismail@gmail.com');

    let stats = { racesOrganized: 0, racesParticipated: 0, podiumFinishes: 0, totalNauticalMiles: 0, vmgEfficiency: 90, winRate: 0 };
    let raceHistory = [];
    try {
      if (userRow.stats_json) stats = JSON.parse(userRow.stats_json);
      if (userRow.race_history_json) raceHistory = JSON.parse(userRow.race_history_json);
    } catch (e) {}

    const user: UserAccount = {
      id: userRow.id,
      tenantId: userRow.tenant_id || (tenantRow?.id || 'tenant-rlyc-default'),
      tenantName: tenantRow?.name || 'Royal Langkawi Yacht Club',
      email: userRow.email,
      username: userRow.username,
      fullName: userRow.full_name,
      sailingClub: userRow.sailing_club,
      sailNumber: userRow.sail_number,
      handicapRating: userRow.handicap_rating,
      role: userRow.role as any,
      participantType: userRow.participant_type as any,
      status: userRow.status as any,
      token: userRow.token,
      planTier: (tenantRow?.plan_tier || 'FREE') as PlanTier,
      createdAt: userRow.created_at,
      isSuperAdmin,
      stats,
      raceHistory,
    };

    const tenant: Tenant | null = tenantRow ? {
      id: tenantRow.id,
      name: tenantRow.name || 'Royal Langkawi Yacht Club',
      slug: tenantRow.slug || 'rlyc',
      ownerId: tenantRow.owner_id || userRow.id,
      planTier: (tenantRow.plan_tier || 'FREE') as PlanTier,
      limits: {
        maxActiveRooms: tenantRow.max_active_rooms || 1,
        maxBoatsPerRoom: tenantRow.max_boats_per_room || 15,
        maxAdminSeats: tenantRow.max_admin_seats || 2,
        loraPriority: !!tenantRow.lora_priority,
        customBranding: !!tenantRow.custom_branding,
      },
      activeRoomsCount: 0,
      membersCount: 0,
      createdAt: tenantRow.created_at || userRow.created_at,
      stripeCustomerId: tenantRow.stripe_customer_id || null,
      stripeSubscriptionId: tenantRow.stripe_subscription_id || null,
      subscriptionStatus: tenantRow.subscription_status || 'none',
      subscriptionCurrentPeriodEnd: Number(tenantRow.subscription_current_period_end) || 0,
      eventPassesBalance: Number(tenantRow.event_passes_balance) || 0,
    } : null;

    return {
      user,
      tenant,
      platform,
      isUniversalAdmin,
      isSuperAdmin,
    };
  } catch (e) {
    console.error('Error resolving gate context:', e);
    return {
      user: null,
      tenant: null,
      platform,
      isUniversalAdmin: false,
      isSuperAdmin: false,
    };
  }
}

/**
 * Express middleware that initializes req.gate on every request
 */
export function serverGateMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  req.gate = resolveGateContext(req);
  next();
}

/**
 * Gate Guard: Requires valid authenticated user
 */
export function requireAuth(allowedRoles?: Array<'ADMIN' | 'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR' | 'PARTICIPANT'>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.gate || !req.gate.user) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in or register to access this resource.',
        requireAuth: true,
      });
    }

    if (req.gate.isUniversalAdmin) {
      return next();
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const userRole = req.gate.user.role;
      const isAllowed = allowedRoles.includes(userRole as any) || (allowedRoles.includes('PARTICIPANT') && (userRole === 'SKIPPER' || userRole === 'RACE_OFFICER'));
      if (!isAllowed) {
        return res.status(403).json({
          error: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}. Current role: ${userRole}`,
        });
      }
    }

    next();
  };
}

/**
 * Gate Guard: Requires Tenant Admin role
 */
export function requireTenantAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.gate || !req.gate.user) {
    return res.status(401).json({ error: 'Authentication required.', requireAuth: true });
  }

  if (req.gate.isUniversalAdmin || req.gate.user.role === 'ADMIN') {
    return next();
  }

  return res.status(403).json({
    error: 'Access restricted to Organization Administrators.',
  });
}

/**
 * Gate Guard: Requires System Super Administrator role
 */
export function requireSuperAdmin() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.gate || !req.gate.user) {
      req.gate = resolveGateContext(req);
    }

    if (!req.gate || !req.gate.user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in as Super Administrator.', requireAuth: true });
    }

    if (req.gate.isSuperAdmin || req.gate.isUniversalAdmin || req.gate.user.isSuperAdmin) {
      return next();
    }

    return res.status(403).json({
      error: 'Access restricted to System Super Administrators.',
    });
  };
}


/**
 * Gate Guard: Enforce Plan Limits (e.g. Free plan 1 active event limit)
 */
export function enforcePlanQuota(action: 'CREATE_EVENT' | 'ADD_BOAT') {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.gate || !req.gate.tenant) {
      return res.status(401).json({ error: 'Tenant context required.' });
    }

    if (req.gate.isUniversalAdmin) {
      return next();
    }

    const tenantId = req.gate.tenant.id;
    const limits = req.gate.tenant.limits;

    if (action === 'CREATE_EVENT') {
      const countRow = db.prepare(`
        SELECT COUNT(*) as active_count FROM events 
        WHERE tenant_id = ? AND status != 'CLOSED'
      `).get(tenantId) as any;

      const activeEvents = countRow?.active_count || 0;
      if (activeEvents >= limits.maxActiveRooms) {
        // Check if organization has purchased single event passes
        const tenantRow = db.prepare('SELECT event_passes_balance FROM tenants WHERE id = ?').get(tenantId) as any;
        const passBalance = Number(tenantRow?.event_passes_balance) || 0;
        if (passBalance > 0) {
          (req as any).useEventPass = true;
          return next();
        }

        return res.status(403).json({
          error: `Plan limit reached: Your current ${req.gate.tenant.planTier} plan allows maximum ${limits.maxActiveRooms} active event(s). Please purchase a Single Regatta Event Pass or upgrade to Club plan.`,
          planLimitExceeded: true,
          planTier: req.gate.tenant.planTier,
          maxAllowed: limits.maxActiveRooms,
          currentCount: activeEvents,
          eventPassesBalance: passBalance,
        });
      }
    }

    next();
  };
}
