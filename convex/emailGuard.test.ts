import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { isAPIError } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireEmailConfigured } from "./emailGuard";

const RECIPIENT = "someone@example.test";
const SIGN_UP = { email: RECIPIENT, password: "correct-horse-battery", name: "Someone" };

// A real Better Auth instance with the same email settings as convex/auth.ts, on an in-memory database.
function createTestAuth() {
  const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [] };
  const sendVerificationEmail = vi.fn(async () => {});
  const sendResetPassword = vi.fn(async () => {});
  const auth = betterAuth({
    baseURL: "http://localhost:3000",
    secret: "test-secret-that-is-at-least-32-characters-long",
    logger: { disabled: true },
    database: memoryAdapter(db),
    hooks: { before: requireEmailConfigured },
    emailAndPassword: { enabled: true, requireEmailVerification: true, sendResetPassword },
    emailVerification: { sendVerificationEmail },
  });
  return { auth, db, sendVerificationEmail, sendResetPassword };
}

async function statusOf(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (e: unknown) => e);
  return isAPIError(error) ? error.statusCode : error;
}

describe("convex/emailGuard.ts requireEmailConfigured", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", undefined);
    vi.stubEnv("EMAIL_FROM_ADDRESS", undefined);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuses email sign-up before creating the user when email isn't configured", async () => {
    const { auth, db, sendVerificationEmail } = createTestAuth();

    expect(await statusOf(auth.api.signUpEmail({ body: SIGN_UP }))).toBe(503);
    expect(db.user).toHaveLength(0);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    const logged = consoleError.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain("BREVO_API_KEY");
    expect(logged).not.toContain(RECIPIENT);
  });

  it("refuses reset and verification-email requests when email isn't configured", async () => {
    const { auth, sendResetPassword } = createTestAuth();

    expect(await statusOf(auth.api.requestPasswordReset({ body: { email: RECIPIENT } }))).toBe(503);
    expect(await statusOf(auth.api.sendVerificationEmail({ body: { email: RECIPIENT } }))).toBe(503);
    expect(sendResetPassword).not.toHaveBeenCalled();
  });

  it("leaves other routes alone", async () => {
    const { auth } = createTestAuth();

    // An unknown user gets the usual 401, not the guard's 503.
    expect(await statusOf(auth.api.signInEmail({ body: { email: RECIPIENT, password: "wrong-password" } }))).toBe(
      401,
    );
  });

  it("lets sign-up through and sends the verification email once email is configured", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-not-a-real-key");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "noreply@example.test");
    const { auth, db, sendVerificationEmail } = createTestAuth();

    await auth.api.signUpEmail({ body: SIGN_UP });

    expect(db.user).toHaveLength(1);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
