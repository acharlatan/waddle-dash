import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPeriod} from '../public/analytics.js';
import {createDemoDataset} from '../public/journey.js';
import {askQuestions,answerGoalSummary} from '../public/ask.js';

const keys=options=>options.map(q=>q.key);
test('lead questions and answers use recorded leads and cost without requiring revenue',()=>{
 const d=createDemoDataset(),p=filterPeriod(d.records,'7'),q=askQuestions('Leads or inquiries',d,p.current),a=answerGoalSummary('Leads or inquiries',p,d);
 assert.deepEqual(keys(q.primary),['goal','changes','coverage']);assert.deepEqual(keys(q.other),['best','revenue']);
 assert.match(q.primary[0].label,/recorded leads/);assert.match(a,/recorded leads: 70/);assert.match(a,/Spend: \$1,190\.00/);assert.match(a,/Cost per recorded lead: \$17\.00/);assert.doesNotMatch(a,/ROAS|revenue:/i);
});
test('unknown conversion definitions stay general, including cost labels',()=>{
 const d=createDemoDataset();d.conversionDefinition='unknown';const p=filterPeriod(d.records,'7');
 assert.match(askQuestions('Leads or inquiries',d,p.current).primary[0].label,/recorded conversions/);
 const a=answerGoalSummary('Leads or inquiries',p,d);assert.match(a,/recorded conversions: 70/);assert.match(a,/Cost per recorded conversion/);assert.doesNotMatch(a,/recorded lead/);
});
test('website activity prioritizes clicks, impressions and valid CTR without promoting ROAS',()=>{
 const d=createDemoDataset();d.records=d.records.map(r=>({...r,spend:null,revenue:null,conversions:null}));const p=filterPeriod(d.records,'7'),q=askQuestions('Website activity',d,p.current),a=answerGoalSummary('Website activity',p,d);
 assert.deepEqual(keys(q.primary),['goal','changes','coverage']);assert.deepEqual(keys(q.other),['best','revenue']);
 assert.match(a,/Recorded clicks: 2,100/);assert.match(a,/Recorded impressions: 42,000/);assert.match(a,/CTR: 5\.00%/);assert.match(a,/not sessions or unique people/);assert.doesNotMatch(a,/conversions:|ROAS:/);
});
test('sales calls platform-reported conversion value what it is, not profit',()=>{
 const d=createDemoDataset();d.valueKind='conversion';d.conversionDefinition='purchases';d.records=d.records.map(r=>({...r,revenue:200}));const p=filterPeriod(d.records,'7'),q=askQuestions('Sales',d,p.current),a=answerGoalSummary('Sales',p,d);
 assert.deepEqual(keys(q.primary),['goal','best','revenue','changes','coverage']);assert.match(a,/platform-reported conversion value/);assert.match(a,/not verified revenue or profit/);assert.match(a,/ROAS: 2\.35x/);
});
test('partial fields, zero denominators, negative adjustments and duplicates do not create ratios',()=>{
 const d=createDemoDataset();d.records=d.records.map(r=>({...r,conversions:0}));let p=filterPeriod(d.records,'7');assert.match(answerGoalSummary('Leads or inquiries',p,d),/Cost per recorded lead: unavailable/);
 d.records=d.records.map(r=>({...r,conversions:0.5}));p=filterPeriod(d.records,'7');assert.match(answerGoalSummary('Leads or inquiries',p,d),/recorded leads: 7/);
 d.records.at(-1).spend=null;p=filterPeriod(d.records,'7');assert.match(answerGoalSummary('Leads or inquiries',p,d),/partial/);assert.match(answerGoalSummary('Leads or inquiries',p,d),/Cost per recorded lead: unavailable/);
 d.records.at(-1).spend=-1;p=filterPeriod(d.records,'7');assert.match(answerGoalSummary('Leads or inquiries',p,d),/negative adjustments/);assert.match(answerGoalSummary('Leads or inquiries',p,d),/Cost per recorded lead: unavailable/);
 const clean=createDemoDataset();clean.duplicates=1;p=filterPeriod(clean.records,'7');assert.match(answerGoalSummary('Leads or inquiries',p,clean),/without unresolved duplicate or invalid-record warnings/);
});
