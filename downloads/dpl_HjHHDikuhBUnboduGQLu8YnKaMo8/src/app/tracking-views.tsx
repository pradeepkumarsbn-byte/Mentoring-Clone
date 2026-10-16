"use client";

import { useState, type FormEvent } from "react";
import { monthDates, rcSummary } from "./tracking";
export type RCRecord = { id: string; boyId: string; date: string; status: string; updatedAt: string; updatedBy: string };
export type WeeklyProgram = { id: string; topic: string; date: string; venue: string };
export type TrackingState = { rcAttendance: RCRecord[]; weeklyPrograms: WeeklyProgram[]; weeklyAttendance: { id: string; boyId: string; programId: string; status: string }[] };
type Boy = { id: string; name: string; status: string; mentorId: string };
type Props = { data: TrackingState & { boys: Boy[]; mentors: { id: string; name: string }[] }; save: (action: string, payload: Record<string, unknown>, success: string, key?: string) => Promise<boolean>; busy: string | null };
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function BoyFilters({ query, setQuery, mentor, setMentor, data }: { query: string; setQuery: (v: string) => void; mentor: string; setMentor: (v: string) => void; data: Props["data"] }) {
  return <><label>Search boys<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Boy name" /></label><label>Mentor<select value={mentor} onChange={e => setMentor(e.target.value)}><option value="">All mentors</option>{data.mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></>;
}
export function RCView({ data, save, busy }: Props) {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [query, setQuery] = useState(""); const [mentor, setMentor] = useState("");
  const [signal,setSignal] = useState("");
  const dates = monthDates(month); const now = today();
  const records = new Map(data.rcAttendance.map(r => [`${r.boyId}:${r.date}`, r]));
  const boys = data.boys.filter(b => b.name.toLowerCase().includes(query.toLowerCase()) && (!mentor || b.mentorId === mentor)).filter(b => !signal || rcSummary(data.rcAttendance.filter(r => r.boyId === b.id),month,now).label === signal).sort((a,b) => a.name.localeCompare(b.name));
  return <div className="view-panel tracking-view"><div className="section-title"><div><p className="eyebrow">One round every day</p><h2>RC chanting attendance</h2><p>Present · Absent · MMC (heard the audio) · Outstation. Changes save immediately.</p></div></div>
    <div className="tracking-toolbar"><label>Month<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label><BoyFilters {...{query,setQuery,mentor,setMentor,data}} /><label>Participation<select value={signal} onChange={e => setSignal(e.target.value)}><option value="">All boys</option><option>Regular</option><option>Needs attention</option><option>Building a record</option><option>No participation records</option></select></label></div>
    <p className="tracking-note">Summary uses marked days through today in this month. Present + MMC count as participation; Outstation and unmarked days are excluded. Regular means at least 80% participation across 7 or more marked days. Any absence below 80% needs attention. Future dates cannot be marked.</p>
    <div className="tracking-scroll"><table className="tracking-grid"><caption>Daily RC attendance for {month || "selected month"}</caption><thead><tr><th scope="col">Boy / monthly summary</th>{dates.map(date => <th scope="col" key={date}>{Number(date.slice(-2))}</th>)}</tr></thead><tbody>{boys.map(boy => {
      const summary = rcSummary(data.rcAttendance.filter(r => r.boyId === boy.id), month, now);
      return <tr key={boy.id}><th scope="row"><strong>{boy.name}</strong><small>{summary.label} · {summary.rate === null ? "—" : `${summary.rate}%`}</small><small>{summary.present} Present · {summary.mmc} MMC · {summary.absent} Absent · {summary.outstation} Out</small><small>{summary.unmarked} days not marked</small></th>{dates.map(date => <td key={date}><select aria-label={`${boy.name}, ${date}`} value={records.get(`${boy.id}:${date}`)?.status ?? ""} disabled={!!busy || date > now} onChange={e => void save("set_rc",{boyId:boy.id,date,status:e.target.value},`${boy.name}'s RC saved.`)}><option value="">Not marked</option><option>Present</option><option>Absent</option><option value="MMC">MMC audio</option><option value="Outstation">Outstation</option></select></td>)}</tr>;
    })}</tbody></table></div>{!boys.length && <p>No boys match these filters.</p>}
  </div>;
}
export function WeeklyView({data,save,busy}: Props) {
  const [selected,setSelected] = useState(""); const [query,setQuery] = useState(""); const [mentor,setMentor] = useState("");
  const programs = [...data.weeklyPrograms].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const program = programs.find(p => p.id === selected) ?? programs[0];
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    if(await save("add_weekly_program",Object.fromEntries(new FormData(form)),"Weekly program added.")) form.reset();
  }
  const attendance = new Map(data.weeklyAttendance.filter(r => r.programId === program?.id).map(r => [r.boyId,r.status]));
  const boys = data.boys.filter(b => b.name.toLowerCase().includes(query.toLowerCase()) && (!mentor || b.mentorId === mentor));
  return <div className="view-panel tracking-view"><div className="section-title"><div><p className="eyebrow">Weekly learning</p><h2>Weekly programs</h2><p>Add each program with its topic and date, then record attendance. Boys can attend every week.</p></div></div>
    <form className="tracking-toolbar" onSubmit={add}><label>Topic *<input name="topic" required maxLength={180} /></label><label>Date *<input name="date" type="date" required /></label><label>Venue<input name="venue" maxLength={200} /></label><button className="primary-button" disabled={!!busy}>Add weekly program</button></form>
    <div className="tracking-toolbar"><label>Program<select value={program?.id ?? ""} onChange={e => setSelected(e.target.value)}>{!program && <option value="">Add a program first</option>}{programs.map(p => <option key={p.id} value={p.id}>{p.date} · {p.topic}</option>)}</select></label><BoyFilters {...{query,setQuery,mentor,setMentor,data}} /></div>
    {program && <><p>{program.date} · {program.topic}{program.venue ? ` · ${program.venue}` : ""} · {Array.from(attendance.values()).filter(s => s === "Present").length} present · {Array.from(attendance.values()).filter(s => s === "Absent").length} absent</p><div className="tracking-scroll"><table className="tracking-grid"><thead><tr><th>Boy</th><th>Attendance</th></tr></thead><tbody>{boys.map(b => <tr key={b.id}><th scope="row">{b.name}</th><td><select aria-label={`${b.name} weekly attendance`} value={attendance.get(b.id) ?? ""} disabled={!!busy} onChange={e => void save("set_weekly_attendance",{boyId:b.id,programId:program.id,status:e.target.value},`${b.name}'s attendance saved.`)}><option value="">Not marked</option><option>Present</option><option>Absent</option></select></td></tr>)}</tbody></table></div></>}
  </div>;
}
export function BackupView() {
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState("");
  async function download() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/mentoring",{cache:"no-store",signal:AbortSignal.timeout(170000)});
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || "Backup could not be downloaded.");
      const {viewer, ...records} = result; void viewer;
      const blob = new Blob([JSON.stringify({format:"warangal-mentoring-backup",version:1,exportedAt:new Date().toISOString(),data:records},null,2)],{type:"application/json"});
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href=url; link.download=`mentoring-backup-${today()}.json`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url),1000);
      setMessage("Backup downloaded. Save the JSON file in a safe place on your computer.");
    } catch(error) {setMessage(error instanceof Error ? error.message : "Export failed. Please retry.");} finally {setBusy(false);}
  }
  return <div className="view-panel tracking-view"><div className="section-title"><div><p className="eyebrow">Local copy</p><h2>Export / Backup</h2><p>Download a fresh copy of all portal records: boys, mentors, programs, attendance, invitations, calendar, RC, weekly programs, website wording and settings.</p></div></div><p>The JSON backup preserves IDs and dates. It contains personal information; store it securely. It excludes login credentials, the access allowlist and spreadsheet-only columns. Automatic restore is not included.</p><button className="primary-button" disabled={busy} onClick={() => void download()}>{busy ? "Preparing backup…" : "Download JSON backup"}</button><p role="status">{message}</p></div>;
}
