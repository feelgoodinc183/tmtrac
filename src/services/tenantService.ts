import { Tenant, PlanTier, AuditLogEntry, UserAccount } from '../types/regatta';
import { authService } from './authService';
import { roomService } from './roomService';

export type TenantChangeListener = (tenant: Tenant | null) => void;

class TenantService {
  private currentTenant: Tenant | null = null;
  private listeners: TenantChangeListener[] = [];

  constructor() {
    this.init();
  }

  private async init() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('tmtrac_active_tenant');
      if (saved) {
        this.currentTenant = JSON.parse(saved);
      }
    } catch (e) {}

    // Synchronize with server if authenticated
    if (authService.isAuthenticated()) {
      await this.fetchCurrentTenant();
    }

    authService.onUserChange((user) => {
      if (user) {
        this.fetchCurrentTenant();
      } else {
        this.currentTenant = null;
        localStorage.removeItem('tmtrac_active_tenant');
        this.notify();
      }
    });
  }

  public getCurrentTenant(): Tenant | null {
    return this.currentTenant;
  }

  public onTenantChange(callback: TenantChangeListener): () => void {
    this.listeners.push(callback);
    callback(this.currentTenant);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.currentTenant));
  }

  public async fetchCurrentTenant(): Promise<Tenant | null> {
    try {
      const res = await fetch('/api/tenants/current', {
        headers: authService.getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tenant) {
          this.currentTenant = data.tenant;
          localStorage.setItem('tmtrac_active_tenant', JSON.stringify(data.tenant));
          this.notify();
          return this.currentTenant;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch current organization tenant:', e);
    }
    return this.currentTenant;
  }

  public async registerOrganization(payload: {
    organizationName: string;
    adminEmail: string;
    adminUsername: string;
    password: string;
    fullName: string;
    sailingClub?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    tenant?: Tenant;
    user?: UserAccount;
    defaultEventCode?: string;
    defaultRoomPins?: { adminPin: string; participantPin: string };
  }> {
    try {
      const res = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success && data.tenant && data.user) {
        this.currentTenant = data.tenant;
        localStorage.setItem('tmtrac_active_tenant', JSON.stringify(data.tenant));
        authService.handleDirectLogin(data.user, data.token);
        if (data.defaultEventCode && data.defaultRoomPins?.adminPin) {
          roomService.rememberAdminPin(data.defaultEventCode, data.defaultRoomPins.adminPin);
        }
        this.notify();
        return {
          success: true,
          tenant: data.tenant,
          user: data.user,
          defaultEventCode: data.defaultEventCode,
          defaultRoomPins: data.defaultRoomPins,
        };
      }
      return { success: false, error: data.error || 'Failed to create organization.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error creating organization.' };
    }
  }

  public async upgradePlan(targetTier: PlanTier): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const res = await fetch('/api/tenants/plan/upgrade', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ targetTier }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (this.currentTenant) {
          this.currentTenant = {
            ...this.currentTenant,
            planTier: targetTier,
            limits: data.limits,
          };
          localStorage.setItem('tmtrac_active_tenant', JSON.stringify(this.currentTenant));
          this.notify();
        }
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || 'Failed to update plan.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error updating plan.' };
    }
  }

  public async fetchAuditLogs(): Promise<{ success: boolean; logs?: AuditLogEntry[]; error?: string }> {
    try {
      const res = await fetch('/api/audit', {
        headers: authService.getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, logs: data.logs || [] };
      }
      return { success: false, error: data.error || 'Failed to fetch audit log.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error fetching audit log.' };
    }
  }

  public async fetchMembers(): Promise<{ success: boolean; members?: any[]; error?: string }> {
    try {
      const res = await fetch('/api/tenants/members', {
        headers: authService.getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, members: data.members || [] };
      }
      return { success: false, error: data.error || 'Failed to fetch organization members.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error fetching members.' };
    }
  }

  public async fetchStripeConfig(): Promise<{
    configured: boolean;
    isLive: boolean;
    mode: 'live' | 'test' | 'simulator';
    publishableKey?: string;
    webhookConfigured?: boolean;
    currency?: string;
    currencySymbol?: string;
  }> {
    try {
      const res = await fetch('/api/stripe/config');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch Stripe config:', e);
    }
    return { configured: false, isLive: false, mode: 'simulator', currency: 'USD', currencySymbol: '$' };
  }

  public async createStripeCheckout(payload: {
    packageId?: string;
    billingInterval?: 'month' | 'year' | 'event';
  }): Promise<{ success: boolean; checkoutUrl?: string; sessionId?: string; error?: string; simulator?: boolean }> {
    try {
      const returnOrigin = window.location.origin;
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          ...authService.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, returnOrigin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, checkoutUrl: data.checkoutUrl, sessionId: data.sessionId, simulator: data.simulator };
      }
      return { success: false, error: data.error || 'Failed to initiate Stripe checkout.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error reaching Stripe checkout service.' };
    }
  }

  public async verifyStripeSession(sessionId: string): Promise<{
    success: boolean;
    activated?: boolean;
    type?: string;
    targetTier?: string;
    eventPassesBalance?: number;
    error?: string;
  }> {
    try {
      const res = await fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`, {
        headers: authService.getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await this.fetchCurrentTenant();
        return data;
      }
      return { success: false, error: data.error || 'Failed to verify session' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error verifying Stripe session.' };
    }
  }

  public async createStripePortal(): Promise<{ success: boolean; portalUrl?: string; error?: string }> {
    try {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success && data.portalUrl) {
        return { success: true, portalUrl: data.portalUrl };
      }
      return { success: false, error: data.error || 'Failed to open billing portal.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error reaching Stripe billing portal.' };
    }
  }
}

export const tenantService = new TenantService();
