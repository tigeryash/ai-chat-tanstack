import { z } from "zod";

// Zod 4 compiles object schemas with `new Function`, which the CSP forbids (no 'unsafe-eval').
// Jitless mode parses the same way without eval. Imported first by src/router.tsx so it runs before
// any schema parses (Zod checks once and caches the answer).
z.config({ jitless: true });
