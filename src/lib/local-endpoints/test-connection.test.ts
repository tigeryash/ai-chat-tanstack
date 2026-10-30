import { describe, expect, it, vi } from "vitest";
import { checkCors } from "./cors-check";
import { localNetworkAccess } from "./network-access";
import { testLocalEndpoint } from "./test-connection";

const BASE = "http://127.0.0.1:1234/v1";

function serving(allowOrigin?: string) {
	return (async () =>
		Response.json(
			{ data: [{ id: "qwen" }] },
			{
				headers: allowOrigin
					? { "access-control-allow-origin": allowOrigin }
					: {},
			},
		)) as unknown as typeof fetch;
}

describe("checkCors", () => {
	it("trusts a readable `*` without probing", async () => {
		const probe = vi.fn();
		expect(await checkCors(`${BASE}/models`, "*", probe)).toBe("any-site");
		expect(probe).not.toHaveBeenCalled();
	});

	it("probes from another origin when the header is hidden or echoes ours", async () => {
		const probe = vi.fn(async () => "this-site" as const);
		expect(await checkCors(`${BASE}/models`, null, probe)).toBe("this-site");
		expect(
			await checkCors(`${BASE}/models`, "https://www.highelollms.com", probe),
		).toBe("this-site");
		expect(probe).toHaveBeenCalledWith(`${BASE}/models`);
	});
});

describe("testLocalEndpoint", () => {
	it("returns the models and the CORS finding", async () => {
		expect(
			await testLocalEndpoint(BASE, {
				fetch: serving(),
				probe: async () => "any-site",
			}),
		).toEqual({ ok: true, models: ["qwen"], cors: "any-site" });
	});

	it("doesn't probe a server it couldn't list", async () => {
		const probe = vi.fn();
		const failing = (async () => {
			throw new TypeError("Failed to fetch");
		}) as typeof fetch;
		expect(
			await testLocalEndpoint(BASE, {
				fetch: failing,
				networkAccess: async () => "prompt",
				probe,
			}),
		).toEqual({ ok: false, reason: "unreachable" });
		expect(probe).not.toHaveBeenCalled();
	});

	it("reports a server that never answers as timed out", async () => {
		const probe = vi.fn();
		const hanging = ((_url: string, init?: RequestInit) =>
			new Promise((_, reject) => {
				init?.signal?.addEventListener("abort", () =>
					reject(init.signal?.reason),
				);
			})) as typeof fetch;
		expect(
			await testLocalEndpoint(BASE, { fetch: hanging, timeoutMs: 10, probe }),
		).toEqual({ ok: false, reason: "timed-out" });
		expect(probe).not.toHaveBeenCalled();
	});
});

describe("localNetworkAccess", () => {
	it("uses the first permission name the browser knows", async () => {
		const query = vi.fn(async ({ name }: { name: string }) => {
			if (name !== "local-network-access") throw new TypeError("unknown");
			return { state: "denied" } as PermissionStatus;
		});
		expect(await localNetworkAccess({ query })).toBe("denied");
		expect(query).toHaveBeenCalledTimes(2);
	});

	it("is unknown in browsers without the permission", async () => {
		const query = vi.fn(async () => {
			throw new TypeError("unknown");
		});
		expect(await localNetworkAccess({ query })).toBe("unknown");
		expect(await localNetworkAccess(undefined)).toBe("unknown");
	});
});
