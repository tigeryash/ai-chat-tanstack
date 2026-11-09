import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { receive as receiveCspReports } from "./cspReports";

const http = httpRouter();
authComponent.registerRoutes(http, createAuth);
// CSP violation counts from our own `/api/csp-report` (shared secret; see convex/cspReports.ts).
http.route({ path: "/csp-report", method: "POST", handler: receiveCspReports });
export default http;
