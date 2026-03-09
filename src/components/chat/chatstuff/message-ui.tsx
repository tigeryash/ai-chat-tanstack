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

const MessageUI = ({ message }: MessageUIProps) => {
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
					{message.parts.map((part, index) => {
						switch (part.type) {
							case "text":
								return (
									<MessageResponse key={`${message.id}-${index}`}>
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

				{message.parts.map((part, idx) => {
					switch (part.type) {
						case "reasoning":
							return (
								<ReasoningContent key={`${message.id}-${idx}`}>
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
