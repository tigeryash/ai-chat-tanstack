import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Model catalog (roadmap 2.1): one run a day, about 50 requests across five public catalogs.
crons.daily(
	"sync model catalog",
	{ hourUTC: 6, minuteUTC: 17 },
	internal.modelCatalogSync.sync,
	{},
);

// CSP violation counts (quality audit G1): drop rows not seen for 30 days.
crons.daily(
	"delete stale CSP reports",
	{ hourUTC: 7, minuteUTC: 3 },
	internal.cspReports.deleteStale,
	{},
);

export default crons;
