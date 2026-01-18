import { useLocation, useParams, useRouter } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AnimateIcon } from "../animate-ui/icons/icon";
import { Send } from "../animate-ui/icons/send";
import { DeepResearch } from "./input/deep-research-button";
import DragNDrop from "./input/drag-n-drop";
import { TextInput } from "./input/text-input";
import { FileInput, Files } from "./input/upload-file";
import { VoiceChat } from "./input/voice-chat-button";
import { VoiceInput } from "./input/voice-input-button";
import { WebSearch } from "./input/web-search-button";

export type FileObject = {
	id: string;
	file: File;
	preview: string;
	base64: string;
	type: string;
	isProcessing?: boolean;
};

type InputProps = {
	sendMessage?: (message: {
		role: "user";
		content: string;
		parts: Array<{ type: "text"; text: string }>;
	}) => void;
	pendingAssistantIdRef?: React.MutableRefObject<Id<"messages"> | null>;
	chatId?: string;
};

export const Input = ({
	sendMessage,
	pendingAssistantIdRef,
	chatId: propChatId,
}: InputProps) => {
	const [input, setInput] = useState("");
	const [webSearchEnabled, setWebSearchEnabled] = useState(false);
	const [files, setFiles] = useState<FileObject[] | null>(null);
	const [isCreating, setIsCreating] = useState(false);

	const params = useParams({ strict: false }) as { chatId?: string };
	const chatId = propChatId || params.chatId;

	const router = useRouter();
	const location = useLocation();

	const createConversation = useMutation(api.conversations.create);
	const sendUserMessage = useMutation(api.messages.sendUserMessage);
	const createAssistantMessage = useMutation(
		api.messages.createAssistantMessage,
	);

	const isExpanded =
		(files && files.length > 0) || input.includes("\n") || input.length > 120;

	const handleSubmit = async (e: React.FormEvent, input: string) => {
		e.preventDefault();
		const trimmedInput = input.trim();
		if (!trimmedInput || isCreating) return;

		if (location.pathname === "/new") {
			try {
				setIsCreating(true);

				const conversationId = await createConversation({
					title: trimmedInput.slice(0, 50),
				});

				// Send the first user message
				const userMessageId = await sendUserMessage({
					conversationId,
					content: trimmedInput,
				});

				// Create placeholder for AI response
				const assistantMessageId = await createAssistantMessage({
					conversationId,
					parentId: userMessageId,
					model: "zai-org/glm-4.6v-flash",
					modelProvider: "lmstudio",
				});

				setInput("");

				// Navigate with search params to trigger AI call
				await router.navigate({
					to: "/$chatId",
					params: { chatId: conversationId },
					search: {
						initialMessage: trimmedInput,
						assistantMessageId: assistantMessageId,
					},
				});
			} catch (error) {
				console.error("Error creating new chat:", error);
			} finally {
				setIsCreating(false);
			}
		} else if (chatId && sendMessage) {
			// Existing chat - save to Convex first, then trigger AI
			try {
				const userMessageId = await sendUserMessage({
					conversationId: chatId as Id<"conversations">,
					content: trimmedInput,
				});

				// Create assistant placeholder
				const assistantMessageId = await createAssistantMessage({
					conversationId: chatId as Id<"conversations">,
					parentId: userMessageId,
					model: "zai-org/glm-4.6v-flash",
					modelProvider: "lmstudio",
				});

				// Set the pending ID so onFinish can update it
				if (pendingAssistantIdRef) {
					pendingAssistantIdRef.current = assistantMessageId;
				}

				setInput("");

				// Trigger AI call
				sendMessage({
					role: "user",
					content: trimmedInput,
					parts: [{ type: "text", text: trimmedInput }],
				});
			} catch (error) {
				console.error("Error sending message:", error);
			}
		}
	};
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			handleSubmit(e, input);
		}
	};

	return (
		<LayoutGroup>
			<DragNDrop setFiles={setFiles}>
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
					<InputButtons
						setFiles={setFiles}
						webSearchEnabled={webSearchEnabled}
						setWebSearchEnabled={setWebSearchEnabled}
						handleSubmit={handleSubmit}
						input={input}
						handleKeyDown={handleKeyDown}
					/>
				</motion.form>
			</DragNDrop>
		</LayoutGroup>
	);
};

type InputButtonsProps = {
	setFiles: React.Dispatch<React.SetStateAction<FileObject[] | null>>;
	webSearchEnabled: boolean;
	setWebSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
	handleSubmit: (e: React.FormEvent, input: string) => Promise<void>;
	input: string;
	handleKeyDown: (e: React.KeyboardEvent) => void;
};

const InputButtons = ({
	setFiles,
	webSearchEnabled,
	setWebSearchEnabled,
	handleSubmit,
	input,
	handleKeyDown,
}: InputButtonsProps) => {
	return (
		<motion.div layout className="flex w-full px-7 justify-between ">
			<div className="flex space-x-2">
				<FileInput setFiles={setFiles} />
				<WebSearch
					webSearchEnabled={webSearchEnabled}
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
	);
};
