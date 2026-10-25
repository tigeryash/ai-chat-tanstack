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
import {
	resetPasswordSchema,
	resetPasswordSearchSchema,
} from "@/lib/auth-schemas";
import { MIN_PASSWORD_LENGTH } from "../../../convex/lib/passwordPolicy";

// The token is a bearer credential for this account: it goes only into the reset request's body,
// never into logs or anywhere else.
export const Route = createFileRoute("/(auth)/reset-password")({
	validateSearch: resetPasswordSearchSchema,
	component: RouteComponent,
});

type Outcome = "reset" | "invalid";

function RouteComponent() {
	const { token, error } = Route.useSearch();
	const [outcome, setOutcome] = useState<Outcome | null>(null);

	if (outcome === "reset") return <PasswordReset />;
	if (outcome === "invalid" || error || !token) {
		return <InvalidLink focusTitle={outcome === "invalid"} />;
	}
	return <ResetPasswordForm token={token} onDone={setOutcome} />;
}

function ResetPasswordForm({
	token,
	onDone,
}: {
	token: string;
	onDone: (outcome: Outcome) => void;
}) {
	const { errors, formError, pending, onSubmit } = useAuthSubmit(
		resetPasswordSchema,
		async ({ password }) => {
			const error = await requestAuth(() =>
				authClient.resetPassword({ newPassword: password, token }),
			);
			// Already used, or expired since the link was opened.
			if (error?.code === "INVALID_TOKEN") {
				onDone("invalid");
				return null;
			}
			if (error) {
				return authErrorMessage(
					error,
					error.message || "Couldn't reset your password. Try again.",
				);
			}
			onDone("reset");
			return null;
		},
	);

	return (
		<AuthForm errors={errors} onSubmit={onSubmit}>
			<AuthField
				name="password"
				label="New password"
				type="password"
				autoComplete="new-password"
				placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
			/>
			<FormAlert message={formError} />
			<SubmitButton pending={pending}>
				{pending ? "Saving…" : "Reset password"}
			</SubmitButton>
			<p className="text-white/80">
				<Link to="/login" className={LINK_CLASS}>
					Back to sign in
				</Link>
			</p>
		</AuthForm>
	);
}

function PasswordReset() {
	return (
		<AuthNotice title="Password updated" focusTitle>
			<p>Your password has been changed. Sign in with the new one.</p>
			<p>
				<Link to="/login" className={LINK_CLASS}>
					Go to sign in
				</Link>
			</p>
		</AuthNotice>
	);
}

function InvalidLink({ focusTitle }: { focusTitle: boolean }) {
	return (
		<AuthNotice title="This link doesn't work" focusTitle={focusTitle}>
			<p>
				Reset links work once and expire after a while. This one has expired,
				was already used, or is incomplete.
			</p>
			<p>
				<Link to="/forgot-password" className={LINK_CLASS}>
					Request a new link
				</Link>
			</p>
		</AuthNotice>
	);
}
