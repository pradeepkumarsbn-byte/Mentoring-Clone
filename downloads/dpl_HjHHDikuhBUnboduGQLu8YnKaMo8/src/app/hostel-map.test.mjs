import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateRoomCoverage,normalizeFloor,normalizeRoomNumber,FLOORS,OUT_ROOM_GROUPS,IN_ROOM_GROUPS} from './hostel-map.ts';
const boy=(id,floor='B0',hostel='1',extra={})=>({id,name:'Same name',floor,hostel,status:'Active',...extra});
test('all ten floors contain exactly 61 unique physical rooms',()=>{
 const layout=[...OUT_ROOM_GROUPS.flat(),...IN_ROOM_GROUPS.flat()];
 assert.equal(layout.length,61);assert.equal(new Set(layout).size,61);
 assert.deepEqual([...layout].sort((a,b)=>a-b),Array.from({length:61},(_,i)=>i+1));
 const state=calculateRoomCoverage([]);assert.equal(state.rooms.length,610);
 for(const f of FLOORS)assert.equal(state.rooms.filter(r=>r.floor===f).length,61);
 assert.equal(state.summary.empty,610);assert.equal(state.summary.percent,0);
});
test('0/1/2/3 registrations and identical names; over capacity counts at most two slots',()=>{
 for(const [count,status] of [[0,'not-covered'],[1,'partial'],[2,'full'],[3,'data-issue']]){
  const state=calculateRoomCoverage(Array.from({length:count},(_,i)=>boy(String(i))));
  assert.equal(state.byKey.get('B0-1').status,status);assert.equal(state.summary.slots,Math.min(count,2));assert.equal(state.summary.mapped,count);
 }
});
test('same room on different floors stays independent; missing floor stays unmapped',()=>{
 const s=calculateRoomCoverage([boy('1'),boy('2','B1'),boy('3','','25')]);
 assert.equal(s.byKey.get('B0-1').boys.length,1);assert.equal(s.byKey.get('B1-1').boys.length,1);
 assert.equal(s.byKey.get('B0-25').boys.length,0);assert.equal(s.unmapped.length,1);
});
test('edit, delete, and reload recompute solely from persistent boy fields',()=>{
 let boys=[boy('1','B3','20')];assert.equal(calculateRoomCoverage(boys).byKey.get('B3-20').status,'partial');
 boys=[{...boys[0],hostel:'21'}];let s=calculateRoomCoverage(JSON.parse(JSON.stringify(boys)));
 assert.equal(s.byKey.get('B3-20').status,'not-covered');assert.equal(s.byKey.get('B3-21').status,'partial');
 s=calculateRoomCoverage([]);assert.equal(s.byKey.get('B3-21').status,'not-covered');
});
test('safe normalization, duplicate IDs, invalid locations and dropped records',()=>{
 assert.equal(normalizeFloor(' b3 '),'B3');assert.equal(normalizeRoomNumber(' 23 '),23);assert.equal(normalizeRoomNumber(23),23);
 for(const v of ['',null,{},0,62,1.5,'1e1','0x10']) assert.equal(normalizeRoomNumber(v),null);
 const s=calculateRoomCoverage([boy('1'),boy('1'),boy('2','B0','1',{status:'Dropped'}),boy('3','B10'),boy('4','B2','62'),boy('5','B0','1',{status:'Passive'})]);
 assert.equal(s.byKey.get('B0-1').boys.length,2);assert.equal(s.unmapped.length,2);
 const conflict=calculateRoomCoverage([boy('1'),boy('1','B2')]);assert.equal(conflict.summary.mapped,0);assert.equal(conflict.unmapped.length,1);
});
