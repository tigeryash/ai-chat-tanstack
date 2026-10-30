// Every public Convex function is API that any visitor (or any signed-in account) can call, with no
// rate limits yet (roadmap 6.2). knip can't see unused ones, because the app reaches them through the
// `api` object. So this test lists them and fails on any that the app never names as
// `api.<module>.<name>` and that isn't allowlisted below with a reason. Delete what the app stopped
// calling instead of allowlisting it; git history keeps it.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const convexDir = import.meta.dirname;
const repoRoot = join(convexDir, "..");

// Same file set Convex deploys: no `_generated`, no files with two dots (tests, helpers). Listed at run
// time, not with `import.meta.glob`, whose file list Vitest's module cache can keep stale.
const moduleFiles = readdirSync(convexDir, {
	withFileTypes: true,
	recursive: true,
})
	.filter((entry) => entry.isFile() && /^[^.]+\.ts$/.test(entry.name))
	.map((entry) => relative(convexDir, join(entry.parentPath, entry.name)))
	.filter((file) => !file.startsWith("_generated"));

/** `"module/path.name"` -> reason. Keep it short: each entry is public API the app doesn't use. */
const ALLOWLIST: Record<string, string> = {};

const SEARCHED_DIRS = ["src", "e2e"];

type RegisteredFunction = {
	isPublic?: boolean;
	isQuery?: boolean;
	isMutation?: boolean;
	isAction?: boolean;
};

function isPublicFunction(value: unknown): boolean {
	if (typeof value !== "function") return false;
	const fn = value as RegisteredFunction;
	return (
		fn.isPublic === true &&
		(fn.isQuery === true || fn.isMutation === true || fn.isAction === true)
	);
}

async function publicFunctionNames(): Promise<string[]> {
	const perModule = await Promise.all(
		moduleFiles.map(async (file) => {
			const exports: Record<string, unknown> = await import(
				join(convexDir, file)
			);
			const modulePath = file.replace(/\.ts$/, "");
			return Object.entries(exports)
				.filter(([, value]) => isPublicFunction(value))
				.map(([name]) => `${modulePath}.${name}`);
		}),
	);
	return perModule.flat().sort();
}

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true, recursive: true })
		.filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
		.map((entry) => join(entry.parentPath, entry.name));
}

const appSource = SEARCHED_DIRS.flatMap((dir) =>
	sourceFiles(join(repoRoot, dir)),
)
	.map((file) => readFileSync(file, "utf8"))
	.join("\n");

function referencedByApp(fullName: string): boolean {
	// `lib/foo.bar` is `api.lib.foo.bar` in the generated `api` object.
	const reference = `api.${fullName.replaceAll("/", ".")}`;
	return new RegExp(`\\b${reference.replaceAll(".", "\\.")}\\b`).test(
		appSource,
	);
}

const names = await publicFunctionNames();

describe("public Convex functions", () => {
	it("finds the functions the app is known to call", () => {
		expect(names).toEqual(
			expect.arrayContaining([
				"models.get",
				"models.list",
				"users.getOrCreate",
			]),
		);
	});

	it("are each referenced from src/ or e2e/, or allowlisted with a reason", () => {
		const unused = names.filter(
			(name) => !referencedByApp(name) && !ALLOWLIST[name],
		);
		expect(
			unused,
			`Unused public Convex functions (searched ${SEARCHED_DIRS.join(", ")})`,
		).toEqual([]);
	});

	it("has no stale allowlist entries", () => {
		const stale = Object.keys(ALLOWLIST).filter(
			(name) => !names.includes(name) || referencedByApp(name),
		);
		expect(stale, "Allowlist entries that are gone or now used").toEqual([]);
	});
});
