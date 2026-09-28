import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {bridgeRequest} from '../app/connection.ts';
import {normalizeBridgeState} from '../app/bridge-state.ts';
const env=parseEnv(fs.readFileSync(process.argv[2],'utf8'));
process.env.MENTORING_SHEETS_TOKEN=env.MENTORING_SHEETS_TOKEN;
const url=env.MENTORING_SHEETS_URL || 'https://script.google.com/macros/s/AKfycbzuVhBE_QYTkkPu76uNx_kix1mMTgjUwHSH9_nMm53s0kKRDWSCuZPrqAr49I5JApCn/exec';
try {
 const response=await bridgeRequest(url,{action:'check_access',email:process.argv[3],includeState:true});
 if(!response.allowed||!response.state)throw Error('Export not authorized');
 const state=normalizeBridgeState(response.state);
 fs.mkdirSync('.migration-private',{recursive:true});
 fs.writeFileSync('.migration-private/app-state.json',JSON.stringify({capturedAt:new Date().toISOString(),state}));
 console.log(JSON.stringify({saved:true,counts:Object.fromEntries(Object.entries(state).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))}));
} catch {console.error('Private source export failed; credentials and records were not printed.');process.exitCode=1;}
