import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./Code.gs',import.meta.url),'utf8');
const schemas={
 Mentors:['Mentor ID','Mentor Name','Email'], Boys:['Boy ID','Name','Contact','Branch','Section','College','Hostel Name','DOB','Native','Status','Mentor ID','Comment','Added On','Added By','Floor'],
 Programs:['Program ID','Program Name','Date','Venue','Invited','Attended','Speaker','Program Type ID'],ProgramTypes:['Program Type ID','Program Name'],
 Attendance:['Attendance ID','Program ID','Mentor ID','Boy ID','Status','Reason','Updated On','Updated By'],Invitations:['Invitation ID','Program ID','Mentor ID','Boy ID','Response','Updated On','Updated By'],
 Access:['Email','Name','Role','Active'],Calendar:['Event ID','Event / Activity','Start Date','End Date'],
 'Website Content':['Key','Section','Label','Value','Updated On','Updated By'],'Website Settings':['Setting ID','Value']
};
function fixture(reorder=false){
 const sheets={};let sequence=0,held=false;
 for(const [name,headers] of Object.entries(schemas)){
  const rows=[reorder?[...headers].reverse():[...headers]];
  sheets[name]={rows,getDataRange:()=>({getValues:()=>rows.map(r=>[...r])}),appendRow:r=>rows.push([...r]),deleteRow:r=>rows.splice(r-1,1),getRange:(r,c)=>({setValue:v=>{rows[r-1][c-1]=v;}})};
 }
 const seed=(name,fields)=>sheets[name].appendRow(sheets[name].rows[0].map(h=>fields[h]??''));
 seed('Mentors',{'Mentor ID':'M1','Mentor Name':'Mentor'});seed('ProgramTypes',{'Program Type ID':'PT-001','Program Name':'DYS0'});
 const context=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='MENTORING_SHEETS_TOKEN'?'test-token':'test-sheet'})},
 SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets[n]}),flush:()=>{}},
 LockService:{getScriptLock:()=>({tryLock:()=>{held=true;return true;},hasLock:()=>held,releaseLock:()=>{held=false;}})},
 Utilities:{getUuid:()=>`uuid-${++sequence}`,formatDate:d=>d.toISOString().slice(0,10)},Session:{getScriptTimeZone:()=> 'UTC'},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}});
 vm.runInContext(source,context);
 const call=(action,body={})=>context.doPost({postData:{contents:JSON.stringify({token:'test-token',action,...body})}});
 const objects=name=>sheets[name].rows.slice(1).map(r=>Object.fromEntries(sheets[name].rows[0].map((h,i)=>[h,r[i]])));
 const program=()=>call('add_program',{name:'DYS 0',programTypeId:'PT-001',date:'2026-09-21',venue:'Room 204',speaker:'BNP'});
 const boy=()=>call('add_boy',{name:'Student',mentorId:'M1',contact:'0123',hostel:'204'});
 return {sheets,seed,call,objects,program,boy,raw:contents=>context.doPost({postData:{contents}}),locked:()=>held};
}
for(const reorder of [false,true]) test(`program create/edit/delete and dependent cleanup, reordered=${reorder}`,()=>{
 const f=fixture(reorder);const result=f.program();assert.equal(result.ok,true);assert.equal(result.programs[0].name,'DYS 0');
 const row=f.objects('Programs')[0],id=row['Program ID'];assert.match(id,/uuid/);assert.equal(row.Speaker,'BNP');assert.equal(row['Program Type ID'],'PT-001');assert.equal(row.Invited,'');
 f.sheets.Programs.rows[1][f.sheets.Programs.rows[0].indexOf('Invited')]='=COUNTIF(A:A,"x")';
 assert.equal(f.call('update_program',{programId:id,programTypeId:'PT-001',date:'2026-09-22',name:'Updated',venue:'',speaker:''}).ok,true);
 assert.equal(f.objects('Programs')[0].Invited,'=COUNTIF(A:A,"x")');assert.equal(f.objects('Programs')[0].Speaker,'');
 f.seed('Attendance',{'Attendance ID':'a','Program ID':id,'Boy ID':'b'});f.seed('Invitations',{'Invitation ID':'i','Program ID':id,'Boy ID':'b'});
 assert.equal(f.call('delete_program',{programId:id}).ok,true);assert.equal(f.objects('Programs').length,0);assert.equal(f.objects('Attendance').length,0);assert.equal(f.objects('Invitations').length,0);assert.equal(f.locked(),false);
});
test('boys preserve DOB and Native; attendance and invitations update instead of duplicating',()=>{
 const f=fixture(true);f.program();f.boy();const programId=f.objects('Programs')[0]['Program ID'],boyId=f.objects('Boys')[0]['Boy ID'];
 f.sheets.Boys.rows[1][f.sheets.Boys.rows[0].indexOf('Native')]='Home';
 assert.equal(f.call('update_boy',{boyId,mentorId:'M1',contact:'',hostel:'305'}).ok,true);
 assert.equal(f.objects('Boys')[0].Native,'Home');assert.equal(f.objects('Boys')[0]['Hostel Name'],'305');
 for(let i=0;i<2;i++){assert.equal(f.call('set_attendance',{programId,boyId,status:'Present'}).ok,true);assert.equal(f.call('set_invitation',{programId,boyId,response:'Coming'}).ok,true);}
 assert.equal(f.objects('Attendance').length,1);assert.equal(f.objects('Invitations').length,1);
 assert.equal(f.call('delete_attendance',{programId,boyId}).ok,true);assert.equal(f.objects('Attendance').length,0);
 assert.equal(f.call('set_invitation',{programId,boyId,invited:false}).ok,true);assert.equal(f.objects('Invitations').length,0);
 assert.equal(f.call('delete_boy',{boyId}).ok,true);assert.equal(f.objects('Boys').length,0);
});
test('missing parent and invalid schema reject before dependent deletion',()=>{
 const f=fixture();f.seed('Attendance',{'Attendance ID':'a','Program ID':'missing','Boy ID':'b'});
 assert.equal(f.call('delete_program',{programId:'missing'}).ok,false);assert.equal(f.objects('Attendance').length,1);
 f.sheets.Programs.rows[0][0]='Unexpected';assert.equal(f.program().ok,false);assert.equal(f.objects('Programs').length,0);assert.equal(f.locked(),false);
});
test('website content preserves blank row positions and other metadata',()=>{
 const f=fixture(true);f.seed('Website Content',{});f.seed('Website Content',{Key:'title',Section:'hero',Label:'Title',Value:'old'});
 assert.equal(f.call('update_website_content',{values:{title:'new'}}).ok,true);
 assert.equal(f.objects('Website Content')[0].Value,'');assert.equal(f.objects('Website Content')[1].Value,'new');assert.equal(f.objects('Website Content')[1].Section,'hero');
});
test('rejects invalid dates, tokens and malformed JSON; read-only state uses no lock',()=>{
 const f=fixture();assert.equal(f.call('add_program',{programTypeId:'PT-001',date:'2026-02-30'}).ok,false);
 assert.equal(f.call('get_state',{token:'wrong'}).ok,false);assert.equal(f.call('get_state').ok,true);assert.equal(f.locked(),false);
 assert.equal(f.raw('{invalid').ok,false);
 assert.equal(f.call('check_access',{email:'test@example.com'}).backendVersion,'header-mapping-v1');
 assert.equal((source.match(/function doPost\(/g)||[]).length,1);
});
test('Room No header works without renaming spreadsheet',()=>{
 const f=fixture();const headers=f.sheets.Boys.rows[0];headers[headers.indexOf('Hostel Name')]='Room No';
 assert.equal(f.boy().ok,true);assert.equal(f.objects('Boys')[0]['Room No'],'204');
});
test('floor persists through creation, editing, clearing and state reload',()=>{
 const f=fixture(true);
 let result=f.call('add_boy',{name:'Student',mentorId:'M1',floor:' b3 ',hostel:'20'});
 assert.equal(result.ok,true);assert.equal(result.boys[0].floor,'B3');
 const boyId=result.boys[0].id;
 result=f.call('update_boy',{boyId,mentorId:'M1',floor:'B3',hostel:'21'});
 assert.equal(result.ok,true);assert.equal(f.call('get_state').boys[0].hostel,'21');
 result=f.call('update_boy',{boyId,mentorId:'M1',hostel:'21'});
 assert.equal(result.boys[0].floor,'B3');
 assert.equal(f.call('update_boy',{boyId,mentorId:'M1',floor:'B10',hostel:'21'}).ok,false);
 assert.equal(f.call('update_boy',{boyId,mentorId:'M1',floor:'B3',hostel:'62'}).ok,false);
 assert.equal(f.call('get_state').boys[0].floor,'B3');
 result=f.call('update_boy',{boyId,mentorId:'M1',floor:'',hostel:'21'});
 assert.equal(result.boys[0].floor,'');assert.equal(result.boys[0].hostel,'21');
});
test('legacy room values stay intact during unrelated profile changes',()=>{
 const f=fixture();f.boy();const before=f.objects('Boys')[0];
 const result=f.call('update_boy',{boyId:before['Boy ID'],mentorId:'M1',floor:'',hostel:'204',comment:'Follow-up'});
 assert.equal(result.ok,true);assert.equal(result.boys[0].hostel,'204');assert.equal(result.boys[0].floor,'');
});
