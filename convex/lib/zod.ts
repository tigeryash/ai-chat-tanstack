// Convex code takes Zod from the app's module too, so there's one place that configures it
// (jitless mode; see src/lib/zod.ts). Relative path: Convex's type check doesn't know the `@/` alias.
export { z } from "../../src/lib/zod";
