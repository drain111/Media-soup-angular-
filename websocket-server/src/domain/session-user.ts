/** What the login cookie carries and what the API exposes about the logged-in user. */
export interface SessionUser {
  id: string; // "<provider>:<subject>"
  loginKey: string; // lowercase
  name?: string;
}
export type AccessCheck = 
  | { allowed: true;  reason: 'host' | 'invited'; roomName: string }
  | { allowed: false; reason: 'unknown' | 'expired' | 'notInvited' };
