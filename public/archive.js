import {parseDate} from './analytics.js';
export const STORAGE_KEY='waddle-time-machine-v1';
export const SNAPSHOT_LOCK='waddle-time-machine-v1-write';
// Older snapshots can omit newer metadata; require only what the interface needs to display them.
export function isReadableSnapshot(x){return !!x&&typeof x==='object'&&typeof x.id==='string'&&typeof x.start==='string'&&parseDate(x.start)===x.start&&typeof x.end==='string'&&parseDate(x.end)===x.end&&!!x.data&&Array.isArray(x.data.records)&&x.data.records.length>0&&x.data.records.every(r=>r&&typeof r.date==='string'&&parseDate(r.date)===r.date)}
export function readArchive(storage){
 const result={enabled:false,items:[],error:'',locked:false,raw:null,conflict:false};
 try{const raw=storage.getItem(STORAGE_KEY);result.raw=raw;if(raw!==null){const saved=JSON.parse(raw);if(saved?.version===1&&Array.isArray(saved.items)&&Object.keys(saved).every(k=>k==='version'||k==='items')){result.enabled=true;result.items=saved.items;if(!saved.items.every(isReadableSnapshot)){result.locked=true;result.error='Some saved snapshots could not be read safely. The archive is read-only and has not been changed.'}}else{result.locked=true;result.error='This saved workspace has an unsupported format. It has not been changed. Use the original version or export your browser data before attempting recovery.'}}}
 catch(error){result.locked=true;result.error='Saved workspace could not be read in this browser. It has not been changed.'}
 return result;
}
export function writeArchive(storage,archive,items){
 if(archive.locked)return false;
 try{if(storage.getItem(STORAGE_KEY)!==archive.raw){archive.conflict=true;archive.error='Saved snapshots changed in another tab. Reload the saved list before trying again; nothing was overwritten.';return false}const raw=JSON.stringify({version:1,items});storage.setItem(STORAGE_KEY,raw);archive.raw=raw;archive.items=items;archive.enabled=true;archive.error='';archive.conflict=false;return true}
 catch(error){archive.error='Could not save: browser storage may be full or unavailable. Your existing saved snapshots were not changed.';return false}
}
export function deleteArchive(storage,archive){
 if(archive.locked)return false;
 try{if(storage.getItem(STORAGE_KEY)!==archive.raw){archive.conflict=true;archive.error='Saved snapshots changed in another tab. Reload the saved list before trying again; nothing was deleted.';return false}storage.removeItem(STORAGE_KEY);archive.raw=null;archive.enabled=false;archive.items=[];archive.error='';archive.conflict=false;return true}
 catch(error){archive.error='Could not remove saved data from this browser.';return false}
}

// Web Locks serialize this app's snapshot writers; stale views are checked again inside the lock.
export async function withSnapshotLock(locks,archive,operation){
 if(!locks||typeof locks.request!=='function'){archive.error='Safe snapshot saving needs browser lock support. Your existing snapshots have not been changed.';return false}
 try{return await locks.request(SNAPSHOT_LOCK,{mode:'exclusive'},operation)}catch(error){archive.error='Could not safely access browser storage. Your existing snapshots have not been changed.';return false}
}
