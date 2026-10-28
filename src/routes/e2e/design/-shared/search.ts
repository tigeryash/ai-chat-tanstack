import { z } from "@/lib/zod";

// `?theme=light|dark` picks a design page's mode; each direction has its own default.
export const designSearch = z.object({
	theme: z.enum(["light", "dark"]).optional(),
});
