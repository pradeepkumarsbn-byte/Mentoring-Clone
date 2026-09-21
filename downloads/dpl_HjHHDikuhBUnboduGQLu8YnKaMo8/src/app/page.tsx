"use client";

import HostelMapView from "./hostel-map-view";
import HostelFields from "./hostel-fields";
import OverviewStats from "./overview-stats";
import { CSSProperties, FormEvent, useCallback, useEffect, useRef, useState } from "react";

type View = "map" | "overview" | "planning" | "boys" | "programs" | "attendance" | "invitations" | "mentors" | "content";
type Modal = "boy" | "program" | null;
type Mentor = { id: string; name: string; initials: string; tone: string };
type ProgramType = { id: string; name: string };
type BoyStatus = "Active" | "Passive" | "Dropped";
type Boy = { id: string; name: string; contact: string; college: string; hostel: string; floor: string; branch: string; section: string; status: BoyStatus; mentorId: string; comment: string; createdAt: string; createdBy: string };
type Program = { id: string; name: string; programTypeId: string; programType: string; date: string; venue: string; speaker: string; createdAt: string };
type Attendance = { id: string; programId: string; boyId: string; mentorId: string; status: "Present" | "Absent" | "Late"; reason: string; updatedAt: string; updatedBy: string };
type Invitation = { id: string; programId: string; boyId: string; mentorId: string; response: string; updatedAt: string; updatedBy: string };
type CalendarEvent = { id: string; title: string; startDate: string; endDate: string; type: string; availability: string; semester: string; scope: string; note: string; source: string };
type Viewer = { email: string; name: string; role: "admin" | "mentor" };
type State = { mentors: Mentor[]; programTypes: ProgramType[]; boys: Boy[]; programs: Program[]; attendance: Attendance[]; invitations: Invitation[]; calendarEvents: CalendarEvent[]; websiteContent: Record<string, string>; websiteSettings: Record<string, string>; refreshedAt: string; viewer?: Viewer };

const emptyState: State = { mentors: [], programTypes: [], boys: [], programs: [], attendance: [], invitations: [], calendarEvents: [], websiteContent: {}, websiteSettings: {}, refreshedAt: "" };
const nav: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "planning", label: "Planning" },
  { id: "boys", label: "Boys" },
  { id: "map", label: "Map" },
  { id: "programs", label: "Programs" },
  { id: "attendance", label: "Attendance" },
  { id: "invitations", label: "Invitations" },
  { id: "mentors", label: "Mentors" },
  { id: "content", label: "Website Content" },
];

const contentFields = [
  ["hero_eyebrow", "Hero", "Eyebrow", false],
  ["hero_title_line_1", "Hero", "Title line 1", false],
  ["hero_title_line_2", "Hero", "Title line 2", false],
  ["hero_description", "Hero", "Description", true],
  ["quick_add_boy_title", "Quick actions", "Add boy title", false],
  ["quick_add_boy_description", "Quick actions", "Add boy description", false],
  ["quick_add_program_title", "Quick actions", "Add program title", false],
  ["quick_add_program_description", "Quick actions", "Add program description", false],
  ["quick_attendance_title", "Quick actions", "Attendance title", false],
  ["quick_attendance_description", "Quick actions", "Attendance description", false],
  ["overview_program_eyebrow", "Overview", "Program eyebrow", false],
  ["overview_program_title", "Overview", "Program title", false],
  ["overview_attention_eyebrow", "Overview", "Attention eyebrow", false],
  ["overview_attention_title", "Overview", "Attention title", false],
  ["boys_eyebrow", "Sections", "Boys eyebrow", false],
  ["boys_title", "Sections", "Boys title", false],
  ["boys_description", "Sections", "Boys description", true],
  ["programs_eyebrow", "Sections", "Programs eyebrow", false],
  ["programs_title", "Sections", "Programs title", false],
  ["programs_description", "Sections", "Programs description", true],
  ["attendance_eyebrow", "Sections", "Attendance eyebrow", false],
  ["attendance_title", "Sections", "Attendance title", false],
  ["attendance_description", "Sections", "Attendance description", true],
  ["invitations_eyebrow", "Sections", "Invitations eyebrow", false],
  ["invitations_title", "Sections", "Invitations title", false],
  ["invitations_description", "Sections", "Invitations description", true],
  ["mentors_eyebrow", "Sections", "Mentors eyebrow", false],
  ["mentors_title", "Sections", "Mentors title", false],
  ["mentors_description", "Sections", "Mentors description", true],
  ["planning_eyebrow", "Sections", "Planning eyebrow", false],
  ["planning_title", "Sections", "Planning title", false],
  ["planning_description", "Sections", "Planning description", true],
  ["modal_eyebrow", "Forms", "Modal eyebrow", false],
  ["modal_boy_title", "Forms", "Add boy title", false],
  ["modal_boy_subtitle", "Forms", "Add boy subtitle", true],
  ["modal_program_title", "Forms", "Add program title", false],
  ["modal_program_subtitle", "Forms", "Add program subtitle", true],
  ["footer_left", "Footer", "Left text", false],
  ["footer_right", "Footer", "Right text", false],
] as const;

function siteText(data: State, key: string, fallback: string) {
  const value = data.websiteContent?.[key]?.trim();
  return value || fallback;
}

function siteSetting(data: State, key: string, fallback: string) {
  const value = data.websiteSettings?.[key]?.trim();
  return value || fallback;
}

