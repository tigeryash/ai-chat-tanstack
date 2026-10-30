import { Send, Square } from "lucide-react";
import {
	AnimatePresence,
	domMax,
	LayoutGroup,
	LazyMotion,
	m,
} from "motion/react";
import { useState } from "react";
import { useAttachments } from "@/lib/attachments/use-attachments";
import DragNDrop from "./input/drag-n-drop";
import { HoverIcon } from "./input/hover-icon";
import { TextInput } from "./input/text-input";
import { FileInput, Files } from "./input/upload-file";

type InputProps = {
	onSubmit?: (input: string) => Promise<void>;
	isLoading?: boolean;
	/** While a reply streams: shows a Stop button in place of Send. */
	onStop?: () => void;
};

export const Input = ({ onSubmit, isLoading, onStop }: InputProps) => {
	const [input, setInput] = useState("");
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
		// The composer's files import Motion as `m`; domMax brings the layout animations it uses.
		<LazyMotion features={domMax}>
			<LayoutGroup>
				<DragNDrop onDrop={attachments.add}>
					<m.form
						layout
						onSubmit={(e) => handleSubmit(e, input)}
						initial={false}
						style={{
							borderRadius: isExpanded ? 12 : 9999,
							transitionProperty: "border-radius",
							animation: "border-radius 0.5s ease-in-out",
						}}
						className={`w-full max-w-md xl:max-w-3xl flex flex-col items-center
             py-3 shadow-lg border-t border-black/10 `}
					>
						<AnimatePresence mode="popLayout">
							{hasFiles && (
								<m.div
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
								</m.div>
							)}
						</AnimatePresence>
						<TextInput
							input={input}
							setInput={setInput}
							onKeyDown={handleKeyDown}
						/>
						<InputButtons
							onAddFiles={attachments.add}
							input={input}
							handleKeyDown={handleKeyDown}
							onStop={onStop}
						/>
					</m.form>
				</DragNDrop>
			</LayoutGroup>
		</LazyMotion>
	);
};

type InputButtonsProps = {
	onAddFiles: (files: File[]) => void;
	input: string;
	handleKeyDown: (e: React.KeyboardEvent) => void;
	onStop?: () => void;
};

const InputButtons = ({
	onAddFiles,
	input,
	handleKeyDown,
	onStop,
}: InputButtonsProps) => {
	return (
		<m.div layout className="flex w-full px-7 justify-between ">
			{/* Web search (roadmap 4.2) and voice (5.1) buttons join these once they work. */}
			<div className="flex space-x-2">
				<FileInput onAdd={onAddFiles} />
			</div>
			<div className="flex space-x-2">
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
					<m.button
						type="submit"
						aria-label="Send"
						className="input-button self-end disabled:hidden"
						disabled={!input.trim()}
						onKeyDown={handleKeyDown}
						initial="rest"
						whileHover="hover"
					>
						<HoverIcon animation="send">
							<Send size={20} strokeWidth={1} aria-hidden />
						</HoverIcon>
					</m.button>
				)}
			</div>
		</m.div>
	);
};
