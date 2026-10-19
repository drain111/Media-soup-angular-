import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-call-placeholder',
  standalone: true,
  imports: [TitleCasePipe],
  template: `<main class="call-page"><div class="content">
    <h1>Call Room</h1>
    <p>Room code: {{ roomCode }}</p>
  </div></main>`,
  styles: [`
    .call-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a2e;
      color: white;
    }
    .content { text-align: center; }
  `],
})
export class CallPlaceholderPage {
  roomCode = '';

  constructor(route: ActivatedRoute) {
    route.queryParams.subscribe((p) => this.roomCode = String(p['code'] ?? ''));
  }
}
