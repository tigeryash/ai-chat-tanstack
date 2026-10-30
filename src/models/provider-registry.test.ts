import { describe, expect, it } from "vitest";
import { PROVIDER_IDS, providerEntry } from "./provider-registry";

describe("provider registry", () => {
	it.each(PROVIDER_IDS)("keeps %s's API URLs on its own origins", (id) => {
		const entry = providerEntry(id);
		const urls = [
			entry.chatBaseUrl,
			entry.keyTest.url,
			entry.publicApiUrl,
		].filter((url): url is string => url !== undefined);
		for (const url of urls) {
			expect(entry.apiOrigins).toContain(new URL(url).origin);
		}
	});

	it.each(PROVIDER_IDS)("lists %s's origins as bare https origins", (id) => {
		for (const origin of providerEntry(id).apiOrigins) {
			expect(new URL(origin).origin).toBe(origin);
			expect(origin.startsWith("https://")).toBe(true);
		}
		expect(new URL(providerEntry(id).keyPageUrl).protocol).toBe("https:");
	});
});
