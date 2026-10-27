import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import {
	ChatSetupError,
	chatErrorLogFields,
	describeChatError,
} from "./chat-errors";

const apiError = (statusCode: number) =>
	new APICallError({
		message: "provider said: sk-secret",
		url: "https://api.openai.com/v1/chat/completions",
		requestBodyValues: {},
		statusCode,
	});

describe("describeChatError", () => {
	it.each([
		[401, "OpenAI rejected the key. Check it in Settings."],
		[402, "OpenAI says the account is out of credits."],
		[404, "OpenAI doesn't know that model. Check the model name."],
		[429, "OpenAI is rate-limiting requests. Wait a moment and try again."],
		[503, "OpenAI had an error. Try again."],
	])("explains HTTP %i without the provider's message", (status, text) => {
		expect(describeChatError(apiError(status), "OpenAI")).toBe(text);
	});

	it("looks through retries", () => {
		const retried = new RetryError({
			message: "failed after retries",
			reason: "maxRetriesExceeded",
			errors: [apiError(500), apiError(429)],
		});
		expect(describeChatError(retried, "OpenAI")).toContain("rate-limiting");
	});

	it("explains a connection failure and passes setup errors through", () => {
		expect(describeChatError(new TypeError("Failed to fetch"), "X")).toContain(
			"Couldn't reach X",
		);
		expect(describeChatError(new ChatSetupError("Add a key."), "X")).toBe(
			"Add a key.",
		);
		expect(describeChatError(new Error("sk-secret"), "X")).toBe(
			"The request to X failed.",
		);
	});

	it("logs only the name and status", () => {
		expect(chatErrorLogFields(apiError(401))).toEqual({
			name: "AI_APICallError",
			status: 401,
		});
	});
});
