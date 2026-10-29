// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
	addLocalEndpoint,
	checkBaseUrl,
	hideCorsWarning,
	LOCAL_ENDPOINTS_STORAGE_KEY,
	localEndpointFor,
	readLocalEndpoints,
	removeLocalEndpoint,
	updateLocalEndpoint,
} from "./endpoints";

describe("checkBaseUrl", () => {
	it("accepts localhost and 127.0.0.1 on any port, without a trailing slash", () => {
		expect(checkBaseUrl(" http://localhost:1234/v1/ ")).toEqual({
			ok: true,
			url: "http://localhost:1234/v1",
		});
		expect(checkBaseUrl("https://127.0.0.1:8443/api/v1")).toEqual({
			ok: true,
			url: "https://127.0.0.1:8443/api/v1",
		});
	});

	it.each([
		"http://192.168.1.20:1234/v1",
		"http://my-pc.local:11434/v1",
		"http://[::1]:1234/v1",
		"https://api.example.com/v1",
	])("refuses %s, which the CSP blocks", (url) => {
		const checked = checkBaseUrl(url);
		expect(checked.ok).toBe(false);
		expect(!checked.ok && checked.error).toContain("Only localhost");
	});

	it.each([
		"localhost:1234",
		"ftp://localhost/v1",
		"http://user:pw@localhost:1234/v1",
		"http://localhost:1234/v1?x=1",
	])("refuses %s", (url) => {
		expect(checkBaseUrl(url).ok).toBe(false);
	});
});

describe("saved endpoints", () => {
	beforeEach(() => {
		for (const endpoint of readLocalEndpoints()) {
			removeLocalEndpoint(endpoint.id);
		}
	});

	it("adds, edits and removes, keeping the id", () => {
		const added = addLocalEndpoint({
			kind: "ollama",
			name: " ",
			baseUrl: "http://localhost:11434/v1/",
		});
		expect(added).toMatchObject({
			kind: "ollama",
			name: "Ollama",
			baseUrl: "http://localhost:11434/v1",
		});
		expect(localStorage.getItem(LOCAL_ENDPOINTS_STORAGE_KEY)).toContain(
			added.id,
		);

		updateLocalEndpoint(added.id, {
			kind: "ollama",
			name: "Ollama (desk)",
			baseUrl: "http://127.0.0.1:11434/v1",
		});
		expect(readLocalEndpoints()).toEqual([
			{ ...added, name: "Ollama (desk)", baseUrl: "http://127.0.0.1:11434/v1" },
		]);

		removeLocalEndpoint(added.id);
		expect(readLocalEndpoints()).toEqual([]);
	});

	it("refuses to save a LAN address", () => {
		expect(() =>
			addLocalEndpoint({
				kind: "custom",
				name: "LAN box",
				baseUrl: "http://10.0.0.5:8080/v1",
			}),
		).toThrow("Only localhost");
		expect(readLocalEndpoints()).toEqual([]);
	});

	it("keeps a dismissed CORS warning until the URL changes", () => {
		const added = addLocalEndpoint({
			kind: "lmstudio",
			name: "LM Studio",
			baseUrl: "http://localhost:1234/v1",
		});
		hideCorsWarning(added.id);
		updateLocalEndpoint(added.id, {
			kind: "lmstudio",
			name: "Renamed",
			baseUrl: added.baseUrl,
		});
		expect(readLocalEndpoints()[0]?.hideCorsWarning).toBe(true);
		updateLocalEndpoint(added.id, {
			kind: "lmstudio",
			name: "Renamed",
			baseUrl: "http://localhost:4321/v1",
		});
		expect(readLocalEndpoints()[0]?.hideCorsWarning).toBeUndefined();
	});

	it("runs choices made before 2.3 on the first saved endpoint", () => {
		expect(localEndpointFor(undefined)).toBeUndefined();
		const first = addLocalEndpoint({
			kind: "lmstudio",
			name: "LM Studio",
			baseUrl: "http://localhost:1234/v1",
		});
		const second = addLocalEndpoint({
			kind: "ollama",
			name: "Ollama",
			baseUrl: "http://localhost:11434/v1",
		});
		expect(localEndpointFor(undefined)).toEqual(first);
		expect(localEndpointFor(second.id)).toEqual(second);
		expect(localEndpointFor("ep-gone")).toBeUndefined();
	});
});
