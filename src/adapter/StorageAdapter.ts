import type { Memento } from 'vscode';
import type { Session } from '../core/types.js';

const STORAGE_KEY = 'devvalue.sessions';

/**
 * Serialises and deserialises sessions through vscode.Memento (context.globalState).
 * Internally stored as Session[]; exposed as Map<branchName, Session>.
 */
export class StorageAdapter {
  constructor(private readonly storage: Memento) {}

  loadSessions(): Map<string, Session> {
    const sessions = this.storage.get<Session[]>(STORAGE_KEY, []);
    const map = new Map<string, Session>();
    for (const session of sessions) {
      map.set(session.branchName, session);
    }
    return map;
  }

  async saveSessions(sessions: Map<string, Session>): Promise<void> {
    await this.storage.update(STORAGE_KEY, Array.from(sessions.values()));
  }
}
