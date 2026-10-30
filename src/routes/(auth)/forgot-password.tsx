import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	AuthField,
	AuthForm,
	AuthNotice,
	FormAlert,
	LINK_CLASS,
	SubmitButton,
	useAuthSubmit,
} from "@/components/auth/auth-form";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, requestAuth } from "@/lib/auth-errors";
import { forgotPasswordSchema } from "@/lib/auth-schemas";

export const Route = createFileRoute("/(auth)/forgot-password")({
	component: RouteComponent,
});

function RouteComponent() {
	const [sent, setSent] = useState(false);

	return sent ? (
		<LinkSent />
	) : (
		<ForgotPasswordForm onSent={() => setSent(true)} />
	);
}

function ForgotPasswordForm({ onSent }: { onSent: () => void }) {
	const { errors, formError, pending, onSubmit } = useAuthSubmit(
		forgotPasswordSchema,
		async ({ email }) => {
			const error = await requestAuth(() =>
				authClient.requestPasswordReset({
					email,
					// The emailed link checks the token, then lands here with `?token=` or `?error=INVALID_TOKEN`.
					redirectTo: "/reset-password",
				}),
			);
			// Better Auth answers the same whether or not the account exists, and still answers success
			// when the email fails to send. So an error here (email not configured, rate limit, offline)
			// says nothing about the address, and showing it can't reveal who has an account.
			if (error) {
				return authErrorMessage(error, "Couldn't send the link. Try again.");
			}
			onSent();
			return null;
		},
	);

	return (
		<AuthForm errors={errors} onSubmit={onSubmit}>
			<p className="w-full text-muted-foreground form-root">
				Enter the email you signed up with and we'll send you a link to choose a
				new password.
			</p>
			<AuthField
				name="email"
				label="Email"
				type="email"
				autoComplete="email"
				placeholder="Enter email"
			/>
			<FormAlert message={formError} />
			<SubmitButton pending={pending}>
				{pending ? "Sending…" : "Send reset link"}
			</SubmitButton>
			<p className="text-muted-foreground">
				Remembered it?{" "}
				<Link to="/login" className={LINK_CLASS}>
					Back to sign in
				</Link>
			</p>
		</AuthForm>
	);
}

// The same message for every address, so the page can't be used to find out who has an account.
function LinkSent() {
	return (
		<AuthNotice title="Check your email" focusTitle>
			<p>
				If an account exists for that address, we sent it a link to reset your
				password. The link works once.
			</p>
			<p className="text-base text-muted-foreground">
				Nothing after a few minutes? Check your spam folder, or{" "}
				<Link to="/login" className={LINK_CLASS}>
					go back to sign in
				</Link>
				.
			</p>
		</AuthNotice>
	);
}
