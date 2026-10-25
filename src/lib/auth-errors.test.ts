import { afterEach, describe, expect, it, vi } from "vitest";
import {
	AUTH_MESSAGES,
	authErrorMessage,
	NETWORK_ERROR_STATUS,
	requestAuth,
} from "./auth-errors";

const FALLBACK = "Something went wrong";

describe("authErrorMessage", () => {
	it("explains that email is unavailable when the email guard answers 503", () => {
		expect(
			authErrorMessage(
				{ status: 503, code: "SERVICE_UNAVAILABLE", message: "raw" },
				FALLBACK,
			),
		).toBe(AUTH_MESSAGES.emailUnavailable);
	});

	it("asks the user to wait when rate limited", () => {
		expect(authErrorMessage({ status: 429 }, FALLBACK)).toBe(
			AUTH_MESSAGES.rateLimited,
		);
	});

	it("points at the connection when no response came back", () => {
		expect(authErrorMessage({ status: NETWORK_ERROR_STATUS }, FALLBACK)).toBe(
			AUTH_MESSAGES.network,
		);
	});

	it("uses the caller's fallback for anything else", () => {
		expect(
			authErrorMessage({ status: 400, message: "Invalid email" }, FALLBACK),
		).toBe(FALLBACK);
	});
});

describe("requestAuth", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("resolves to null when the call succeeds", async () => {
		await expect(
			requestAuth(async () => ({ error: null })),
		).resolves.toBeNull();
	});

	it("passes Better Auth's error through", async () => {
		const error = { status: 503, code: "SERVICE_UNAVAILABLE" };

		await expect(requestAuth(async () => ({ error }))).resolves.toBe(error);
	});

	it("turns a thrown request into a network error and logs only the error's name", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(
			requestAuth(async () => {
				throw new TypeError(
					"Failed to fetch https://example.test/?token=secret",
				);
			}),
		).resolves.toEqual({ status: NETWORK_ERROR_STATUS });
		expect(log).toHaveBeenCalledWith("Auth request failed:", "TypeError");
		expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
	});
});
