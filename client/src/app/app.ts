import { Component, Injectable, TransferState, inject, makeStateKey, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';
import { Observable, of, tap } from 'rxjs';

export interface AuthProviderInfo {
  id: string;
  label: string;
}

const PROVIDERS_KEY = makeStateKey<AuthProviderInfo[]>('auth-providers');

@Injectable({ providedIn: 'root' })
export class AuthProvidersService {
  private http = inject(HttpClient);
  private state = inject(TransferState);

  getProviders(): Observable<AuthProviderInfo[]> {
    // In the browser, reuse what SSR already fetched (no second HTTP call).
    const cached = this.state.get(PROVIDERS_KEY, null);
    if (cached) return of(cached);

    return this.http
      .get<AuthProviderInfo[]>('/api/auth/providers')
      .pipe(tap((list) => this.state.set(PROVIDERS_KEY, list)));
  }

  login(providerId: string) {
    // Full-page navigation: the API answers with a 302 to the provider.
    window.location.href = `/api/auth/${providerId}/redirect`;
  }
}

@Component({
  selector: 'app-root',
  imports: [TitleCasePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private auth = inject(AuthProvidersService);
  providers = signal<AuthProviderInfo[]>([]);

  constructor() {
    this.auth.getProviders().subscribe((list) => this.providers.set(list));
  }

  login(providerId: string) {
    this.auth.login(providerId);
  }
}