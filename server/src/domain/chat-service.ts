import Redis from 'ioredis';
import type { SessionStore } from './ports.js';

export class ChatService {
  constructor(store: SessionStore) {}

  async send(code: string, from: string, text: string, timestamp: number): Promise<void> {
    // Implementation deferred to infrastructure layer (Redis list with LTRIM)
  }

  getHistory(code: string): Promise<{ from: string; text: string; ts: number }[]> {
    return Promise.resolve([]);
  }
}
