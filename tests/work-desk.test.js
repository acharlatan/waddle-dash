import test from 'node:test';
import assert from 'node:assert/strict';
import {workDeskModel} from '../public/work-desk.js';
import {createDemoDataset} from '../public/journey.js';
import {filterPeriod} from '../public/analytics.js';

const records=createDemoDataset().records;
const saved=(id,root='root')=>({id,rootId:root,title:`Fictional ${id}`,savedAt:'2026-11-01T12:00:00Z',context:{campaign:'Generic Search',channel:'Paid Search',selectedPeriod:{start:'2026-10-08',end:'2026-10-14'},observation:'Recorded leads fell.'},session:{data:{records},days:'7',goal:'Leads or inquiries',plan:{noticed:'A plan'},checkins:[]}});

test('work desk distinguishes an empty session, a typed plan, and captured context',()=>{
 assert.equal(workDeskModel({mode:'personal',plan:{}}).active,false);
 assert.equal(workDeskModel({mode:'personal',plan:{noticed:'   '}}).active,false);
 assert.equal(workDeskModel({mode:'personal',plan:{noticed:'An observation'}}).active,true);
 assert.equal(workDeskModel({mode:'personal',plan:{},caseContext:{question:'Why?'}}).active,true);
 assert.equal(workDeskModel({mode:'personal',plan:{},investigationTitle:'My question'}).active,true);
});

test('saved cards retain original dates and only show snapshots linked to the exact saved copy',()=>{
 const first=saved('first'),second=saved('second');
 const snapshots=[{investigationId:'first',investigationRootId:'root'},{investigationId:'second',investigationRootId:'root'},{investigationRootId:'root'}];
 const input=JSON.stringify({first,second,snapshots});
 const result=workDeskModel({mode:'personal',days:'all'},[first,second],snapshots);
 assert.equal(result.saved.length,2);
 assert.deepEqual(result.saved.map(x=>x.linkedSnapshots),[1,1]);
 assert.equal(result.saved[0].start,'2026-10-08');
 assert.equal(result.saved[0].campaign,'Generic Search');
 assert.equal(result.saved[0].channel,'Paid Search');
 assert.equal(JSON.stringify({first,second,snapshots}),input);
});

test('saved cards without case context use their own saved period; demo never shows personal saves',()=>{
 const item=saved('first');item.context=null;item.session.days='7';
 const result=workDeskModel({mode:'personal'},[item],[]);
 const savedPeriod=filterPeriod(records,'7');
 assert.equal(result.saved[0].start,savedPeriod.start);
 assert.equal(result.saved[0].observation,'A plan');
 assert.deepEqual(workDeskModel({mode:'demo',example:true,plan:{}},[item],[]).saved,[]);
});
