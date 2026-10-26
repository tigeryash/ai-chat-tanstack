import { z } from "zod";

// The only place app code imports Zod from (Biome's noRestrictedImports enforces it). Zod 4 compiles
// object schemas with `new Function`, which our CSP forbids, and since Zod 4.6 it probes for eval when an
// object schema is *created*, not first parsed. Turning jitless on here means it is on before any module
// can create a schema, however the bundler orders chunks: every schema module imports this one first.
z.config({ jitless: true });

export { z };
