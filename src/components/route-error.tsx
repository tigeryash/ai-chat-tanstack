import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { reportError } from "@/lib/error-reporting/start";

/**
 * The router's default error screen. Stack traces are for developers: production shows a plain
 * message, since a stack exposes file paths and internals to anyone who triggers an error.
 */
export function RouteError({ error }: ErrorComponentProps) {
	// The router catches this error, so Sentry's global handlers never see it (roadmap 1.8b).
	useEffect(() => reportError(error), [error]);

	if (import.meta.env.DEV) {
		return (
			<pre className="whitespace-pre-wrap p-4 text-sm">
				{error instanceof Error ? error.stack : String(error)}
			</pre>
		);
	}

	return (
		<p role="alert" className="p-4">
			Something went wrong. Reload the page to try again.
		</p>
	);
}
