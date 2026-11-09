import { useEffect, useState } from "react";
import { useViewer } from "@/lib/account";
import { logError } from "@/lib/log";
import { visibleChats } from "@/lib/storage/ownership";
import type { Prompt } from "./prompt";
import { type PromptStore, promptStore } from "./prompt-store";

export type PromptListState =
	| { status: "loading" }
	| { status: "ready"; prompts: Prompt[] }
	| { status: "error" };

/**
 * The prompts the viewer may see (roadmap 1.9's rule, like chats: their account's and the ones made
 * signed out), kept current as prompts change in any tab.
 */
export function usePrompts(
	store: PromptStore = promptStore(),
): PromptListState {
	const viewer = useViewer();
	const [state, setState] = useState<PromptListState>({ status: "loading" });
	useEffect(
		() =>
			store.watchPrompts(
				(prompts) => setState({ status: "ready", prompts }),
				(error) => {
					logError("Couldn't read the prompt library:", error);
					setState({ status: "error" });
				},
			),
		[store],
	);
	if (state.status !== "ready") return state;
	if (viewer === undefined) return { status: "loading" };
	return { status: "ready", prompts: visibleChats(state.prompts, viewer) };
}
