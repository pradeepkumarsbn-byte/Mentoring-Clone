export type StatePatch={upserts:{kind:string;record:Record<string,unknown>&{id:string}}[];deletes:{kind:string;id:string}[];refreshedAt:string};
export function applyStatePatch<T extends object>(state:T,patch:StatePatch):T {
 const result={...state} as Record<string,unknown>;
 for(const {kind,id} of patch.deletes) {
  if(kind==='websiteSettings'||kind==='websiteContent'){const map={...(result[kind] as object)} as Record<string,unknown>;delete map[id];result[kind]=map;}
  else if(Array.isArray(result[kind])) result[kind]=(result[kind] as {id:string}[]).filter(item=>item.id!==id);
 }
 for(const {kind,record} of patch.upserts) {
  if(kind==='websiteSettings'||kind==='websiteContent') result[kind]={...(result[kind] as object),[record.id]:record.value};
  else if(Array.isArray(result[kind])) {const records=[...(result[kind] as {id:string}[])];const index=records.findIndex(item=>item.id===record.id);if(index<0)records.push(record);else records[index]=record;result[kind]=records;}
 }
 result.refreshedAt=patch.refreshedAt;
 return result as T;
}
