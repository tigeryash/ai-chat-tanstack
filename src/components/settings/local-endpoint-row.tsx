import { useId, useState } from "react";
import { CorsNotice } from "@/components/local-endpoints/cors-notice";
import {
	NetworkAccessDenied,
	NetworkAccessExplainer,
} from "@/components/local-endpoints/network-access-help";
import { Button } from "@/components/ui/button";
import {
	type EndpointKind,
	endpointHost,
	hideCorsWarning,
	type LocalEndpoint,
	removeLocalEndpoint,
	updateLocalEndpoint,
} from "@/lib/local-endpoints/endpoints";
import { LIST_TIMEOUT_MS } from "@/lib/local-endpoints/list-models";
import {
	markNetworkAccessExplained,
	useNetworkAccessExplained,
} from "@/lib/local-endpoints/network-access";
import {
	type ConnectionResult,
	testLocalEndpoint,
} from "@/lib/local-endpoints/test-connection";
import { LocalEndpointForm } from "./local-endpoint-form";

type Phase =
	| { step: "idle" }
	| { step: "explaining" }
	| { step: "testing" }
	| { step: "done"; result: ConnectionResult };

/** How to get a server answering this site, when it doesn't. */
function setupHint(kind: EndpointKind): string {
	const origin = window.location.origin;
	switch (kind) {
		case "lmstudio":
			return 'In LM Studio, open the Developer tab, start the server and turn on "Enable CORS".';
		case "ollama":
			return `Start Ollama with OLLAMA_ORIGINS=${origin} so it accepts this site.`;
		case "custom":
			return `Check the server is running and allows requests from ${origin} (CORS).`;
	}
}

function FailureMessage({
	endpoint,
	result,
}: {
	endpoint: LocalEndpoint;
	result: Extract<ConnectionResult, { ok: false }>;
}) {
	if (result.reason === "denied") return <NetworkAccessDenied />;
	return (
		<p role="alert" className="text-destructive text-sm">
			{failureText(endpoint, result)}
		</p>
	);
}

function failureText(
	endpoint: LocalEndpoint,
	result: Extract<ConnectionResult, { ok: false }>,
): string {
	const host = endpointHost(endpoint);
	switch (result.reason) {
		case "unreachable":
			return `Couldn't reach ${host}. ${setupHint(endpoint.kind)}`;
		case "timed-out":
			return `${host} timed out: it didn't send its model list within ${LIST_TIMEOUT_MS / 1000} seconds. Check the server isn't stuck loading a model, then test again.`;
		default:
			return `${host} answered${result.status ? ` with an error (${result.status})` : ", but not with a model list"}. Check that the URL is the server's OpenAI-compatible API (usually ending in /v1).`;
	}
}

function ModelsFound({ models }: { models: readonly string[] }) {
	if (models.length === 0) {
		return (
			<p className="text-sm">
				Connected, but the server reports no models. Load or pull one first.
			</p>
		);
	}
	return (
		<div className="grid gap-1.5">
			<p className="text-emerald-700 text-sm dark:text-emerald-400">
				Connected · {models.length} {models.length === 1 ? "model" : "models"}
			</p>
			<ul aria-label="Models on this server" className="flex flex-wrap gap-1">
				{models.map((model) => (
					<li
						key={model}
						className="rounded-md border px-1.5 py-0.5 font-mono text-xs"
					>
						{model}
					</li>
				))}
			</ul>
		</div>
	);
}

export function LocalEndpointRow({ endpoint }: { endpoint: LocalEndpoint }) {
	const headingId = useId();
	const explained = useNetworkAccessExplained();
	const [editing, setEditing] = useState(false);
	const [phase, setPhase] = useState<Phase>({ step: "idle" });

	// Runs inside the click handler, so the first local request always comes from a user click.
	const runTest = () => {
		setPhase({ step: "testing" });
		testLocalEndpoint(endpoint.baseUrl).then((result) =>
			setPhase({ step: "done", result }),
		);
	};
	const startTest = () => {
		if (explained) runTest();
		else setPhase({ step: "explaining" });
	};

	return (
		<section
			aria-labelledby={headingId}
			className="grid gap-3 border-b py-4 last:border-b-0"
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<div className="mr-auto grid gap-0.5">
					<h3 id={headingId} className="font-medium">
						{endpoint.name}
					</h3>
					<p className="font-mono text-muted-foreground text-xs">
						{endpoint.baseUrl}
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={startTest}
					disabled={phase.step === "testing" || phase.step === "explaining"}
				>
					{phase.step === "testing" ? "Testing…" : "Test connection"}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setEditing(true)}
					disabled={editing}
				>
					Edit
				</Button>
				<Button
					variant="destructive"
					size="sm"
					onClick={() => removeLocalEndpoint(endpoint.id)}
				>
					Remove
				</Button>
			</div>
			{editing && (
				<LocalEndpointForm
					initial={endpoint}
					submitLabel="Save changes"
					onCancel={() => setEditing(false)}
					onSave={(draft) => {
						updateLocalEndpoint(endpoint.id, draft);
						setEditing(false);
						setPhase({ step: "idle" });
					}}
				/>
			)}
			{phase.step === "explaining" && (
				<NetworkAccessExplainer
					onContinue={() => {
						markNetworkAccessExplained();
						runTest();
					}}
					onCancel={() => setPhase({ step: "idle" })}
				/>
			)}
			<div aria-live="polite" className="grid gap-2 empty:hidden">
				{phase.step === "done" &&
					(phase.result.ok ? (
						<>
							<ModelsFound models={phase.result.models} />
							<CorsNotice
								endpoint={endpoint}
								cors={phase.result.cors}
								onHide={() => hideCorsWarning(endpoint.id)}
							/>
						</>
					) : (
						<FailureMessage endpoint={endpoint} result={phase.result} />
					))}
			</div>
		</section>
	);
}
