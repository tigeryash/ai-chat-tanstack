import { Link } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import {
	browserAsksNotToTrack,
	setAnalyticsEnabled,
	useAnalyticsEnabled,
} from "@/lib/analytics/consent";
import type { SettingControlProps } from "./setting-row-props";

/** Settings → Privacy (roadmap 1.8, 1.8b): one switch for page views, Web Vitals, usage events and error reports. */
export function AnalyticsSwitch({
	controlId,
	descriptionId,
}: SettingControlProps) {
	const enabled = useAnalyticsEnabled();
	const browserOptOut = browserAsksNotToTrack();

	return (
		<>
			<Switch
				id={controlId}
				aria-describedby={descriptionId}
				checked={enabled && !browserOptOut}
				disabled={browserOptOut}
				onCheckedChange={setAnalyticsEnabled}
				className="@lg:justify-self-end"
			/>
			{browserOptOut && (
				<p className="col-span-full max-w-2xl text-sm text-muted-foreground">
					Your browser asks sites not to track you (Global Privacy Control or Do
					Not Track), so analytics stay off.
				</p>
			)}
		</>
	);
}

/** Settings → Privacy: the Privacy Policy and Terms (the old Settings page's footer). */
export function LegalLinks() {
	return (
		<nav aria-label="Legal" className="flex gap-4 text-sm @lg:justify-self-end">
			<Link to="/privacy" className="underline-offset-4 hover:underline">
				Privacy Policy
			</Link>
			<Link to="/terms" className="underline-offset-4 hover:underline">
				Terms of Service
			</Link>
		</nav>
	);
}
