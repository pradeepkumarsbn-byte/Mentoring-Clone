import { FLOORS, normalizeFloor, normalizeRoomNumber, ROOMS_PER_FLOOR } from './hostel-map';

export default function HostelFields({ floor = '', room = '' }: { floor?: string; room?: string }) {
  const normalizedFloor = normalizeFloor(floor);
  const normalizedRoom = normalizeRoomNumber(room);
  return <><label><span>Floor</span><select name="floor" defaultValue={normalizedFloor || floor}><option value="">Floor not assigned</option>{floor && !normalizedFloor && <option value={floor}>Existing value: {floor}</option>}{FLOORS.map(value => <option key={value}>{value}</option>)}</select></label><label><span>Room No</span><select name="hostel" defaultValue={normalizedRoom ? String(normalizedRoom) : room}><option value="">Room not assigned</option>{room && !normalizedRoom && <option value={room}>Existing value: {room}</option>}{Array.from({length:ROOMS_PER_FLOOR}, (_,index) => <option key={index+1}>{index+1}</option>)}</select></label></>;
}
