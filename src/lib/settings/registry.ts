import { PROVIDER_IDS, PROVIDERS } from "@/lib/keys/providers";
import {
	SETTINGS_SECTIONS,
	type SettingsSection,
	type SettingsSectionId,
	settingsSection,
} from "./sections";

// The settings registry (roadmap R2 S1, docs/settings-research.md section 2): one typed list of every
// row in Settings. It drives the dialog's nav (a section with no rows is hidden), the dialog's search,
// and later the Cmd+K palette (S5). A later slice adds a setting by adding a row here and its control in
// `src/components/settings/setting-controls.tsx`; the type there makes a missing control a type error.
// No React and no controls here, so the palette can search settings without loading them.

/** Who a setting applies to (docs/settings-research.md, "Scope rules"). */
export type SettingScope = "global" | "model" | "workspace" | "chat";

/** Where it's kept: this device only, forever, or this device now and synced in Phase 6. */
export type SettingStorage = "device" | "syncs";

/** `inline`: label and description on the left, the control on the right. `block`: the control below. */
export type SettingLayout = "inline" | "block";

/** A card of rows within a section. Rows of one card sit together in `SETTINGS`. */
export interface SettingsCard {
	id: string;
	section: SettingsSectionId;
	/** Shown above the card, and names it for screen readers. */
	title?: string;
	description?: string;
}

export interface SettingDefinition {
	id: string;
	section: SettingsSectionId;
	card: string;
	label: string;
	description: string;
	/** Other words people search for. Labels are searched too. */
	keywords: readonly string[];
	scope: SettingScope;
	storage: SettingStorage;
	layout: SettingLayout;
}

export const SETTINGS_CARDS = [
	{
		id: "host-preferences",
		section: "models",
		title: "Host preferences",
		description:
			'How Auto picks a host for a model. Picking a host yourself in the model picker\'s "Run with" still runs it, marked. Kept in this browser and sent only to your own router (OpenRouter, AI Gateway).',
	},
	{ id: "openrouter", section: "connections" },
	{ id: "api-keys", section: "connections" },
	{ id: "local-models", section: "connections" },
	{ id: "theme", section: "appearance" },
	{ id: "text", section: "appearance", title: "Fonts" },
	{ id: "theme-file", section: "appearance" },
	{ id: "chat-notices", section: "chat" },
	{
		id: "background-status",
		section: "notifications",
		title: "Background status",
		description:
			"When this tab is in the background, show how replies are going. Only counts and the chat's name are shown, never what's in a chat.",
	},
	{ id: "transfer", section: "data" },
	{ id: "analytics", section: "privacy" },
	{ id: "legal", section: "privacy" },
] as const satisfies readonly SettingsCard[];

type CardId = (typeof SETTINGS_CARDS)[number]["id"];

const PROVIDER_NAMES = PROVIDER_IDS.map((id) => PROVIDERS[id].name);
const KEY_MODE_WORDS = [
	"key mode",
	"remember on this device",
	"this session only",
];

