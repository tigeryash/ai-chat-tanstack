import { type CorsExposure, checkCors } from "./cors-check";
import {
	type ListDeps,
	type ListFailure,
	listLocalModels,
} from "./list-models";

// Settings' "Test connection" (roadmap 2.3): the server's models, and who else may use it.

export type ConnectionResult =
	| { ok: true; models: string[]; cors: CorsExposure }
	| { ok: false; reason: ListFailure; status?: number };

export interface ConnectionDeps extends ListDeps {
	probe?: (url: string) => Promise<CorsExposure>;
}

export async function testLocalEndpoint(
	baseUrl: string,
	{ probe, ...deps }: ConnectionDeps = {},
): Promise<ConnectionResult> {
	const list = await listLocalModels(baseUrl, deps);
	if (!list.ok) return list;
	const cors = await checkCors(`${baseUrl}/models`, list.allowOrigin, probe);
	return { ok: true, models: list.models, cors };
}
