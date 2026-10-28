import { type ResolveModel, resolveProviderModel } from "./browser-transport";
import { LOCAL_PROVIDER } from "./model-selection";

// Playwright drives the real chat routes (`/new`, `/$chatId`) without calling a real model (hard rule 6).
// In builds made with VITE_E2E=true, the local provider's model named `E2E_MOCK_MODEL` is the AI SDK
// mock model. Anywhere else the check is false at build time, so the mock never ships.

export const E2E_MOCK_MODEL = "e2e-mock-model";
export const E2E_MOCK_REPLY = ["Hello from ", "the mock ", "model."];

export const resolveAppModel: ResolveModel = async (selection) => {
	if (
		import.meta.env.VITE_E2E === "true" &&
		selection.provider === LOCAL_PROVIDER &&
		selection.model === E2E_MOCK_MODEL
	) {
		const { mockChatModel } = await import("./mock-model");
		return mockChatModel({ text: E2E_MOCK_REPLY, chunkDelayInMs: 20 });
	}
	return resolveProviderModel(selection);
};
