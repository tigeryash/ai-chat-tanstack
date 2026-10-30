import {
	type NativeIdProvider,
	PROVIDER_IDS,
	PROVIDER_REGISTRY,
} from "./provider-registry";

// Providers a user can call directly with their own key (roadmap decision 3), for which the model
// catalog records each model's native id (`nativeIds` in ./provider-registry).
//
// Imported by Convex (convex/lib/modelCatalog), so keep this file free of `@/` imports.
export const NATIVE_ID_PROVIDERS: readonly NativeIdProvider[] =
	PROVIDER_IDS.filter(
		(id): id is NativeIdProvider => PROVIDER_REGISTRY[id].nativeIds,
	);

export type { NativeIdProvider };
