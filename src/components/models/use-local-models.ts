import { useEffect, useState } from "react";
import {
	type LocalEndpoint,
	useLocalEndpoints,
} from "@/lib/local-endpoints/endpoints";
import {
	listLocalModels,
	type ModelList,
} from "@/lib/local-endpoints/list-models";
import { useNetworkAccessExplained } from "@/lib/local-endpoints/network-access";

/** One saved endpoint and what it reported; `list` is null while it hasn't answered. */
export interface LocalEndpointModels {
	endpoint: LocalEndpoint;
	list: ModelList | null;
}

/**
 * What each saved local endpoint reports at its `/models`, asked each time `enabled` turns true (the
 * picker opening, a click). A page load never calls localhost, nothing is called before an endpoint
 * is saved, and nothing before the user has read our Local Network Access explainer.
 */
export function useLocalModels(enabled: boolean): {
	endpoints: LocalEndpointModels[];
	explained: boolean;
} {
	const endpoints = useLocalEndpoints();
	const explained = useNetworkAccessExplained();
	const [lists, setLists] = useState<Record<string, ModelList>>({});
	const active = enabled && explained && endpoints.length > 0;
	const targets = endpoints.map((endpoint) => endpoint.baseUrl).join(" ");

	useEffect(() => {
		if (!active) return;
		let current = true;
		const urls = [...new Set(targets.split(" "))];
		for (const url of urls) {
			listLocalModels(url).then((list) => {
				if (current) setLists((previous) => ({ ...previous, [url]: list }));
			});
		}
		return () => {
			current = false;
		};
	}, [active, targets]);

	return {
		endpoints: endpoints.map((endpoint) => ({
			endpoint,
			list: lists[endpoint.baseUrl] ?? null,
		})),
		explained,
	};
}
