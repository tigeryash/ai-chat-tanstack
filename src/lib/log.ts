import { redact } from "@/lib/redact";

// App code logs errors through here, so everything reaching the console (and Vercel's logs) passes
// `redact()` first. Pass a short label plus names, codes, or paths; never prompts, replies, or files.

export function logError(label: string, ...details: unknown[]): void {
	console.error(label, ...details.map((detail) => redact(detail)));
}

export function logWarn(label: string, ...details: unknown[]): void {
	console.warn(label, ...details.map((detail) => redact(detail)));
}
