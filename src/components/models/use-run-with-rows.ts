import { useState } from "react";
import type { ModelChoice } from "@/lib/chat/model-selection";
import { type HostOption, isAvailable } from "@/lib/hosts/host-options";
import type { HostPrefs } from "@/lib/hosts/host-prefs";
import type { CurrentHost } from "./run-with";

// "Run with"'s state (roadmap 2.2b): whether Auto is on, the rows to show, and what pinning a host or
// turning Auto on or off chooses. Previewing another model only flips a local Auto switch.

export function useRunWithRows({
	gatewayId,
	hosts,
	autoPick,
	current,
	prefs,
	onChoose,
}: {
	gatewayId: string;
	hosts: readonly HostOption[];
	autoPick: HostOption | undefined;
	current: CurrentHost | undefined;
	prefs: HostPrefs;
	onChoose: (choice: ModelChoice, close: boolean) => void;
}) {
	// Previewing another model: Auto stays on until a host is picked.
	const [previewAuto, setPreviewAuto] = useState(true);
	const auto = current ? current.auto : previewAuto;
	const visible = prefs.hideUnavailable
		? hosts.filter((option) => isAvailable(option) && !option.excluded)
		: hosts;

	const pin = (option: HostOption, upstream?: string) =>
		onChoose(
			{
				provider: option.provider,
				model: option.model,
				gatewayId,
				upstream,
				autoHost: false,
			},
			true,
		);
	const setAuto = (on: boolean) => {
		if (!current) {
			setPreviewAuto(on);
			return;
		}
		if (on) {
			const pick = autoPick ?? hosts[0];
			if (pick) {
				onChoose(
					{
						provider: pick.provider,
						model: pick.model,
						gatewayId,
						autoHost: true,
					},
					false,
				);
			}
			return;
		}
		// Off: keep the host Auto chose, pinned.
		const now = hosts.find((option) => option.provider === current.provider);
		if (now?.connected) {
			onChoose(
				{
					provider: now.provider,
					model: now.model,
					gatewayId,
					upstream: current.upstream,
					autoHost: false,
				},
				false,
			);
		}
	};

	return { auto, visible, pin, setAuto };
}
