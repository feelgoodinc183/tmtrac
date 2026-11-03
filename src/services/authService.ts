import { UserAccount } from '../types/regatta';

const AUTH_TOKEN_KEY = 'tmtrac_auth_token_v1';
const AUTH_USER_KEY = 'tmtrac_auth_user_v1';

export type AuthListener = (user: UserAccount | null) => void;
export type SessionEndedListener = (ended: boolean) => void;

// A 401 from these means "wrong password", not "your session ended".
const CREDENTIAL_ENDPOINTS = ['/api/auth/login', '/api/auth/register'];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestCarriesToken(input: RequestInfo | URL, init: RequestInit | undefined, token: string): boolean {
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  const values = [headers.get('Authorization'), headers.get('x-auth-token'), headers.get('x-super-admin-token')];
  if (values.some((v) => v && v.includes(token))) return true;
  return requestUrl(input).includes(token);
}

class AuthService {
  private currentUser: UserAccount | null = null;
  private token: string | null = null;
  private listeners: AuthListener[] = [];
  private isInitialized = false;
  private sessionEnded = false;
  private sessionEndedListeners: SessionEndedListener[] = [];

  constructor() {
    this.restoreSession();
    this.installSessionGuard();
  }

  /**
   * Watch every API call: if a request sent with the current login comes back 401, the session
   * has ended on the server (expired, password changed, signed out elsewhere). Flag it once so
   * the app can ask the user to sign in again instead of carrying on as if signed in.
   */
  private installSessionGuard() {
    if (typeof window === 'undefined' || (window as any).__tmtracSessionGuard) return;
    (window as any).__tmtracSessionGuard = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const tokenAtSend = this.token;
      const res = await originalFetch(input, init);
      if (res.status === 401 && tokenAtSend && tokenAtSend === this.token) {
        let pathname = '';
        try {
          pathname = new URL(requestUrl(input), window.location.origin).pathname;
        } catch {}
        if (
          pathname.startsWith('/api/') &&
          !CREDENTIAL_ENDPOINTS.includes(pathname) &&
          requestCarriesToken(input, init, tokenAtSend)
        ) {
          this.setSessionEnded(true);
        }
      }
      return res;
    };
  }

  private setSessionEnded(ended: boolean) {
    if (this.sessionEnded === ended) return;
    this.sessionEnded = ended;
    this.sessionEndedListeners.forEach((cb) => cb(ended));
  }

  public isSessionEnded(): boolean {
    return this.sessionEnded;
  }

  public onSessionEndedChange(callback: SessionEndedListener): () => void {
    this.sessionEndedListeners.push(callback);
    callback(this.sessionEnded);
    return () => {
      this.sessionEndedListeners = this.sessionEndedListeners.filter((cb) => cb !== callback);
    };
  }

  private restoreSession() {
    if (typeof window === 'undefined') return;
    try {
      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const savedUserJson = localStorage.getItem(AUTH_USER_KEY);
      if (savedToken && savedUserJson) {
        this.token = savedToken;
        this.currentUser = JSON.parse(savedUserJson);
      }
    } catch (e) {
      console.warn('Failed to restore auth session:', e);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }

  public async init(): Promise<UserAccount | null> {
    if (this.isInitialized) return this.currentUser;
    this.isInitialized = true;

    if (!this.token) {
      return null;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          this.currentUser = data.user;
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
          this.notify();
          return this.currentUser;
        }
      }
      // A 401 here is picked up by the session guard, which asks the user to sign in again.
    } catch (e) {
      console.warn('Failed to verify token with server:', e);
    }
    return this.currentUser;
  }

  public getCurrentUser(): UserAccount | null {
    return this.currentUser;
  }

  public getToken(): string | null {
    return this.token;
  }

  public isAuthenticated(): boolean {
    return !!this.currentUser && !!this.token;
  }

  public isSuperAdmin(): boolean {
    return !!this.currentUser?.isSuperAdmin;
  }


  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  public onAuthChange(callback: AuthListener): () => void {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public onUserChange(callback: AuthListener): () => void {
    return this.onAuthChange(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.currentUser));
  }

  public handleDirectLogin(user: UserAccount, token: string) {
    this.token = token;
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
    this.setSessionEnded(false);
    this.notify();
  }

  public async login(login: string, password: string): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        this.token = data.token;
        this.currentUser = data.user;
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        this.setSessionEnded(false);
        this.notify();
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || 'Login failed.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error during login.' };
    }
  }

  public async register(payload: {
    email: string;
    username: string;
    password: string;
    fullName: string;
    sailingClub?: string;
    sailNumber?: string;
    handicapRating?: string;
    role?: 'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR';
  }): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        this.token = data.token;
        this.currentUser = data.user;
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        this.setSessionEnded(false);
        this.notify();
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || 'Registration failed.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error during registration.' };
    }
  }

  public isUniversalAdmin(): boolean {
    return !!this.currentUser?.isSuperAdmin;
  }

  public isAdmin(): boolean {
    return this.isUniversalAdmin();
  }

  // ==========================================
  // Admin User Management API
  // ==========================================
  public async fetchAllUsers(): Promise<{ success: boolean; users?: UserAccount[]; error?: string }> {
    try {
      const res = await fetch('/api/admin/users', {
        headers: this.getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, users: data.users || [] };
      }
      return { success: false, error: data.error || 'Failed to fetch user directory.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error fetching users.' };
    }
  }

  public async adminCreateUser(payload: {
    email: string;
    username: string;
    password: string;
    fullName: string;
    sailingClub?: string;
    sailNumber?: string;
    handicapRating?: string;
    role: 'ADMIN' | 'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR';
  }): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || 'Failed to create user.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error creating user.' };
    }
  }

  public async adminUpdateRole(userId: string, role: 'ADMIN' | 'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR'): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || 'Failed to update user role.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error updating user role.' };
    }
  }

  public async adminToggleStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || 'Failed to update user status.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error updating user status.' };
    }
  }

  public async adminResetPassword(userId: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || 'Failed to reset password.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error resetting password.' };
    }
  }

  public async adminDeleteUser(userId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || 'Failed to delete user.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error deleting user.' };
    }
  }

  public async updateProfile(fields: {
    fullName?: string;
    sailingClub?: string;
    sailNumber?: string;
    handicapRating?: string;
  }): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        this.currentUser = data.user;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        this.notify();
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || 'Failed to update profile.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error updating profile.' };
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
      }
    } catch (e) {
      console.warn('Logout network error:', e);
    } finally {
      this.clearSession();
    }
  }

  private clearSession() {
    this.token = null;
    this.currentUser = null;
    this.setSessionEnded(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
    this.notify();
  }
}

export const authService = new AuthService();
