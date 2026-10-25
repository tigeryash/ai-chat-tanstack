import { describe, expect, it } from "vitest";
import {
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
} from "../../convex/lib/passwordPolicy";
import {
	fieldErrors,
	forgotPasswordSchema,
	loginSchema,
	loginSearchSchema,
	MAX_NAME_LENGTH,
	resetPasswordSchema,
	resetPasswordSearchSchema,
	signupSchema,
	VERIFY_LINK_ERRORS,
} from "./auth-schemas";

const EMAIL = "someone@example.test";
const SHORT_PASSWORD = "1".repeat(MIN_PASSWORD_LENGTH - 1);
const MIN_PASSWORD = "1".repeat(MIN_PASSWORD_LENGTH);
const MAX_PASSWORD = "1".repeat(MAX_PASSWORD_LENGTH);
const LONG_PASSWORD = "1".repeat(MAX_PASSWORD_LENGTH + 1);

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

describe("signupSchema", () => {
	const valid = { name: "Someone", email: EMAIL, password: MIN_PASSWORD };

	it("accepts a name, an email and a password of the minimum length", () => {
		expect(signupSchema.safeParse(valid).success).toBe(true);
	});

	it("accepts a password of exactly the maximum length", () => {
		expect(
			signupSchema.safeParse({ ...valid, password: MAX_PASSWORD }).success,
		).toBe(true);
	});

	it.each([
		["shorter", SHORT_PASSWORD],
		["longer", LONG_PASSWORD],
	])("rejects a password %s than the server allows", (_, password) => {
		const result = signupSchema.safeParse({ ...valid, password });

		expect(result.success).toBe(false);
		expect(result.error?.flatten().fieldErrors.password).toBeDefined();
	});

	it.each([
		["empty", ""],
		["only spaces", "   "],
	])("rejects a name that is %s", (_, name) => {
		const result = signupSchema.safeParse({ ...valid, name });

		expect(result.success).toBe(false);
		expect(result.error?.flatten().fieldErrors.name).toBeDefined();
	});

	it("rejects a name over the length limit", () => {
		const result = signupSchema.safeParse({
			...valid,
			name: "a".repeat(MAX_NAME_LENGTH + 1),
		});

		expect(result.success).toBe(false);
	});

	it("trims the name and the email", () => {
		const result = signupSchema.safeParse({
			...valid,
			name: "  Someone  ",
			email: `  ${EMAIL} `,
		});

		expect(result.data).toMatchObject({ name: "Someone", email: EMAIL });
	});

	it("rejects a malformed email", () => {
		const result = signupSchema.safeParse({ ...valid, email: "not-an-email" });

		expect(result.error?.flatten().fieldErrors.email).toBeDefined();
	});

	it("keeps the password exactly as typed", () => {
		const password = "  spaces count  ";

		expect(signupSchema.safeParse({ ...valid, password }).data?.password).toBe(
			password,
		);
	});
});

describe("forgotPasswordSchema", () => {
	it("accepts an email", () => {
		expect(forgotPasswordSchema.safeParse({ email: EMAIL }).success).toBe(true);
	});

	it("rejects a malformed email", () => {
		const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });

		expect(result.error?.flatten().fieldErrors.email).toBeDefined();
	});
});

describe("resetPasswordSearchSchema", () => {
	it("reads the token Better Auth redirects with", () => {
		expect(resetPasswordSearchSchema.parse({ token: "abc123" })).toEqual({
			token: "abc123",
		});
	});

	it("reads Better Auth's error for an unknown or expired token", () => {
		expect(resetPasswordSearchSchema.parse({ error: "INVALID_TOKEN" })).toEqual(
			{ error: "INVALID_TOKEN" },
		);
	});

	it.each([
		["empty", ""],
		["not a string", 12345],
		["a list", ["a", "b"]],
	])("treats a token that is %s as missing", (_, token) => {
		expect(resetPasswordSearchSchema.parse({ token }).token).toBeUndefined();
	});
});

describe("loginSearchSchema", () => {
	it("lists the codes Better Auth's verify-email endpoint redirects with", () => {
		expect(VERIFY_LINK_ERRORS).toEqual([
			"TOKEN_EXPIRED",
			"INVALID_TOKEN",
			"USER_NOT_FOUND",
			"INVALID_USER",
		]);
	});

	it.each(VERIFY_LINK_ERRORS)("reads the %s error", (error) => {
		expect(loginSearchSchema.parse({ error })).toEqual({ error });
	});

	it("reads no error when the link worked", () => {
		expect(loginSearchSchema.parse({}).error).toBeUndefined();
	});

	it.each([
		["an unknown code", "SOMETHING_ELSE"],
		["free text", "Your account was deleted, call 555-0100"],
		["markup", "<img src=x onerror=alert(1)>"],
		["a known code in the wrong case", "token_expired"],
		["empty", ""],
		["not a string", 12345],
		["a list", ["TOKEN_EXPIRED", "INVALID_TOKEN"]],
	])("ignores an error that is %s", (_, error) => {
		expect(loginSearchSchema.parse({ error }).error).toBeUndefined();
	});
});

describe("fieldErrors", () => {
	it("lists messages only for the fields that failed", () => {
		const result = signupSchema.safeParse({
			name: "Someone",
			email: "not-an-email",
			password: SHORT_PASSWORD,
		});
		if (result.success) throw new Error("expected the parse to fail");

		expect(fieldErrors(result.error)).toEqual({
			email: ["Enter a valid email address"],
			password: [
				`Use at least ${MIN_PASSWORD_LENGTH} characters for your password`,
			],
		});
	});
});

describe("resetPasswordSchema", () => {
	it("accepts a password between the server's limits", () => {
		expect(
			resetPasswordSchema.safeParse({ password: MIN_PASSWORD }).success,
		).toBe(true);
		expect(
			resetPasswordSchema.safeParse({ password: MAX_PASSWORD }).success,
		).toBe(true);
	});

	it.each([
		["shorter", SHORT_PASSWORD],
		["longer", LONG_PASSWORD],
	])("rejects a password %s than the server allows", (_, password) => {
		const result = resetPasswordSchema.safeParse({ password });

		expect(result.error?.flatten().fieldErrors.password).toBeDefined();
	});
});
