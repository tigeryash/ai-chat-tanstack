import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { components } from './_generated/api'
import { query } from './_generated/server'
import type { GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'
import { queueEmail, sendPasswordChangedNotice } from "./email";
import { requireEmailConfigured } from "./emailGuard";
import authConfig from "./auth.config";
import { hideAccountExistence } from "./lib/hideAccountExistence";
import { dropOAuthTokens } from "./lib/oauthTokens";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./lib/passwordPolicy";

const siteUrl = process.env.SITE_URL!

export const authComponent = createClient<DataModel>(components.betterAuth)


export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false },
) => {
  return betterAuth({
    logger: {
      disabled: optionsOnly,
    },
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    hooks: {
      before: requireEmailConfigured,
    },
    databaseHooks: {
      // Sign-in is the only use of Google/GitHub/Discord, so their OAuth tokens are never stored.
      account: dropOAuthTokens,
    },
    emailAndPassword: {
     enabled: true,
     minPasswordLength: MIN_PASSWORD_LENGTH,
     maxPasswordLength: MAX_PASSWORD_LENGTH,
     autoSignIn: true,
     requireEmailVerification: true,
     // Queued, not sent here: only real accounts get one, so waiting on Brevo would reveal them.
     sendResetPassword: async ({ user, url }) => {
       await queueEmail(ctx, {
         to: user.email,
         subject: "Reset your password",
         text: `Click the link to reset your password: ${url}`,
       });
     },
     onPasswordReset: async ({ user }) => {
       await sendPasswordChangedNotice(user.email);
     },
    },
    emailVerification: {
       // Queued for the same reason: on sign-up, only a new address gets one.
       sendVerificationEmail: async ({ user, url }) => {
         await queueEmail(ctx, {
           to: user.email,
           subject: "Verify your email address",
           text: `Click the link to verify your email: ${url}`,
         });
       },
    }, 
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["email-password", "github", "discord", "google"],
        allowDifferentEmails: false,
        allowUnlinkingAll: true,
        updateUserInfoOnLink: true,
      },
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
      google: {
        prompt: "select_account",
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID as string,
        clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      },
    },
    plugins: [convex({ authConfig, jwksRotateOnTokenGenerationError: true, }), hideAccountExistence()],
  }) 
}
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx)
  },
})