import { PROVIDER_IDS } from "@/lib/keys/providers";
import type { EndpointKind } from "@/lib/local-endpoints/endpoints";
import { z } from "@/lib/zod";

// The allowlist of analytics events (roadmap 1.8, decision 23). An event not listed here is dropped, and
// so is any property its schema doesn't name. Every property is a boolean, a small number, or a string
// from a closed set (an enum or a short lowercase slug), so free text (prompts, replies, file contents,
// keys, chat titles, URLs) has nowhere to go. A slice that adds an event adds it here and to
// docs/data-inventory.md.

/** Lowercase letters, digits, dots, dashes and underscores: a catalog id like "openai" or "moonshotai", never prose. */
const slug = z
	.string()
	.max(40)
	.regex(/^[a-z0-9][a-z0-9._-]*$/);

// Typed against the endpoint list without importing it: endpoints.ts sends `local_endpoint_added`.
const ENDPOINT_KINDS = [
	"lmstudio",
	"ollama",
	"custom",
] as const satisfies readonly EndpointKind[];

export const EVENT_SCHEMAS = {
	/** A message was sent. Pane count comes with multi-pane chats (Phase 3); hasAttachment is true when it carried a file (1.6). */
	chat_sent: z.object({
		providerKind: z.enum(["hosted", "local"]),
		paneCount: z.number().int().min(1).max(16).optional(),
		hasAttachment: z.boolean(),
	}),
	/** A model was picked in the model picker. `developer` is the catalog's developer id, or local/custom. */
	model_picked: z.object({
		developer: slug,
		highElo: z.boolean(),
	}),
	/** An API key was saved for a provider. Never the key, its length, or its last characters. */
	key_connected: z.object({
		provider: z.enum(PROVIDER_IDS),
	}),
	/** A local model server was saved. Never its name or URL. */
	local_endpoint_added: z.object({
		kind: z.enum(ENDPOINT_KINDS),
	}),
	/** The command palette opened (roadmap R2 S5). Never what was typed in it. */
	palette_opened: z.object({}),
	/**
	 * A palette command ran: its fixed id ("new-chat", "setting.theme"), or for one made from your data
	 * its kind ("chat.open"). Never a chat's id or title, a layout's name, or the query.
	 */
	command_run: z.object({ id: slug }),
} as const;

export type EventName = keyof typeof EVENT_SCHEMAS;
export type EventProperties<Name extends EventName> = z.input<
	(typeof EVENT_SCHEMAS)[Name]
>;
export type SafeProperties = Record<string, string | number | boolean>;

export function isEventName(name: string): name is EventName {
	return Object.hasOwn(EVENT_SCHEMAS, name);
}
