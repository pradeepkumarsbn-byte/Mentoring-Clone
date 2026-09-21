export const FLOORS = Array.from({ length: 10 }, (_, i) => `B${i}`);
export const ROOMS_PER_FLOOR = 61;
export const ROOM_CAPACITY = 2;
export const OUT_ROOM_GROUPS = [[61,60,59,58],[57,56],[44,43,42,41,40,39],[38,37,36,35,34,33],[11,10,9,8,7],[6,5,4,3,2,1]];
export const IN_ROOM_GROUPS = [[55,54,53,52,51,50,49,48,47,46,45],[32,31,30,29,28],[27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12]];
export type MapBoy = { id: string; name: string; floor?: string; hostel: string; status: string };
export type RoomStatus = 'not-covered' | 'partial' | 'full' | 'data-issue';
export const STATUS_LABELS: Record<RoomStatus, string> = { 'not-covered': 'Not covered', partial: 'Partially covered', full: 'Fully covered', 'data-issue': 'Data issue' };
export function normalizeFloor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const floor = value.trim().toUpperCase();
  return /^B[0-9]$/.test(floor) ? floor : null;
}
export function normalizeRoomNumber(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const room = Number(text);
  return room >= 1 && room <= ROOMS_PER_FLOOR ? room : null;
}
export function getRoomKey(floor: unknown, room: unknown): string | null {
  const f = normalizeFloor(floor), r = normalizeRoomNumber(room);
  return f && r ? `${f}-${r}` : null;
}
export type CoverageRoom = { key: string; floor: string; number: number; boys: MapBoy[]; status: RoomStatus };
export function summarizeRooms(rooms: CoverageRoom[]) {
  const counts = { total: rooms.length, full: 0, partial: 0, empty: 0, issues: 0, mapped: 0, slots: 0, percent: 0 };
  for (const room of rooms) {
    counts[room.status === 'not-covered' ? 'empty' : room.status === 'data-issue' ? 'issues' : room.status]++;
    counts.mapped += room.boys.length;
    counts.slots += Math.min(room.boys.length, ROOM_CAPACITY);
  }
  counts.percent = counts.total ? counts.slots / (counts.total * ROOM_CAPACITY) * 100 : 0;
  return counts;
}
export function calculateRoomCoverage(boys: readonly MapBoy[]) {
  const rooms: CoverageRoom[] = FLOORS.flatMap(floor => Array.from({length: ROOMS_PER_FLOOR}, (_, i) => ({ key: `${floor}-${i+1}`, floor, number: i+1, boys: [], status: 'not-covered' })));
  const byKey = new Map(rooms.map(room => [room.key, room]));
  const unmapped: { boy: MapBoy; reason: string }[] = [];
  // Duplicate IDs with conflicting locations must not be silently assigned to a room.
  const unique = new Map<string, MapBoy>();
  const conflicts = new Set<string>();
  for (const boy of boys) {
    if (!boy.id?.trim()) { unmapped.push({boy,reason:'Missing student ID'}); continue; }
    const prior = unique.get(boy.id);
    if (prior && (getRoomKey(prior.floor,prior.hostel) !== getRoomKey(boy.floor,boy.hostel) || prior.status !== boy.status)) conflicts.add(boy.id);
    if (!prior) unique.set(boy.id,boy);
  }
  for (const boy of unique.values()) {
    if (conflicts.has(boy.id)) { unmapped.push({boy,reason:'Conflicting copies of the same student ID'}); continue; }
    if (boy.status === 'Dropped') continue;
    const key = getRoomKey(boy.floor,boy.hostel);
    if (!key) { unmapped.push({boy,reason: !boy.floor?.trim() ? 'Floor not assigned' : !normalizeFloor(boy.floor) ? 'Invalid floor' : 'Missing or invalid room (use 1–61)'}); continue; }
    byKey.get(key)!.boys.push(boy);
  }
  for (const room of rooms) room.status = room.boys.length > 2 ? 'data-issue' : room.boys.length === 2 ? 'full' : room.boys.length === 1 ? 'partial' : 'not-covered';
  return { rooms, byKey, unmapped, summary: summarizeRooms(rooms), floors: FLOORS.map(floor => ({floor,...summarizeRooms(rooms.filter(room => room.floor === floor))})) };
}
