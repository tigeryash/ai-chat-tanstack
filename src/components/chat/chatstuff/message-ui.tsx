import { useState } from "react";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import type { MessageUIProps } from "@/types/types";
import MessageActions, { type MessageActionsProps } from "./message-actions";
import { MessagePart } from "./message-parts";
import {
	EditMessageForm,
	textOf,
	UserMessageActions,
	type UserMessageBranching,
	UserMessageEditOverlay,
} from "./user-message-actions";

type Props = MessageUIProps &
	Omit<MessageActionsProps, "message"> & { branching?: UserMessageBranching };

// Parts only ever get appended or updated in place while a reply streams, so a part's index is a
// stable key; a key built from its text would remount it on every streamed token.
const partKey = (messageId: string, index: number) => `${messageId}-${index}`;

const MessageUI = ({ message, branching, ...actions }: Props) => {
	const [editing, setEditing] = useState(false);
	const onEdit = branching?.onEdit;
	const startEdit = onEdit && (() => setEditing(true));
	if (editing && onEdit) {
		return (
			<Message from={message.role}>
				<EditMessageForm
					initialText={textOf(message.parts)}
					onCancel={() => setEditing(false)}
					onSubmit={(text) => {
						setEditing(false);
						onEdit(text);
					}}
				/>
			</Message>
		);
	}
	return (
		<Message from={message.role}>
			<div>
				<ReasoningUI message={message} />
				<MessageContent
					bubbleAside={
						message.role === "user" && (
							<UserMessageEditOverlay
								onStartEdit={startEdit}
								versionIds={branching?.versionIds}
							/>
						)
					}
				>
					{message.parts.map((part, index) => (
						<MessagePart
							key={partKey(message.id, index)}
							part={part}
							role={message.role}
						/>
					))}
				</MessageContent>
			</div>

			{message.role === "user" ? (
				<UserMessageActions
					messageId={message.id}
					onStartEdit={startEdit}
					versionIds={branching?.versionIds}
					onSwitch={branching?.onSwitch}
				/>
			) : (
				<MessageActions message={message} {...actions} />
			)}
		</Message>
	);
};

export default MessageUI;

const ReasoningUI = ({ message }: MessageUIProps) => {
	const reasoning = message.parts.flatMap((part, index) =>
		part.type === "reasoning" ? [{ part, index }] : [],
	);
	if (message.role !== "assistant" || reasoning.length === 0) return null;

	return (
		<Reasoning
			isStreaming={reasoning.some(({ part }) => part.state === "streaming")}
		>
			<ReasoningTrigger />
			{reasoning.map(({ part, index }) => (
				<ReasoningContent key={partKey(message.id, index)}>
					{part.text}
				</ReasoningContent>
			))}
		</Reasoning>
	);
};
