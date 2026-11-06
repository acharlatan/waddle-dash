import test from 'node:test';
import assert from 'node:assert/strict';
import {STORAGE_KEY,readArchive,writeArchive,deleteArchive,updateSnapshotCheckin} from '../public/archive.js';
import {makeSnapshot,compareSnapshots} from '../public/time-machine.js';
import {createDemoDataset,makeCurrentComparison} from '../public/journey.js';
import {filterPeriod} from '../public/analytics.js';
class Storage {constructor(){this.map=new Map();this.writes=0;this.fail=false}getItem(k){return this.map.has(k)?this.map.get(k):null}setItem(k,v){if(this.fail)throw Error('full');this.writes++;this.map.set(k,v)}removeItem(k){if(this.fail)throw Error('unavailable');this.map.delete(k)}}
test('storage starts off; opt-in and explicit save survive a fresh read',()=>{
 const storage=new Storage(),initial=readArchive(storage);assert.equal(initial.enabled,false);assert.equal(storage.writes,0);assert.equal(writeArchive(storage,initial,[]),true);assert.equal(readArchive(storage).items.length,0);
 const data=createDemoDataset(),p=filterPeriod(data.records,'7'),snapshot=makeSnapshot({records:p.current,data,name:'Fictional',goal:'Leads',plan:{test:'Editable test'},report:{summary:'Edited'}});assert.equal(writeArchive(storage,initial,[snapshot]),true);
 const reloaded=readArchive(storage);assert.equal(reloaded.enabled,true);assert.equal(reloaded.items[0].plan.test,'Editable test');assert.equal(reloaded.items[0].report.summary,'Edited');assert.equal(reloaded.items[0].status,'');
});
test('old snapshots remain intact and unrecognized storage is never overwritten',()=>{
 const storage=new Storage(),old=JSON.stringify({version:1,items:[{id:'old',status:'ongoing',plan:{noticed:'keep'}}]});storage.map.set(STORAGE_KEY,old);const archive=readArchive(storage);assert.equal(archive.items[0].status,'ongoing');assert.equal(storage.getItem(STORAGE_KEY),old);
 const unknown=JSON.stringify({version:2,items:[{id:'do-not-delete'}]});storage.map.set(STORAGE_KEY,unknown);const locked=readArchive(storage);assert.equal(locked.locked,true);assert.equal(writeArchive(storage,locked,[]),false);assert.equal(deleteArchive(storage,locked),false);assert.equal(storage.getItem(STORAGE_KEY),unknown);
});
test('storage errors retain the old saved data and offer an error',()=>{
 const storage=new Storage(),archive=readArchive(storage);writeArchive(storage,archive,[{id:'keep'}]);const before=storage.getItem(STORAGE_KEY);storage.fail=true;assert.equal(writeArchive(storage,archive,[{id:'new'}]),false);assert.equal(storage.getItem(STORAGE_KEY),before);assert.equal(archive.items[0].id,'keep');assert.match(archive.error,/full or unavailable/);assert.equal(deleteArchive(storage,archive),false);assert.equal(storage.getItem(STORAGE_KEY),before);
});
test('current comparison uses only the selected dates without saving or inventing data',()=>{
 const data=createDemoDataset(),p=filterPeriod(data.records,'7');const earlier=makeSnapshot({records:p.previous,data,name:'Earlier fictional',goal:'Leads',plan:{},report:{},start:p.previous[0].date,end:p.previous.at(-1).date});const current=makeCurrentComparison(data,'Later fictional','Leads',{}, {},p);assert.equal(current.data.records.length,14);assert.equal(data.records.length,28);assert.equal(current.start,'2026-10-08');assert.equal(compareSnapshots(earlier,current).recent.conversions,70);
});


test('an explicitly cleared status is saved while an untouched legacy status stays unchanged',()=>{
 const original={id:'a',status:'planned',notes:'old'};
 assert.deepEqual(updateSnapshotCheckin(original,'new',''),{id:'a',status:'',notes:'new'});
 assert.deepEqual(updateSnapshotCheckin(original,'new',undefined),{id:'a',status:'planned',notes:'new'});
 const legacy=updateSnapshotCheckin({id:'legacy',notes:''},'note',undefined);
 assert.equal(Object.hasOwn(legacy,'status'),false);
 assert.equal(original.status,'planned');
});
