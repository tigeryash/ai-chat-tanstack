import type { UIDataTypes, UIMessagePart, UITools } from "ai";

export type MessageUIProps = {
	message: {
		id: string;
		role: "system" | "user" | "assistant";
		metadata?: unknown;
		parts: UIMessagePart<UIDataTypes, UITools>[];
	};
};
