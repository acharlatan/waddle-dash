import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPeriod} from '../public/analytics.js';
import {createDemoDataset,makePlanDraft} from '../public/journey.js';
import {investigate} from '../public/mystery.js';
import {makeSnapshot,compareSnapshots,snapshotDataForSession} from '../public/time-machine.js';
import {STORAGE_KEY,readArchive,writeArchive,deleteArchive,withSnapshotLock} from '../public/archive.js';
import {INVESTIGATION_PREFIX,captureCaseContext,makeInvestigation,readInvestigations,saveInvestigation,restoreInvestigation} from '../public/investigations.js';

class MemoryStorage{
 constructor(){this.map=new Map();this.writes=0;this.failRead=false;this.failWrite=false}
 get length(){if(this.failRead)throw Error('unavailable');return this.map.size}
 key(i){return [...this.map.keys()][i]??null}
 getItem(k){if(this.failRead)throw Error('unavailable');return this.map.get(k)??null}
 setItem(k,v){if(this.failWrite)throw Error('quota');this.writes++;this.map.set(k,String(v))}
 removeItem(k){if(this.failWrite)throw Error('unavailable');this.map.delete(k)}
}
function fictionalState(){
 const data={...createDemoDataset(),source:'google'},p=filterPeriod(data.records,'7'),result=investigate('expensive',p,'7',data,'Leads or inquiries');
 return {mode:'personal',example:false,data,name:'Fictional report.csv',goal:'Leads or inquiries',days:'7',metric:'conversions',sort:'conversions',caseType:'expensive',planCaseType:'expensive',plan:makePlanDraft(result,'expensive',p,data,'7'),report:{notes:'An edited fictional note'},caseContext:captureCaseContext({type:'expensive',result,period:p,days:'7',data,goal:'Leads or inquiries'}),investigationTitle:'Investigate Generic Search',investigationId:'',investigationRootId:'',checkins:[]};
}
const save=(storage,archive,state,id,asNew=false)=>saveInvestigation(storage,archive,readInvestigations(storage),makeInvestigation(state,id,'2026-11-06T00:00:00.000Z',asNew));

test('opt-in and an explicit save are required; two investigations reopen independently',()=>{
 const storage=new MemoryStorage(),archive=readArchive(storage),state=fictionalState(),first=makeInvestigation(state,'first');
 assert.throws(()=>saveInvestigation(storage,archive,readInvestigations(storage),first),/Turn on local saving/);assert.equal(storage.writes,0);
 assert.equal(writeArchive(storage,archive,[]),true);const emptyArchive=storage.getItem(STORAGE_KEY);
 save(storage,archive,state,'first',true);state.plan.test='A different fictional plan';state.investigationTitle='Second question';save(storage,archive,state,'second',true);
 assert.equal(storage.getItem(STORAGE_KEY),emptyArchive);const listed=readInvestigations(storage);assert.equal(listed.items.length,2);
 const a=restoreInvestigation(listed.items.find(x=>x.id==='first')),b=restoreInvestigation(listed.items.find(x=>x.id==='second'));
 assert.notEqual(a.plan.test,b.plan.test);assert.equal(a.report.notes,'An edited fictional note');assert.equal(a.data.records.length,28);assert.equal(a.investigationDirty,false);
 a.plan.test='Unsaved change';assert.notEqual(restoreInvestigation(listed.items.find(x=>x.id==='first')).plan.test,a.plan.test);
});

test('saving stores normalized records, original case evidence and separate later copies',()=>{
 const storage=new MemoryStorage(),archive=readArchive(storage),s=fictionalState();writeArchive(storage,archive,[]);
 s.data.rawCSV='must not be stored';s.data.records[0].raw='must not be stored';const a=save(storage,archive,s,'a',true);
 assert.equal(a.context.selectedPeriod.start,'2026-10-08');assert.equal(a.context.earlierPeriod.start,'2026-10-01');assert.equal(a.context.campaign,'Generic Search');assert.equal(a.context.channel,'Paid Search');
 assert.equal(a.context.figures.earlier.conversions,56);assert.equal(a.context.figures.later.conversions,21);assert.equal(a.context.figures.earlierCost,12.5);
 assert.equal(a.session.data.rawCSV,undefined);assert.equal(a.session.data.records[0].raw,undefined);
 s.investigationId=a.id;s.investigationRootId=a.rootId;s.days='all';s.plan.test='Later edit';const b=save(storage,archive,s,'b');
 assert.equal(b.parentId,'a');assert.equal(b.rootId,'a');assert.equal(b.context.selectedPeriod.start,'2026-10-08');assert.equal(b.session.days,'all');
 assert.notEqual(JSON.parse(storage.getItem(INVESTIGATION_PREFIX+'a')).session.plan.test,'Later edit');
});

test('demo work and incomplete legacy metadata are never silently saved as personal investigations',()=>{
 const s=fictionalState();s.mode='demo';s.example=true;assert.throws(()=>makeInvestigation(s,'demo'),/Fictional demo/);
 const older=fictionalState();delete older.data.duplicates;assert.throws(()=>makeInvestigation(older,'old'),/quality details/);
 const unknown=fictionalState();unknown.data.valueKind=null;assert.throws(()=>makeInvestigation(unknown,'old'),/source, currency, or value meaning/);
});

