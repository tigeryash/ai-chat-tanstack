"use client";

// AI SDK Elements' older names for the message actions. They are now `MessageActions` and
// `MessageAction` in ./message, built on shadcn/ui's MessageFooter, Button and Tooltip.

export {
	MessageAction as Action,
	type MessageActionProps as ActionProps,
	MessageActions as Actions,
	type MessageActionsProps as ActionsProps,
} from "./message";
