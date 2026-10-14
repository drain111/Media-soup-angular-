import { Routes } from '@angular/router';
import { AuthErrorPage } from './auth-error-page.js';
import { LandingPage } from './landing.page.js';

export const routes: Routes = [
  { path: '', component: LandingPage, pathMatch: 'full' },
  { path: 'auth/error', component: AuthErrorPage },
];