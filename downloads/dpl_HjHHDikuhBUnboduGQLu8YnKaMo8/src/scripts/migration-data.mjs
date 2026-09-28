import assert from 'node:assert/strict';
export const projectRef='uqieusxmgbyxayhoclkk';
const tabs={mentors:'Mentors',programTypes:'ProgramTypes',boys:'Boys',programs:'Programs',attendance:'Attendance',invitations:'Invitations',calendarEvents:'Calendar',websiteContent:'Website Content',websiteSettings:'Website Settings'};
export function prepareImport(snapshot,state){
 const records=[];
 for(const [kind,tab] of Object.entries(tabs)){
  const sheet=snapshot.sheets.find(s=>s.name===tab);assert.ok(sheet,`Missing tab: ${tab}`);
  const raw=new Map(sheet.values.slice(1).filter(r=>r[0]).map(r=>[String(r[0]),Object.fromEntries(sheet.values[0].map((h,j)=>[h,r[j]??'']))]));
  const values=Array.isArray(state[kind])?state[kind]:Object.entries(state[kind]).map(([id,value])=>({id,value}));
  const ids=new Set();
  for(const record of values){assert.ok(record.id&&!ids.has(record.id),`Missing or duplicate ID in ${kind}`);ids.add(record.id);const source=raw.get(record.id);assert.ok(source,`Missing source row in ${kind}`);records.push({kind,id:record.id,data:{...record,...(kind==='mentors'?{email:String(source.Email||'')}:{}),sourceRow:source}});}
 }
 const index=new Set(records.map(r=>r.kind+':'+r.id));
 for(const {kind,data} of records){
  const refs=kind==='boys'?[['mentors',data.mentorId]]:kind==='programs'?[['programTypes',data.programTypeId]]:['attendance','invitations'].includes(kind)?[['boys',data.boyId],['programs',data.programId],['mentors',data.mentorId]]:[];
  for(const [parent,id] of refs)assert.ok(index.has(parent+':'+id),`Orphan relationship: ${kind} to ${parent}`);
 }
 for(const kind of ['attendance','invitations']){const pairs=records.filter(r=>r.kind===kind).map(r=>r.data.programId+':'+r.data.boyId);assert.equal(new Set(pairs).size,pairs.length,`Duplicate session/boy in ${kind}`);}
 const accessSheet=snapshot.sheets.find(s=>s.name==='Access');assert.ok(accessSheet,'Access tab required');
 const access=accessSheet.values.slice(1).filter(r=>String(r[0]||'').trim()).map(r=>{const source=Object.fromEntries(accessSheet.values[0].map((h,j)=>[h,r[j]??'']));const email=String(source.Email).trim().toLowerCase(),role=String(source.Role).trim().toLowerCase(),active=['yes','true','1','active'].includes(String(source.Active).trim().toLowerCase());assert.ok(['mentor','admin'].includes(role),'Unknown access role');assert.match(email,/^[^ @]+@[^ @]+\.[^ @]+$/);return {email,name:String(source.Name||''),role,active,source};});
 assert.equal(new Set(access.map(a=>a.email)).size,access.length,'Duplicate access email');assert.ok(access.some(a=>a.role==='admin'&&a.active),'Active admin required');
 return {records,access,counts:Object.fromEntries(Object.keys(tabs).map(k=>[k,records.filter(r=>r.kind===k).length]))};
}
