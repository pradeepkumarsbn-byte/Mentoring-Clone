type Row = Record<string, unknown>;
const key = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
const fields: Record<string, Record<string, string[]>> = {
  mentors: { id: ['Mentor ID'], name: ['Mentor Name'], initials: [], tone: [] },
  programTypes: { id: ['Program Type ID'], name: ['Program Name'] },
  boys: { id: ['Boy ID'], name: [], contact: [], college: [], hostel: ['Room No', 'Room Number', 'Hostel Name'], floor: ['Floor'], branch: [], section: [], status: [], mentorId: [], comment: [], createdAt: ['Added On'], createdBy: ['Added By'] },
  programs: { id: ['Program ID'], name: ['Program Name'], programTypeId: [], programType: [], date: [], venue: [], speaker: [], createdAt: ['Added On'] },
  attendance: { id: ['Attendance ID'], programId: [], boyId: [], mentorId: [], status: [], reason: [], updatedAt: ['Updated On'], updatedBy: [] },
  invitations: { id: ['Invitation ID'], programId: [], boyId: [], mentorId: [], response: [], updatedAt: ['Updated On'], updatedBy: [] },
  calendarEvents: { id: ['Event ID'], title: ['Event / Activity'], startDate: [], endDate: [], type: [], availability: [], semester: [], scope: ['Institution / Scope'], note: ['Planning Note'], source: [] },
};

function object(value: unknown): value is Row {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function scalar(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (['string', 'number', 'boolean'].includes(typeof value)) return String(value);
  throw new Error('The Google Sheet returned an invalid response.');
}

// Apps Script may return rows keyed by the actual sheet headers. Convert them
// at the server boundary; never rename columns or change spreadsheet records.
export function normalizeBridgeState(value: unknown) {
  if (!object(value)) throw new Error('The Google Sheet returned an invalid response.');
  const state: Record<string, unknown> = { ...value };
  for (const [collection, schema] of Object.entries(fields)) {
    const rows = value[collection];
    if (!Array.isArray(rows)) throw new Error('The Google Sheet returned an invalid response.');
    state[collection] = rows.flatMap(row => {
      if (!object(row)) throw new Error('The Google Sheet returned an invalid response.');
      const source = new Map(Object.entries(row).map(([name, entry]) => [key(name), entry]));
      const normalized: Record<string, string> = {};
      for (const [name, aliases] of Object.entries(schema)) {
        const candidate = [name, ...aliases].map(key).find(name => source.has(name));
        normalized[name] = scalar(candidate === undefined ? undefined : source.get(candidate));
      }
      for (const name of ['date', 'startDate', 'endDate']) {
        if (normalized[name] && /^\d{4}-\d{2}-\d{2}T/.test(normalized[name])) normalized[name] = normalized[name].slice(0, 10);
      }
      // Unused sheet rows can still contain count formulas (Invited/Attended).
      // They are not records when every field used by the app is empty.
      if (Object.values(normalized).every(entry => entry === '')) return [];
      if (!normalized.id) throw new Error(`The Google Sheet returned an invalid response: ${collection} contains a record without an ID.`);
      if (collection === 'mentors' && !normalized.initials) {
        normalized.initials = normalized.name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
      }
      return [normalized];
    });
  }
  const types = new Map((state.programTypes as Record<string, string>[]).map(row => [row.id, row.name]));
  for (const program of state.programs as Record<string, string>[]) program.programType ||= types.get(program.programTypeId) || '';
  for (const name of ['websiteContent', 'websiteSettings']) {
    if (!object(value[name])) throw new Error('The Google Sheet returned an invalid response.');
    state[name] = Object.fromEntries(Object.entries(value[name]).map(([name, entry]) => [name, scalar(entry)]));
  }
  if (typeof value.refreshedAt !== 'string') throw new Error('The Google Sheet returned an invalid response.');
  return state;
}
