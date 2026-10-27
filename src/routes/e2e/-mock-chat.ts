// What the mock model on /e2e/chat streams. e2e/chat.spec.ts checks the page against these.

export const MOCK_REASONING = ["Let me think ", "about that ", "for a moment."];

/** 40 chunks, 60 ms apart: long enough to press Stop halfway. */
export const MOCK_REPLY = Array.from(
	{ length: 40 },
	(_, index) => `word${index + 1} `,
);
