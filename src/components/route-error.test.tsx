// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteError } from "./route-error";

function renderError() {
	const error = new Error("database password is hunter2");
	error.stack =
		"Error: database password is hunter2\n    at secret (/srv/app/server.ts:1:1)";
	render(<RouteError error={error} reset={() => {}} />);
}

describe("RouteError", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
	});

	it("shows a generic message in production, without the stack or message", () => {
		vi.stubEnv("DEV", false);

		renderError();

		expect(screen.getByRole("alert").textContent).toContain(
			"Something went wrong",
		);
		expect(document.body.textContent).not.toContain("hunter2");
		expect(document.body.textContent).not.toContain("/srv/app");
	});

	it("shows the stack in development", () => {
		vi.stubEnv("DEV", true);

		renderError();

		expect(document.body.textContent).toContain("/srv/app/server.ts");
	});
});
