import {
	Message,
	MessageContent,
	MessageResponse,
} from "@/components/ai-elements/message";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import type { MessageUIProps } from "@/types/types";
import MessageActions from "./message-actions";

const createPartKeyFactory = (messageId: string) => {
	const counts = new Map<string, number>();

	return (part: { type: string; text?: string }) => {
		const signature = `${part.type}:${part.text ?? ""}`;
		const count = counts.get(signature) ?? 0;
		counts.set(signature, count + 1);

		return `${messageId}-${signature}-${count}`;
	};
};

const MessageUI = ({ message }: MessageUIProps) => {
	const getPartKey = createPartKeyFactory(message.id);

	return (
		<Message from={message.role} key={`${message.id}`}>
			<div>
				{/* {message.sources?.length && (
											<Sources>
												<SourcesTrigger count={message.sources.length} />
												<SourcesContent>
													{message.sources.map((source) => (
														<Source
															href={source.href}
															key={source.href}
															title={source.title}
														/>
													))}
												</SourcesContent>
											</Sources>
										)} */}
				<ReasoningUI message={message} />

				<MessageContent>
					{message.parts.map((part) => {
						switch (part.type) {
							case "text":
								return (
									<MessageResponse key={getPartKey(part)}>
										{part.text}
									</MessageResponse>
								);
							default:
								return null;
						}
					})}
				</MessageContent>
			</div>

			<MessageActions message={message} />
		</Message>
	);
};

export default MessageUI;

const ReasoningUI = ({ message }: MessageUIProps) => {
	const getPartKey = createPartKeyFactory(message.id);

	return (
		message.parts[1] && (
			<Reasoning
				isStreaming={
					message.role === "assistant" &&
					message.parts[1].type === "reasoning" &&
					message.parts[1].state !== "done"
				}
			>
				{/* //duration={message.reasoning.duration} */}
				<ReasoningTrigger />

				{message.parts.map((part) => {
					switch (part.type) {
						case "reasoning":
							return (
								<ReasoningContent key={getPartKey(part)}>
									{part.text}
								</ReasoningContent>
							);
						default:
							return null;
					}
				})}
			</Reasoning>
		)
	);
};
