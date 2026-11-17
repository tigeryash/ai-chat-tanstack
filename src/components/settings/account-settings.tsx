import { Link } from "@tanstack/react-router";
import { CheckIcon, Loader2, LogInIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { RemoveChatsDialog } from "@/components/account/remove-chats-dialog";
import { useSignOut } from "@/components/account/use-sign-out";
import { Button, buttonVariants } from "@/components/ui/button";
import { useViewer } from "@/lib/account";
import { authClient } from "@/lib/auth-client";
import { logError } from "@/lib/log";
import {
	initialsOf,
	type SignInMethodStatus,
	signInMethodStatuses,
} from "@/lib/sign-in-methods";
import type { SettingControlProps } from "./setting-row-props";

// Settings → Account (roadmap R2 S8): who's signed in, how they can sign in, and the two ways to sign
// out the sidebar has too. It shows only what Better Auth already keeps; nothing new is stored. Never
// log the email (docs/security.md).

/** Signed in, the Account rows; signed out, a card that links to sign-in and sign-up. */
export function AccountGate({ children }: { children: ReactNode }) {
	const viewer = useViewer();
	if (viewer === undefined) return null;
	return viewer ? children : <SignInCard />;
}

function SignInCard() {
	return (
		<section
			aria-labelledby="account-sign-in-title"
			className="grid gap-4 rounded-lg border bg-card p-4 text-card-foreground"
		>
			<div className="grid gap-1">
				<h3 id="account-sign-in-title" className="font-medium text-sm">
					Sign in to sync and share
				</h3>
				<p className="max-w-prose text-muted-foreground text-sm">
					You don't need an account to chat: your keys and chats stay in this
					browser. An account is for syncing chats across devices and sharing
					them, which are coming later.
				</p>
			</div>
			<div className="flex flex-wrap gap-2">
				<Link to="/login" className={buttonVariants({ size: "sm" })}>
					<LogInIcon aria-hidden />
					Sign in
				</Link>
				<Link
					to="/signup"
					className={buttonVariants({ size: "sm", variant: "outline" })}
				>
					Create an account
				</Link>
			</div>
		</section>
	);
}

/** Name, email and an initials avatar. Photos from Google or GitHub would need remote images, which the CSP blocks. */
export function ProfileControl() {
	const { data } = authClient.useSession();
	const user = data?.user;
	if (!user) return null;
	return (
		<div className="flex min-w-0 items-center gap-3 @lg:justify-self-end">
			<span
				aria-hidden
				className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-medium text-primary-foreground text-sm"
			>
				{initialsOf(user.name, user.email)}
			</span>
			<div className="grid min-w-0 text-sm">
				<span className="truncate font-medium" data-testid="account-name">
					{user.name}
				</span>
				<span
					className="truncate text-muted-foreground"
					data-testid="account-email"
				>
					{user.email}
				</span>
			</div>
		</div>
	);
}

type MethodsState =
	| { status: "loading" }
	| { status: "ready"; methods: SignInMethodStatus[] }
	| { status: "error" };

/** Fetched once per mount; the list is keyed by the viewer, so another account remounts it. */
function useSignInMethods(): MethodsState {
	const [state, setState] = useState<MethodsState>({ status: "loading" });
	useEffect(() => {
		let cancelled = false;
		authClient
			.listAccounts()
			.then(({ data, error }) => {
				if (cancelled) return;
				if (error || !data) {
					throw new Error(
						`listAccounts failed: ${error?.code ?? error?.status ?? "no data"}`,
					);
				}
				setState({
					status: "ready",
					methods: signInMethodStatuses(
						data.map((account) => account.providerId),
					),
				});
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				logError("Couldn't list sign-in methods:", error);
				setState({ status: "error" });
			});
		return () => {
			cancelled = true;
		};
	}, []);
	return state;
}

export function SignInMethods({ labelId }: SettingControlProps) {
	const viewer = useViewer();
	if (!viewer) return null;
	return <SignInMethodList key={viewer} labelId={labelId} />;
}

function SignInMethodList({ labelId }: { labelId: string }) {
	const state = useSignInMethods();
	if (state.status === "loading") {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Loader2 aria-hidden className="size-4 animate-spin" />
				Loading sign-in methods…
			</p>
		);
	}
	if (state.status === "error") {
		return (
			<p role="alert" className="text-destructive text-sm">
				Couldn't load your sign-in methods. Reopen Settings to try again.
			</p>
		);
	}
	return (
		<ul aria-labelledby={labelId} className="grid gap-2 @md:grid-cols-2">
			{state.methods.map((method) => (
				<li
					key={method.providerId}
					data-linked={method.linked || undefined}
					className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
				>
					<span className="font-medium">{method.label}</span>
					{method.linked ? (
						<span className="flex items-center gap-1 text-foreground">
							<CheckIcon aria-hidden className="size-4" />
							Linked
						</span>
					) : (
						<span className="text-muted-foreground">Not linked</span>
					)}
				</li>
			))}
		</ul>
	);
}

function SignOutError({ failed }: { failed: boolean }) {
	if (!failed) return null;
	return (
		<p role="alert" className="col-span-full text-destructive text-sm">
			Couldn't sign out. Try again.
		</p>
	);
}

export function SignOutControl({
	controlId,
	descriptionId,
}: SettingControlProps) {
	const viewer = useViewer();
	if (!viewer) return null;
	return (
		<SignOutButton
			userId={viewer}
			controlId={controlId}
			descriptionId={descriptionId}
		/>
	);
}

function SignOutButton({
	userId,
	controlId,
	descriptionId,
}: {
	userId: string;
	controlId: string;
	descriptionId: string;
}) {
	const { signOut, failed } = useSignOut(userId);
	return (
		<>
			<Button
				id={controlId}
				size="sm"
				variant="outline"
				aria-describedby={descriptionId}
				className="@lg:justify-self-end"
				onClick={() => void signOut(false)}
			>
				Sign out
			</Button>
			<SignOutError failed={failed} />
		</>
	);
}

export function SignOutRemoveChatsControl({
	controlId,
	descriptionId,
}: SettingControlProps) {
	const viewer = useViewer();
	if (!viewer) return null;
	return (
		<SignOutRemoveChatsButton
			userId={viewer}
			controlId={controlId}
			descriptionId={descriptionId}
		/>
	);
}

function SignOutRemoveChatsButton({
	userId,
	controlId,
	descriptionId,
}: {
	userId: string;
	controlId: string;
	descriptionId: string;
}) {
	const { signOut, failed } = useSignOut(userId);
	const [confirming, setConfirming] = useState(false);
	return (
		<>
			<Button
				id={controlId}
				size="sm"
				variant="destructive"
				aria-describedby={descriptionId}
				className="@lg:justify-self-end"
				onClick={() => setConfirming(true)}
			>
				Sign out and remove
			</Button>
			<SignOutError failed={failed} />
			<RemoveChatsDialog
				userId={userId}
				open={confirming}
				onOpenChange={setConfirming}
				onConfirm={() => void signOut(true)}
			/>
		</>
	);
}
