import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { KeyMode } from "@/lib/keys";
import {
	finishOpenRouterConnect,
	OpenRouterConnectError,
	readOpenRouterCallback,
	startOpenRouterConnect,
	withoutOpenRouterCallback,
} from "@/lib/keys/openrouter-oauth";
import { logError } from "@/lib/log";
import { KeyModeChoice } from "./key-mode-choice";

type Status =
	| { kind: "idle" }
	| { kind: "working"; message: string }
	| { kind: "done"; message: string }
	| { kind: "error"; message: string };

interface ConnectOpenRouterProps {
	connected: boolean;
	onConnected: (key: string, mode: KeyMode) => Promise<void>;
}

/**
 * "Connect OpenRouter": sends the user to OpenRouter's consent page, and when they come back to this
 * page with `?code=`, trades it for a key and saves it. The page must be the callback URL.
 */
export function ConnectOpenRouter({
	connected,
	onConnected,
}: ConnectOpenRouterProps) {
	const [mode, setMode] = useState<KeyMode>("remember");
	const [status, setStatus] = useState<Status>({ kind: "idle" });
	const handledCallback = useRef(false);

	useEffect(() => {
		if (handledCallback.current) return;
		handledCallback.current = true;
		const url = new URL(window.location.href);
		const callback = readOpenRouterCallback(url);
		if (!callback) return;
		// Drop the code from the address bar and history before anything else runs.
		window.history.replaceState(
			window.history.state,
			"",
			withoutOpenRouterCallback(url),
		);

		setStatus({
			kind: "working",
			message: "Finishing the OpenRouter connection…",
		});
		finishOpenRouterConnect(callback)
			.then(({ key, mode: chosenMode }) => onConnected(key, chosenMode))
			.then(() =>
				setStatus({ kind: "done", message: "OpenRouter is connected." }),
			)
			.catch((error: unknown) => {
				if (error instanceof OpenRouterConnectError) {
					setStatus({ kind: "error", message: error.message });
					return;
				}
				logError("Couldn't finish connecting OpenRouter:", error);
				setStatus({
					kind: "error",
					message: "Couldn't save the OpenRouter key in this browser.",
				});
			});
	}, [onConnected]);

	const connect = async () => {
		setStatus({ kind: "working", message: "Opening OpenRouter…" });
		const callbackUrl = `${window.location.origin}${window.location.pathname}`;
		window.location.assign(await startOpenRouterConnect(callbackUrl, mode));
	};

	return (
		<section
			aria-labelledby="connect-openrouter"
			className="grid gap-3 rounded-lg border p-4"
		>
			<div className="grid gap-1">
				<h2 id="connect-openrouter" className="font-semibold">
					Connect OpenRouter
				</h2>
				<p className="text-sm text-muted-foreground">
					Sign in to OpenRouter to make a key for this app, without copying one.
					On OpenRouter's page you can set a credit limit for it. One OpenRouter
					key runs models from most providers.
				</p>
			</div>
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
					status.kind === "error" ? "text-sm text-destructive" : "text-sm"
				}
			>
				{status.kind === "idle" ? "" : status.message}
			</p>
		</section>
	);
}
