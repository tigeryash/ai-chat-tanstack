// API origins the browser may call directly (roadmap decision 3: model calls go browser → provider).
// This list is the CSP `connect-src` allowlist, so a provider added here becomes reachable from the
// page, and one missing here is blocked once the CSP is enforced. CORS for each was checked on
// 2026-10-20; check it again before adding one.
export const PROVIDER_API_ORIGINS = [
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
	// Chat completions and the OAuth PKCE key exchange (roadmap 1.1).
	"https://openrouter.ai",
	"https://router.huggingface.co",
	"https://ai-gateway.vercel.sh",
] as const;

// Local model servers (LM Studio, Ollama) on any port. Chrome's Local Network Access prompt still
// asks the user first (docs/security.md, "Local model servers").
export const LOCAL_MODEL_ORIGINS = [
	"http://localhost:*",
	"http://127.0.0.1:*",
] as const;
