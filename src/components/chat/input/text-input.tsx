import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

type TextInputProps = {
	input: string;
	setInput: React.Dispatch<React.SetStateAction<string>>;
	onKeyDown: (e: React.KeyboardEvent) => void;
};

export const TextInput = ({ input, setInput, onKeyDown }: TextInputProps) => {
	const inputTextHeigh = 35;
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [height, setHeight] = useState(inputTextHeigh);
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
