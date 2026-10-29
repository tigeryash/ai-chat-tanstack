import { describe, expect, it } from "vitest";
import { classify, isRetryable } from "./classify";
import { type ChatCompletion, PROBES, parseJsonReply } from "./probes";

// Fixtures shaped like OpenRouter replies. Nothing here calls a model.

function reply(
	content: string | null,
	extra: {
		finish?: string;
		toolCalls?: unknown[];
		completionTokens?: number;
	} = {},
): ChatCompletion {
	return {
		choices: [
			{
				finish_reason: extra.finish ?? "stop",
				message: { content, tool_calls: extra.toolCalls },
			},
		],
		usage: {
			prompt_tokens: 8,
			completion_tokens: extra.completionTokens ?? 2,
			cost: 0.00001,
		},
	};
}

const ok = (body: unknown) => ({
	kind: "response" as const,
	status: 200,
	body,
});
const error = (status: number, message: string) => ({
	kind: "response" as const,
	status,
	body: { error: { code: status, message } },
});

function probe(parameter: string) {
	const found = PROBES.find((p) => p.parameter === parameter);
	if (!found) throw new Error(parameter);
	return found;
}

/** Classifies `completion` as the named probe's reply, running its effect check. */
function asProbe(parameter: string, completion: ChatCompletion) {
	const { check, request } = probe(parameter);
	const sent = request({ floor: 16 });
	return classify(ok(completion), check && ((c) => check(c, sent)));
}

describe("classify", () => {
	it("accepts a normal reply", () => {
		expect(classify(ok(reply("Hello")))).toEqual({ status: "accepted" });
	});

	it("rejects when no host can take the parameter", () => {
		const result = classify(
			error(
				404,
				"No endpoints found that can handle the requested parameters.",
			),
		);
		expect(result.status).toBe("rejected");
		expect(result.note).toContain("No endpoints found");
	});

	it.each([400, 422])("rejects a %i from the host", (status) => {
		expect(
			classify(error(status, "Unsupported parameter: 'temperature'")).status,
		).toBe("rejected");
	});

	it.each([429, 500, 502, 503, 403])("calls a %i inconclusive", (status) => {
		expect(classify(error(status, "busy")).status).toBe("inconclusive");
	});

	it("stops the run on a bad key or no credit", () => {
		expect(classify(error(401, "No auth")).fatal).toContain("401");
		expect(classify(error(402, "Insufficient credits")).fatal).toContain("402");
	});

	it("treats an error inside a 200 as that error", () => {
		const body = { error: { code: 400, message: "Provider returned error" } };
		expect(classify(ok(body)).status).toBe("rejected");
	});

	it("calls a network failure or an empty reply inconclusive", () => {
		expect(classify({ kind: "network", message: "ECONNRESET" }).status).toBe(
			"inconclusive",
		);
		expect(classify(ok({ choices: [] })).status).toBe("inconclusive");
		expect(classify(ok("<html>Bad gateway</html>")).status).toBe(
			"inconclusive",
		);
	});

	it("truncates long error notes", () => {
		const result = classify(error(400, "x".repeat(1000)));
		expect(result.note?.length).toBe(200);
	});

	it("retries only transient statuses", () => {
		expect([408, 429, 500, 503].every(isRetryable)).toBe(true);
		expect([200, 400, 401, 402, 404].some(isRetryable)).toBe(false);
	});
});

describe("effect checks", () => {
	it("stop: ignored when the stop word comes through", () => {
		expect(asProbe("stop", reply("red green blue")).status).toBe("ignored");
		expect(asProbe("stop", reply("red ")).status).toBe("accepted");
		// No "red" at all (e.g. the model only reasoned): can't tell, so not ignored.
		expect(asProbe("stop", reply("", { finish: "length" })).status).toBe(
			"accepted",
		);
	});

	it("max_tokens: ignored when the reply runs past the cap", () => {
		expect(
			asProbe("max_tokens", reply("Hi", { completionTokens: 12 })).status,
		).toBe("accepted");
		expect(
			asProbe("max_tokens", reply("Hi…", { completionTokens: 400 })).status,
		).toBe("ignored");
	});

	it("response_format: ignored when a finished reply isn't JSON", () => {
		expect(asProbe("response_format", reply('{"a":1}')).status).toBe(
			"accepted",
		);
		expect(
			asProbe("response_format", reply('```json\n{"a":1}\n```')).status,
		).toBe("accepted");
		expect(asProbe("response_format", reply("Sure! Here you go")).status).toBe(
			"ignored",
		);
		expect(
			asProbe("response_format", reply('{"a":', { finish: "length" })).status,
		).toBe("accepted");
	});

	it("structured_outputs: ignored when the schema isn't followed", () => {
		expect(asProbe("structured_outputs", reply('{"a":"hi"}')).status).toBe(
			"accepted",
		);
		expect(asProbe("structured_outputs", reply('{"b":2}')).status).toBe(
			"ignored",
		);
	});

	it("tool_choice: ignored when a forced call doesn't happen", () => {
		const call = [
			{
				id: "1",
				type: "function",
				function: { name: "ping", arguments: "{}" },
			},
		];
		expect(
			asProbe(
				"tool_choice",
				reply(null, { toolCalls: call, finish: "tool_calls" }),
			).status,
		).toBe("accepted");
		expect(asProbe("tool_choice", reply("Hello!")).status).toBe("ignored");
	});

	it("tools: a text answer proves nothing, so it stays accepted", () => {
		expect(asProbe("tools", reply("I can't call tools.")).status).toBe(
			"accepted",
		);
	});

	it("parses fenced JSON and rejects garbage", () => {
		expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
		expect(parseJsonReply("nope")).toBeUndefined();
	});
});
