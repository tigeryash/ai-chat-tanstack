import { Atom, AudioLines, Globe, Mic, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { ToolTipContainer } from "./input/tooltip-container";
import { FileInput, Files } from "./input/upload-file";

type TextInputProps = {
	input: string;
	setInput: React.Dispatch<React.SetStateAction<string>>;
	setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
	onKeyDown: (e: React.KeyboardEvent) => void;
	isExpanded: boolean;
};

export type FileObject = {
	id: string;
	file: File;
	preview: string;
	base64: string;
	type: string;
};

export const Input = () => {
	const [input, setInput] = useState("");
	const [isExpanded, setIsExpanded] = useState(false);
	const [WebSearchEnabled, setWebSearchEnabled] = useState(false);
	const [files, setFiles] = useState<FileObject[] | null>(null);

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

	useEffect(() => {
		if (files && files.length > 0) {
			setIsExpanded(true);
		} else {
			setIsExpanded(false);
		}
	}, [files]);

	return (
		<form
			onSubmit={(e) => handleSubmit(e, input)}
			className={`w-full max-w-md xl:max-w-3xl flex flex-col items-center  space-y-2
             py-3 shadow-lg border-t border-black/10 ${isExpanded ? "max-h-60 rounded-xl" : "rounded-full"}`}
		>
			<Files files={files} setFiles={setFiles} />
			<TextInput
				input={input}
				setInput={setInput}
				isExpanded={isExpanded}
				setIsExpanded={setIsExpanded}
				onKeyDown={handleKeyDown}
			/>

			<div className="flex w-full px-7 justify-between ">
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
					<button
						type="submit"
						className="input-button self-end disabled:hidden"
						onClick={(e) => handleSubmit(e, input)}
						disabled={!input.trim()}
						onKeyDown={handleKeyDown}
					>
						<Send size={20} strokeWidth={1} />
					</button>
				</div>
			</div>
		</form>
	);
};

const TextInput = ({
	input,
	setInput,
	setIsExpanded,
	onKeyDown,
	isExpanded,
}: TextInputProps) => {
	return (
		<textarea
			value={input}
			rows={1}
			onChange={(e) => setInput(e.target.value)}
			placeholder="Ask anything"
			className="resize-none overflow-y-auto 
                rounded px-7 py-1 w-full ring-0  focus:outline-none focus:ring-0 bg-transparent
                 text-black placeholder:black-white/60  "
			onKeyDown={onKeyDown}
			onInput={(e) => {
				const target = e.currentTarget;
				target.style.height = "auto";
				target.style.height = `${target.scrollHeight}px`;
				if (isExpanded === false) {
					setIsExpanded(target.scrollHeight > 100);
				}
			}}
		/>
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
				<Atom size={20} strokeWidth={0.75} />
			</button>
		</ToolTipContainer>
	);
};

const VoiceInput = () => {
	return (
		<ToolTipContainer Tip="Voice Input">
			<button type="button" className="input-button">
				<Mic size={20} strokeWidth={0.75} />
			</button>
		</ToolTipContainer>
	);
};

const VoiceChat = () => {
	return (
		<ToolTipContainer Tip="Voice Chat">
			<button type="button" className="input-button">
				<AudioLines size={20} strokeWidth={0.75} />
			</button>
		</ToolTipContainer>
	);
};
