import { useEffect, useState } from "react";
import { listLocalModels, type ModelList } from "@/lib/chat/list-models";

/**
 * What the local server (LM Studio, roadmap 1.2) reports at its `/models`, asked the first time
 * `enabled` is true (the picker opening), so a page load never calls localhost (Chrome may ask the
 * person about local network access). Null until answered. Slice 2.3 adds endpoint settings.
 */
export function useLocalModels(enabled: boolean): ModelList | null {
	const [list, setList] = useState<ModelList | null>(null);
	const [asked, setAsked] = useState(false);
	if (enabled && !asked) setAsked(true);
	useEffect(() => {
		if (!asked) return;
		let current = true;
		listLocalModels().then((result) => {
			if (current) setList(result);
		});
		return () => {
			current = false;
		};
	}, [asked]);
	return list;
}
