import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleInvitees } from './invitation-eligibility.ts';
const boy = (id, status = 'Active', mentorId = 'm1') => ({ id, name: id, status, mentorId, contact: '', branch: '', section: '', hostel: '' });
const data = {
  boys: [boy('present'), boy('late'), boy('absent'), boy('new'), boy('dropped', 'Dropped'), boy('passive', 'Passive'), boy('other', 'Active', 'm2')],
  mentors: [{ id: 'm1', name: 'Mentor One' }, { id: 'm2', name: 'Mentor Two' }],
  programs: [{ id: 'old', programTypeId: 't1' }, { id: 'next', programTypeId: 't1' }, { id: 'different', programTypeId: 't2' }],
  attendance: [{ programId: 'old', boyId: 'present', status: 'Present' }, { programId: 'old', boyId: 'late', status: 'Late' }, { programId: 'old', boyId: 'absent', status: 'Absent' }, { programId: 'different', boyId: 'new', status: 'Present' }],
};
test('only eligible boys for the selected mentor; attendance on any date of this type excludes Present and Late', () => {
  assert.deepEqual(eligibleInvitees(data, 't1', 'm1').map(b => b.id), ['absent', 'new', 'passive']);
  assert.deepEqual(eligibleInvitees(data, 't1', 'm2').map(b => b.id), ['other']);
});
test('search and type changes preserve eligibility boundaries', () => {
  assert.deepEqual(eligibleInvitees(data, 't1', 'all', 'Mentor Two').map(b => b.id), ['other']);
  assert.ok(eligibleInvitees(data, 't2').some(b => b.id === 'present'));
  assert.ok(!eligibleInvitees(data, 't2').some(b => b.id === 'new'));
  assert.deepEqual(eligibleInvitees(data, ''), []);
});
