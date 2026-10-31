import { type ResolveModel, resolveProviderModel } from "./browser-transport";
import { LOCAL_PROVIDER } from "./model-selection";

// Playwright drives the real chat routes (`/new`, `/$chatId`) without calling a real model (hard rule 6).
// In builds made with VITE_E2E=true, the local provider's model named `E2E_MOCK_MODEL` is the AI SDK
// mock model. Anywhere else the check is false at build time, so the mock never ships.

export const E2E_MOCK_MODEL = "e2e-mock-model";
export const E2E_MOCK_REPLY = ["Hello from ", "the mock ", "model."];
/** Panes need models that tell apart (roadmap 3.1): `e2e-mock-model-<name>` replies "Hello from <name>.". */
export const e2eMockModel = (name: string) => `${E2E_MOCK_MODEL}-${name}`;
export const e2eMockReply = (name: string) => `Hello from ${name}.`;
/** Streams "tick " for about 20 s, long enough to press Stop. */
export const E2E_SLOW_MODEL = "e2e-slow-model";
const SLOW_CHUNKS = 200;
const SLOW_CHUNK_DELAY_MS = 100;

function mockReplyFor(model: string) {
	if (model === E2E_MOCK_MODEL) {
		return { text: E2E_MOCK_REPLY, chunkDelayInMs: 20 };
	}
	if (model === E2E_SLOW_MODEL) {
		return {
			text: Array.from({ length: SLOW_CHUNKS }, () => "tick "),
			chunkDelayInMs: SLOW_CHUNK_DELAY_MS,
		};
	}
	const prefix = `${E2E_MOCK_MODEL}-`;
	if (model.startsWith(prefix) && model.length > prefix.length) {
		const name = model.slice(prefix.length);
		return { text: ["Hello from ", name, "."], chunkDelayInMs: 20 };
	}
	return undefined;
}

export const resolveAppModel: ResolveModel = async (selection) => {
	const reply =
		import.meta.env.VITE_E2E === "true" && selection.provider === LOCAL_PROVIDER
			? mockReplyFor(selection.model)
			: undefined;
	if (reply) {
		const { mockChatModel } = await import("./mock-model");
		return mockChatModel(reply);
	}
	return resolveProviderModel(selection);
};
