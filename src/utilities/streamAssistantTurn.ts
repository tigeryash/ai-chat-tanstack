import {
	parseJsonEventStream,
	readUIMessageStream,
	type UIMessage,
	type UIMessageChunk,
	uiMessageChunkSchema,
} from "ai";
import type { Id } from "../../convex/_generated/dataModel";

const STREAM_PERSIST_INTERVAL_MS = 250;

type PersistedAssistantPart =
	| { type: "text"; text: string; state?: "streaming" | "done" }
	| { type: "reasoning"; text: string; state?: "streaming" | "done" };

type UpdateAssistantMessage = (args: {
	messageId: Id<"messages">;
	content?: string;
	parts?: PersistedAssistantPart[];
	status?: "streaming" | "completed" | "failed";
}) => Promise<unknown>;

type StreamUpdate = {
	text: string;
	parts: UIMessage["parts"];
	isFinal?: boolean;
};

const createAbortError = () => {
	const error = new Error("Aborted");
	error.name = "AbortError";
	return error;
};

const isAbortError = (error: unknown) =>
	(error instanceof DOMException && error.name === "AbortError") ||
	(error instanceof Error && error.name === "AbortError");

const getTextFromParts = (parts: UIMessage["parts"]) =>
	parts
		.filter(
			(part): part is Extract<UIMessage["parts"][number], { type: "text" }> =>
				part.type === "text",
		)
		.map((part) => part.text)
		.join("");

const toPersistedParts = ({
	parts,
	state,
}: {
	parts: UIMessage["parts"];
	state: "streaming" | "done";
}): PersistedAssistantPart[] =>
	parts.flatMap((part) => {
		switch (part.type) {
			case "text":
				return [{ type: "text", text: part.text, state }];
			case "reasoning":
				return [{ type: "reasoning", text: part.text, state }];
			default:
				return [];
		}
	});

const getPersistSignature = (text: string, parts: PersistedAssistantPart[]) =>
	JSON.stringify({
		text,
		parts: parts.map((part) => ({
			type: part.type,
			text: part.text,
		})),
	});

/**
 * Calls /api/chat with the given messages, reads the AI SDK data stream,
 * and patches the Convex assistant message on each text chunk.
 *
 * Returns when the stream is fully consumed.
 */
export async function streamAssistantTurn({
	messages,
	assistantMessageId,
	updateAssistantMessage,
	onUpdate,
	signal,
}: {
	messages: UIMessage[];
	assistantMessageId: Id<"messages">;
	updateAssistantMessage: UpdateAssistantMessage;
	onUpdate?: (update: StreamUpdate) => void;
	signal?: AbortSignal;
}): Promise<void> {
	if (signal?.aborted) {
		throw createAbortError();
	}

	const response = await fetch("/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ messages }),
		signal,
	});

	if (!response.ok || !response.body) {
		if (signal?.aborted) {
			throw createAbortError();
		}

		await updateAssistantMessage({
			messageId: assistantMessageId,
			status: "failed",
		});
		throw new Error(`Chat API error: ${response.status}`);
	}

	let latestText = "";
	let latestParts: UIMessage["parts"] = [];
	let lastPersistedSignature: string | null = null;
	let pendingPersistPayload: {
		text: string;
		parts: PersistedAssistantPart[];
		signature: string;
	} | null = null;
	let persistTimer: ReturnType<typeof setTimeout> | null = null;
	let persistInFlight: Promise<void> | null = null;
	let lastPersistStartedAt = 0;

	const persistStreamingUpdate = async (payload: {
		text: string;
		parts: PersistedAssistantPart[];
		signature: string;
	}) => {
		lastPersistStartedAt = Date.now();
		await updateAssistantMessage({
			messageId: assistantMessageId,
			content: payload.text,
			parts: payload.parts,
			status: "streaming",
		});
		lastPersistedSignature = payload.signature;
	};

	const clearPersistTimer = () => {
		if (persistTimer !== null) {
			clearTimeout(persistTimer);
			persistTimer = null;
		}
	};

	const runPersistIfNeeded = () => {
		if (persistInFlight || pendingPersistPayload === null) {
			return;
		}

		const payload = pendingPersistPayload;
		pendingPersistPayload = null;

		persistInFlight = persistStreamingUpdate(payload).finally(() => {
			persistInFlight = null;
			schedulePersist();
		});
	};

	const schedulePersist = () => {
		if (
			persistInFlight ||
			pendingPersistPayload === null ||
			persistTimer !== null
		) {
			return;
		}

		const delay = Math.max(
			0,
			STREAM_PERSIST_INTERVAL_MS - (Date.now() - lastPersistStartedAt),
		);

		persistTimer = setTimeout(() => {
			persistTimer = null;
			runPersistIfNeeded();
		}, delay);
	};

	const queuePersist = (message: UIMessage) => {
		const text = getTextFromParts(message.parts);
		const parts = toPersistedParts({
			parts: message.parts,
			state: "streaming",
		});
		const signature = getPersistSignature(text, parts);

		if (signature === lastPersistedSignature) {
			return;
		}

		pendingPersistPayload = { text, parts, signature };
		schedulePersist();
	};

	const waitForStreamingPersist = async ({
		flushPending,
	}: {
		flushPending: boolean;
	}) => {
		clearPersistTimer();

		if (flushPending) {
			runPersistIfNeeded();
		} else {
			pendingPersistPayload = null;
		}

		while (persistInFlight) {
			await persistInFlight;
		}
	};

	const uiMessageStream = readUIMessageStream<UIMessage>({
		stream: parseJsonEventStream({
			stream: response.body,
			schema: uiMessageChunkSchema,
		}).pipeThrough(
			new TransformStream<
				| { success: true; value: UIMessageChunk }
				| { success: false; error: Error },
				UIMessageChunk
			>({
				transform(chunk, controller) {
					if (!chunk.success) {
						throw chunk.error;
					}

					controller.enqueue(chunk.value);
				},
			}),
		),
	});

	try {
		for await (const message of uiMessageStream) {
			if (signal?.aborted) {
				throw createAbortError();
			}

			const nextText = getTextFromParts(message.parts);
			const partsChanged =
				getPersistSignature(
					nextText,
					toPersistedParts({ parts: message.parts, state: "streaming" }),
				) !==
				getPersistSignature(
					latestText,
					toPersistedParts({ parts: latestParts, state: "streaming" }),
				);

			if (nextText === latestText && !partsChanged) {
				continue;
			}

			latestText = nextText;
			latestParts = message.parts;
			onUpdate?.({ text: latestText, parts: latestParts });
			queuePersist(message);
		}

		await waitForStreamingPersist({ flushPending: true });
		onUpdate?.({ text: latestText, parts: latestParts, isFinal: true });

		await updateAssistantMessage({
			messageId: assistantMessageId,
			content: latestText,
			parts: toPersistedParts({ parts: latestParts, state: "done" }),
			status: "completed",
		});
	} catch (error) {
		if (signal?.aborted || isAbortError(error)) {
			await waitForStreamingPersist({ flushPending: false });
			return;
		}

		await waitForStreamingPersist({ flushPending: false });
		await updateAssistantMessage({
			messageId: assistantMessageId,
			status: "failed",
		});
		throw error;
	}
}
