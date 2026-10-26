import { ExternalLinkIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROVIDERS, type ProviderId } from "@/lib/keys/providers";
import { type KeyTestResult, testProviderKey } from "@/lib/keys/test-key";
import {
	getProviderKey,
	InvalidKeyError,
	type KeyMode,
	type KeySummary,
} from "@/lib/keys/vault";
import { logError } from "@/lib/log";
import { KeyModeChoice } from "./key-mode-choice";

interface ProviderKeyRowProps {
	providerId: ProviderId;
	saved: KeySummary | undefined;
	onSave: (providerId: ProviderId, key: string, mode: KeyMode) => Promise<void>;
	onDelete: (providerId: ProviderId) => Promise<void>;
}

export function ProviderKeyRow({
	providerId,
	saved,
	onSave,
	onDelete,
}: ProviderKeyRowProps) {
	const provider = PROVIDERS[providerId];
	const headingId = useId();
	const [adding, setAdding] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<TestOutcome | null>(null);

	const runTest = async () => {
		setTesting(true);
		setTestResult(null);
		try {
			const key = await getProviderKey(providerId);
			setTestResult(
				key
					? await testProviderKey(providerId, key)
					: { ok: false, reason: "unreadable" },
			);
		} catch (error) {
			logError("Couldn't read an API key to test it:", { providerId, error });
			setTestResult({ ok: false, reason: "unreadable" });
		} finally {
			setTesting(false);
		}
	};

	const remove = async () => {
		setTestResult(null);
		try {
			await onDelete(providerId);
		} catch (error) {
			logError("Couldn't delete an API key:", { providerId, error });
		}
	};

	return (
		<section
			aria-labelledby={headingId}
			className="grid gap-3 border-b py-4 last:border-b-0"
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<div className="mr-auto grid gap-0.5">
					<h3 id={headingId} className="font-medium">
						{provider.name}
					</h3>
					<p className="text-sm text-muted-foreground">
						{saved ? <SavedKeyStatus saved={saved} /> : "Not connected"}
					</p>
				</div>
				{saved ? (
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={runTest}
							disabled={testing}
						>
							{testing ? "Testing…" : "Test key"}
						</Button>
						<Button variant="destructive" size="sm" onClick={remove}>
							Delete key
						</Button>
					</>
				) : (
					<>
						<a
							href={provider.keyPageUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
						>
							Get a key
							<ExternalLinkIcon aria-hidden className="size-3" />
						</a>
						{!adding && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setAdding(true)}
							>
								Add key
							</Button>
						)}
					</>
				)}
			</div>
			<p aria-live="polite" className="text-sm empty:hidden">
				{testResult && <TestResultMessage result={testResult} />}
			</p>
			{adding && !saved && (
				<AddKeyForm
					providerName={provider.name}
					onCancel={() => setAdding(false)}
					onSave={async (key, mode) => {
						await onSave(providerId, key, mode);
						setAdding(false);
					}}
				/>
			)}
		</section>
	);
}

function SavedKeyStatus({ saved }: { saved: KeySummary }) {
	return (
		<>
			<span className="font-mono">••••{saved.last4}</span>
			{" · "}
			{saved.mode === "remember"
				? "Remembered on this device"
				: "This session only"}
			{saved.source === "openrouter-oauth" && " · Connected with OpenRouter"}
		</>
	);
}

type TestOutcome = KeyTestResult | { ok: false; reason: "unreadable" };

const TEST_FAILURES: Record<
	Extract<TestOutcome, { ok: false }>["reason"],
	string
> = {
	unreadable: "Couldn't read the saved key. Delete it and add it again.",
	rejected: "The provider rejected this key. Check it, or make a new one.",
	"rate-limited":
		"The provider is rate-limiting this key. It probably works; try again in a minute.",
	"provider-error": "The provider had an error. Try again later.",
	unreachable:
		"Couldn't reach the provider. Check your connection, or whether an extension blocks it.",
};

function TestResultMessage({ result }: { result: TestOutcome }) {
	if (!result.ok) {
		return (
			<span className="text-destructive">{TEST_FAILURES[result.reason]}</span>
		);
	}
	return (
		<span className="text-emerald-700 dark:text-emerald-400">
			Key works
			{result.modelCount !== undefined &&
				` · ${result.modelCount} models available`}
		</span>
	);
}

function AddKeyForm({
	providerName,
	onSave,
	onCancel,
}: {
	providerName: string;
	onSave: (key: string, mode: KeyMode) => Promise<void>;
	onCancel: () => void;
}) {
	const inputId = useId();
	const errorId = useId();
	const [key, setKey] = useState("");
	const [mode, setMode] = useState<KeyMode>("remember");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (pending) return;
		setPending(true);
		setError(null);
		try {
			await onSave(key, mode);
		} catch (caught) {
			if (caught instanceof InvalidKeyError) {
				setError(caught.message);
			} else {
				logError("Couldn't save an API key:", caught);
				setError(
					'Couldn\'t save the key in this browser. Try "This session only", or check your storage settings.',
				);
			}
			setPending(false);
		}
	};

	return (
		// No `action` and no field names: even a native submit (before hydration, or if the handler
		// fails to attach) has nothing to send, so the key can't reach our server (hard rule 1).
		<form onSubmit={submit} className="grid max-w-xl gap-3">
			<div className="grid gap-1.5">
				<Label htmlFor={inputId}>{providerName} API key</Label>
				<Input
					id={inputId}
					type="password"
					autoComplete="off"
					spellCheck={false}
					autoCapitalize="off"
					value={key}
					onChange={(event) => setKey(event.target.value)}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? errorId : undefined}
					required
				/>
				{error && (
					<p id={errorId} className="text-sm text-destructive">
						{error}
					</p>
				)}
			</div>
			<KeyModeChoice value={mode} onChange={setMode} />
			<div className="flex gap-2">
				<Button type="submit" size="sm" disabled={pending}>
					{pending ? "Saving…" : "Save key"}
				</Button>
				<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</form>
	);
}
