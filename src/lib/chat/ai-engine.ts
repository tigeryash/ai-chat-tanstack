// The parts of `ai` that run a request (streamText, the gateway, middleware). Chat code imports them
// from here, never from "ai", and only from modules that load on the first send (stream-reply.ts).
//
// `ai` ships as one module, so the chunk with `useChat`'s `Chat` (which every chat page preloads) would
// otherwise also hold streamText and the gateway SDK. In production builds `aiEngineCopy()` in
// vite.config.ts makes this file's "ai" a separate copy of the module, so the first send downloads these
// and the page doesn't (about 50 KB gzip off /new). Dev and Vitest use plain "ai".
export {
	APICallError,
	convertToModelMessages,
	createGateway,
	extractReasoningMiddleware,
	RetryError,
	streamText,
	wrapLanguageModel,
} from "ai";
