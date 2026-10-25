const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

// Brevo rejects senders that aren't verified in its dashboard, so there is no safe default address.
const REQUIRED_ENV = ["BREVO_API_KEY", "EMAIL_FROM_ADDRESS"] as const;

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Thrown when this Convex deployment can't send email. Emails carry verification and reset links
 * (bearer tokens), so a missing key fails loudly instead of logging the email (hard rule 4).
 */
export class EmailNotConfiguredError extends Error {
  constructor(missing: readonly string[]) {
    super(`Email is not configured on this Convex deployment: set ${missing.join(" and ")}.`);
    this.name = "EmailNotConfiguredError";
  }
}

/** Names of the env vars sending email needs that are unset. Names only, never values. */
export function missingEmailEnv(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]);
}

export async function sendEmail({ to, subject, text, html }: EmailOptions) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey || !fromAddress) {
    throw new EmailNotConfiguredError(missingEmailEnv());
  }

  const response = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      // JSON.stringify drops an undefined name, and Brevo then shows the address alone.
      sender: { name: process.env.EMAIL_FROM_NAME || undefined, email: fromAddress },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html || `<p>${text}</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Brevo rejected the email: HTTP ${response.status}${await brevoErrorCode(response)}`);
  }

  return response.json();
}

/**
 * Better Auth's `onPasswordReset`. It's awaited after the password has already changed, so a failed
 * notice is logged, not thrown: otherwise `/reset-password` reports an error for a reset that worked.
 * `sendEmail` errors name the cause (missing env, Brevo status) without the address or the message.
 */
export async function sendPasswordChangedNotice(to: string) {
  try {
    await sendEmail({
      to,
      subject: "Your password has been reset",
      text: "Your password has been reset.",
    });
  } catch (error) {
    console.error(
      "Password reset succeeded, but the confirmation email failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

// Brevo's error `message` can quote the request (recipient, sender), so only its `code` is kept, and
// only when it looks like one of Brevo's identifiers (`invalid_parameter`, `unauthorized`, ...).
async function brevoErrorCode(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const code = typeof body === "object" && body !== null && "code" in body ? body.code : null;
  return typeof code === "string" && /^[a-z_]{1,64}$/.test(code) ? ` (${code})` : "";
}
