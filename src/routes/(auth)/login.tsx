import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
	AuthField,
	AuthForm,
	FormAlert,
	LINK_CLASS,
	SubmitButton,
	useAuthSubmit,
} from "@/components/auth/auth-form";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, requestAuth } from "@/lib/auth-errors";
import {
	loginSchema,
	loginSearchSchema,
	type VerifyLinkError,
} from "@/lib/auth-schemas";

export const Route = createFileRoute("/(auth)/login")({
	validateSearch: loginSearchSchema,
	component: RouteComponent,
});

// Shown when a verification link redirects here with `?error=`. Signing in with the unverified address
// then offers a new link.
const VERIFY_LINK_MESSAGES: Record<VerifyLinkError, string> = {
	TOKEN_EXPIRED:
		"That verification link has expired. Sign in to get a new one.",
	INVALID_TOKEN:
		"That verification link didn't work. It may have been cut short. Sign in to get a new one.",
	USER_NOT_FOUND:
		"We couldn't find an account for that verification link. Create an account to continue.",
	INVALID_USER: "That verification link didn't work. Sign in to get a new one.",
};

function RouteComponent() {
	const router = useRouter();
	const { error: linkError } = Route.useSearch();
	// The address the last sign-in was refused for because it isn't verified yet.
	const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
	const { errors, formError, pending, onSubmit } = useAuthSubmit(
		loginSchema,
		async ({ email, password }) => {
			setUnverifiedEmail(null);
			const error = await requestAuth(() =>
				authClient.signIn.email({ email, password }),
			);
			if (error?.code === "EMAIL_NOT_VERIFIED") {
				setUnverifiedEmail(email);
				return "Verify your email first: open the link we sent when you signed up.";
			}
			if (error) {
				return authErrorMessage(error, error.message || "Login failed");
			}
			await router.navigate({ to: "/new" });
			return null;
		},
	);

	return (
		<AuthForm errors={errors} onSubmit={onSubmit}>
			<FormAlert message={linkError ? VERIFY_LINK_MESSAGES[linkError] : null} />
			<AuthField
				name="email"
				label="Email"
				type="email"
				autoComplete="email"
				placeholder="Enter email"
			/>
			<AuthField
				name="password"
				label="Password"
				type="password"
				autoComplete="current-password"
				placeholder="Enter password"
				labelAside={
					<Link to="/forgot-password" className={LINK_CLASS}>
						Forgot password?
					</Link>
				}
			/>
			<FormAlert message={formError} />
			{/* Cleared with the alert when the form is submitted again. */}
			{formError && unverifiedEmail && (
				<ResendVerification email={unverifiedEmail} />
			)}
			<SubmitButton pending={pending}>Login</SubmitButton>
			<p className="text-white/80">
				New here?{" "}
				<Link to="/signup" className={LINK_CLASS}>
					Create an account
				</Link>
			</p>
		</AuthForm>
	);
}

function ResendVerification({ email }: { email: string }) {
	const [sending, setSending] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const resend = async () => {
		setSending(true);
		setError(null);
		const failure = await requestAuth(() =>
			// The new link lands back here, like the one sent at sign-up.
			authClient.sendVerificationEmail({ email, callbackURL: "/login" }),
		);
		setSending(false);
		if (failure) {
			// A 500 can carry Brevo's rejection, so never show the server's message.
			setError(
				authErrorMessage(failure, "Couldn't send the email. Try again."),
			);
			return;
		}
		setSent(true);
	};

	if (sent) return <ResendConfirmation />;
	return (
		<>
			<button
				type="button"
				onClick={resend}
				disabled={sending}
				aria-busy={sending}
				className={`${LINK_CLASS} cursor-pointer disabled:cursor-wait disabled:opacity-60`}
			>
				{sending ? "Sending…" : "Resend verification email"}
			</button>
			<FormAlert message={error} />
		</>
	);
}

// Signed out, Better Auth answers the same for an unknown, a verified and an unverified address, so this
// can't say whether an email went out. Focus moves here because the button it replaces is gone.
function ResendConfirmation() {
	const ref = useRef<HTMLParagraphElement>(null);

	useEffect(() => {
		ref.current?.focus();
	}, []);

	return (
		<p
			ref={ref}
			tabIndex={-1}
			className="w-full rounded-lg border border-white/30 bg-white/10 p-3 text-white/90 focus:outline-none"
		>
			If that address still needs verifying, we've sent it a new link. Open it,
			then sign in. Nothing after a few minutes? Check your spam folder.
		</p>
	);
}
