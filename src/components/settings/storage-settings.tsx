import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useViewer } from "@/lib/account";
import { logError } from "@/lib/log";
import {
	getStorageStatus,
	type PersistenceState,
	requestPersistentStorage,
	type StorageStatus,
} from "@/lib/storage/persistence";
import type { LocalChatUsage } from "@/lib/storage/storage-usage";
import {
	estimateSummary,
	PERSISTENCE_DENIED,
	PERSISTENCE_TEXT,
	usageSummary,
} from "@/lib/storage/storage-wording";

// Settings → Your data (Refine S11). The chat store loads with `import()` when this section opens, so
// Dexie stays out of every page's first load (bundle budget).
const localData = () => import("@/lib/storage/local-data");

type Usage =
	| { status: "loading" }
	| { status: "error" }
	| { status: "ready"; usage: LocalChatUsage; estimate: StorageStatus };

/** The viewer's chats and attached files on this device, and the browser's storage estimate. */
export function StorageUsed() {
	const viewer = useViewer();
	const [state, setState] = useState<Usage>({ status: "loading" });

	useEffect(() => {
		if (viewer === undefined) return;
		let stop: (() => void) | undefined;
		let cancelled = false;
		const onError = (error: unknown) => {
			logError("Couldn't read storage use:", error);
			if (!cancelled) setState({ status: "error" });
		};
		localData().then(({ watchUsage }) => {
			if (cancelled) return;
			stop = watchUsage(
				viewer,
				async (usage) => {
					const estimate = await getStorageStatus();
					if (!cancelled) setState({ status: "ready", usage, estimate });
				},
				onError,
			);
		}, onError);
		return () => {
			cancelled = true;
			stop?.();
		};
	}, [viewer]);

	if (state.status === "error") {
		return (
			<p role="alert" className="text-destructive text-sm">
				Couldn't read what's stored in this browser.
			</p>
		);
	}
	if (state.status === "loading") {
		return <p className="text-muted-foreground text-sm">Counting…</p>;
	}
	const estimate = estimateSummary(
		state.estimate.usageBytes,
		state.estimate.quotaBytes,
	);
	return (
		<div data-testid="storage-used" className="grid gap-1 text-sm">
			<p className="font-medium">{usageSummary(state.usage)}</p>
			{estimate && <p className="text-muted-foreground">{estimate}</p>}
		</div>
	);
}

/** Whether the browser keeps this site's storage persistent (decision 9), with a way to ask. */
export function PersistentStorage() {
	const [state, setState] = useState<PersistenceState | null>(null);
	const [asking, setAsking] = useState(false);
	const [denied, setDenied] = useState(false);

	useEffect(() => {
		let cancelled = false;
		getStorageStatus().then(({ persistence }) => {
			if (!cancelled) setState(persistence);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const ask = async () => {
		setAsking(true);
		const result = await requestPersistentStorage();
		setState(result);
		setDenied(result === "not-persisted");
		setAsking(false);
	};

	if (state === null) return null;
	return (
		<div className="grid gap-2 text-sm">
			<p data-testid="persistence-state">{PERSISTENCE_TEXT[state]}</p>
			{state === "not-persisted" && (
				<div className="flex flex-wrap items-center gap-3">
					<Button
						size="sm"
						variant="outline"
						disabled={asking}
						onClick={() => void ask()}
					>
						Ask the browser to keep my chats
					</Button>
					{denied && (
						<p role="status" className="text-muted-foreground">
							{PERSISTENCE_DENIED}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
