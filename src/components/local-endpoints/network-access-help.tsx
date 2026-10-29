import { Button } from "@/components/ui/button";

// Chrome's Local Network Access prompt (Chrome 142+, docs/security.md "Local model servers"): our
// explainer before the first request to localhost, and the way back after a "Block".

export function NetworkAccessExplainer({
	onContinue,
	onCancel,
}: {
	/** Must send the first local request itself, from this click. */
	onContinue: () => void;
	onCancel?: () => void;
}) {
	return (
		<div
			role="note"
			aria-label="Before connecting to your computer"
			className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm"
		>
			<p className="font-medium">Your browser may ask first</p>
			<p className="text-muted-foreground">
				To reach a model server on this computer, this site needs your browser's
				permission. Chrome shows a prompt about apps on your device or your
				local network: choose <strong>Allow</strong>. If you block it, Chrome
				won't ask again until you change it in site settings.
			</p>
			<p className="text-muted-foreground">
				We only call the servers you add in Settings, and only when you test one
				or open the model picker.
			</p>
			<div className="flex gap-2">
				<Button size="sm" onClick={onContinue}>
					Continue
				</Button>
				{onCancel && (
					<Button size="sm" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				)}
			</div>
		</div>
	);
}

export function NetworkAccessDenied() {
	return (
		<div
			role="alert"
			aria-label="Local network access is blocked"
			className="grid gap-1.5 rounded-lg border border-destructive/40 p-3 text-sm"
		>
			<p className="font-medium text-destructive">
				Your browser is blocking this site from reaching your computer
			</p>
			<p className="text-muted-foreground">
				Chrome won't ask again, so allow it yourself:
			</p>
			<ol className="list-decimal gap-0.5 pl-5 text-muted-foreground">
				<li>
					Click the site controls icon at the left end of the address bar, then{" "}
					<strong>Site settings</strong>.
				</li>
				<li>
					Set <strong>Local network access</strong> (in newer Chrome,{" "}
					<strong>Apps on device</strong>) to <strong>Allow</strong>.
				</li>
				<li>Reload this page and test the connection again.</li>
			</ol>
		</div>
	);
}
