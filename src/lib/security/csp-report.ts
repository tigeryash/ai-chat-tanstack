import { z } from "@/lib/zod";

// Parses what browsers POST to the CSP report endpoint into one short summary per violation. The
// policy uses `report-uri` (`{ "csp-report": {...} }`, application/csp-report); Reporting API batches
// (`[{ type: "csp-violation", body: {...} }]`) are read too, for when it moves to `report-to`.
// Only the directive, the blocked origin, and the page path are kept: a report's `script-sample`
// and full URLs can quote page content, which never goes in logs (hard rule 4).

export const MAX_CSP_REPORT_BYTES = 64 * 1024;
const MAX_VIOLATIONS_PER_REQUEST = 20;

export interface CspViolation {
	directive: string;
	blocked: string;
	page: string;
	disposition: string;
}

const text = z.string().max(4096).optional();

const legacyReport = z.object({
	"csp-report": z.object({
		"document-uri": text,
		"violated-directive": text,
		"effective-directive": text,
		"blocked-uri": text,
		disposition: text,
	}),
});

const reportingApiReport = z.object({
	type: z.literal("csp-violation"),
	body: z.object({
		documentURL: text,
		effectiveDirective: text,
		blockedURL: text,
		disposition: text,
	}),
});

export function parseCspReport(payload: unknown): CspViolation[] {
	const legacy = legacyReport.safeParse(payload);
	if (legacy.success) {
		const report = legacy.data["csp-report"];
		return [
			summarize({
				directive:
					report["effective-directive"] ?? report["violated-directive"],
				blocked: report["blocked-uri"],
				page: report["document-uri"],
				disposition: report.disposition,
			}),
		];
	}

	if (!Array.isArray(payload)) return [];
	return payload.slice(0, MAX_VIOLATIONS_PER_REQUEST).flatMap((entry) => {
		const parsed = reportingApiReport.safeParse(entry);
		if (!parsed.success) return [];
		const { body } = parsed.data;
		return [
			summarize({
				directive: body.effectiveDirective,
				blocked: body.blockedURL,
				page: body.documentURL,
				disposition: body.disposition,
			}),
		];
	});
}

function summarize(raw: {
	directive?: string;
	blocked?: string;
	page?: string;
	disposition?: string;
}): CspViolation {
	return {
		directive: (raw.directive ?? "unknown").split(" ")[0] ?? "unknown",
		blocked: blockedSource(raw.blocked),
		page: pathOf(raw.page),
		disposition: raw.disposition === "enforce" ? "enforce" : "report",
	};
}

/** Keywords (`inline`, `eval`, `data`) as they are; URLs cut down to their origin. */
function blockedSource(blocked: string | undefined): string {
	if (!blocked) return "unknown";
	if (/^[a-z-]+$/i.test(blocked)) return blocked;
	try {
		const url = new URL(blocked);
		return url.origin === "null" ? url.protocol : url.origin;
	} catch {
		return "unparseable";
	}
}

/** Only the path: a query string can hold a reset token or a search. */
function pathOf(page: string | undefined): string {
	if (!page) return "unknown";
	try {
		return new URL(page).pathname;
	} catch {
		return "unparseable";
	}
}
