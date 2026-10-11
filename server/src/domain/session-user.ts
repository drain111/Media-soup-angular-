/** What the login cookie carries and what the API exposes about the logged-in user. */
export interface SessionUser {
  id: string; // "<provider>:<subject>"
  email: string; // lowercase
  name?: string;
}
