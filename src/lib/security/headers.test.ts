import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS, withSecurityHeaders } from "@/lib/security/headers";

describe("withSecurityHeaders", () => {
	it("adds the headers and keeps status, body, and every Set-Cookie", async () => {
		const original = new Response("body", {
			status: 201,
			headers: { "content-type": "text/plain" },
		});
		original.headers.append("set-cookie", "a=1; Path=/");
		original.headers.append("set-cookie", "b=2; Path=/");

		const response = withSecurityHeaders(original);

		expect(response.status).toBe(201);
		expect(await response.text()).toBe("body");
		expect(response.headers.getSetCookie()).toEqual([
			"a=1; Path=/",
			"b=2; Path=/",
		]);
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			expect(response.headers.get(name)).toBe(value);
		}
	});

	it("leaves a header the route set itself alone", () => {
		const response = withSecurityHeaders(
			new Response(null, { headers: { "referrer-policy": "no-referrer" } }),
		);
		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
	});

	it("works on responses with immutable headers, like a proxied fetch", () => {
		const immutable = Response.redirect("https://example.com/", 302);
		const response = withSecurityHeaders(immutable);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://example.com/");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});
});
