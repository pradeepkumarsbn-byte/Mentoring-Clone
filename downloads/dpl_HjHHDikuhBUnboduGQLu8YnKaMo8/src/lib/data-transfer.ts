export const columns:Record<string,string[]>={
 boys:['id','name','mentorId','contact','college','branch','section','floor','hostel','status','comment'],
 mentors:['id','name','email','initials','tone'],programTypes:['id','name'],programs:['id','name','programTypeId','date','venue','speaker'],
 attendance:['id','programId','boyId','mentorId','status','reason'],invitations:['id','programId','boyId','mentorId','response'],
 calendarEvents:['id','title','startDate','endDate','type','availability','semester','scope','note','source'],
 websiteContent:['id','value'],websiteSettings:['id','value'],access:['email','name','role','active'],
};
export type DataRecord={kind:string;id:string;data:Record<string,unknown>&{id:string}};
export type AccessRecord={email:string;name:string;role:string;active:boolean;source?:unknown};
export type Transfer={format:'mentoring-backup';version:1;records:DataRecord[];access:AccessRecord[];fingerprint?:string;exportedAt?:string};
export function parseCSV(text:string):string[][]{
 text=text.replace(/^\uFEFF/,'');const rows:string[][]=[];let row:string[]=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
  if(c==='"'){if(value||closed)throw Error('Invalid CSV quoting');quoted=true;}
  else if(c===','||c==='\n'||c==='\r'){row.push(value);value='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}}
  else{if(closed)throw Error('Unexpected text after a quoted CSV value');value+=c;}}
 if(quoted)throw Error('Unclosed CSV quote');row.push(value);if(row.some(v=>v!==''))rows.push(row);return rows;
}
export function csvExport(kind:string,rows:Record<string,unknown>[]):string{
 const fields=columns[kind];if(!fields)throw Error('Unknown collection');
 // The leading apostrophe prevents spreadsheet formulas and is removed on re-import.
 const cell=(v:unknown)=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s)||s.startsWith("'"))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[fields.map(cell).join(','),...rows.map(r=>fields.map(k=>cell(r[k])).join(','))].join('\r\n');
}
export function csvImport(kind:string,text:string):Transfer{
 const allowed=columns[kind];if(!allowed)throw Error('Choose a collection');const [header,...rows]=parseCSV(text);if(!header||!rows.length)throw Error('The CSV has no records');
 const keys=header.map(v=>v.trim());if(new Set(keys).size!==keys.length||keys.some(k=>!allowed.includes(k)))throw Error('Use the downloaded template headers without renaming them');
 const records:DataRecord[]=[],access:AccessRecord[]=[];
 rows.forEach((row,index)=>{if(row.length!==keys.length)throw Error(`CSV row ${index+2} has the wrong number of columns`);const v=Object.fromEntries(keys.map((k,i)=>[k,row[i].replace(/^'(?=[=+\-@\t\r'])/,'')]));
  if(kind==='access'){if(!['true','false'].includes(v.active?.toLowerCase()))throw Error(`CSV row ${index+2}: active must be true or false`);access.push({email:v.email?.trim().toLowerCase(),name:v.name||'',role:v.role?.toLowerCase(),active:v.active.toLowerCase()==='true'});}
  else {if(['websiteContent','websiteSettings'].includes(kind)&&!v.id?.trim())throw Error(`CSV row ${index+2}: setting/content ID is required`);const id=v.id?.trim()||crypto.randomUUID();records.push({kind,id,data:{...v,id}});}
 });return {format:'mentoring-backup',version:1,records,access};
}
export function validateTransfer(value:unknown):Transfer{
 if(!value||typeof value!=='object')throw Error('Invalid backup');const v=value as Transfer;
 if(v.format!=='mentoring-backup'||v.version!==1||!Array.isArray(v.records)||!Array.isArray(v.access))throw Error('Choose a Mentoring Hub backup or an exported CSV');
 if(v.records.length>5000||v.access.length>500)throw Error('Import exceeds the limit of 5,000 records and 500 access entries');
 for(const r of v.records){if(!r||typeof r.kind!=='string'||!columns[r.kind]||r.kind==='access'||typeof r.id!=='string'||!r.id||!r.data||typeof r.data!=='object'||Array.isArray(r.data)||r.data.id!==r.id)throw Error('Invalid record in backup');}
 return {format:'mentoring-backup',version:1,records:v.records,access:v.access};
}
export function validFilePath(path:unknown):path is string{return typeof path==='string'&&/^[A-Za-z0-9_-]+\/[A-Za-z0-9][A-Za-z0-9._ -]{0,180}$/.test(path)&&!path.includes('..');}
