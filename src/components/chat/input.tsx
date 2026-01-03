import { Globe } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { AudioLines } from "../animate-ui/icons/audio-lines";
import { AnimateIcon } from "../animate-ui/icons/icon";
import { Send } from "../animate-ui/icons/send";
import { AtomIcon } from "../ui/atom";
import { MicIcon } from "../ui/mic";
import { ToolTipContainer } from "./input/tooltip-container";
import { FileInput, Files } from "./input/upload-file";

type TextInputProps = {
	input: string;
	setInput: React.Dispatch<React.SetStateAction<string>>;
	onKeyDown: (e: React.KeyboardEvent) => void;
};

export type FileObject = {
	id: string;
	file: File;
	preview: string;
	base64: string;
	type: string;
	isProcessing?: boolean;
};

export const Input = () => {
	const [input, setInput] = useState("");
	const [WebSearchEnabled, setWebSearchEnabled] = useState(false);
	const [files, setFiles] = useState<FileObject[] | null>(null);

	const isExpanded =
		(files && files.length > 0) || input.includes("\n") || input.length > 120;

	const handleSubmit = (e: React.FormEvent, input: string) => {
		e.preventDefault();
		const trimmedInput = input.trim();
		if (!trimmedInput) return;
		console.log("Submitted input:", trimmedInput);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			handleSubmit(e, input);
		}
	};

	return (
		<LayoutGroup>
			<motion.form
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
					{files && files.length > 0 && (
						<motion.div
							key="files"
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
							className="w-full overflow-hidden"
						>
							<Files files={files} setFiles={setFiles} />
						</motion.div>
					)}
				</AnimatePresence>
				<TextInput
					input={input}
					setInput={setInput}
					onKeyDown={handleKeyDown}
				/>
				<motion.div layout className="flex w-full px-7 justify-between ">
					<div className="flex space-x-2">
						<FileInput setFiles={setFiles} />
						<WebSearch
							WebSearchEnabled={WebSearchEnabled}
							setWebSearchEnabled={setWebSearchEnabled}
						/>
						<DeepResearch />
					</div>
					<div className="flex space-x-2">
						<VoiceInput />
						<VoiceChat />
						<AnimateIcon animateOnHover>
							<button
								type="submit"
								className="input-button self-end disabled:hidden"
								onClick={(e) => handleSubmit(e, input)}
								disabled={!input.trim()}
								onKeyDown={handleKeyDown}
							>
								<Send size={20} strokeWidth={1} />
							</button>
						</AnimateIcon>
					</div>
				</motion.div>
			</motion.form>
		</LayoutGroup>
	);
};

const TextInput = ({ input, setInput, onKeyDown }: TextInputProps) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [height, setHeight] = useState(35);
	useLayoutEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		const _trigger = input;

		textarea.style.height = "0px";
		const scrollHeight = textarea.scrollHeight;
		const newHeight = Math.min(Math.max(scrollHeight, 35), 208);
		setHeight(newHeight);
		textarea.style.height = `${newHeight}px`;
	}, [input]);
	return (
		<motion.div layout="position" className="w-full">
			<motion.div
				initial={false}
				animate={{ height: `${height}px` }}
				transition={{
					duration: 0.2,
					ease: [0.4, 0, 0.2, 1],
				}}
				className="overflow-hidden"
			>
				<textarea
					ref={textareaRef}
					style={{ height: `${height}px` }}
					value={input}
					rows={1}
					onChange={(e) => {
						setInput(e.target.value);
					}}
					placeholder="Ask anything"
					className="resize-none overflow-y-auto 
                	rounded px-7 py-1 w-full ring-0  focus:outline-none focus:ring-0 bg-transparent
                  text-black placeholder-black/60 max-h-52"
					onKeyDown={onKeyDown}
				/>
			</motion.div>
		</motion.div>
	);
};

const WebSearch = ({
	WebSearchEnabled,
	setWebSearchEnabled,
}: {
	WebSearchEnabled: boolean;
	setWebSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
	return (
		<ToolTipContainer Tip="Web Search">
			<button
				type="button"
				className={`input-button group flex items-center space-x-1 transition-all duration-300 ease-in-out
                ${
									WebSearchEnabled
										? "ring-green-400/70 ring-1 hover:text-red-500 hover:bg-red-500/5! hover:ring-red-600/70! active:bg-red-500/10! active:ring-red-500/70! "
										: "hover:ring-1 hover:text-green-500 hover:ring-green-400/70! hover:bg-green-500/10!  active:ring-2 active:ring-green-500/70!"
								}`}
				onClick={() => setWebSearchEnabled(!WebSearchEnabled)}
			>
				<Globe
					strokeWidth={0.75}
					size={20}
					className={`transition-colors duration-300 ease-in-out ${
						WebSearchEnabled
							? "group-hover:text-red-500 text-green-500"
							: "group-hover:text-green-500"
					}`}
				/>
			</button>
		</ToolTipContainer>
	);
};

const DeepResearch = () => {
	return (
		<ToolTipContainer Tip="Deep Research">
			<button type="button" className="input-button">
				<AtomIcon size={20} />
			</button>
		</ToolTipContainer>
	);
};

const VoiceInput = () => {
	return (
		<ToolTipContainer Tip="Voice Input">
			<button type="button" className="input-button">
				<MicIcon size={20} />
			</button>
		</ToolTipContainer>
	);
};

const VoiceChat = () => {
	return (
		<ToolTipContainer Tip="Voice Chat">
			<AnimateIcon animateOnHover>
				<button type="button" className="input-button">
					<AudioLines size={20} strokeWidth={0.75} />
				</button>
			</AnimateIcon>
		</ToolTipContainer>
	);
};
