import test from 'node:test';
import assert from 'node:assert/strict';
import {monthDates,rcSummary} from './tracking.ts';
test('month grids support leap years and year boundaries',()=>{
 assert.equal(monthDates('2028-02').length,29);assert.equal(monthDates('2026-02').length,28);assert.equal(monthDates('2026-12').at(-1),'2026-12-31');assert.deepEqual(monthDates(''),[]);
});
test('RC distinguishes missing, absence, audio and outstation, ignoring future marks',()=>{
 const r=rcSummary([{date:'2026-10-01',status:'Present'},{date:'2026-10-02',status:'MMC'},{date:'2026-10-03',status:'Absent'},{date:'2026-10-04',status:'Outstation'},{date:'2026-10-30',status:'Absent'}],'2026-10','2026-10-05');
 assert.equal(r.rate,67);assert.equal(r.label,'Needs attention');assert.equal(r.unmarked,1);assert.equal(r.outstation,1);
 assert.equal(rcSummary([],'2026-10','2026-10-05').rate,null);
 const regular=monthDates('2026-10').slice(0,7).map(date=>({date,status:'MMC'}));assert.equal(rcSummary(regular,'2026-10','2026-10-16').label,'Regular');
});
