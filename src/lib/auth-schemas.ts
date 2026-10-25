import { z } from "zod";
import {
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
} from "../../convex/lib/passwordPolicy";

// Same limits as Better Auth on the server (convex/auth.ts).
export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});
