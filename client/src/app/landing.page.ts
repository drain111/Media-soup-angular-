// landing.page.ts
import { AuthProvidersService, AuthProviderInfo } from './services/auth-providers.service.js';
import { Component, HostListener, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser, TitleCasePipe } from '@angular/common';
@Component({
  selector: 'app-landing',
  standalone: true,
    imports: [TitleCasePipe],
  styleUrl: './app-landing.css',

  templateUrl: './landing.page.html',
})
export class LandingPage {
  auth = inject(AuthProvidersService); // no private: la plantilla usa auth.user(), auth.loading()...
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  providers = signal<AuthProviderInfo[]>([]);
  showDropdown = false;

  constructor() {
    this.auth.getProviders().subscribe((list) => this.providers.set(list));
    if (this.isBrowser) this.auth.authCheck(); // en SSR no hay cookie
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest('.user-area')) this.showDropdown = false;
  }

  // al volver con "atrás" desde el proveedor, el navegador restaura la página con loading=true
  @HostListener('window:pageshow', ['$event'])
  onPageShow(event: PageTransitionEvent) {
    if (event.persisted) this.auth.loading.set(false);
  }

  login(providerId: string) { this.auth.login(providerId); }

  onLogout() {
    this.showDropdown = false;
    this.auth.logoutFromUI();
  }
}