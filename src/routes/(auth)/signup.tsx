import { MIN_PASSWORD_LENGTH } from "@convex/lib/passwordPolicy";
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
import { signupSchema } from "@/lib/auth-schemas";

export const Route = createFileRoute("/(auth)/signup")({
	component: RouteComponent,
});

function RouteComponent() {
	const [sentTo, setSentTo] = useState<string | null>(null);

	return sentTo === null ? (
		<SignupForm onSignedUp={setSentTo} />
	) : (
		<CheckEmail email={sentTo} />
	);
}

function SignupForm({ onSignedUp }: { onSignedUp: (email: string) => void }) {
	const { errors, formError, pending, onSubmit } = useAuthSubmit(
		signupSchema,
		async (values) => {
			const error = await requestAuth(() =>
				authClient.signUp.email({
					...values,
					// Where the verification link lands. Better Auth doesn't sign people in after verifying.
					callbackURL: "/login",
				}),
			);
			if (error) {
				return authErrorMessage(
					error,
					error.message || "Couldn't create your account. Try again.",
				);
			}
			onSignedUp(values.email);
			return null;
		},
	);

	return (
		<AuthForm errors={errors} onSubmit={onSubmit}>
			<AuthField
				name="name"
				label="Name"
				type="text"
				autoComplete="name"
				placeholder="Enter your name"
			/>
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
				autoComplete="new-password"
				placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
			/>
			<FormAlert message={formError} />
			<SubmitButton pending={pending}>
				{pending ? "Creating account…" : "Create account"}
			</SubmitButton>
			<p className="text-muted-foreground">
				Already have an account?{" "}
				<Link to="/login" className={LINK_CLASS}>
					Sign in
				</Link>
			</p>
		</AuthForm>
	);
}

// Email verification is required (convex/auth.ts), so sign-up never signs anyone in. Better Auth also
// answers an address that already has an account exactly like a new one, so this can't say which it was.
function CheckEmail({ email }: { email: string }) {
	return (
		<AuthNotice title="Check your email" focusTitle>
			<p>
				We sent a verification link to{" "}
				<strong className="break-all text-foreground">{email}</strong>. Open it,
				then sign in.
			</p>
			<p className="text-base text-muted-foreground">
				Nothing after a few minutes? Check your spam folder. If you already have
				an account with this address,{" "}
				<Link to="/login" className={LINK_CLASS}>
					sign in
				</Link>{" "}
				or{" "}
				<Link to="/forgot-password" className={LINK_CLASS}>
					reset your password
				</Link>{" "}
				instead.
			</p>
		</AuthNotice>
	);
}