function safeColour(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function boundedNumber(value: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function selected(value: string, allowed: readonly string[], fallback: string) {
  return allowed.includes(value) ? value : fallback;
}

function enabled(value: string, fallback = true) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return true;
  if (normalized === "no") return false;
  return fallback;
}

const fontStacks: Record<string, string> = {
  Georgia: 'Georgia, "Times New Roman", serif',
  "Times New Roman": '"Times New Roman", Times, serif',
  Arial: "Arial, Helvetica, sans-serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  "Trebuchet MS": '"Trebuchet MS", Arial, sans-serif',
  Verdana: "Verdana, Geneva, sans-serif",
};

function websiteStyle(data: State): CSSProperties {
  const shadow = selected(siteSetting(data, "shadow_strength", "Soft"), ["None", "Soft", "Medium", "Strong"], "Soft");
  const shadows: Record<string, string> = {
    None: "none",
    Soft: "0 20px 50px rgba(43, 43, 34, 0.07)",
    Medium: "0 22px 56px rgba(36, 37, 31, 0.13)",
    Strong: "0 26px 64px rgba(30, 31, 27, 0.20)",
  };
  const headingFont = selected(siteSetting(data, "heading_font", "Georgia"), ["Georgia", "Times New Roman", "Arial", "Trebuchet MS", "Verdana"], "Georgia");
  const bodyFont = selected(siteSetting(data, "body_font", "Arial"), ["Arial", "Helvetica", "Trebuchet MS", "Verdana", "Georgia"], "Arial");
  return {
    "--ink": safeColour(siteSetting(data, "text_color", "#22251F"), "#22251F"),
    "--muted": safeColour(siteSetting(data, "muted_text_color", "#72766D"), "#72766D"),
    "--line": safeColour(siteSetting(data, "border_color", "#E8E5DD"), "#E8E5DD"),
    "--cream": safeColour(siteSetting(data, "page_background", "#F7F5EF"), "#F7F5EF"),
    "--paper": safeColour(siteSetting(data, "surface_color", "#FFFEFA"), "#FFFEFA"),
    "--saffron": safeColour(siteSetting(data, "primary_color", "#E86F2D"), "#E86F2D"),
    "--saffron-dark": safeColour(siteSetting(data, "primary_dark", "#B94816"), "#B94816"),
    "--saffron-soft": safeColour(siteSetting(data, "primary_soft", "#FFF0E5"), "#FFF0E5"),
    "--green": safeColour(siteSetting(data, "success_color", "#2D6C55"), "#2D6C55"),
    "--green-soft": safeColour(siteSetting(data, "success_soft", "#E8F3ED"), "#E8F3ED"),
    "--announcement-background": safeColour(siteSetting(data, "announcement_background", "#2D6C55"), "#2D6C55"),
    "--announcement-text": safeColour(siteSetting(data, "announcement_text_color", "#FFFFFF"), "#FFFFFF"),
    "--heading-font": fontStacks[headingFont],
    "--body-font": fontStacks[bodyFont],
    "--hero-title-size": `${boundedNumber(siteSetting(data, "hero_title_size", "75"), 75, 40, 96)}px`,
    "--hero-mobile-title-size": `${boundedNumber(siteSetting(data, "hero_mobile_title_size", "45"), 45, 30, 64)}px`,
    "--section-title-size": `${boundedNumber(siteSetting(data, "section_title_size", "27"), 27, 20, 44)}px`,
    "--hero-copy-size": `${boundedNumber(siteSetting(data, "hero_copy_size", "17"), 17, 12, 24)}px`,
    "--table-text-size": `${boundedNumber(siteSetting(data, "table_text_size", "10"), 10, 8, 16)}px`,
    "--nav-text-size": `${boundedNumber(siteSetting(data, "nav_text_size", "13"), 13, 10, 18)}px`,
    "--content-width": `${boundedNumber(siteSetting(data, "content_width", "1180"), 1180, 900, 1440)}px`,
    "--card-radius": `${boundedNumber(siteSetting(data, "card_radius", "20"), 20, 0, 32)}px`,
    "--button-radius": `${boundedNumber(siteSetting(data, "button_radius", "11"), 11, 0, 40)}px`,
    "--card-gap": `${boundedNumber(siteSetting(data, "card_gap", "15"), 15, 6, 30)}px`,
    "--shadow": shadows[shadow],
  } as CSSProperties;
}

function formatDate(value: string) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTimestamp(value: string) {
  if (!value) return "Earlier record";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function localIsoDate(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDateRange(start: string, end: string) {
  if (!start) return "Date not added";
  return !end || start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

function monthLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.valueOf()) ? "Other dates" : parsed.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function availabilityClass(value: string) {
  if (value === "Likely Available") return "available";
  if (value === "Busy") return "busy";
  if (value === "Confirm") return "confirm";
  return "normal";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "—";
}

const invitationResponses = ["Coming", "Maybe", "Not coming", "No answer", "Call back", "Other"] as const;
type InvitationResponse = typeof invitationResponses[number];

function parseInvitationResponse(value?: string): { category: InvitationResponse | ""; note: string } {
  const text = (value ?? "").trim();
  if (!text) return { category: "", note: "" };
  const [first, ...rest] = text.split(" — ");
  if ((invitationResponses as readonly string[]).includes(first)) {
    return { category: first as InvitationResponse, note: rest.join(" — ") };
  }
  const normalized = first.toLowerCase().replace(/\s+/g, " ");
  if (["coming", "will come", "will be coming", "yes"].includes(normalized)) return { category: "Coming", note: rest.join(" — ") };
  if (["maybe", "may come", "not sure"].includes(normalized)) return { category: "Maybe", note: rest.join(" — ") };
  if (["not coming", "will not come", "cannot come", "can't come"].includes(normalized)) return { category: "Not coming", note: rest.join(" — ") };
  if (["no answer", "not answering", "did not answer"].includes(normalized)) return { category: "No answer", note: rest.join(" — ") };
  return { category: "Other", note: text };
}

function responseTone(value?: string) {
  const category = parseInvitationResponse(value).category;
  if (category === "Coming") return "coming";
  if (category === "Maybe" || category === "Call back") return "maybe";
  if (category === "Not coming") return "not-coming";
  return "waiting";
}

function latestPrograms(programs: Program[], limit = 5) {
  return [...programs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, limit);
}

function followUpCount(data: State, boyId: string) {
  return new Set(data.invitations.filter((record) => record.boyId === boyId).map((record) => record.programId)).size;
}

function attendedCount(data: State, boyId: string) {
  return data.attendance.filter((record) => record.boyId === boyId && record.status === "Present").length;
}

function needsMentorAttention(data: State, boyId: string) {
  const threshold = boundedNumber(siteSetting(data, "attention_invitation_threshold", "4"), 4, 2, 10);
  return followUpCount(data, boyId) >= threshold && attendedCount(data, boyId) === 0;
}

export default function Home() {
  const [data, setData] = useState<State>(emptyState);
  const [view, setView] = useState<View>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [profileBoyId, setProfileBoyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const refreshSeconds = boundedNumber(siteSetting(data, "auto_refresh_seconds", "30"), 30, 30, 120);
  const reading = useRef(false);
  const writing = useRef(false);
  const revision = useRef(0);
  const retryAfter = useRef(0);
  const failures = useRef(0);
  const heroLayout = selected(siteSetting(data, "hero_layout", "Split"), ["Split", "Centered"], "Split").toLowerCase();
  const headerStyle = selected(siteSetting(data, "header_style", "Light"), ["Light", "Tinted", "Solid"], "Light").toLowerCase();
  const buttonStyle = selected(siteSetting(data, "button_style", "Rounded"), ["Rounded", "Pill", "Square"], "Rounded").toLowerCase();
  const density = selected(siteSetting(data, "density", "Comfortable"), ["Comfortable", "Compact"], "Comfortable").toLowerCase();
  const borderStyle = selected(siteSetting(data, "card_border_style", "Subtle"), ["Subtle", "Accent", "None"], "Subtle").toLowerCase();
  const portalClassName = `portal-shell hero-layout-${heroLayout} header-${headerStyle} buttons-${buttonStyle} density-${density} borders-${borderStyle}`;
  const showAnnouncement = enabled(siteSetting(data, "announcement_enabled", "No"), false);
  const showMetrics = enabled(siteSetting(data, "show_metrics", "Yes"));
  const showFooter = enabled(siteSetting(data, "show_footer", "Yes"));
  const showQuickActions = enabled(siteSetting(data, "show_quick_actions", "Yes"));
  const showHeroDecoration = enabled(siteSetting(data, "show_hero_decoration", "Yes"));

  const refresh = useCallback(async () => {
    if(reading.current || writing.current) return;
    reading.current = true;
    const startedRevision = revision.current;
    try {
      const response = await fetch("/api/mentoring", { cache: "no-store", signal: AbortSignal.timeout(170000) });
      const result = await response.json() as State & { error?: string; signInPath?: string };
      if(startedRevision !== revision.current) return;
      if (response.status === 401 && result.signInPath) {
        window.location.assign(result.signInPath);
        return;
      }
      if (!response.ok) throw new Error(result.error || "Could not load records.");
      setData(result);
      failures.current = 0;
      retryAfter.current = 0;
      setError("");
    } catch (caught) {
      if(startedRevision !== revision.current) return;
      failures.current += 1;
      retryAfter.current = Date.now() + Math.min(120000, 30000 * 2 ** (failures.current - 1));
      setError(caught instanceof Error && caught.name === "TimeoutError" ? "The connection timed out. Your loaded records remain visible; reconnecting automatically." : caught instanceof Error ? caught.message : "Could not load the live database.");
    } finally {
      reading.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const backgroundRefresh = () => { if(document.visibilityState === "visible" && Date.now() >= retryAfter.current) void refresh(); };
    const interval = window.setInterval(backgroundRefresh, refreshSeconds * 1000);
    const refreshOnFocus = backgroundRefresh;
    const reconnect = () => { retryAfter.current = 0; void refresh(); };
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("online", reconnect);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("online", reconnect);
    };
  }, [refresh, refreshSeconds]);

  async function save(action: string, payload: Record<string, unknown>, success: string, key = action) {
    if(writing.current) return false;
    writing.current = true;
    revision.current += 1;
    setBusy(key);
    setError("");
    try {
      const response = await fetch("/api/mentoring", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const result = await response.json() as { error?: string; state?: State; signInPath?: string };
      if (response.status === 401 && result.signInPath) {
        window.location.assign(result.signInPath);
        return false;
      }
      if (!response.ok || !result.state) throw new Error(result.error || "The record could not be saved.");
      setData(result.state);
      setToast(success);
      window.setTimeout(() => setToast(""), 2200);
      failures.current = 0;
      retryAfter.current = 0;
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The record could not be saved.");
      return false;
    } finally {
      writing.current = false;
      setBusy(null);
    }
  }

  async function addBoy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (await save("add_boy", values, `${values.name} added.`, "add-boy")) setModal(null);
  }

  async function addProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (await save("add_program", values, "Program created.", "add-program")) setModal(null);
  }

  async function updateProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProgramId) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (await save("update_program", { programId: editingProgramId, ...values }, "Program details updated.", `program:${editingProgramId}`)) {
      setEditingProgramId(null);
      setModal(null);
    }
  }

  const present = data.attendance.filter((record) => record.status === "Present");
  const reached = new Set(present.map((record) => record.boyId)).size;
  const recentProgram = [...data.programs].sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <main className={portalClassName} style={websiteStyle(data)}>
      <header className="site-header">
        <button className="brand brand-button" onClick={() => setView("overview")} aria-label="Open mentoring overview"><span className="brand-mark">{siteSetting(data, "brand_initials", "IW").slice(0, 4)}</span><span><strong>{siteSetting(data, "brand_title", "Mentoring Hub")}</strong><small>{siteSetting(data, "brand_subtitle", "ISKCON Warangal")}</small></span></button>
        <nav className="nav-tabs" aria-label="Primary views">{nav.filter((item) => item.id !== "content" || data.viewer?.role === "admin").map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>
        <div className="auth-cluster"><span className="private-pill"><i /> {data.viewer ? `${data.viewer.name} · ${data.viewer.role}` : "Secure sign-in"}</span>{data.viewer && <a className="sign-out-link" href="/api/auth/signout">Sign out</a>}</div>
      </header>

      {showAnnouncement && <aside className="announcement-banner" role="note"><span>●</span><p>{siteSetting(data, "announcement_text", "Welcome to the ISKCON Warangal youth mentoring workspace.")}</p></aside>}

      <div className="page-shell" id="top">
        <section className={`hero operational-hero ${showHeroDecoration ? "" : "without-decoration"}`}>
          <div><p className="eyebrow">{siteText(data, "hero_eyebrow", "Youth mentoring · live Google Sheet")}</p><h1>{siteText(data, "hero_title_line_1", "Record it once.")}<br />{siteText(data, "hero_title_line_2", "See it everywhere.")}</h1><p className="hero-copy">{siteText(data, "hero_description", "Add boys and programs, take attendance, and build the right invitation list from one private workspace. Every save writes to the Sheet and refreshes the dashboard immediately.")}</p></div>
          {showQuickActions && <div className="quick-actions" aria-label="Quick actions">
            <button onClick={() => setModal("boy")}><span>＋</span><b>{siteText(data, "quick_add_boy_title", "Add boy")}</b><small>{siteText(data, "quick_add_boy_description", "Create a mentoring record")}</small></button>
            <button onClick={() => setModal("program")}><span>＋</span><b>{siteText(data, "quick_add_program_title", "Add program")}</b><small>{siteText(data, "quick_add_program_description", "Schedule a dated session")}</small></button>
            <button onClick={() => setView("attendance")}><span>✓</span><b>{siteText(data, "quick_attendance_title", "Take attendance")}</b><small>{siteText(data, "quick_attendance_description", "Present or absent in one tap")}</small></button>
          </div>}
        </section>

        {error && <div className="error-banner" role="alert"><span>!</span><p>{error}</p><button onClick={() => void refresh()}>Retry</button></div>}

        {view === "overview" && <OverviewStats data={data} loading={loading} error={error} />}

        {showMetrics && view !== "overview" && view !== "map" && <section className="metric-grid" aria-label="Program summary">
          <article className="metric-card featured"><p>Total boys</p><strong>{loading ? "—" : data.boys.length}</strong><span>Across {data.mentors.length} mentors</span></article>
          <article className="metric-card"><p>Programs</p><strong>{loading ? "—" : data.programs.length}</strong><span>Dated DYS sessions</span></article>
          <article className="metric-card"><p>Present entries</p><strong>{loading ? "—" : present.length}</strong><span>{reached} unique boys reached</span></article>
          <article className="metric-card"><p>Latest program</p><strong className="metric-word">{recentProgram?.programType ?? "—"}</strong><span>{recentProgram ? formatDate(recentProgram.date) : "Add the first program"}</span></article>
        </section>}

        <section className="workspace" aria-live="polite">
          {loading ? <LoadingState /> : <>
            {view === "overview" && <Overview data={data} setView={setView} setModal={setModal} openProfile={setProfileBoyId} />}
            {view === "planning" && <PlanningView data={data} />}
            {view === "map" && <HostelMapView boys={data.boys} openProfile={setProfileBoyId} ready={!!data.refreshedAt} />}
            {view === "boys" && <BoysView data={data} setModal={setModal} openProfile={setProfileBoyId} />}
            {view === "programs" && <ProgramsView data={data} setModal={setModal} setView={setView} save={save} busy={busy} editProgram={(programId) => { setEditingProgramId(programId); setModal("program"); }} />}
            {view === "attendance" && <AttendanceView data={data} save={save} busy={busy} />}
            {view === "invitations" && <InvitationsView data={data} save={save} busy={busy} setModal={setModal} />}
            {view === "mentors" && <MentorsView data={data} setView={setView} openProfile={setProfileBoyId} />}
            {view === "content" && data.viewer?.role === "admin" && <WebsiteContentView data={data} save={save} busy={busy} />}
          </>}
        </section>
      </div>

      {showFooter && <footer><span>{siteText(data, "footer_left", "ISKCON Warangal · Youth Mentoring")}</span><span>{siteText(data, "footer_right", "Private Google Sheet · updates refresh automatically")}</span></footer>}
      {modal === "boy" && <ModalShell eyebrow={siteText(data, "modal_eyebrow", "Live database entry")} title={siteText(data, "modal_boy_title", "Add a boy")} subtitle={siteText(data, "modal_boy_subtitle", "Add his contact and mentoring details now; they can be updated later from his profile.")} onClose={() => setModal(null)}><BoyForm mentors={data.mentors} onSubmit={addBoy} saving={busy === "add-boy"} /></ModalShell>}
      {modal === "program" && <ModalShell eyebrow={editingProgramId ? "Program management" : siteText(data, "modal_eyebrow", "Live database entry")} title={editingProgramId ? "Edit dated program" : siteText(data, "modal_program_title", "Add a dated program")} subtitle={editingProgramId ? "Update the date, venue, speaker, session name or recurring Program Type." : siteText(data, "modal_program_subtitle", "Program Type stays unique even when DYS0 or DYS1 repeats on another date.")} onClose={() => { setEditingProgramId(null); setModal(null); }}><ProgramForm programTypes={data.programTypes} program={data.programs.find((program) => program.id === editingProgramId)} onSubmit={editingProgramId ? updateProgram : addProgram} saving={busy === (editingProgramId ? `program:${editingProgramId}` : "add-program")} /></ModalShell>}
      {profileBoyId && data.boys.some((boy) => boy.id === profileBoyId) && <BoyProfileModal data={data} boyId={profileBoyId} save={save} busy={busy} onClose={() => setProfileBoyId(null)} />}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}

function LoadingState() {
  return <div className="panel loading-panel"><span className="spinner" /><strong>Opening the live mentoring database…</strong></div>;
}

function Overview({ data, setView, setModal, openProfile }: { data: State; setView: (view: View) => void; setModal: (modal: Modal) => void; openProfile: (boyId: string) => void }) {
  const typeStats = data.programTypes.map((type) => {
    const programIds = new Set(data.programs.filter((program) => program.programTypeId === type.id).map((program) => program.id));
    const records = data.attendance.filter((record) => record.status === "Present" && programIds.has(record.programId));
    return { type, sessions: programIds.size, entries: records.length, unique: new Set(records.map((record) => record.boyId)).size };
  }).filter((stat) => stat.sessions > 0);
  const zeroAttendance = data.boys.filter((boy) => boy.status !== "Dropped" && !data.attendance.some((record) => record.boyId === boy.id && record.status === "Present"));
  const attention = zeroAttendance.filter((boy) => needsMentorAttention(data, boy.id));
  return <div className="view-panel overview-grid">
    <OverviewStats data={data} />
    <article className="panel program-panel">
      <div className="panel-heading"><div><p className="eyebrow">{siteText(data, "overview_program_eyebrow", "Program performance")}</p><h2>{siteText(data, "overview_program_title", "Attendance by program type")}</h2></div><span className="muted-tag">All repeat dates combined</span></div>
      <div className="program-list">{typeStats.length ? typeStats.map((stat) => <div className="program-row" key={stat.type.id}><div className="program-top"><div><strong>{stat.type.name}</strong><span>{stat.sessions} dated {stat.sessions === 1 ? "session" : "sessions"}</span></div><b>{stat.entries} present</b></div><div className="bar-track"><span style={{ width: `${Math.max(4, Math.min(100, (stat.unique / Math.max(data.boys.length, 1)) * 100))}%` }} /></div><div className="program-foot"><span>{stat.unique} unique boys reached</span><span>{data.boys.length - stat.unique} still eligible</span></div></div>) : <Empty text="Add a program to begin tracking." />}</div>
      <p className="logic-note"><span>✓</span><b>DYS0 remains one Program Type.</b> A boy who attended any dated DYS0 is excluded from every future DYS0 invitation list.</p>
    </article>
    <article className="panel follow-panel">
      <div className="panel-heading"><div><p className="eyebrow">{siteText(data, "overview_attention_eyebrow", "Mentor attention")}</p><h2>{siteText(data, "overview_attention_title", "Not yet attended")}</h2></div><button className="text-button" onClick={() => setView("boys")}>View boys</button></div>
      <div className="follow-list">{[...attention, ...zeroAttendance.filter((boy) => !attention.some((item) => item.id === boy.id))].slice(0, 6).map((boy) => <button className="person-row profile-row-button" key={boy.id} onClick={() => openProfile(boy.id)}><span className="person-avatar">{initials(boy.name)}</span><span><strong>{boy.name}</strong><small>{mentorName(data, boy.mentorId)} · {boy.section || "No section"}</small></span><b className={needsMentorAttention(data, boy.id) ? "attention-label" : ""}>{needsMentorAttention(data, boy.id) ? `${followUpCount(data, boy.id)} calls` : "New"}</b></button>)}</div>
      <div className="stacked-actions"><button className="invite-cta" onClick={() => setView("attendance")}><span>Take attendance now</span><b>→</b></button><button className="secondary-cta" onClick={() => setModal("boy")}>＋ Add another boy</button></div>
    </article>
  </div>;
}

function PlanningView({ data }: { data: State }) {
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("all");
  const [type, setType] = useState("all");
  const [semester, setSemester] = useState("all");
  const [showPast, setShowPast] = useState(false);
  const [institution, setInstitution] = useState("all");
  const institutionOf = (scope: string) => /NIT Warangal/i.test(scope) ? "NIT Warangal" : /VNRVJIET/i.test(scope) ? "VNRVJIET" : "Other";
  const today = localIsoDate();
  const lookaheadDays = boundedNumber(siteSetting(data, "planning_lookahead_days", "120"), 120, 30, 365);
  const cutoffDate = new Date(`${today}T00:00:00`);
  cutoffDate.setDate(cutoffDate.getDate() + lookaheadDays);
  const cutoff = localIsoDate(cutoffDate);
  const normalized = query.trim().toLowerCase();
  const allEvents = data.calendarEvents.filter(event => institution === "all" || institutionOf(event.scope) === institution).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));
  const upcoming = allEvents.filter((event) => event.endDate >= today && event.startDate <= cutoff);
  const availableWindows = upcoming.filter((event) => event.availability === "Likely Available");
  const busyWindows = upcoming.filter((event) => event.availability === "Busy");
  const currentEvents = allEvents.filter((event) => event.startDate <= today && event.endDate >= today);
  const affectedBoys = data.boys.filter((boy) => (institution !== "NIT Warangal" && /vnrvjiet|vnr vignana|vignana jyothi/i.test(boy.college)) || (institution !== "VNRVJIET" && /nitw|nit warangal|national institute of technology.*warangal/i.test(boy.college)));
  const visible = allEvents.filter((event) =>
    (showPast || event.endDate >= today)
    && (availability === "all" || event.availability === availability)
    && (type === "all" || event.type === type)
    && (semester === "all" || event.semester === semester)
    && (!normalized || [event.title, event.type, event.availability, event.semester, event.scope, event.note, event.source].join(" ").toLowerCase().includes(normalized))
  );
  const grouped = visible.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
    const label = monthLabel(event.startDate);
    (groups[label] ??= []).push(event);
    return groups;
  }, {});
  const eventTypes = Array.from(new Set(allEvents.map((event) => event.type).filter(Boolean)));
  const semesters = Array.from(new Set(allEvents.map((event) => event.semester).filter(Boolean)));
  const nextAvailable = availableWindows[0];
  const nextBusy = busyWindows[0];

  return <div className="view-panel planning-view">
    <SectionTitle
      eyebrow={siteText(data, "planning_eyebrow", "Academic planning")}
      title={siteText(data, "planning_title", "Plan preaching around college life")}
      copy={siteText(data, "planning_description", "See examinations, holidays and breaks together. Use the availability signals as guidance, then confirm each boy's room number and travel plans before inviting.")}
      action={<a className="primary-button planning-sheet-link" href="/api/spreadsheet?tab=calendar" target="_blank" rel="noreferrer">Edit calendar in Sheet →</a>}
    />

    <div className="planning-scope-note"><span>i</span><div><strong>NIT Warangal and VNRVJIET ? 2026?27</strong><p>NIT Warangal dates cover the programs and semesters listed on each event. VNRVJIET academic dates cover B.Tech I Year (R25), except Biotechnology. Filter by institution before planning; availability is guidance, not a guarantee.</p></div></div>

    <section className="planning-kpis" aria-label="Academic planning summary">
      <article><span className="planning-kpi-icon available">○</span><div><strong>{availableWindows.length}</strong><p>Likely available windows</p><small>Next {lookaheadDays} days</small></div></article>
      <article><span className="planning-kpi-icon busy">!</span><div><strong>{busyWindows.length}</strong><p>Busy periods</p><small>Exams and assessments</small></div></article>
      <article><span className="planning-kpi-icon normal">⌁</span><div><strong>{affectedBoys.length}</strong><p>Matched boys</p><small>College matches selected institution(s)</small></div></article>
      <article><span className="planning-kpi-icon confirm">?</span><div><strong>{currentEvents.length}</strong><p>Active today</p><small>{currentEvents[0]?.title ?? "No calendar event today"}</small></div></article>
    </section>

    <section className="planning-signal-grid">
      <article className="planning-signal available"><div className="signal-head"><span>Best next opportunity</span><b>Likely available</b></div>{nextAvailable ? <><h3>{nextAvailable.title}</h3><time>{formatDateRange(nextAvailable.startDate, nextAvailable.endDate)}</time><p>{nextAvailable.note}</p></> : <Empty text="No available window is recorded in this look-ahead period." />}</article>
      <article className="planning-signal busy"><div className="signal-head"><span>Next period to avoid</span><b>Busy</b></div>{nextBusy ? <><h3>{nextBusy.title}</h3><time>{formatDateRange(nextBusy.startDate, nextBusy.endDate)}</time><p>{nextBusy.note}</p></> : <Empty text="No busy period is recorded in this look-ahead period." />}</article>
    </section>

    {currentEvents.length > 0 && <section className="today-planning"><div><p className="eyebrow">Happening now</p><h3>{currentEvents.map((event) => event.title).join(" · ")}</h3></div><div>{currentEvents.map((event) => <span className={`availability-badge ${availabilityClass(event.availability)}`} key={event.id}>{event.availability}</span>)}</div></section>}

    <div className="planning-filter-bar">
      <select aria-label="Institution" value={institution} onChange={event => { setInstitution(event.target.value); setSemester("all"); }}><option value="all">All institutions</option><option>NIT Warangal</option><option>VNRVJIET</option></select>
      <Search value={query} onChange={setQuery} placeholder="Search exams, holidays or notes…" />
      <select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">All availability</option><option>Likely Available</option><option>Busy</option><option>Normal</option><option>Confirm</option></select>
      <select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All event types</option>{eventTypes.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={semester} onChange={(event) => setSemester(event.target.value)}><option value="all">All semesters</option>{semesters.map((item) => <option key={item}>{item}</option>)}</select>
      <label className="past-toggle"><input type="checkbox" checked={showPast} onChange={(event) => setShowPast(event.target.checked)} /><span>Show past dates</span></label>
      <span className="result-count">{visible.length} events</span>
    </div>

    <div className="calendar-timeline">
      {Object.entries(grouped).map(([month, events]) => <section className="calendar-month" key={month}><div className="calendar-month-title"><span /> <h3>{month}</h3><b>{events.length}</b></div><div className="calendar-event-list">{events.map((event) => {
        const parsed = new Date(`${event.startDate}T00:00:00`);
        const isCurrent = event.startDate <= today && event.endDate >= today;
        return <article className={`calendar-event-card ${availabilityClass(event.availability)} ${isCurrent ? "current" : ""}`} key={event.id}>
          <time className="calendar-date-block"><strong>{Number.isNaN(parsed.valueOf()) ? "—" : parsed.getDate().toString().padStart(2, "0")}</strong><span>{Number.isNaN(parsed.valueOf()) ? "" : parsed.toLocaleDateString("en-IN", { month: "short" })}</span></time>
          <div className="calendar-event-copy"><div className="calendar-event-meta"><span className={`availability-badge ${availabilityClass(event.availability)}`}>{event.availability}</span><span className="calendar-type-badge">{event.type}</span>{isCurrent && <b>Today</b>}</div><h3>{event.title}</h3><p>{formatDateRange(event.startDate, event.endDate)} · {event.semester}</p><blockquote>{event.note || "Confirm the boy's availability before inviting."}</blockquote><small>{event.scope} · {event.source}</small></div>
        </article>;
      })}</div></section>)}
      {visible.length === 0 && <div className="panel"><Empty text="No academic calendar events match these filters." /></div>}
    </div>
  </div>;
}

