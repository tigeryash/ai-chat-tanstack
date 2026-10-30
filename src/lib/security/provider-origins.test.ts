import { describe, expect, it } from "vitest";
import { PROVIDER_API_ORIGINS } from "./provider-origins";

describe("PROVIDER_API_ORIGINS", () => {
	// The CSP's connect-src allowlist, built from the provider registry. Pinned here so a new origin
	// is a visible, reviewed change: check its CORS from a browser before updating this list.
	it("is exactly the reviewed list", () => {
		expect(PROVIDER_API_ORIGINS).toEqual([
			"https://api.openai.com",
			"https://api.anthropic.com",
			"https://generativelanguage.googleapis.com",
			"https://api.x.ai",
			"https://api.mistral.ai",
			"https://api.deepseek.com",
			"https://api.groq.com",
			"https://api.together.xyz",
			"https://api.fireworks.ai",
			"https://api.moonshot.ai",
			"https://api.cerebras.ai",
			"https://openrouter.ai",
			"https://router.huggingface.co",
			"https://huggingface.co",
			"https://ai-gateway.vercel.sh",
		]);
	});
});
