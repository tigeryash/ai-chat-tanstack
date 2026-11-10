import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { KeyMode } from "@/lib/keys";
import {
	clearOpenRouterConnectOutcome,
	OPENROUTER_CALLBACK_PATH,
	openRouterConnectOutcome,
} from "@/lib/keys/openrouter-callback";
import { startOpenRouterConnect } from "@/lib/keys/openrouter-oauth";
import { KeyModeChoice } from "./key-mode-choice";
import { useProviderKeys } from "./use-provider-keys";

type Status =
	| { kind: "idle" }
	| { kind: "working"; message: string }
	| { kind: "done"; message: string }
	| { kind: "error"; message: string };

/**
 * "Connect OpenRouter": sends the user to OpenRouter's consent page. The callback page
 * (`OPENROUTER_CALLBACK_PATH`) trades the code for a key, then opens this row, which shows how it went.
 */
export function ConnectOpenRouter({
	callbackPath = OPENROUTER_CALLBACK_PATH,
}: {
	callbackPath?: string;
}) {
	const { keys } = useProviderKeys();
	const connected = keys?.some((key) => key.providerId === "openrouter");
	const [mode, setMode] = useState<KeyMode>("remember");
	const [status, setStatus] = useState<Status>(
		() => openRouterConnectOutcome() ?? { kind: "idle" },
	);
	// Shown once: reopening Settings later starts clean.
	useEffect(() => clearOpenRouterConnectOutcome, []);

	const connect = async () => {
		setStatus({ kind: "working", message: "Opening OpenRouter…" });
		const callbackUrl = `${window.location.origin}${callbackPath}`;
		window.location.assign(await startOpenRouterConnect(callbackUrl, mode));
	};

	return (
		<div className="grid gap-3">
			{!connected && <KeyModeChoice value={mode} onChange={setMode} />}
			<div>
				<Button
					onClick={connect}
					disabled={status.kind === "working"}
					variant={connected ? "outline" : "default"}
				>
					{connected ? "Reconnect OpenRouter" : "Connect OpenRouter"}
				</Button>
			</div>
			<p
				aria-live="polite"
				className={
					status.kind === "error"
						? "text-sm text-destructive empty:hidden"
						: "text-sm empty:hidden"
				}
			>
				{status.kind === "idle" ? "" : status.message}
			</p>
		</div>
	);
}
