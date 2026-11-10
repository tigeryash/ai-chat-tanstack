import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useViewer } from "@/lib/account";
import { logError } from "@/lib/log";
import {
	exportFileName,
	exportSummary,
	importErrorMessage,
	importSummary,
} from "@/lib/storage/data-file";

type Busy = "export" | "import" | null;
type Message = { error: boolean; text: string } | null;

// The stores load on first click: Dexie and the chat format stay out of the settings page's first load.
const transfer = () => import("@/lib/storage/data-transfer");

function download(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	// Revoked a little later: some browsers still read a large file after the click returns.
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Settings → Your data (roadmap 1.10): export the viewer's chats (with branches and attachments) and
 * saved prompts to one JSON file, and import such a file back. Keys never go in it (hard rule 1).
 */
export function DataTransfer() {
	const viewer = useViewer();
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState<Busy>(null);
	const [message, setMessage] = useState<Message>(null);

	const exportData = async () => {
		if (viewer === undefined) return;
		setBusy("export");
		setMessage(null);
		try {
			const { exportLocalData } = await transfer();
			const { blob, ...counts } = await exportLocalData(viewer);
			download(blob, exportFileName(new Date()));
			setMessage({ error: false, text: exportSummary(counts) });
		} catch (error) {
			logError("Export failed:", error);
			setMessage({
				error: true,
				text: "Couldn't export your data. Try again.",
			});
		} finally {
			setBusy(null);
		}
	};

	const importData = async (file: File | undefined) => {
		if (!file || viewer === undefined) return;
		setBusy("import");
		setMessage(null);
		try {
			const { importLocalData } = await transfer();
			const result = await importLocalData(file, viewer);
			setMessage({ error: false, text: importSummary(result) });
		} catch (error) {
			logError("Import failed:", error);
			setMessage({ error: true, text: importErrorMessage(error) });
		} finally {
			setBusy(null);
		}
	};

	const disabled = busy !== null || viewer === undefined;

	return (
		<>
			<div
				className="flex flex-wrap items-center gap-2"
				aria-busy={busy !== null}
			>
				<Button
					size="sm"
					variant="outline"
					disabled={disabled}
					onClick={() => void exportData()}
				>
					{busy === "export" && (
						<Loader2 aria-hidden className="animate-spin" />
					)}
					{busy === "export" ? "Exporting…" : "Export data"}
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={disabled}
					onClick={() => input.current?.click()}
				>
					{busy === "import" && (
						<Loader2 aria-hidden className="animate-spin" />
					)}
					{busy === "import" ? "Importing…" : "Import data"}
				</Button>
				<input
					ref={input}
					type="file"
					accept="application/json,.json"
					aria-label="Export file to import"
					className="hidden"
					onChange={(event) => {
						void importData(event.target.files?.[0]);
						event.target.value = "";
					}}
				/>
			</div>
			{message && (
				<p
					role={message.error ? "alert" : "status"}
					className={
						message.error
							? "max-w-2xl text-sm text-destructive"
							: "max-w-2xl text-sm text-muted-foreground"
					}
				>
					{message.text}
				</p>
			)}
		</>
	);
}