export const SETTINGS = [
	// Models & hosts
	{
		id: "blocked-hosts",
		section: "models",
		card: "host-preferences",
		label: "Blocked hosts",
		description:
			"Hosts Auto never uses, on OpenRouter, AI Gateway or a direct key. Name the host (DeepInfra), not the router.",
		keywords: [
			"blocklist",
			"ignore",
			"exclude host",
			"skip provider",
			"provider routing",
			"openrouter",
			"ai gateway",
		],
		scope: "global",
		storage: "device",
		layout: "block",
	},
	{
		id: "min-precision",
		section: "models",
		card: "host-preferences",
		label: "Exclude quantized",
		description:
			"Skip hosts that serve a model at lower precision than this. Hosts that don't say still count.",
		keywords: ["quantization", "precision", "fp8", "fp16", "fp4", "int4"],
		scope: "global",
		storage: "device",
		layout: "inline",
	},
	{
		id: "price-cap",
		section: "models",
		card: "host-preferences",
		label: "Price cap for Auto",
		description:
			"Auto skips hosts above these prices. Leave one empty for no cap there.",
		keywords: ["max price", "budget", "cost limit", "cheap", "spending"],
		scope: "global",
		storage: "device",
		layout: "block",
	},
	// Connections
	{
		id: "connect-openrouter",
		section: "connections",
		card: "openrouter",
		label: "Connect OpenRouter",
		description:
			"Sign in to OpenRouter to make a key for this app, without copying one. On OpenRouter's page you can set a credit limit for it. One OpenRouter key runs models from most providers.",
		keywords: ["oauth", "sign in", "credit limit", ...KEY_MODE_WORDS],
		scope: "global",
		storage: "device",
		layout: "block",
	},
	{
		id: "provider-keys",
		section: "connections",
		card: "api-keys",
		label: "API keys",
		description:
			"You pay providers directly with your own keys. A key stays in this browser and is only ever sent to its own provider, never to our server. Prefer keys with a spending limit.",
		keywords: [
			"provider",
			"bring your own key",
			"byok",
			"test key",
			"delete key",
			...KEY_MODE_WORDS,
			...PROVIDER_NAMES,
		],
		scope: "global",
		storage: "device",
		layout: "block",
	},
	{
		id: "local-endpoints",
		section: "connections",
		card: "local-models",
		label: "Local models",
		description:
			"Chat with models running on this computer. Your browser talks to the server directly; nothing goes through our server.",
		keywords: [
			"local server",
			"lm studio",
			"ollama",
			"localhost",
			"openai-compatible",
			"endpoint",
			"offline",
		],
		scope: "global",
		storage: "device",
		layout: "block",
	},
	// Appearance
	{
		id: "theme",
		section: "appearance",
		card: "theme",
		label: "Theme",
		description: "Light, dark, or follow your system.",
		keywords: ["dark mode", "light mode", "system", "color scheme"],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
	{
		id: "density",
		section: "appearance",
		card: "theme",
		label: "Density",
		description: "How much space sits around messages and controls.",
		keywords: ["compact", "comfortable", "spacing"],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
	{
		id: "accent-color",
		section: "appearance",
		card: "theme",
		label: "Accent color",
		description: "Buttons, selection and focus rings, in both themes.",
		keywords: ["primary color", "brand", "highlight"],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
	{
		id: "advanced-colors",
		section: "appearance",
		card: "theme",
		label: "Custom colors",
		description:
			"Every color by purpose, for light and dark, with a contrast check.",
		keywords: [
			"advanced colors",
			"palette",
			"background",
			"text color",
			"contrast",
			"wcag",
		],
		scope: "global",
		storage: "syncs",
		layout: "block",
	},
	{
		id: "text-size",
		section: "appearance",
		card: "text",
		label: "Text size",
		description: "Scales all text and controls.",
		keywords: ["font size", "zoom", "bigger", "smaller", "scale"],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
	{
		id: "ui-font",
		section: "appearance",
		card: "text",
		label: "Interface font",
		description: "Menus, buttons and labels.",
		keywords: ["typeface", "font"],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
	{
		id: "reading-font",
		section: "appearance",
		card: "text",
		label: "Message font",
		description: "Messages and replies.",
		keywords: ["reading font", "serif", "typeface", "font"],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
	{
		id: "code-font",
		section: "appearance",
		card: "text",
		label: "Code font",
		description: "Code blocks and inline code.",
		keywords: ["monospace", "typeface", "font"],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
	{
		id: "theme-file",
		section: "appearance",
		card: "theme-file",
		label: "Theme file",
		description:
			"Export your theme as a JSON file to keep or share it, or import one.",
		keywords: ["export theme", "import theme", "json", "share", "backup"],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
	{
		id: "reset-appearance",
		section: "appearance",
		card: "theme-file",
		label: "Reset appearance",
		description: "Back to the default theme, fonts, text size and colors.",
		keywords: ["reset all", "default", "restore"],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
	// Chat
	{
		id: "context-warnings",
		section: "chat",
		card: "chat-notices",
		label: "Context-length warnings",
		description:
			"A notice above a chat once it has used 80% of its model's context, and again when it's past it.",
		keywords: ["context window", "context limit", "token limit", "too long"],
		scope: "global",
		storage: "device",
		layout: "inline",
	},
	// Notifications
	{
		id: "tab-status",
		section: "notifications",
		card: "background-status",
		label: "Show reply status in the tab title",
		description: "The tab's title and icon show replies in progress or done.",
		keywords: ["background status", "favicon", "tab title"],
		scope: "global",
		storage: "device",
		layout: "inline",
	},
	{
		id: "notify-finished",
		section: "notifications",
		card: "background-status",
		label: "Notify me when a reply is ready",
		description:
			"A browser notification when a reply finishes in a background tab.",
		keywords: ["notification", "reply done", "alert"],
		scope: "global",
		storage: "device",
		layout: "inline",
	},
	{
		id: "notify-failed",
		section: "notifications",
		card: "background-status",
		label: "Notify me when a reply fails",
		description:
			"A browser notification when a reply fails in a background tab.",
		keywords: ["notification", "error", "alert"],
		scope: "global",
		storage: "device",
		layout: "inline",
	},
	{
		id: "notification-permission",
		section: "notifications",
		card: "background-status",
		label: "Browser permission",
		description: "Notifications need this browser's permission for this site.",
		keywords: ["allow notifications", "blocked", "permission"],
		scope: "global",
		storage: "device",
		layout: "inline",
	},
	{
		id: "test-notification",
		section: "notifications",
		card: "background-status",
		label: "Test notification",
		description: "Send one to check that notifications reach you.",
		keywords: ["send test notification", "try"],
		scope: "global",
		storage: "device",
		layout: "inline",
	},
	// Your data
	{
		id: "export-import",
		section: "data",
		card: "transfer",
		label: "Export and import",
		description:
			"Chats are kept in this browser. Export them, with their branches, attached files and model settings, plus your saved prompts, to one file you can keep or import on another device. A chat or prompt already here is replaced only by a newer copy. API keys are never included; the theme has its own export under Appearance.",
		keywords: [
			"export data",
			"import data",
			"backup",
			"download",
			"restore",
			"move device",
			"json",
		],
		scope: "global",
		storage: "device",
		layout: "block",
	},
	// Privacy
	{
		id: "analytics",
		section: "privacy",
		card: "analytics",
		label: "Share anonymous usage analytics",
		description:
			'Cookieless page views and load times (Vercel Web Analytics and Speed Insights), plus counts like "a message was sent" or "a model was picked", and error reports (Sentry) with keys and content removed. Never your messages, replies, files, keys or chat names.',
		keywords: [
			"analytics",
			"tracking",
			"telemetry",
			"error reports",
			"error reporting",
			"sentry",
			"opt out",
			"do not track",
		],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
	{
		id: "legal",
		section: "privacy",
		card: "legal",
		label: "Legal",
		description: "How we handle your data, and the terms for using the app.",
		keywords: ["privacy policy", "terms of service"],
		scope: "global",
		storage: "syncs",
		layout: "inline",
	},
] as const satisfies readonly (SettingDefinition & { card: CardId })[];

export type SettingId = (typeof SETTINGS)[number]["id"];
export type Setting = (typeof SETTINGS)[number];

export function settingsInSection(section: SettingsSectionId): Setting[] {
	return SETTINGS.filter((setting) => setting.section === section);
}

/** The section's cards that have rows, each with its rows, in registry order. */
export function cardsInSection(section: SettingsSectionId) {
	return SETTINGS_CARDS.filter((card) => card.section === section)
		.map((card) => ({
			card: card as SettingsCard,
			rows: SETTINGS.filter((setting) => setting.card === card.id),
		}))
		.filter(({ rows }) => rows.length > 0);
}

/**
 * Sections shown in the nav: those with rows, plus General, where Settings opens. A section without
 * rows yet still opens from a link (`?settings=keyboard`) and says what's coming.
 */
export function visibleSettingsSections(): SettingsSection[] {
	return SETTINGS_SECTIONS.filter(
		(section) =>
			section.id === "general" || settingsInSection(section.id).length > 0,
	);
}

export interface SettingMatch {
	setting: Setting;
	section: SettingsSection;
}

function normalize(text: string): string {
	return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** 0 for a label that starts with the query, 1 for a label that has it, 2 for a keyword match. */
function rank(setting: Setting, query: string, words: string[]): number | null {
	const label = normalize(setting.label);
	const haystack = [label, ...setting.keywords.map(normalize)].join(" | ");
	if (!words.every((word) => haystack.includes(word))) return null;
	if (label.startsWith(query)) return 0;
	return words.every((word) => label.includes(word)) ? 1 : 2;
}

/**
 * Settings whose label or keywords hold every word of `query` (case-insensitive), best first: label
 * matches before keyword matches, then registry order. An empty query matches nothing.
 */
export function searchSettings(query: string): SettingMatch[] {
	const normalized = normalize(query);
	if (!normalized) return [];
	const words = normalized.split(" ");
	return SETTINGS.flatMap((setting, index) => {
		const score = rank(setting, normalized, words);
		return score === null ? [] : [{ setting, score, index }];
	})
		.sort((a, b) => a.score - b.score || a.index - b.index)
		.map(({ setting }) => ({
			setting,
			section: settingsSection(setting.section),
		}));
}

export function settingById(id: SettingId): Setting {
	const setting = SETTINGS.find((s) => s.id === id);
	if (!setting) throw new Error(`Unknown setting: ${id}`);
	return setting;
}
