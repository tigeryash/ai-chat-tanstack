import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	addLocalEndpoint,
	MAX_ENDPOINTS,
	useLocalEndpoints,
} from "@/lib/local-endpoints/endpoints";
import { LocalEndpointForm } from "./local-endpoint-form";
import { LocalEndpointRow } from "./local-endpoint-row";

/**
 * Settings → Local models (roadmap 2.3). LM Studio, Ollama or any OpenAI-compatible server on this
 * computer. Nothing here calls a server until the user clicks "Test connection".
 */
export function LocalEndpoints() {
	const endpoints = useLocalEndpoints();
	const [adding, setAdding] = useState(false);

	return (
		<section aria-labelledby="local-endpoints" className="grid gap-2">
			<div className="flex items-center gap-3">
				<h2 id="local-endpoints" className="mr-auto font-semibold">
					Local models
				</h2>
				{!adding && endpoints.length < MAX_ENDPOINTS && (
					<Button variant="outline" size="sm" onClick={() => setAdding(true)}>
						Add local server
					</Button>
				)}
			</div>
			<p className="max-w-2xl text-muted-foreground text-sm">
				Chat with models running on this computer. Your browser talks to the
				server directly; nothing goes through our server.
			</p>
			{adding && (
				<div className="py-2">
					<LocalEndpointForm
						submitLabel="Add server"
						onCancel={() => setAdding(false)}
						onSave={(draft) => {
							addLocalEndpoint(draft);
							setAdding(false);
						}}
					/>
				</div>
			)}
			{endpoints.length === 0 && !adding && (
				<p className="py-2 text-muted-foreground text-sm">
					No local servers yet.
				</p>
			)}
			<div className="grid">
				{endpoints.map((endpoint) => (
					<LocalEndpointRow key={endpoint.id} endpoint={endpoint} />
				))}
			</div>
		</section>
	);
}
