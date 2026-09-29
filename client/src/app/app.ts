import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('client');
  private readonly http = inject(HttpClient);

  loginToGoogle(): void {
    this.http
      .get<{ url: string }>('/api/auth/google/login-url')
      .subscribe({
        next: (res) => window.location.assign(res.url),
        error: (err) => console.error('Failed to get Google login URL', err),
      });
  }
}
