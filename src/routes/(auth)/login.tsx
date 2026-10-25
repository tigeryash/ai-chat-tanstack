import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
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
import { loginSchema } from "@/lib/auth-schemas";

export const Route = createFileRoute("/(auth)/login")({
	component: RouteComponent,
});

function RouteComponent() {
	const router = useRouter();
	const { errors, formError, pending, onSubmit } = useAuthSubmit(
		loginSchema,
		async ({ email, password }) => {
			const error = await requestAuth(() =>
				authClient.signIn.email({ email, password }),
			);
			if (error?.code === "EMAIL_NOT_VERIFIED") {
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
