export const maxDuration = 180;
import { bridgeRequest, bridgeUrl } from "../../connection";
import { normalizeBridgeState } from "../../bridge-state";
export const dynamic = "force-dynamic";

import { chatGPTSignInPath, getChatGPTUser } from "../../chatgpt-auth";

type Action =
  | { action: "add_boy"; name?: unknown; contact?: unknown; college?: unknown; hostel?: unknown; floor?: unknown; branch?: unknown; section?: unknown; status?: unknown; mentorId?: unknown; comment?: unknown }
  | { action: "update_boy"; boyId?: unknown; contact?: unknown; college?: unknown; hostel?: unknown; floor?: unknown; branch?: unknown; section?: unknown; status?: unknown; mentorId?: unknown; comment?: unknown }
  | { action: "delete_boy"; boyId?: unknown }
  | { action: "add_program"; name?: unknown; programTypeId?: unknown; date?: unknown; venue?: unknown; speaker?: unknown }
  | { action: "update_program"; programId?: unknown; name?: unknown; programTypeId?: unknown; date?: unknown; venue?: unknown; speaker?: unknown }
  | { action: "delete_program"; programId?: unknown }
  | { action: "set_attendance"; programId?: unknown; boyId?: unknown; status?: unknown; reason?: unknown }
  | { action: "delete_attendance"; programId?: unknown; boyId?: unknown }
  | { action: "set_invitation"; programId?: unknown; boyId?: unknown; invited?: unknown; response?: unknown }
  | { action: "delete_invitation"; programId?: unknown; boyId?: unknown }
  | { action: "update_website_content"; values?: unknown };

type BridgeState = {
  mentors: unknown[];
  programTypes: unknown[];
  boys: unknown[];
  programs: unknown[];
  attendance: unknown[];
  invitations: unknown[];
  calendarEvents: unknown[];
  websiteContent: Record<string, unknown>;
  websiteSettings: Record<string, unknown>;
  refreshedAt: string;
};

type Viewer = { email: string; name: string; role: "admin" | "mentor" };

const allowedActions = new Set<Action["action"]>([
  "add_boy",
  "update_boy",
  "delete_boy",
  "add_program",
  "update_program",
  "delete_program",
  "set_attendance",
  "delete_attendance",
  "set_invitation",
  "delete_invitation",
  "update_website_content",
]);

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

function isState(value: unknown): value is BridgeState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<BridgeState>;
  return [state.mentors, state.programTypes, state.boys, state.programs, state.attendance, state.invitations, state.calendarEvents]
    .every(Array.isArray)
    && !!state.websiteContent && typeof state.websiteContent === "object" && !Array.isArray(state.websiteContent)
    && !!state.websiteSettings && typeof state.websiteSettings === "object" && !Array.isArray(state.websiteSettings)
    && typeof state.refreshedAt === "string";
}

async function callBridge(payload: Record<string, unknown>) {
 const url=await bridgeUrl();
 if(!url)throw new Error("The original Mentoring Hub spreadsheet connection is not configured.");
 return bridgeRequest(url,payload);
}

async function authorize(operation?: Action): Promise<{ viewer?: Viewer; response?: Response; backendVersion?: unknown; capabilities?: unknown; state?: unknown }> {
  const user = await getChatGPTUser();
  if (!user) {
    return {
      response: json({
        error: "Please sign in with an approved Google account.",
        signInPath: chatGPTSignInPath("/"),
      }, 401),
    };
  }

  // New backends authorize and execute in one round trip. Older deployments
  // ignore these optional fields and retain the existing two-call path.
  const access = await callBridge({ action: "check_access", email: user.email, ...(operation ? { operation } : { includeState: true }) });
  if (access.allowed !== true) {
    return {
      response: json({
        error: `The Google account ${user.email} is not approved for this mentoring portal.`,
      }, 403),
    };
  }

  return {
    state: access.state,
    backendVersion: access.backendVersion,
    capabilities: access.capabilities,
    viewer: {
      email: user.email,
      name: typeof access.name === "string" && access.name.trim() ? access.name.trim() : user.displayName,
      role: access.role === "admin" ? "admin" : "mentor",
    },
  };
}

export async function GET() {
  try {
    const authorization = await authorize();
    if (authorization.response) return authorization.response;
    const state = normalizeBridgeState(authorization.state ?? await callBridge({ action: "get_state" }));
    if (!isState(state)) throw new Error("The Google Sheet returned an invalid response.");
    return json({ ...state, viewer: authorization.viewer });
  } catch (error) {
    console.error("mentoring Sheet GET failed", error);
    const message = error instanceof Error ? error.message : "";
    // Only expose recognized configuration failures, never arbitrary backend text
    // that could contain private URLs, credentials, or spreadsheet records.
    const missingSheet = /^Missing sheet: (Access|Mentors|ProgramTypes|Boys|Programs|Attendance|Invitations|Calendar|WebsiteContent|WebsiteSettings)$/.exec(message);
    const detail = missingSheet
      ? `The spreadsheet tab "${missingSheet[1]}" is missing or named differently. Correct its name in the connected spreadsheet.`
      : /Deploy as a Web app|Google denied access/.test(message)
        ? "Google rejected the spreadsheet connection. Check the Apps Script deployment URL and access settings."
        : /HTTP 404/.test(message)
          ? "The Apps Script endpoint was not found. Check the configured deployment URL."
          : /invalid response/.test(message)
            ? "The spreadsheet backend returned an unexpected data format. Check that its version matches this app."
            : "The spreadsheet request failed or timed out. Retry to reconnect; any previously loaded records remain visible.";
    return json({ error: detail }, 502);
  }
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json({ error: "JSON is required." }, 415);
    }

    const body = await request.json() as Action;
    if (!body || !allowedActions.has(body.action)) return json({ error: "Unsupported action." }, 400);
    const authorization = await authorize(body);
    if (authorization.response) return authorization.response;
    // The legacy deployment corrupts columns in several write actions.
    // The corrected deployment identifies itself in the existing access check.
    if (authorization.backendVersion !== "header-mapping-v1") {
      return json({ error: "Saving is paused until the corrected Apps Script is deployed. Existing records remain available. Update the existing deployment to the repaired version, then retry." }, 503);
    }
    if ((body.action === "add_boy" || body.action === "update_boy") && body.floor !== undefined
      && !(Array.isArray(authorization.capabilities) && authorization.capabilities.includes("boy-floor-v1"))) {
      return json({ error: "Deploy the latest Apps Script with Floor support before saving boy details. This prevents losing the selected floor." }, 503);
    }
    if (body.action === "update_website_content" && authorization.viewer?.role !== "admin") {
      return json({ error: "Only an Admin can update website wording." }, 403);
    }

    const result = normalizeBridgeState(authorization.state ?? await callBridge({ ...(body as unknown as Record<string, unknown>), updatedBy: authorization.viewer?.email }));
    if (!isState(result)) throw new Error("The Google Sheet returned an invalid response.");
    return json({ ok: true, state: { ...result, viewer: authorization.viewer } });
  } catch (error) {
    console.error("mentoring Sheet POST failed", error);
    const message = error instanceof Error && !/connection|bridge returned|invalid response/i.test(error.message)
      ? error.message
      : "The record could not be saved to the Google Sheet.";
    return json({ error: message }, 400);
  }
}
