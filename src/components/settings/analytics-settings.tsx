import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import {
	browserAsksNotToTrack,
	setAnalyticsEnabled,
	useAnalyticsEnabled,
} from "@/lib/analytics/consent";

/** Settings → Analytics (roadmap 1.8): one switch for page views, Web Vitals and usage events. */
export function AnalyticsSettings() {
	const enabled = useAnalyticsEnabled();
	const id = useId();
	const browserOptOut = browserAsksNotToTrack();

	return (
		<section aria-labelledby="analytics" className="mt-10 grid gap-4">
			<header className="grid gap-2">
				<h2 id="analytics" className="font-semibold">
					Analytics
				</h2>
				<p className="max-w-2xl text-sm text-muted-foreground">
					Cookieless page views and load times (Vercel Web Analytics and Speed
					Insights), plus counts like "a message was sent" or "a model was
					picked". Never your messages, replies, files, keys or chat names.
				</p>
			</header>
			<div className="flex items-center gap-3">
				<Switch
					id={id}
					checked={enabled && !browserOptOut}
					disabled={browserOptOut}
					onCheckedChange={setAnalyticsEnabled}
				/>
				<label htmlFor={id} className="text-sm">
					Share anonymous usage analytics
				</label>
			</div>
			{browserOptOut && (
				<p className="max-w-2xl text-sm text-muted-foreground">
					Your browser asks sites not to track you (Global Privacy Control or Do
					Not Track), so analytics stay off.
				</p>
			)}
		</section>
	);
}
