import type { ModelChoice } from "@/lib/chat/model-selection";
import type { HostOption } from "./host-options";

// Switching a chat's host (roadmap 2.2b): Auto (best connected host), or a pinned connected host. The
// header's host switcher and the palette's "Switch host" page (R2 S7) both switch through it.

export const AUTO_HOST = "auto";

/** The connected hosts serving the model; a switcher is offered only with two or more. */
export function connectedHosts(hosts: readonly HostOption[]): HostOption[] {
	return hosts.filter((option) => option.connected);
}

/** `AUTO_HOST` or the pinned host's provider. */
export function currentHost(choice: ModelChoice): string {
	return choice.autoHost !== false ? AUTO_HOST : choice.provider;
}

/** The choice after picking `host` (`AUTO_HOST` or a provider), or undefined for an unknown host. */
export function choiceWithHost(
	choice: ModelChoice,
	hosts: readonly HostOption[],
	host: unknown,
): ModelChoice | undefined {
	if (host === AUTO_HOST) {
		return { ...choice, upstream: undefined, autoHost: true };
	}
	const option = connectedHosts(hosts).find((entry) => entry.provider === host);
	if (!option) return undefined;
	return {
		provider: option.provider,
		model: option.model,
		gatewayId: choice.gatewayId,
		autoHost: false,
	};
}
