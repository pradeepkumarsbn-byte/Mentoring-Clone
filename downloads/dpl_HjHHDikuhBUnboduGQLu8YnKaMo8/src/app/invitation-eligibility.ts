type InviteBoy = { id: string; name: string; status: string; mentorId: string; contact: string; branch: string; section: string; hostel: string };
type InviteData<T extends InviteBoy> = {
  boys: T[];
  mentors: { id: string; name: string }[];
  programs: { id: string; programTypeId: string }[];
  attendance: { programId: string; boyId: string; status: string }[];
};

// Attendance credit belongs to the program type, across all its dated sessions.
export function eligibleInvitees<T extends InviteBoy>(data: InviteData<T>, typeId: string, mentor = 'all', query = ''): T[] {
  if (!typeId) return [];
  const sessions = new Set(data.programs.filter(program => program.programTypeId === typeId).map(program => program.id));
  const attended = new Set(data.attendance.filter(record => sessions.has(record.programId) && ['Present', 'Late'].includes(record.status)).map(record => record.boyId));
  const names = new Map(data.mentors.map(item => [item.id, item.name]));
  const search = query.trim().toLowerCase();
  return data.boys.filter(boy => boy.status !== 'Dropped' && !attended.has(boy.id)
    && (mentor === 'all' || boy.mentorId === mentor)
    && (!search || [boy.name, boy.contact, names.get(boy.mentorId), boy.branch, boy.section, boy.hostel].join(' ').toLowerCase().includes(search)));
}
