import { describe, expect, it } from "vitest";
import type { ModelChoice } from "@/lib/chat/model-selection";
import { AUTO_HOST, choiceWithHost, currentHost } from "./host-choice";
import type { HostOption } from "./host-options";

const choice: ModelChoice = {
	provider: "openrouter",
	model: "dev/model",
	gatewayId: "dev/model",
	upstream: "fireworks",
	autoHost: true,
};
const hosts = [
	{ provider: "openrouter", model: "dev/model", connected: true },
	{ provider: "fireworks", model: "fw/model", connected: true },
	{ provider: "deepseek", model: "ds", connected: false },
] as unknown as HostOption[]; // only the fields host-choice reads

describe("host choice", () => {
	it("Auto drops the pinned upstream", () => {
		expect(currentHost(choice)).toBe(AUTO_HOST);
		expect(choiceWithHost(choice, hosts, AUTO_HOST)).toEqual({
			...choice,
			upstream: undefined,
		});
	});

	it("pins a connected host with its own model id", () => {
		const next = choiceWithHost(choice, hosts, "fireworks");
		expect(next).toEqual({
			provider: "fireworks",
			model: "fw/model",
			gatewayId: "dev/model",
			autoHost: false,
		});
		expect(next && currentHost(next)).toBe("fireworks");
	});

	it("ignores a host that isn't connected", () => {
		expect(choiceWithHost(choice, hosts, "deepseek")).toBeUndefined();
	});
});