test('legacy snapshot bytes are not rewritten by reads or new investigation saves',()=>{
 const storage=new MemoryStorage(),s=fictionalState(),p=filterPeriod(s.data.records,'7');
 const old=makeSnapshot({records:p.previous,data:{...s.data,currencyCheckVersion:undefined},name:'Old fictional',goal:s.goal,plan:{noticed:'Keep the old plan'},report:{notes:'Keep the old note'},start:p.previous[0].date,end:p.previous.at(-1).date});
 const raw=JSON.stringify({version:1,items:[old]});storage.map.set(STORAGE_KEY,raw);const archive=readArchive(storage);
 assert.equal(archive.enabled,true);assert.equal(archive.items[0].plan.noticed,'Keep the old plan');
 save(storage,archive,s,'new',true);assert.equal(storage.getItem(STORAGE_KEY),raw);
 const session=snapshotDataForSession(archive.items[0]);session.records[0].spend=999;assert.equal(storage.getItem(STORAGE_KEY),raw);
});

test('damaged, newer and unavailable storage remains unchanged and blocks saves',()=>{
 for(const raw of ['{bad json',JSON.stringify({version:2,items:[]}),JSON.stringify({version:1,items:[],future:'do not remove'})]){
  const storage=new MemoryStorage();storage.map.set(STORAGE_KEY,raw);const archive=readArchive(storage);assert.equal(archive.locked,true);assert.equal(writeArchive(storage,archive,[]),false);assert.equal(deleteArchive(storage,archive),false);assert.equal(storage.getItem(STORAGE_KEY),raw);
 }
 const storage=new MemoryStorage(),archive=readArchive(storage);writeArchive(storage,archive,[]);const unknown=JSON.stringify({kind:'waddle-investigation',version:9,id:'unknown'});storage.map.set(INVESTIGATION_PREFIX+'unknown',unknown);
 const listing=readInvestigations(storage);assert.equal(listing.locked,true);assert.throws(()=>saveInvestigation(storage,archive,listing,makeInvestigation(fictionalState(),'another')),/damaged|unsupported/);assert.equal(storage.getItem(INVESTIGATION_PREFIX+'unknown'),unknown);
 storage.failRead=true;assert.equal(readInvestigations(storage).locked,true);assert.equal(readArchive(storage).locked,true);
});

test('quota failures, ID collisions and stale tabs preserve all previous saves',()=>{
 const storage=new MemoryStorage(),a=readArchive(storage);writeArchive(storage,a,[]);const s=fictionalState();save(storage,a,s,'kept',true);
 const old=storage.getItem(INVESTIGATION_PREFIX+'kept'),oldArchive=storage.getItem(STORAGE_KEY);
 assert.throws(()=>save(storage,a,s,'kept'),/already exists/);storage.failWrite=true;assert.throws(()=>save(storage,a,s,'new'),/full or unavailable/);storage.failWrite=false;
 assert.equal(storage.getItem(INVESTIGATION_PREFIX+'kept'),old);assert.equal(storage.getItem(STORAGE_KEY),oldArchive);
 const tabA=readArchive(storage),tabB=readArchive(storage);assert.equal(writeArchive(storage,tabA,[{id:'new snapshot'}]),true);const newer=storage.getItem(STORAGE_KEY);
 assert.equal(writeArchive(storage,tabB,[]),false);assert.match(tabB.error,/another tab/);assert.equal(deleteArchive(storage,tabB),false);assert.equal(storage.getItem(STORAGE_KEY),newer);
});

test('snapshot writes require lock support and execute through the lock',async()=>{
 const archive={error:''};let writes=0;assert.equal(await withSnapshotLock(null,archive,()=>{writes++;return true}),false);assert.equal(writes,0);assert.match(archive.error,/lock support/);
 const locks={request:async(name,options,fn)=>{assert.match(name,/waddle-time-machine/);assert.equal(options.mode,'exclusive');return fn()}};
 assert.equal(await withSnapshotLock(locks,archive,()=>{writes++;return true}),true);assert.equal(writes,1);
});

test('legacy quality uncertainty is disclosed without changing its saved copy',()=>{
 const s=fictionalState(),p=filterPeriod(s.data.records,'7'),snapshot=makeSnapshot({records:p.current,data:s.data,name:'Older',goal:s.goal,plan:s.plan,report:s.report,start:p.start,end:p.end});
 delete snapshot.data.errors;delete snapshot.data.duplicates;const original=JSON.stringify(snapshot);const restored=snapshotDataForSession(snapshot);
 assert.equal(restored.qualityUnknown,true);assert.equal(JSON.stringify(snapshot),original);assert.throws(()=>makeInvestigation({...s,data:restored},'x'),/quality details/);
 const other=structuredClone(snapshot);other.id='other';other.start='2026-10-15';other.end='2026-10-21';other.data.records=other.data.records.map(r=>({...r,date:r.date.replace(/\d\d$/,d=>String(Number(d)+7).padStart(2,'0'))}));
 assert.match(compareSnapshots(snapshot,other).error,/quality history/);
});

test('snapshot and check-in references remain with an explicitly saved copy',()=>{
 const storage=new MemoryStorage(),a=readArchive(storage),s=fictionalState();writeArchive(storage,a,[]);const first=save(storage,a,s,'first',true);
 s.investigationId=first.id;s.investigationRootId=first.rootId;s.checkins=[{earlierSnapshotId:'snapshot-a',laterSnapshotId:'snapshot-b',earlierStart:'2026-10-01',earlierEnd:'2026-10-07',laterStart:'2026-10-08',laterEnd:'2026-10-14'}];s.report.checkin='Existing report text\n\nFictional check-in';
 const second=save(storage,a,s,'second');assert.equal(second.session.checkins[0].earlierSnapshotId,'snapshot-a');assert.match(restoreInvestigation(second).report.checkin,/Existing report text/);assert.deepEqual(first.session.checkins,[]);
});
