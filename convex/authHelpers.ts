import type { UserIdentity } from "convex/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";

type AppUser = Doc<"users">;
type AuthUser = NonNullable<
	Awaited<ReturnType<typeof authComponent.safeGetAuthUser>>
>;

function getAuthUserAvatar(
	authUser: AuthUser,
	identity: UserIdentity,
): string | undefined {
	return authUser.image ?? identity.pictureUrl ?? undefined;
}

function buildUserProfilePatch(
	user: AppUser,
	authUser: AuthUser,
	identity: UserIdentity,
) {
	const name = authUser.name ?? identity.name;
	const email = authUser.email ?? identity.email;
	const avatarUrl = getAuthUserAvatar(authUser, identity);

	const patch: Partial<AppUser> = {};

	if (user.authUserId !== authUser._id) {
		patch.authUserId = authUser._id;
	}

	if (user.tokenIdentifier !== identity.tokenIdentifier) {
		patch.tokenIdentifier = identity.tokenIdentifier;
	}

	if (name !== undefined && user.name !== name) {
		patch.name = name;
	}

	if (email !== undefined && user.email !== email) {
		patch.email = email;
	}

	if (avatarUrl !== undefined && user.avatarUrl !== avatarUrl) {
		patch.avatarUrl = avatarUrl;
	}

	return patch;
}

async function findUserByLegacyFields(
	ctx: QueryCtx,
	authUser: AuthUser,
	identity: UserIdentity,
): Promise<AppUser | null> {
	if (authUser.email) {
		const byEmail = await ctx.db
			.query("users")
			.withIndex("by_email", (q) => q.eq("email", authUser.email))
			.first();

		if (byEmail) {
			return byEmail;
		}
	}

	return await ctx.db
		.query("users")
		.withIndex("by_token", (q) =>
			q.eq("tokenIdentifier", identity.tokenIdentifier),
		)
		.first();
}

async function getAuthIdentity(ctx: QueryCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		return null;
	}

	const authUser = await authComponent.safeGetAuthUser(ctx);
	if (!authUser) {
		return null;
	}

	return { identity, authUser };
}

async function findAppUser(
	ctx: QueryCtx,
	authUser: AuthUser,
	identity: UserIdentity,
) {
	const user = await ctx.db
		.query("users")
		.withIndex("by_auth_user", (q) => q.eq("authUserId", authUser._id))
		.first();

	return user ?? (await findUserByLegacyFields(ctx, authUser, identity));
}

/**
 * Creates the signed-in user's `users` row, or refreshes its profile fields from Better Auth.
 * Mutations only (it writes). The old read-only `getCurrentUserOrNull` went with the old chat backend; restore it
 * from git history when a query needs the caller's row.
 */
export async function upsertCurrentUser(ctx: MutationCtx): Promise<AppUser> {
	const auth = await getAuthIdentity(ctx);
	if (!auth) {
		throw new Error("Unauthenticated");
	}

	const { identity, authUser } = auth;
	const user = await findAppUser(ctx, authUser, identity);
	const now = Date.now();

	if (!user) {
		const userId = await ctx.db.insert("users", {
			authUserId: authUser._id,
			tokenIdentifier: identity.tokenIdentifier,
			name: authUser.name ?? identity.name,
			email: authUser.email ?? identity.email,
			avatarUrl: getAuthUserAvatar(authUser, identity),
			createdAt: now,
			updatedAt: now,
		});

		const created = await ctx.db.get(userId);
		if (!created) {
			throw new Error("Failed to create user");
		}
		return created;
	}

	const patch = buildUserProfilePatch(user, authUser, identity);
	if (Object.keys(patch).length === 0) {
		return user;
	}

	await ctx.db.patch(user._id, { ...patch, updatedAt: now });
	return { ...user, ...patch, updatedAt: now };
}
