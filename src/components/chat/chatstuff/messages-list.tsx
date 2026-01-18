import type { UIMessage } from "@ai-sdk/react";
import type { UIDataTypes, UITools } from "ai";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
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
import {
	Source,
	Sources,
	SourcesContent,
	SourcesTrigger,
} from "@/components/ai-elements/sources";

type MessagesListProps = {
	messages: UIMessage<unknown, UIDataTypes, UITools>[];
};
const MessagesList = ({ messages }: MessagesListProps) => {
	console.log("Rendering MessagesList with messages:", messages);
	return (
		<div className="flex-1 h-full  ">
			<Conversation className=" relative size-full">
				<ConversationContent className="w-[80%] mx-auto">
					{messages.map(({ ...message }) => (
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
								{message.parts[1] && (
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
								)}

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
						</Message>
					))}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>
		</div>
	);
};

export default MessagesList;
