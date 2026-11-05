export const STORAGE_KEY='waddle-time-machine-v1';
export function readArchive(storage){
 const result={enabled:false,items:[],error:'',locked:false};
 try{const raw=storage.getItem(STORAGE_KEY);if(raw!==null){const saved=JSON.parse(raw);if(saved?.version===1&&Array.isArray(saved.items)){result.enabled=true;result.items=saved.items}else{result.locked=true;result.error='This saved workspace has an unsupported format. It has not been changed. Use the original version or export your browser data before attempting recovery.'}}}
 catch(error){result.locked=true;result.error='Saved workspace could not be read in this browser. It has not been changed.'}
 return result;
}
export function writeArchive(storage,archive,items){
 if(archive.locked)return false;
 try{storage.setItem(STORAGE_KEY,JSON.stringify({version:1,items}));archive.items=items;archive.enabled=true;archive.error='';return true}
 catch(error){archive.error='Could not save: browser storage may be full or unavailable. Your existing saved snapshots were not changed.';return false}
}
export function deleteArchive(storage,archive){
 if(archive.locked)return false;
 try{storage.removeItem(STORAGE_KEY);archive.enabled=false;archive.items=[];archive.error='';return true}
 catch(error){archive.error='Could not remove saved data from this browser.';return false}
}
