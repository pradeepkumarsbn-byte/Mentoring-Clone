export const maxDuration = 180;
import { bridgeRequest, bridgeUrl } from "../../connection";
export const dynamic = "force-dynamic";

import { chatGPTSignInPath, getChatGPTUser } from "../../chatgpt-auth";

type Action =
  | { action: "add_boy"; name?: unknown; contact?: unknown; college?: unknown; hostel?: unknown; branch?: unknown; section?: unknown; status?: unknown; mentorId?: unknown; comment?: unknown }
  | { action: "update_boy"; boyId?: unknown; contact?: unknown; college?: unknown; hostel?: unknown; branch?: unknown; section?: unknown; status?: unknown; mentorId?: unknown; comment?: unknown }
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

async function authorize(): Promise<{ viewer?: Viewer; response?: Response }> {
  const user = await getChatGPTUser();
  if (!user) {
    return {
      response: json({
        error: "Please sign in with an approved Google account.",
        signInPath: chatGPTSignInPath("/"),
      }, 401),
    };
  }

  const access = await callBridge({ action: "check_access", email: user.email });
  if (access.allowed !== true) {
    return {
      response: json({
        error: `The Google account ${user.email} is not approved for this mentoring portal.`,
      }, 403),
    };
  }

  return {
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
    const state = await callBridge({ action: "get_state" });
    if (!isState(state)) throw new Error("The Google Sheet returned an invalid response.");
    return json({ ...state, viewer: authorization.viewer });
  } catch (error) {
    console.error("mentoring Sheet GET failed", error);
    return json({ error: "Google Sheets is responding slowly or is temporarily unavailable. Any last loaded records remain visible; automatic refresh will try again." }, 502);
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await authorize();
    if (authorization.response) return authorization.response;
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json({ error: "JSON is required." }, 415);
    }

    const body = await request.json() as Action;
    if (!body || !allowedActions.has(body.action)) return json({ error: "Unsupported action." }, 400);
    if (body.action === "update_website_content" && authorization.viewer?.role !== "admin") {
      return json({ error: "Only an Admin can update website wording." }, 403);
    }

    const result = await callBridge({ ...(body as unknown as Record<string, unknown>), updatedBy: authorization.viewer?.email });
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
