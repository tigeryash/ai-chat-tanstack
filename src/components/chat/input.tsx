// The composer is Yash's design (CLAUDE.md hard rule 8). Nothing in this file, `./input/`, its
// animate-ui icons or its styles may change how it looks or animates without his approval of a
// mockup or screenshot first. e2e/composer-design.spec.ts pins the look; never refresh its baselines
// without that approval.

import { Square } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import { useAttachments } from "@/lib/attachments/use-attachments";
import { AnimateIcon } from "../animate-ui/icons/icon";
import { Send } from "../animate-ui/icons/send";
import { DeepResearch } from "./input/deep-research-button";
import DragNDrop from "./input/drag-n-drop";
import { TextInput } from "./input/text-input";
import { FileInput, Files } from "./input/upload-file";
import { VoiceChat } from "./input/voice-chat-button";
import { VoiceInput } from "./input/voice-input-button";
import { WebSearch } from "./input/web-search-button";

type InputProps = {
	onSubmit?: (input: string) => Promise<void>;
	isLoading?: boolean;
	/** While a reply streams: shows a Stop button in place of Send. */
	onStop?: () => void;
	/** A draft kept outside, so synced panes share one (roadmap 3.2). Without it, the composer keeps its own. */
	value?: string;
	onValueChange?: (value: string) => void;
};

export const Input = ({
	onSubmit,
	isLoading,
	onStop,
	value,
	onValueChange,
}: InputProps) => {
	const [ownInput, setOwnInput] = useState("");
	const input = value ?? ownInput;
	const setInput = onValueChange ?? setOwnInput;
	const [webSearchEnabled, setWebSearchEnabled] = useState(false);
	const attachments = useAttachments();
	const hasFiles = attachments.files.length > 0;

	const isExpanded = hasFiles || input.includes("\n") || input.length > 120;

	const handleSubmit = async (e: React.FormEvent, input: string) => {
		e.preventDefault();
		const trimmedInput = input.trim();
		if (!trimmedInput || isLoading) return;

		await onSubmit?.(trimmedInput);

		setInput("");
	};
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			handleSubmit(e, input);
		}
	};

	return (
		<LayoutGroup>
			<DragNDrop onDrop={attachments.add}>
				<motion.form
					layout
					onSubmit={(e) => handleSubmit(e, input)}
					initial={false}
					style={{
						borderRadius: isExpanded ? 12 : 9999,
						transitionProperty: "border-radius",
						animation: "border-radius 0.5s ease-in-out",
					}}
					className={`composer-design bg-white w-full max-w-md xl:max-w-3xl flex flex-col items-center
             py-3 shadow-lg border-t border-black/10 `}
				>
					<AnimatePresence mode="popLayout">
						{hasFiles && (
							<motion.div
								key="files"
								// The file row slides open and shut with the card; it only runs when files come or go.
								// react-doctor-disable-next-line react-doctor/no-layout-property-animation
								initial={{ opacity: 0, height: 0 }}
								// react-doctor-disable-next-line react-doctor/no-layout-property-animation
								animate={{ opacity: 1, height: "auto" }}
								// react-doctor-disable-next-line react-doctor/no-layout-property-animation
								exit={{ opacity: 0, height: 0 }}
								transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
								className="w-full overflow-hidden"
							>
								<Files
									files={attachments.files}
									onRemove={attachments.remove}
								/>
							</motion.div>
						)}
					</AnimatePresence>
					<TextInput
						input={input}
						setInput={setInput}
						onKeyDown={handleKeyDown}
					/>
					<InputButtons
						onAddFiles={attachments.add}
						webSearchEnabled={webSearchEnabled}
						setWebSearchEnabled={setWebSearchEnabled}
						input={input}
						handleKeyDown={handleKeyDown}
						onStop={onStop}
					/>
				</motion.form>
			</DragNDrop>
		</LayoutGroup>
	);
};

type InputButtonsProps = {
	onAddFiles: (files: File[]) => void;
	webSearchEnabled: boolean;
	setWebSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
	input: string;
	handleKeyDown: (e: React.KeyboardEvent) => void;
	onStop?: () => void;
};

const InputButtons = ({
	onAddFiles,
	webSearchEnabled,
	setWebSearchEnabled,
	input,
	handleKeyDown,
	onStop,
}: InputButtonsProps) => {
	return (
		<motion.div layout className="flex w-full px-7 justify-between ">
			<div className="flex space-x-2">
				<FileInput onAdd={onAddFiles} />
				<WebSearch
					webSearchEnabled={webSearchEnabled}
					setWebSearchEnabled={setWebSearchEnabled}
				/>
				<DeepResearch />
			</div>
			<div className="flex space-x-2">
				<VoiceInput />
				<VoiceChat />
				{onStop ? (
					<button
						type="button"
						aria-label="Stop"
						className="input-button self-end"
						onClick={onStop}
					>
						<Square size={16} strokeWidth={1.5} aria-hidden />
					</button>
				) : (
					<AnimateIcon animateOnHover>
						<button
							type="submit"
							aria-label="Send"
							className="input-button self-end disabled:hidden"
							disabled={!input.trim()}
							onKeyDown={handleKeyDown}
						>
							<Send size={20} strokeWidth={1} />
						</button>
					</AnimateIcon>
				)}
			</div>
		</motion.div>
	);
};
