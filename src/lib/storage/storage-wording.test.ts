import { describe, expect, it } from "vitest";
import { estimateSummary, formatBytes, usageSummary } from "./storage-wording";

describe("storage wording", () => {
	it("formats bytes in binary units", () => {
		expect(formatBytes(0)).toBe("0 bytes");
		expect(formatBytes(1)).toBe("1 byte");
		expect(formatBytes(1023)).toBe("1023 bytes");
		expect(formatBytes(1536)).toBe("1.5 KB");
		expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
		expect(formatBytes(2 * 1024 ** 3)).toBe("2 GB");
		expect(formatBytes(-5)).toBe("0 bytes");
	});

	it("counts chats and files in plain words", () => {
		expect(usageSummary({ chats: 1, attachments: 0 })).toBe(
			"1 chat and 0 attached files",
		);
		expect(usageSummary({ chats: 1200, attachments: 1 })).toBe(
			"1,200 chats and 1 attached file",
		);
	});

	it("says nothing about the estimate when the browser doesn't give one", () => {
		expect(estimateSummary(null, null)).toBeNull();
		expect(estimateSummary(2048, null)).toBe(
			"2 KB used by this site in this browser",
		);
		expect(estimateSummary(2048, 1024 ** 3)).toBe(
			"2 KB used by this site in this browser, of about 1 GB it allows",
		);
	});
});
