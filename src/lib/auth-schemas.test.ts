import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH } from "../../convex/lib/passwordPolicy";
import { loginSchema } from "./auth-schemas";

const EMAIL = "someone@example.test";

describe("loginSchema", () => {
	it("uses the server's minimum password length of 8", () => {
		expect(MIN_PASSWORD_LENGTH).toBe(8);
	});

	it("rejects a password shorter than the server allows", () => {
		const result = loginSchema.safeParse({ email: EMAIL, password: "1234567" });

		expect(result.success).toBe(false);
		expect(result.error?.flatten().fieldErrors.password).toBeDefined();
	});

	it("accepts a password of exactly the minimum length", () => {
		expect(
			loginSchema.safeParse({ email: EMAIL, password: "12345678" }).success,
		).toBe(true);
	});

	it("rejects a malformed email", () => {
		expect(
			loginSchema.safeParse({ email: "not-an-email", password: "12345678" })
				.success,
		).toBe(false);
	});
});
