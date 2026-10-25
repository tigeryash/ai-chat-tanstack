// Shared by Better Auth (convex/auth.ts) and the auth forms (src/lib/auth-schemas.ts), so the client
// never accepts a password the server would reject.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
