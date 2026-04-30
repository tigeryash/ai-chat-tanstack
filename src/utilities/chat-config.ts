import {
	DEFAULT_CHAT_MODEL,
	DEFAULT_CHAT_PROVIDER,
	DEFAULT_LMSTUDIO_BASE_URL,
	env,
} from "@/env";

export function getClientChatConfig() {
	return {
		model: env.VITE_CHAT_MODEL ?? DEFAULT_CHAT_MODEL,
		provider: env.VITE_CHAT_PROVIDER ?? DEFAULT_CHAT_PROVIDER,
	};
}

export function getServerChatConfig() {
	return {
		model:
			process.env.CHAT_MODEL ??
			process.env.VITE_CHAT_MODEL ??
			env.VITE_CHAT_MODEL ??
			DEFAULT_CHAT_MODEL,
		provider:
			process.env.CHAT_PROVIDER ??
			process.env.VITE_CHAT_PROVIDER ??
			env.VITE_CHAT_PROVIDER ??
			DEFAULT_CHAT_PROVIDER,
		baseUrl:
			process.env.LMSTUDIO_BASE_URL ??
			process.env.VITE_LMSTUDIO_BASE_URL ??
			env.VITE_LMSTUDIO_BASE_URL ??
			DEFAULT_LMSTUDIO_BASE_URL,
	};
}
