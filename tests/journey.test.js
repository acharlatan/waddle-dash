import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDataset,createDemoCheckin,makePlanDraft,formatPlan,planForReportFromSnapshot} from '../public/journey.js';
import {filterPeriod} from '../public/analytics.js';
import {investigate} from '../public/mystery.js';
import {makeSnapshot,compareSnapshots} from '../public/time-machine.js';

test('fictional demo is a complete, safely comparable lead story',()=>{
 const data=createDemoDataset(),period=filterPeriod(data.records,'7'),r=investigate('expensive',period,'7',data);
 assert.equal(data.records.length,28);assert.equal(data.source,'demo');assert.equal(data.records.every(x=>x.revenue===null),true);
 assert.equal(r.previous.spend,1190);assert.equal(r.current.spend,1190);assert.equal(r.previous.conversions,105);assert.equal(r.current.conversions,70);assert.equal(r.top.label,'Generic Search');assert.equal(r.top.previous.conversions,56);assert.equal(r.top.current.conversions,21);
});
test('case makes an editable plan with named evidence, periods and a tentative hypothesis',()=>{
 const data=createDemoDataset(),p=filterPeriod(data.records,'7'),r=investigate('expensive',p,'7',data),draft=makePlanDraft(r,'expensive',p,data,'7');
 for(const token of ['Generic Search','Paid Search','56','21','$700.00','2026-10-01','2026-10-14'])assert.ok(draft.noticed.includes(token),token);
 assert.match(draft.hypothesis,/possibilities|not conclusions/i);assert.match(draft.test,/tracking/);assert.match(draft.limits,/does not establish/);assert.match(draft.review,/7 comparable days/);
 draft.test='My own test';assert.match(formatPlan(draft),/My own test/);assert.equal(makePlanDraft({error:'missing'},'expensive',p,data,'7'),null);
});
test('spending draft does not imply partial spend identifies the largest campaign',()=>{
 const data=createDemoDataset();data.records.at(-1).spend=null;const p=filterPeriod(data.records,'7'),r=investigate('spending',p,'7',data),draft=makePlanDraft(r,'spending',p,data,'7');assert.equal(r.canShare,false);assert.match(draft.noticed,/rows/);assert.doesNotMatch(draft.noticed,/Generic Search/);
});
test('fictional check-in is separate, planned, and compares records without claiming an experiment outcome',()=>{
 const data=createDemoDataset(),plan={noticed:'Editable observation',test:'My planned test',notes:'My experiment note'};
 const items=createDemoCheckin(data,plan);assert.equal(items.length,2);assert.equal(items[0].status,'planned');assert.equal(items[0].start,'2026-10-08');assert.equal(items[1].start,'2026-10-15');assert.match(items[0].name,/FICTIONAL/);assert.equal(items[0].plan.test,'My planned test');assert.equal(items[1].plan.test,undefined);plan.test='Changed later';assert.equal(items[0].plan.test,'My planned test');
 const c=compareSnapshots(...items);assert.equal(c.old.conversions,70);assert.equal(c.recent.conversions,70);assert.equal(c.old.spend,1190);assert.equal(c.recent.spend,1190);
});
test('saved snapshot contains independent plan and edited report without migrating old entries',()=>{
 const data=createDemoDataset(),records=filterPeriod(data.records,'7').current,plan={noticed:'Original',review:'Next week'},report={summary:'Edited observation',checkin:'User note'};
 const snap=makeSnapshot({records,data,name:'Synthetic',goal:'Leads',plan,report});assert.equal(snap.status,'');plan.noticed='Changed';report.summary='Changed';records[0].spend=999;
 assert.equal(snap.plan.noticed,'Original');assert.equal(snap.report.summary,'Edited observation');assert.notEqual(snap.data.records[0].spend,999);const legacy={...snap,status:'ongoing'};compareSnapshots(legacy,snap);assert.equal(legacy.status,'ongoing');
});
test('check-in prevents incompatible sources, currencies, definitions and overlapping dates',()=>{
 const [a,b]=createDemoCheckin(createDemoDataset());let x=structuredClone(b);x.data.currency='EUR';assert.match(compareSnapshots(a,x).error,/Currencies/);x=structuredClone(b);x.data.source='different';assert.match(compareSnapshots(a,x).error,/sources/);x=structuredClone(b);x.data.conversionDefinition='bookings';assert.match(compareSnapshots(a,x).error,/definitions differ/);x=structuredClone(b);x.start=a.end;assert.match(compareSnapshots(a,x).error,/overlap/);
});

test('check-in can supply a missing report plan without overwriting an edit or active plan',()=>{
 const snap={plan:{noticed:'Saved observation',test:'Saved test'}};
 assert.match(planForReportFromSnapshot({}, {},snap),/Saved test/);
 assert.equal(planForReportFromSnapshot({experiment:'Existing text'}, {},snap),null);
 assert.equal(planForReportFromSnapshot({experiment:''}, {},snap),null);
 assert.equal(planForReportFromSnapshot({}, {test:'Current plan'},snap),null);
});
