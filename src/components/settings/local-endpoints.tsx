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
 * Settings → Connections → Local models (roadmap 2.3). LM Studio, Ollama or any OpenAI-compatible server on this
 * computer. Nothing here calls a server until the user clicks "Test connection".
 */
export function LocalEndpoints() {
	const endpoints = useLocalEndpoints();
	const [adding, setAdding] = useState(false);

	return (
		<div className="grid gap-2">
			{!adding && endpoints.length < MAX_ENDPOINTS && (
				<div>
					<Button variant="outline" size="sm" onClick={() => setAdding(true)}>
						Add local server
					</Button>
				</div>
			)}
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
		</div>
	);
}