function BoysView({ data, setModal, openProfile }: { data: State; setModal: (modal: Modal) => void; openProfile: (boyId: string) => void }) {
  const [query, setQuery] = useState("");
  const [mentor, setMentor] = useState("all");
  const [status, setStatus] = useState("all");
  const [branch, setBranch] = useState("all");
  const [section, setSection] = useState("all");
  const [hostel, setHostel] = useState("all");
  const normalized = query.trim().toLowerCase();
  const options = (field: "branch" | "section" | "hostel") => Array.from(new Set(data.boys.map((boy) => boy[field]).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const rows = data.boys.filter((boy) =>
    (mentor === "all" || boy.mentorId === mentor)
    && (status === "all" || boy.status === status)
    && (branch === "all" || boy.branch === branch)
    && (section === "all" || boy.section === section)
    && (hostel === "all" || boy.hostel === hostel)
    && (!normalized || [boy.name, boy.contact, boy.college, boy.hostel, boy.branch, boy.section, boy.comment, mentorName(data, boy.mentorId)].join(" ").toLowerCase().includes(normalized))
  ).sort((a, b) => attendedCount(data, b.id) - attendedCount(data, a.id) || a.name.localeCompare(b.name));
  return <div className="view-panel">
    <SectionTitle eyebrow={siteText(data, "boys_eyebrow", "Boys database")} title={siteText(data, "boys_title", "Search, filter and follow up")} copy={siteText(data, "boys_description", "Open any boy's profile to see contact details, responses, attendance history, remarks and mentor comments.")} action={<button className="primary-button large-action" onClick={() => setModal("boy")}>＋ Add boy</button>} />
    <div className="filter-bar multi-filter"><Search value={query} onChange={setQuery} placeholder="Search name, contact, mentor or comment…" /><select value={mentor} onChange={(event) => setMentor(event.target.value)}><option value="all">All mentors</option>{data.mentors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option>Active</option><option>Passive</option><option>Dropped</option></select><select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="all">All branches</option>{options("branch").map((item) => <option key={item}>{item}</option>)}</select><select value={section} onChange={(event) => setSection(event.target.value)}><option value="all">All sections</option>{options("section").map((item) => <option key={item}>{item}</option>)}</select><select value={hostel} onChange={(event) => setHostel(event.target.value)}><option value="all">All rooms</option>{options("hostel").map((item) => <option key={item}>{item}</option>)}</select><span className="result-count">{rows.length} boys</span></div>
    <div className="table-wrap boys-table"><table><thead><tr><th>Boy</th><th>Contact</th><th>Mentor</th><th>College / Room No</th><th>Branch / section</th><th>Status</th><th>Follow-up</th><th>Present</th></tr></thead><tbody>{rows.map((boy) => { const count = attendedCount(data, boy.id); const calls = followUpCount(data, boy.id); const flagged = needsMentorAttention(data, boy.id); return <tr key={boy.id}><td><button className="table-person profile-link" onClick={() => openProfile(boy.id)}><i>{initials(boy.name)}</i><span><strong>{boy.name}</strong><small>View complete profile →</small></span></button></td><td>{boy.contact ? <a className="contact-link" href={`tel:${boy.contact.replace(/[^\d+]/g, "")}`}>{boy.contact}</a> : "—"}</td><td>{mentorName(data, boy.mentorId)}</td><td>{boy.college || "—"}<small className="cell-sub">{boy.floor ? `${boy.floor} · ` : ""}{boy.hostel || "—"}</small></td><td><span className="section-chip">{boy.section || "—"}</span><small className="cell-sub">{boy.branch || "—"}</small></td><td><span className={`status-badge ${boy.status.toLowerCase()}`}>{boy.status}</span></td><td>{flagged ? <button className="attention-chip" onClick={() => openProfile(boy.id)}>⚑ {calls} invitations</button> : <span>{calls} invitations</span>}</td><td><strong>{count}</strong> sessions</td></tr>; })}</tbody></table>{rows.length === 0 && <Empty text="No boys match these filters." />}</div>
  </div>;
}

function ProgramsView({ data, setModal, setView, save, busy, editProgram }: { data: State; setModal: (modal: Modal) => void; setView: (view: View) => void; save: (action: string, payload: Record<string, unknown>, success: string, key?: string) => Promise<boolean>; busy: string | null; editProgram: (programId: string) => void }) {
  const programs = latestPrograms(data.programs, data.programs.length);

  async function deleteProgram(program: Program) {
    const attendanceCount = data.attendance.filter((record) => record.programId === program.id).length;
    const invitationCount = data.invitations.filter((record) => record.programId === program.id).length;
    const linked = attendanceCount + invitationCount;
    const warning = linked
      ? ` This will also remove ${attendanceCount} attendance and ${invitationCount} invitation ${linked === 1 ? "record" : "records"}.`
      : "";
    if (!window.confirm(`Delete ${program.programType} on ${formatDate(program.date)}?${warning} This cannot be undone.`)) return;
    await save("delete_program", { programId: program.id }, "Program deleted.", `delete-program:${program.id}`);
  }

  return <div className="view-panel"><SectionTitle eyebrow={siteText(data, "programs_eyebrow", "Program database")} title={siteText(data, "programs_title", "Dated sessions")} copy={siteText(data, "programs_description", "Each date is a session; Program Type is the recurring DYS0, DYS1 or later stage.")} action={<button className="primary-button large-action" onClick={() => setModal("program")}>＋ Add program</button>} />
    <div className="program-card-grid">{programs.map((program) => { const records = data.attendance.filter((record) => record.programId === program.id); const invitations = data.invitations.filter((record) => record.programId === program.id); const coming = invitations.filter((record) => parseInvitationResponse(record.response).category === "Coming").length; const deleteKey = `delete-program:${program.id}`; return <article className="session-card" key={program.id}><div className="session-card-head"><span>{program.programType}</span><time>{formatDate(program.date)}</time></div><h3>{program.name}</h3><p>{program.venue || "Venue not added"}{program.speaker ? ` · ${program.speaker}` : ""}</p><div className="session-stats"><span><b>{records.filter((record) => record.status === "Present").length}</b> present</span><span><b>{records.filter((record) => record.status === "Absent").length}</b> absent</span><span><b>{invitations.length}</b> invited</span><span className="expected"><b>{coming}</b> coming</span></div><div className="session-actions"><button onClick={() => setView("attendance")}>Take attendance →</button><button className="edit-session" onClick={() => editProgram(program.id)}>Edit</button><button className="delete-session" disabled={busy === deleteKey} onClick={() => void deleteProgram(program)}>{busy === deleteKey ? "Deleting…" : "Delete"}</button></div></article>; })}</div>{data.programs.length === 0 && <div className="panel"><Empty text="No programs yet. Add the first dated session." /></div>}
  </div>;
}

function AttendanceView({ data, save, busy }: { data: State; save: (action: string, payload: Record<string, unknown>, success: string, key?: string) => Promise<boolean>; busy: string | null }) {
  const programs = latestPrograms(data.programs, data.programs.length);
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [mentor, setMentor] = useState("all");
  const program = programs.find((item) => item.id === programId) ?? programs[0];
  const currentId = program?.id ?? "";
  const normalized = query.trim().toLowerCase();
  const invitations = data.invitations.filter((item) => item.programId === currentId);
  const invitedBoyIds = new Set(invitations.map((item) => item.boyId));
  const attendance = data.attendance.filter((record) => record.programId === currentId);
  const rows = data.boys.filter((boy) => invitedBoyIds.has(boy.id) && (mentor === "all" || boy.mentorId === mentor) && (!normalized || [boy.name, boy.contact, boy.section, boy.branch, mentorName(data, boy.mentorId)].join(" ").toLowerCase().includes(normalized)));
  const marked = attendance.filter((record) => invitedBoyIds.has(record.boyId)).length;
  const present = attendance.filter((record) => invitedBoyIds.has(record.boyId) && record.status === "Present").length;
  return <div className="view-panel"><SectionTitle eyebrow={siteText(data, "attendance_eyebrow", "Live attendance")} title={siteText(data, "attendance_title", "Attendance with useful remarks")} copy={siteText(data, "attendance_description", "Choose a dated session to see exactly the boys invited for it. Mark Present in one tap, or add a useful reason before marking Absent.")} />
    {program ? <><div className="attendance-toolbar"><label><span>Program session · all {programs.length} dated sessions</span><select value={currentId} onChange={(event) => setProgramId(event.target.value)}>{programs.map((item) => <option key={item.id} value={item.id}>{item.programType} · {formatDate(item.date)} · {item.venue || "Venue not added"}</option>)}</select></label><Search value={query} onChange={setQuery} placeholder="Search boys…" /><select value={mentor} onChange={(event) => setMentor(event.target.value)}><option value="all">All mentors</option>{data.mentors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="attendance-summary"><strong>{program.programType}</strong><span>{formatDate(program.date)} · {program.venue || "Venue not added"}</span><div className="attendance-progress"><b>{present} present</b><span>{marked} of {invitations.length} marked</span></div></div>
      <div className="attendance-sheet">{rows.map((boy) => <AttendanceRow key={`${currentId}:${boy.id}`} data={data} boy={boy} program={program} invitation={invitations.find((item) => item.boyId === boy.id)} record={attendance.find((item) => item.boyId === boy.id)} save={save} busy={busy} />)}{invitations.length === 0 && <Empty text="No boys were invited for this dated session yet." />}{invitations.length > 0 && rows.length === 0 && <Empty text="No invited boys match the current search or mentor filter." />}</div></> : <div className="panel"><Empty text="Add a program before taking attendance." /></div>}
  </div>;
}

function AttendanceRow({ data, boy, program, invitation, record, save, busy }: { data: State; boy: Boy; program: Program; invitation?: Invitation; record?: Attendance; save: (action: string, payload: Record<string, unknown>, success: string, key?: string) => Promise<boolean>; busy: string | null }) {
  const [reason, setReason] = useState(record?.reason ?? "");
  const [savedStatus, setSavedStatus] = useState(record?.status ?? "");
  const key = `${program.id}:${boy.id}`;

  async function mark(status: "Present" | "Absent") {
    if (await save("set_attendance", { programId: program.id, boyId: boy.id, status, reason }, `${boy.name} marked ${status.toLowerCase()}.`, key)) setSavedStatus(status);
  }

  async function undo() {
    if (!window.confirm(`Undo ${boy.name}'s attendance for ${program.programType} on ${formatDate(program.date)}?`)) return;
    if (await save("delete_attendance", { programId: program.id, boyId: boy.id }, `${boy.name}'s attendance cleared.`, key)) {
      setSavedStatus("");
      setReason("");
    }
  }

  const status = record?.status ?? savedStatus;
  const response = parseInvitationResponse(invitation?.response).category || invitation?.response || "Response recorded";
  return <div className={`attendance-row ${status ? "marked" : ""}`}><span className="person-avatar">{initials(boy.name)}</span><span className="attendance-person"><strong>{boy.name}</strong><small>{mentorName(data, boy.mentorId)} · {boy.branch} {boy.section}</small><em>Invited · {response}</em></span><label className="attendance-reason"><span>Remark / reason for absence</span><input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="e.g. Exam, out of station, did not answer…" /></label><div className="attendance-toggle"><button type="button" disabled={busy === key} className={status === "Present" ? "selected present" : ""} onClick={() => void mark("Present")}>{busy === key ? "Saving…" : status === "Present" ? "✓ Present saved" : "✓ Present"}</button><button type="button" disabled={busy === key || !reason.trim()} title={!reason.trim() ? "Add the reason before marking absent" : "Mark absent"} className={status === "Absent" ? "selected absent" : ""} onClick={() => void mark("Absent")}>{busy === key ? "Saving…" : status === "Absent" ? "× Absent saved" : "× Absent"}</button>{status && <button type="button" className="undo-record" disabled={busy === key} onClick={() => void undo()}>↶ Undo attendance</button>}</div></div>;
}

function InvitationsView({ data, save, busy, setModal }: { data: State; save: (action: string, payload: Record<string, unknown>, success: string, key?: string) => Promise<boolean>; busy: string | null; setModal: (modal: Modal) => void }) {
  const firstType = data.programTypes.find((type) => data.programs.some((program) => program.programTypeId === type.id))?.id ?? data.programTypes[0]?.id ?? "";
  const [typeId, setTypeId] = useState(firstType);
  const [targetProgramId, setTargetProgramId] = useState("");
  const [query, setQuery] = useState("");
  const [mentor, setMentor] = useState("all");
  const selectedType = data.programTypes.find((type) => type.id === typeId);
  const allTypePrograms = data.programs.filter((program) => program.programTypeId === typeId);
  const typePrograms = latestPrograms(allTypePrograms, boundedNumber(siteSetting(data, "recent_session_limit", "5"), 5, 3, 10));
  const target = typePrograms.find((program) => program.id === targetProgramId) ?? typePrograms[0];
  const typeProgramIds = new Set(allTypePrograms.map((program) => program.id));
  const alreadyAttended = new Set(data.attendance.filter((record) => record.status === "Present" && typeProgramIds.has(record.programId)).map((record) => record.boyId));
  const normalized = query.trim().toLowerCase();
  const eligible = data.boys.filter((boy) => boy.status !== "Dropped" && !alreadyAttended.has(boy.id) && (mentor === "all" || boy.mentorId === mentor) && (!normalized || [boy.name, boy.contact, mentorName(data, boy.mentorId), boy.branch, boy.section, boy.hostel].join(" ").toLowerCase().includes(normalized)));
  const targetInvitations = target ? data.invitations.filter((item) => item.programId === target.id) : [];
  const expected = targetInvitations.filter((item) => parseInvitationResponse(item.response).category === "Coming").length;
  return <div className="view-panel"><div className="invitation-hero"><div><p className="eyebrow">{siteText(data, "invitations_eyebrow", "Invitation responses")}</p><h2>{siteText(data, "invitations_title", "Call, invite and record the answer")}</h2><p>{siteText(data, "invitations_description", "Every invitation requires a response. Add the boy's exact reason in the note so future follow-up is clear.")}</p></div><div className="invitation-outcomes"><div><strong>{eligible.length}</strong><span>eligible</span></div><div><strong>{targetInvitations.length}</strong><span>called</span></div><div className="coming"><strong>{expected}</strong><span>coming</span></div></div></div>
    <div className="invite-controls"><div className="program-switcher">{data.programTypes.map((type) => <button key={type.id} className={typeId === type.id ? "active" : ""} onClick={() => { setTypeId(type.id); setTargetProgramId(""); }}>{type.name}</button>)}</div><div className="invite-filters"><Search value={query} onChange={setQuery} placeholder="Search eligible boys…" /><select value={mentor} onChange={(event) => setMentor(event.target.value)}><option value="all">All mentors</option>{data.mentors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={target?.id ?? ""} onChange={(event) => setTargetProgramId(event.target.value)}><option value="">Select latest dated session</option>{typePrograms.map((program) => <option key={program.id} value={program.id}>{formatDate(program.date)} · {program.venue}</option>)}</select></div></div>
    <div className="eligibility-rule"><span>✓</span><p><b>{selectedType?.name ?? "Program"} rule:</b> repeat dates are combined. Present once means no longer eligible for this Program Type. Dropped boys never appear in future invitation lists.</p></div>
    {!target ? <div className="panel inline-empty"><Empty text={`Add a dated ${selectedType?.name ?? "program"} session before recording invitations.`} /><button className="primary-button" onClick={() => setModal("program")}>＋ Add program</button></div> : <div className="invite-grid">{eligible.map((boy) => { const invitation = data.invitations.find((item) => item.programId === target.id && item.boyId === boy.id); return <InvitationResponseCard key={`${boy.id}:${invitation?.response ?? "new"}`} boy={boy} mentor={mentorName(data, boy.mentorId)} program={target} invitation={invitation} save={save} busy={busy} />; })}</div>}
  </div>;
}

function InvitationResponseCard({ boy, mentor, program, invitation, save, busy }: { boy: Boy; mentor: string; program: Program; invitation?: Invitation; save: (action: string, payload: Record<string, unknown>, success: string, key?: string) => Promise<boolean>; busy: string | null }) {
  const initial = parseInvitationResponse(invitation?.response ?? "");
  const [category, setCategory] = useState<InvitationResponse | "">(initial.category);
  const [note, setNote] = useState(initial.note);
  const key = `invite:${program.id}:${boy.id}`;
  const response = category === "Other"
    ? (note.trim() ? `Other — ${note.trim()}` : "")
    : (category ? `${category}${note.trim() ? ` — ${note.trim()}` : ""}` : "");

  async function undoInvitation() {
    if (!window.confirm(`Undo ${boy.name}'s invitation for ${program.programType} on ${formatDate(program.date)}?`)) return;
    await save("delete_invitation", { programId: program.id, boyId: boy.id }, `${boy.name}'s invitation cleared.`, key);
  }

  return <article className={`invite-card ${invitation ? "recorded" : ""}`}>
    <div className="invite-person"><span className="person-avatar">{initials(boy.name)}</span><div><strong>{boy.name}</strong><p>{mentor} · {boy.branch} {boy.section}</p><small>{boy.contact || "No contact number"} · {invitation ? `Response saved for ${formatDate(program.date)}` : `Call for ${program.programType} · ${formatDate(program.date)}`}</small></div></div>
    <label className="response-field"><span>Call response *</span><select value={category} onChange={(event) => setCategory(event.target.value as InvitationResponse | "")}><option value="">Select response</option>{invitationResponses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label className="response-field response-note"><span>What did he say?</span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} placeholder={category === "Other" ? "Reason is required" : "Optional exact words or reason"} /></label>
    <div className="invite-card-actions"><button disabled={!response || busy === key} className={invitation ? "save-response saved" : "save-response"} onClick={() => void save("set_invitation", { programId: program.id, boyId: boy.id, invited: true, response }, `${boy.name}'s response saved.`, key)}>{busy === key ? "Saving…" : invitation ? "✓ Update response" : "Save invitation & response"}</button>{invitation && <button className="undo-invitation" disabled={busy === key} onClick={() => void undoInvitation()}>↶ Undo invitation</button>}</div>
  </article>;
}

function MentorsView({ data, setView, openProfile }: { data: State; setView: (view: View) => void; openProfile: (boyId: string) => void }) {
  const recentLimit = boundedNumber(siteSetting(data, "recent_session_limit", "5"), 5, 3, 10);
  const recent = latestPrograms(data.programs, recentLimit);
  const [programId, setProgramId] = useState(recent[0]?.id ?? "");
  const program = recent.find((item) => item.id === programId) ?? recent[0];
  const invitations = program ? data.invitations.filter((item) => item.programId === program.id) : [];
  const coming = invitations.filter((item) => parseInvitationResponse(item.response).category === "Coming").length;
  const maybe = invitations.filter((item) => ["Maybe", "Call back"].includes(parseInvitationResponse(item.response).category)).length;
  return <div className="view-panel"><SectionTitle eyebrow={siteText(data, "mentors_eyebrow", "Mentor summaries")} title={siteText(data, "mentors_title", "Every group, response and attendance stage")} copy={siteText(data, "mentors_description", "Choose one of the latest five sessions for invitation responses, then expand a mentor to see every boy and the sessions he has attended.")} />
    {program && <div className="mentor-response-toolbar"><label><span>Invitation session · latest {recentLimit}</span><select value={program.id} onChange={(event) => setProgramId(event.target.value)}>{recent.map((item) => <option key={item.id} value={item.id}>{item.programType} · {formatDate(item.date)} · {item.venue || "Venue not added"}</option>)}</select></label><div><strong>{invitations.length}</strong><span>Called</span></div><div className="coming"><strong>{coming}</strong><span>Coming</span></div><div className="maybe"><strong>{maybe}</strong><span>Maybe / call back</span></div></div>}
    <div className="mentor-grid">{data.mentors.map((mentor) => {
      const boys = data.boys.filter((boy) => boy.mentorId === mentor.id).sort((a, b) => attendedCount(data, b.id) - attendedCount(data, a.id) || a.name.localeCompare(b.name));
      const boyIds = new Set(boys.map((boy) => boy.id));
      const present = data.attendance.filter((record) => record.status === "Present" && boyIds.has(record.boyId));
      const mentorInvitations = invitations.filter((record) => boyIds.has(record.boyId));
      const flagged = boys.filter((boy) => needsMentorAttention(data, boy.id));
      return <article className="mentor-card" key={mentor.id}>
        <div className="mentor-head"><span className={`mentor-avatar ${mentor.tone}`}>{mentor.initials}</span><div><h3>{mentor.name}</h3><p>{boys.length} boys · {flagged.length} need attention</p></div><button onClick={() => setView("boys")} aria-label={`Open boys for ${mentor.name}`}>→</button></div>
        <div className="mentor-totals"><div><strong>{boys.length}</strong><span>Total boys</span></div><div><strong>{new Set(present.map((record) => record.boyId)).size}</strong><span>Boys attended</span></div></div>
        <div className="mentor-programs expanded">{data.programTypes.slice(0, 6).map((type) => { const programIds = new Set(data.programs.filter((item) => item.programTypeId === type.id).map((item) => item.id)); const records = present.filter((record) => programIds.has(record.programId)); return <div key={type.id}><span>{type.name}</span><strong>{new Set(records.map((record) => record.boyId)).size}</strong><small>boys</small></div>; })}</div>
        <div className="mentor-response-list"><div className="mentor-response-head"><strong>{program ? `${program.programType} responses` : "Invitation responses"}</strong><span>{mentorInvitations.length} called</span></div>{mentorInvitations.length ? mentorInvitations.map((invitation) => { const boy = data.boys.find((item) => item.id === invitation.boyId); const parsed = parseInvitationResponse(invitation.response); return boy ? <div className="mentor-response-row" key={invitation.id}><button className="response-boy profile-text-button" onClick={() => openProfile(boy.id)}>{boy.name}</button><span className={`response-chip ${responseTone(invitation.response)}`}>{parsed.category || "Not recorded"}</span>{parsed.note && <small>{parsed.note}</small>}</div> : null; }) : <p className="no-responses">No boys called for this session yet.</p>}</div>
        <details className="mentor-roster"><summary>View {boys.length} boys · most regular first</summary><div className="mentor-roster-list">{boys.map((boy) => { const sessions = data.attendance.filter((record) => record.boyId === boy.id && record.status === "Present").map((record) => data.programs.find((item) => item.id === record.programId)).filter((item): item is Program => Boolean(item)); return <div className="mentor-roster-row" key={boy.id}><button onClick={() => openProfile(boy.id)}><strong>{boy.name}</strong><small>{boy.contact || "No contact"} · {boy.status} · {sessions.length} attended</small></button><div>{sessions.length ? sessions.map((session) => <span key={session.id}>{session.programType} · {formatDate(session.date)}</span>) : <em>No attendance yet</em>}</div>{needsMentorAttention(data, boy.id) && <b>⚑ {followUpCount(data, boy.id)} invitations</b>}</div>; })}{boys.length === 0 && <p className="no-responses">No boys assigned to this mentor.</p>}</div></details>
      </article>;
    })}</div>
  </div>;
}

function BoyProfileModal({ data, boyId, save, busy, onClose }: { data: State; boyId: string; save: (action: string, payload: Record<string, unknown>, success: string, key?: string) => Promise<boolean>; busy: string | null; onClose: () => void }) {
  const boy = data.boys.find((item) => item.id === boyId);
  if (!boy) return null;
  const profileBoy: Boy = boy;
  const attendance = data.attendance.filter((record) => record.boyId === boy.id).map((record) => ({ record, program: data.programs.find((program) => program.id === record.programId) })).filter((item): item is { record: Attendance; program: Program } => Boolean(item.program)).sort((a, b) => b.program.date.localeCompare(a.program.date));
  const invitations = data.invitations.filter((record) => record.boyId === boy.id).map((record) => ({ record, program: data.programs.find((program) => program.id === record.programId) })).filter((item): item is { record: Invitation; program: Program } => Boolean(item.program)).sort((a, b) => b.program.date.localeCompare(a.program.date));
  const profileKey = `profile:${boy.id}`;
  const deleteKey = `delete:${boy.id}`;

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await save("update_boy", { boyId: profileBoy.id, ...values }, `${profileBoy.name}'s profile updated.`, profileKey);
  }

  async function deleteBoy() {
    const linked = attendance.length + invitations.length;
    if (!window.confirm(`Delete ${profileBoy.name}? This will also remove ${linked} linked attendance and invitation ${linked === 1 ? "record" : "records"}. This cannot be undone.`)) return;
    if (await save("delete_boy", { boyId: profileBoy.id }, `${profileBoy.name} deleted.`, deleteKey)) onClose();
  }

  async function undoAttendance(program: Program) {
    const key = `profile-attendance:${profileBoy.id}:${program.id}`;
    if (!window.confirm(`Undo ${profileBoy.name}'s attendance for ${program.programType} on ${formatDate(program.date)}?`)) return;
    await save("delete_attendance", { boyId: profileBoy.id, programId: program.id }, `${profileBoy.name}'s attendance cleared.`, key);
  }

  async function undoInvitation(program: Program) {
    const key = `profile-invitation:${profileBoy.id}:${program.id}`;
    if (!window.confirm(`Undo ${profileBoy.name}'s invitation for ${program.programType} on ${formatDate(program.date)}?`)) return;
    await save("delete_invitation", { boyId: profileBoy.id, programId: program.id }, `${profileBoy.name}'s invitation cleared.`, key);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
    <div className="modal-head profile-head"><div className="profile-identity"><span className="profile-avatar">{initials(boy.name)}</span><div><p className="eyebrow">Boy profile · {mentorName(data, boy.mentorId)}</p><h2 id="profile-title">{boy.name}</h2><p>{boy.contact || "No contact number"} · {boy.college || "College not added"} · {boy.hostel || "Room No not added"}</p></div></div><button className="modal-close" onClick={onClose} aria-label="Close">×</button></div>
    <div className="profile-stats"><div><strong>{attendance.filter((item) => item.record.status === "Present").length}</strong><span>Present entries</span></div><div><strong>{invitations.length}</strong><span>Invitations</span></div><div><strong>{boy.status}</strong><span>Current status</span></div><div className={needsMentorAttention(data, boy.id) ? "attention" : ""}><strong>{needsMentorAttention(data, boy.id) ? "Needs attention" : "On track"}</strong><span>{needsMentorAttention(data, boy.id) ? `${followUpCount(data, boy.id)} invitations, no attendance` : "Follow-up signal"}</span></div></div>

    <form className="profile-edit-form" onSubmit={updateProfile}>
      <div className="profile-section-heading"><div><p className="eyebrow">Profile management</p><h3>Contact, status and mentor notes</h3></div><span>Added {formatTimestamp(boy.createdAt)}{boy.createdBy ? ` by ${boy.createdBy}` : ""}</span></div>
      <div className="profile-edit-grid"><label><span>Contact number</span><input name="contact" defaultValue={boy.contact} inputMode="tel" maxLength={24} /></label><label><span>Status</span><select name="status" defaultValue={boy.status}><option>Active</option><option>Passive</option><option>Dropped</option></select></label><label><span>Mentor</span><select name="mentorId" defaultValue={boy.mentorId}>{data.mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}</select></label><label><span>College</span><input name="college" defaultValue={boy.college} /></label><HostelFields floor={boy.floor} room={boy.hostel} /><label><span>Branch</span><input name="branch" defaultValue={boy.branch} /></label><label><span>Section</span><input name="section" defaultValue={boy.section} /></label><label className="full"><span>Mentor comment about this boy</span><textarea name="comment" rows={4} maxLength={1500} defaultValue={boy.comment} placeholder="Interests, concerns, preferred follow-up, background or next step…" /></label></div>
      <div className="profile-actions"><button type="button" className="danger-button" disabled={busy === deleteKey} onClick={() => void deleteBoy()}>{busy === deleteKey ? "Deleting…" : "Delete boy"}</button><button className="primary-button large-action" type="submit" disabled={busy === profileKey}>{busy === profileKey ? "Saving…" : "Save profile"}</button></div>
    </form>

    <BoyProfileActions data={data} boy={boy} save={save} busy={busy} />

    <section className="profile-history"><div className="profile-section-heading"><div><p className="eyebrow">Attendance history</p><h3>Sessions attended and absence remarks</h3></div><span>{attendance.length} records</span></div><div className="history-list">{attendance.length ? attendance.map(({ record, program }) => { const key = `profile-attendance:${boy.id}:${program.id}`; return <article className="history-item" key={record.id}><span className={`history-icon ${record.status.toLowerCase()}`}>{record.status === "Present" ? "✓" : record.status === "Late" ? "◷" : "×"}</span><div><strong>{program.programType} · {program.name}</strong><p>{formatDate(program.date)} · {program.venue || "Venue not added"}{program.speaker ? ` · Speaker: ${program.speaker}` : ""}</p>{record.reason && <blockquote>{record.reason}</blockquote>}<small>Recorded {formatTimestamp(record.updatedAt)} by {record.updatedBy || mentorName(data, record.mentorId)}</small></div><div className="history-actions"><b className={`status-badge ${record.status.toLowerCase()}`}>{record.status}</b><button disabled={busy === key} onClick={() => void undoAttendance(program)}>↶ Undo</button></div></article>; }) : <Empty text="No attendance recorded yet." />}</div></section>

    <section className="profile-history"><div className="profile-section-heading"><div><p className="eyebrow">Follow-up history</p><h3>Invitation responses across sessions</h3></div><span>{invitations.length} responses</span></div><div className="history-list">{invitations.length ? invitations.map(({ record, program }) => { const parsed = parseInvitationResponse(record.response); const key = `profile-invitation:${boy.id}:${program.id}`; return <article className="history-item invitation-history" key={record.id}><span className={`history-icon ${responseTone(record.response)}`}>☎</span><div><strong>{program.programType} · {formatDate(program.date)}</strong><p>{program.venue || "Venue not added"}</p><blockquote>{parsed.note || record.response}</blockquote><small>Updated {formatTimestamp(record.updatedAt)} by {record.updatedBy || mentorName(data, record.mentorId)}</small></div><div className="history-actions"><b className={`response-chip ${responseTone(record.response)}`}>{parsed.category || "Recorded"}</b><button disabled={busy === key} onClick={() => void undoInvitation(program)}>↶ Undo</button></div></article>; }) : <Empty text="No invitation responses recorded yet." />}</div></section>
  </section></div>;
}

function BoyProfileActions({ data, boy, save, busy }: { data: State; boy: Boy; save: (action: string, payload: Record<string, unknown>, success: string, key?: string) => Promise<boolean>; busy: string | null }) {
  const programs = latestPrograms(data.programs, data.programs.length);
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const program = programs.find((item) => item.id === programId) ?? programs[0];
  const invitation = program ? data.invitations.find((record) => record.programId === program.id && record.boyId === boy.id) : undefined;
  const attendance = program ? data.attendance.find((record) => record.programId === program.id && record.boyId === boy.id) : undefined;
  const parsed = parseInvitationResponse(invitation?.response);
  const [category, setCategory] = useState<InvitationResponse | "">(parsed.category);
  const [note, setNote] = useState(parsed.note);
  const [attendanceStatus, setAttendanceStatus] = useState<"Present" | "Absent">(attendance?.status === "Absent" ? "Absent" : "Present");
  const [reason, setReason] = useState(attendance?.reason ?? "");

  useEffect(() => {
    const nextParsed = parseInvitationResponse(invitation?.response);
    setCategory(nextParsed.category);
    setNote(nextParsed.note);
    setAttendanceStatus(attendance?.status === "Absent" ? "Absent" : "Present");
    setReason(attendance?.reason ?? "");
  }, [program?.id, boy.id, invitation?.response, attendance?.status, attendance?.reason]);

  if (!program) return <section className="profile-direct-actions"><div className="profile-section-heading"><div><p className="eyebrow">Record for this boy</p><h3>Invitation and attendance</h3></div></div><Empty text="Add a program before recording an invitation or attendance." /></section>;

  const invitationKey = `profile-direct-invitation:${boy.id}:${program.id}`;
  const attendanceKey = `profile-direct-attendance:${boy.id}:${program.id}`;
  const response = category === "Other"
    ? (note.trim() ? `Other — ${note.trim()}` : "")
    : (category ? `${category}${note.trim() ? ` — ${note.trim()}` : ""}` : "");

  async function saveInvitation() {
    await save("set_invitation", { programId: program.id, boyId: boy.id, invited: true, response }, `${boy.name}'s invitation saved.`, invitationKey);
  }

  async function saveAttendance() {
    await save("set_attendance", { programId: program.id, boyId: boy.id, status: attendanceStatus, reason }, `${boy.name} marked ${attendanceStatus.toLowerCase()}.`, attendanceKey);
  }

  return <section className="profile-direct-actions">
    <div className="profile-section-heading"><div><p className="eyebrow">Record for this boy</p><h3>Invitation and attendance</h3></div><span>Choose any dated session</span></div>
    <label className="profile-program-picker"><span>Program session</span><select value={program.id} onChange={(event) => setProgramId(event.target.value)}>{programs.map((item) => <option key={item.id} value={item.id}>{item.programType} · {formatDate(item.date)} · {item.venue || "Venue not added"}</option>)}</select></label>
    <div className="profile-action-grid">
      <article><div className="profile-action-title"><span>☎</span><div><strong>Invitation response</strong><small>{invitation ? "Already recorded · update or undo from history below" : "Invite him for this session"}</small></div></div><label><span>Response *</span><select value={category} onChange={(event) => setCategory(event.target.value as InvitationResponse | "")}><option value="">Select response</option>{invitationResponses.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>What did he say?</span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} placeholder="Optional exact words or reason" /></label><button className="primary-button" disabled={!response || busy === invitationKey} onClick={() => void saveInvitation()}>{busy === invitationKey ? "Saving…" : invitation ? "Update invitation" : "Save invitation"}</button></article>
      <article><div className="profile-action-title"><span>✓</span><div><strong>Attendance</strong><small>{attendance ? `${attendance.status} is currently recorded` : "Mark this dated session"}</small></div></div><label><span>Attendance status</span><select value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value as "Present" | "Absent")}><option>Present</option><option>Absent</option></select></label><label><span>{attendanceStatus === "Absent" ? "Reason for absence *" : "Remark"}</span><input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder={attendanceStatus === "Absent" ? "Exam, out of station, no answer…" : "Optional note"} /></label><button className="primary-button" disabled={(attendanceStatus === "Absent" && !reason.trim()) || busy === attendanceKey} onClick={() => void saveAttendance()}>{busy === attendanceKey ? "Saving…" : attendance ? "Update attendance" : "Save attendance"}</button></article>
    </div>
  </section>;
}

function WebsiteContentView({ data, save, busy }: { data: State; save: (action: string, payload: Record<string, unknown>, success: string, key?: string) => Promise<boolean>; busy: string | null }) {
  const [draft, setDraft] = useState<Record<string, string>>({ ...data.websiteContent });
  const [dirty, setDirty] = useState(false);
  const sections = Array.from(new Set(contentFields.map((field) => field[1])));

  async function saveContent() {
    const values = Object.fromEntries(contentFields.map(([key]) => [key, draft[key] ?? ""]));
    if (await save("update_website_content", { values }, "Website text updated for everyone.", "website-content")) setDirty(false);
  }

  return <div className="view-panel content-editor">
    <SectionTitle eyebrow="Admin only" title="Edit website wording live" copy="Update the main headings and descriptions here. Saves go to the Website Content tab in Google Sheets and appear for every approved user on their next refresh." />
    <div className="content-notice"><span>✓</span><p><b>No redeployment needed.</b> Website text and design refresh automatically while this page is visible, normally every {boundedNumber(siteSetting(data, "auto_refresh_seconds", "30"), 30, 30, 120)} seconds. Slow connections may take longer.</p></div>
    <div className="settings-sheet-card"><div><p className="eyebrow">Design controls</p><h3>Colours, fonts, sizing and layout</h3><p>Use the <b>Website Settings</b> tab to customise the full visual theme. Every row explains the allowed value and the part of the site it changes.</p></div><a href="/api/spreadsheet?tab=settings" target="_blank" rel="noreferrer">Open Website Settings →</a></div>
    <div className="content-section-grid">{sections.map((section) => <section className="content-section" key={section}><div className="content-section-head"><p className="eyebrow">Website copy</p><h3>{section}</h3></div><div className="content-field-grid">{contentFields.filter((field) => field[1] === section).map(([key, , label, multiline]) => <label className={multiline ? "content-field full" : "content-field"} key={key}><span>{label}</span>{multiline ? <textarea rows={4} maxLength={3000} value={draft[key] ?? ""} onChange={(event) => { setDraft((current) => ({ ...current, [key]: event.target.value })); setDirty(true); }} /> : <input maxLength={3000} value={draft[key] ?? ""} onChange={(event) => { setDraft((current) => ({ ...current, [key]: event.target.value })); setDirty(true); }} />}<small>{key}</small></label>)}</div></section>)}</div>
    <div className="content-save-bar"><div><strong>{dirty ? "Unsaved wording changes" : "All wording is saved"}</strong><span>Only Admin accounts can open or save this screen.</span></div><button className="secondary-cta" disabled={!dirty || busy === "website-content"} onClick={() => { setDraft({ ...data.websiteContent }); setDirty(false); }}>Discard changes</button><button className="primary-button" disabled={!dirty || busy === "website-content"} onClick={() => void saveContent()}>{busy === "website-content" ? "Saving…" : "Save website text"}</button></div>
  </div>;
}

function ModalShell({ eyebrow, title, subtitle, onClose, children }: { eyebrow: string; title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><p className="eyebrow">{eyebrow}</p><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="modal-close" onClick={onClose} aria-label="Close">×</button></div>{children}</section></div>;
}

function BoyForm({ mentors, onSubmit, saving }: { mentors: Mentor[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  return <form className="record-form" onSubmit={onSubmit}><label className="full"><span>Boy name *</span><input name="name" required autoFocus placeholder="Full name" /></label><label><span>Contact number</span><input name="contact" inputMode="tel" maxLength={24} placeholder="Mobile number" /></label><label><span>Mentor *</span><select name="mentorId" required defaultValue=""><option value="" disabled>Select mentor</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}</select></label><label><span>College</span><input name="college" placeholder="e.g. NITW" /></label><HostelFields /><label><span>Branch</span><input name="branch" placeholder="e.g. CSE" /></label><label><span>Section</span><input name="section" placeholder="e.g. A" /></label><label><span>Status</span><select name="status" defaultValue="Active"><option>Active</option><option>Passive</option><option>Dropped</option></select></label><label className="full"><span>Initial mentor comment</span><textarea name="comment" rows={3} maxLength={1500} placeholder="Interest, background or next follow-up step…" /></label><div className="form-actions full"><button className="primary-button large-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save boy"}</button></div></form>;
}

function ProgramForm({ programTypes, program, onSubmit, saving }: { programTypes: ProgramType[]; program?: Program; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  return <form className="record-form" onSubmit={onSubmit}><label><span>Program Type *</span><select name="programTypeId" required defaultValue={program?.programTypeId ?? ""}><option value="" disabled>Select DYS stage</option>{programTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label><span>Date *</span><input name="date" type="date" required defaultValue={program?.date ?? ""} /></label><label className="full"><span>Session name</span><input name="name" defaultValue={program?.name ?? ""} placeholder="Defaults to the Program Type" /></label><label><span>Venue</span><input name="venue" defaultValue={program?.venue ?? ""} placeholder="Where is the session?" /></label><label><span>Speaker / facilitator</span><input name="speaker" defaultValue={program?.speaker ?? ""} placeholder="Who conducted the session?" /></label><div className="form-actions full"><button className="primary-button large-action" type="submit" disabled={saving}>{saving ? "Saving…" : program ? "Save program changes" : "Create program"}</button></div></form>;
}

function SectionTitle({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="section-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{copy}</p></div>{action}</div>;
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-box"><span>⌕</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state"><strong>{text}</strong><span>Live records will appear here as soon as they are saved.</span></div>;
}

function mentorName(data: State, id: string) {
  return data.mentors.find((mentor) => mentor.id === id)?.name ?? "Unassigned";
}
