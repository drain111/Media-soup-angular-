import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth-error',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [`
    .auth-error-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-color: #f5f5f5;
    }
    .error-card {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      max-width: 500px;
      text-align: center;
    }
    .error-message {
      color: #d32f2f;
      font-size: 1.1rem;
      margin: 1rem 0;
    }
    .error-provider {
      color: #666;
      font-size: 0.9rem;
    }
    .back-btn {
      padding: 0.75rem 1.5rem;
      background-color: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }
    .back-btn:hover {
      background-color: #1565c0;
    }
  `],
  template: `
    <div class="auth-error-page">
      <div class="error-card">
        <h1>Authentication Failed</h1>
        <p class="error-message">{{ errorMessage }}</p>
        @if (provider) {
          <p class="error-provider">Provider: {{ provider }}</p>
        }
        <button routerLink="/" class="back-btn">Back to Home</button>
      </div>
    </div>
  `
})
export class AuthErrorPage implements OnInit {
  errorMessage = 'An unexpected error occurred during authentication.';
  provider: string | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const messageParam = this.route.snapshot.queryParams['message'];
    if (messageParam) {
      this.errorMessage = decodeURIComponent(messageParam);
    }
    const providerParam = this.route.snapshot.queryParams['provider'];
    if (providerParam) {
      this.provider = providerParam;
    }
  }
}
