import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeBridgeState } from './bridge-state.ts';

const fixture = () => ({
  mentors: [{ 'Mentor ID': 'm1', 'Mentor Name': 'Test Mentor' }],
  programTypes: [{ 'Program Type ID': 't1', 'Program Name': 'Workshop' }],
  boys: [{ 'Boy ID': 'b1', Name: 'Test Boy', 'Mentor ID': 'm1', 'Hostel Name': 'Hostel', Contact: 123 }],
  programs: [{ 'Program ID': 'p1', 'Program Name': 'Session', Date: '2026-09-20', 'Program Type ID': 't1' }],
  attendance: [{ 'Attendance ID': 'a1', 'Program ID': 'p1', 'Boy ID': 'b1', Status: 'Present' }],
  invitations: [{ 'Invitation ID': 'i1', 'Program ID': 'p1', 'Boy ID': 'b1' }],
  calendarEvents: [{ 'Event ID': 'e1', 'Event / Activity': 'Exam', 'Start Date': '2026-09-21' }],
  websiteContent: {}, websiteSettings: { refresh_seconds: 60 }, refreshedAt: '2026-09-20T00:00:00Z',
});

test('maps actual spreadsheet headers and preserves relationships', () => {
  const state = normalizeBridgeState(fixture());
  assert.equal(state.programs[0].date, '2026-09-20');
  assert.equal(state.programs[0].id, state.attendance[0].programId);
  assert.equal(state.boys[0].id, state.invitations[0].boyId);
  assert.equal(state.programs[0].programType, 'Workshop');
  assert.equal(state.boys[0].hostel, 'Hostel');
  assert.equal(state.boys[0].contact, '123');
  assert.equal(state.mentors[0].initials, 'TM');
  assert.equal(state.calendarEvents[0].title, 'Exam');
  assert.equal(state.websiteSettings.refresh_seconds, '60');
});
test('accepts already-normalized rows without losing identifiers', () => {
  const state = normalizeBridgeState(fixture());
  assert.deepEqual(normalizeBridgeState(state), state);
});
test('reads the additive Floor field without guessing or replacing room values', () => {
  const input = fixture();
  assert.equal(normalizeBridgeState(input).boys[0].floor, '');
  input.boys[0].Floor = 'B3';
  input.boys[0]['Hostel Name'] = 23;
  const state = normalizeBridgeState(input);
  assert.equal(state.boys[0].floor, 'B3');
  assert.equal(state.boys[0].hostel, '23');
  assert.deepEqual(normalizeBridgeState(state), state);
});
test('normalizes calendar timestamps for date filters and timeline rendering', () => {
  const input = fixture();
  input.calendarEvents[0]['Start Date'] = '2026-10-05T07:00:00.000Z';
  input.calendarEvents[0]['End Date'] = '2026-10-09T07:00:00.000Z';
  const state = normalizeBridgeState(input);
  assert.equal(state.calendarEvents[0].startDate, '2026-10-05');
  assert.equal(state.calendarEvents[0].endDate, '2026-10-09');
});
test('missing optional dates and status cannot crash string operations', () => {
  const input = fixture();
  delete input.programs[0].Date;
  const state = normalizeBridgeState(input);
  assert.equal(state.programs[0].date.localeCompare(''), 0);
  assert.equal(state.boys[0].status.toLowerCase(), '');
});
test('rejects nonempty records without IDs instead of inventing write targets', () => {
  const input = fixture();
  delete input.programs[0]['Program ID'];
  assert.throws(() => normalizeBridgeState(input), /invalid response/);
});
test('skips empty rows but rejects malformed collections', () => {
  const input = fixture();
  input.programs.push({});
  input.programs.push({ Invited: 0, Attended: 0 });
  assert.equal(normalizeBridgeState(input).programs.length, 1);
  input.programs = null;
  assert.throws(() => normalizeBridgeState(input), /invalid response/);
});
