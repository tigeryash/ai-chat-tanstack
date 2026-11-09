import { describe, expect, it } from "vitest";
import { MAX_PANES } from "@/lib/storage/workspace";
import {
	MAX_LINK_PANES,
	modelLinkHref,
	modelLinkSearchSchema,
	parseModelLink,
	resolveModelLink,
} from "./model-link";

// Deep links `/new?models=a,b,c` (roadmap 3.5).

describe("model links", () => {
	it("keeps the workspace's pane limit", () => {
		expect(MAX_LINK_PANES).toBe(MAX_PANES);
	});

	it("reads the ids in order, dropping blank and malformed ones", () => {
		expect(
			parseModelLink(" anthropic/claude-opus-5.5, ,openai/gpt-5.5,<script>,-x"),
		).toEqual(["anthropic/claude-opus-5.5", "openai/gpt-5.5"]);
		expect(parseModelLink(undefined)).toEqual([]);
		expect(parseModelLink("")).toEqual([]);
		expect(parseModelLink(`a/${"b".repeat(300)}`)).toEqual([]);
	});

	it("opens at most four panes, repeats included", () => {
		expect(parseModelLink("a/1,a/1,b/2,c/3,d/4,e/5")).toEqual([
			"a/1",
			"a/1",
			"b/2",
			"c/3",
		]);
	});

	it("ignores a search value that isn't usable text", () => {
		expect(modelLinkSearchSchema.parse({ models: "a/1,b/2" })).toEqual({
			models: "a/1,b/2",
		});
		expect(modelLinkSearchSchema.parse({ models: 12 })).toEqual({});
		expect(modelLinkSearchSchema.parse({ models: ["a"] })).toEqual({});
		expect(modelLinkSearchSchema.parse({ models: "x".repeat(2000) })).toEqual(
			{},
		);
		expect(modelLinkSearchSchema.parse({})).toEqual({});
	});

	it("matches ids to catalog models and lists the rest as missing", () => {
		const models = [{ gatewayId: "a/1" }, { gatewayId: "b/2" }];
		expect(resolveModelLink(["b/2", "zz/9", "a/1", "b/2"], models)).toEqual({
			found: [{ gatewayId: "b/2" }, { gatewayId: "a/1" }, { gatewayId: "b/2" }],
			missing: ["zz/9"],
		});
	});

	it("builds a link that parses back to the same ids", () => {
		const href = modelLinkHref(
			["anthropic/claude-opus-5.5", "openai/gpt-5.5"],
			"https://example.test",
		);
		expect(href).toBe(
			"https://example.test/new?models=anthropic/claude-opus-5.5,openai/gpt-5.5",
		);
		const value = new URL(href ?? "").searchParams.get("models") ?? "";
		expect(parseModelLink(value)).toEqual([
			"anthropic/claude-opus-5.5",
			"openai/gpt-5.5",
		]);
		expect(modelLinkHref([], "https://example.test")).toBeUndefined();
	});
});
