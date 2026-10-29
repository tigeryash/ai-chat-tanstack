import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CorsExposure } from "@/lib/local-endpoints/cors-check";
import type { LocalEndpoint } from "@/lib/local-endpoints/endpoints";

// Who else may use a local server, after "Test connection" (docs/security.md, "Local model servers").

export function CorsNotice({
	endpoint,
	cors,
	onHide,
}: {
	endpoint: LocalEndpoint;
	cors: CorsExposure;
	onHide: () => void;
}) {
	if (cors === "this-site") {
		return (
			<p className="flex items-center gap-1.5 text-emerald-700 text-sm dark:text-emerald-400">
				<CheckIcon aria-hidden="true" className="size-4" />
				Only this site can use this server.
			</p>
		);
	}
	if (cors === "unknown") {
		return (
			<p className="text-muted-foreground text-sm">
				Couldn't check which websites can use this server.
			</p>
		);
	}
	if (endpoint.hideCorsWarning) return null;
	const origin = window.location.origin;
	return (
		<div
			role="alert"
			aria-label="Every website can use this server"
			className="grid gap-2 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3 text-sm"
		>
			<p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
				<TriangleAlertIcon aria-hidden="true" className="size-4" />
				Every website you visit can use this server
			</p>
			<p className="text-muted-foreground">
				It allows requests from any origin, so while it runs, any open tab could
				send it prompts or read its replies. Safer setups:
			</p>
			<ul className="list-disc gap-0.5 pl-5 text-muted-foreground">
				<li>
					<strong>Ollama:</strong> allow only this site. Quit Ollama, then start
					it with{" "}
					<code className="rounded bg-muted px-1 font-mono text-xs">
						OLLAMA_ORIGINS={origin} ollama serve
					</code>{" "}
					(or set <code className="font-mono text-xs">OLLAMA_ORIGINS</code> in
					its environment and restart it).
				</li>
				<li>
					<strong>LM Studio:</strong> "Enable CORS" can't be limited to one
					site. Turn it on only while you use it, and stop the server when
					you're done.
				</li>
			</ul>
			<div>
				<Button size="sm" variant="outline" onClick={onHide}>
					Don't show again for {endpoint.name}
				</Button>
			</div>
		</div>
	);
}
