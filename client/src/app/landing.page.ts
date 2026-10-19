// landing.page.ts
import { AuthProvidersService, AuthProviderInfo } from './services/auth-providers.service.js';
import { Component, HostListener, PLATFORM_ID, inject, signal } from '@angular/core';
import { TitleCasePipe, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
@Component({
  selector: 'app-landing',
  standalone: true,
    imports: [TitleCasePipe],
  styleUrl: './app-landing.css',

  templateUrl: './landing.page.html',
})
export class LandingPage {
  auth = inject(AuthProvidersService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  providers = signal<AuthProviderInfo[]>([]);
  showDropdown = false;
  showCreateRoomModal = false;
  roomCode = signal<string | null>(null);
  roomName = signal('');
  roomEmails = signal('');
  constructor() {
    this.auth.getProviders().subscribe((list) => this.providers.set(list));
    if (this.isBrowser) this.auth.authCheck();
  }
  onRoomNameInput(event: Event) {
    this.roomName.set((event.target as HTMLInputElement).value);
  }

  onRoomEmailsInput(event: Event) {
    this.roomEmails.set((event.target as HTMLTextAreaElement).value);
  }
  async onGo(): Promise<void> {
    if (!this.roomName().trim()) return;

    const roomName = this.roomName();
    const inviteEmails = this.roomEmails()
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    try {
      const resp = await lastValueFrom(
        this.http.post<{ code: string }>('/api/rooms', { roomName, inviteEmails }),
      );
      if (resp?.code) {
        this.roomCode.set(resp.code);
        this.showCreateRoomModal = false;
        await this.router.navigate(['/call'], { queryParams: { code: resp.code } });
      }
    } catch (e) {
      console.error('Failed to create room', e);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest('.user-area')) this.showDropdown = false;
    if (!(event.target as HTMLElement).closest('.modal') && !(event.target as HTMLElement).closest('.content')) this.showCreateRoomModal = false;
  }

  // al volver con "atrás" desde el proveedor, el navegador restaura la página con loading=true
  @HostListener('window:pageshow', ['$event'])
  onPageShow(event: PageTransitionEvent) {
    if (event.persisted) this.auth.loading.set(false);
  }
  showCreateRoomModalFunction() {
    this.showCreateRoomModal = true;
  }
  login(providerId: string) { this.auth.login(providerId); }

  onLogout() {
    this.showDropdown = false;
    this.auth.logoutFromUI();
  }
}