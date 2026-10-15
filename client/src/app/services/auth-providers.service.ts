import {  Injectable, TransferState, inject, makeStateKey, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, of, tap } from 'rxjs';
export interface AuthProviderInfo {
  id: string;
  label: string;
}
const PROVIDERS_KEY = makeStateKey<AuthProviderInfo[]>('auth-providers');

export interface SessionUser {
  id?: string;
  email: string;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthProvidersService {
  private http = inject(HttpClient);
  private state = inject(TransferState);

  readonly user = signal<SessionUser | null>(null);
  /** true hasta que /api/session responde (con usuario o con 401) */
  readonly checking = signal(true);
  /** true mientras el navegador se va al proveedor; evita el doble clic */
  redirecting = signal(false);
  // true hasta que /api/session responde (con usuario o con 401)
  loading = signal(true);
  getProviders(): Observable<AuthProviderInfo[]> {
    const cached = this.state.get(PROVIDERS_KEY, null);
    if (cached) return of(cached);

    return this.http
      .get<AuthProviderInfo[]>('/api/auth/providers')
      .pipe(tap((list) => this.state.set(PROVIDERS_KEY, list)));
  }

  login(providerId: string) {
    if (this.redirecting()) return;
    this.redirecting.set(true);
    window.location.href = `/api/auth/${providerId}/redirect`;
  }



  authCheck() {
    this.http
      .get<SessionUser>('/api/session')
      .pipe(finalize(() => this.loading.set(false))) // con éxito Y con error
      .subscribe({
        next: (u) => this.user.set(u),
        error: () => this.user.set(null), // 401 = sin sesión
      });
  }

  logoutFromUI() {
    const previous = this.user();
    this.user.set(null); // optimista: la UI cambia al instante
    this.http.delete('/api/session').subscribe({
      // si falla, la cookie sigue viva: se vuelve al estado anterior en vez de mentir
      error: () => this.user.set(previous),
    });
  }

  initials(name?: string): string {
    const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (parts.length === 0) return '?';
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
}