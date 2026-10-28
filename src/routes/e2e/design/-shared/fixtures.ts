import type { UIMessage } from "ai";

// Fixture data for the design-direction prototypes (roadmap 3.0). Nothing here is fetched or stored.

export type FixturePane = {
	id: string;
	model: string;
	brand: "claude" | "deepseek";
	via: string;
	messages: UIMessage[];
};

export const SIDEBAR_CHATS = {
	pinned: ["Code reviewer prompt", "Weekly planning"],
	recent: [
		"Why does my list re-render?",
		"Rust vs Go error handling",
		"Lisbon in four days",
		"Explain the KV cache",
		"Postgres index for a feed",
		"Rewrite the onboarding email",
	],
};

export const ACTIVE_CHAT = "Why does my list re-render?";

const QUESTION =
	"My React list re-renders every row on each keystroke in the search box. Why, and what's the smallest fix?";

const question = (id: string): UIMessage => ({
	id,
	role: "user",
	parts: [{ type: "text", text: QUESTION }],
});

const metadata = (model: string) => ({ provider: "openrouter", model });

export const PANES: FixturePane[] = [
	{
		id: "left",
		model: "Claude Sonnet 5.5",
		brand: "claude",
		via: "OpenRouter",
		messages: [
			question("left-user"),
			{
				id: "left-reply",
				role: "assistant",
				metadata: metadata("anthropic/claude-sonnet-5.5"),
				parts: [
					{ type: "step-start" },
					{
						type: "reasoning",
						// Still streaming, so the trace stays open and its title shimmers.
						state: "streaming",
						text: "The search state probably lives in the same component as the list. Every keystroke sets state there, so React renders the parent and, by default, every child row. Rows also get a new `onSelect` arrow each render, so even memoized rows would re-render.",
					},
					{
						type: "text",
						text: "The search box and the list share a parent, so each keystroke re-renders that parent **and every row under it**.\n\nSmallest fix: move the input's state into its own component and pass only the *debounced* query up.\n\n```tsx\nconst rows = useMemo(() => filter(items, query), [items, query]);\n```",
					},
				],
			},
		],
	},
	{
		id: "right",
		model: "DeepSeek V4.1 Flash",
		brand: "deepseek",
		via: "OpenRouter",
		messages: [
			question("right-user"),
			{
				id: "right-reply",
				role: "assistant",
				metadata: metadata("deepseek/deepseek-v4.1-flash"),
				parts: [
					{ type: "step-start" },
					{
						type: "reasoning",
						state: "done",
						text: "Typing updates state high in the tree; the rows aren't memoized.",
					},
					{
						type: "text",
						text: "Typing updates state that sits above the list, so React re-renders every row.\n\n1. Keep the query in the input's own component.\n2. Wrap each row in `memo`.\n3. Pass stable callbacks (or let the React Compiler do it).\n\nWith the compiler on, step 1 alone is usually enough.",
					},
				],
			},
		],
	},
];
