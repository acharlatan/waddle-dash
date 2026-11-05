import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCSV,suggestMapping,normalizeData,filterPeriod} from '../public/analytics.js';
import {investigate,campaignGroups} from '../public/mystery.js';
import {conversionLabel,metricSummary,goalMetricKeys,defaultMetric,metricChange} from '../public/marketing.js';
import {makeSnapshot,compareSnapshots} from '../public/time-machine.js';

// Fictional campaign numbers, not client data or a real platform export.
const csv=readFileSync(new URL('./fixtures/synthetic_lead_shift.csv',import.meta.url),'utf8');
function imported(){const p=parseCSV(csv),m=suggestMapping(p.headers);m.revenue=-1;return {...normalizeData(p,m,'USD',{defaultChannel:'Paid Search'}),source:'google',valueKind:'none',conversionDefinition:'leads'}}
const run=(rows,type='expensive',data=imported())=>investigate(type,filterPeriod(rows,'7'),'7',data);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≠ ${b}`);

test('fictional two-campaign lead report finds Generic Search, with correct spend and cost evidence',()=>{
 const data=imported(),r=run(data.records,'expensive',data);
 assert.equal(r.previous.spend,1190);assert.equal(r.current.spend,1190);
 assert.equal(r.previous.conversions,105);assert.equal(r.current.conversions,70);
 near(r.previousCost,1190/105);near(r.currentCost,17);
 assert.equal(r.top.label,'Generic Search');assert.equal(r.changes[1].label,'Brand Search');
 assert.equal(r.top.previous.conversions,56);assert.equal(r.top.current.conversions,21);
 assert.equal(r.top.previous.spend,700);assert.equal(r.top.current.spend,700);
 near(r.top.previousCost,12.5);near(r.top.currentCost,700/21);
 assert.match(r.next,/56 → 21/);assert.match(r.next,/\$700\.00 → \$700\.00/);assert.match(r.next,/do not establish the cause/);
 assert.equal(data.records.every(x=>x.revenue===null),true);
});
test('lead goal has useful volume and cost without revenue',()=>{
 const rows=imported().records,s=metricSummary(rows,'leads');assert.equal(s.revenue,null);
 assert.deepEqual(goalMetricKeys('Leads or inquiries',s),['conversions','spend','cpc','cvr']);
 assert.equal(defaultMetric('Leads or inquiries',rows),'conversions');assert.equal(conversionLabel('leads'),'recorded leads');
});
test('bookings are labeled only after confirmation and rates need a definition',()=>{
 const rows=imported().records,bookings=metricSummary(rows,'bookings'),unknown=metricSummary(rows,'unknown');
 assert.equal(conversionLabel('bookings'),'recorded bookings');assert.equal(conversionLabel('unknown'),'recorded conversions');
 assert.ok(bookings.cvr!==null);assert.equal(unknown.cvr,null);assert.equal(goalMetricKeys('Bookings',bookings)[0],'conversions');
 assert.equal(conversionLabel('anything else'),'recorded conversions');
});
test('website activity prioritizes present clicks and impressions rather than invented sessions',()=>{
 const rows=imported().records,s=metricSummary(rows,'unknown');assert.deepEqual(goalMetricKeys('Website activity',s),['clicks','impressions','ctr','spend']);
 assert.equal(defaultMetric('Website activity',rows),'clicks');assert.ok(!goalMetricKeys('Website activity',s).includes('conversions'));
});
test('earlier-only and later-only campaign records pause comparison without inserting zeros',()=>{
 const original=imported().records;
 const earlierOnly=original.filter(r=>!(r.campaign==='Generic Search'&&r.date>='2026-10-08'));
 const laterOnly=original.filter(r=>!(r.campaign==='Generic Search'&&r.date<'2026-10-08'));
 for(const [rows,which] of [[earlierOnly,'later'],[laterOnly,'earlier']]){
  const r=run(rows,'results');assert.match(r.error,new RegExp(`not recorded in the ${which} period`));assert.equal(r.changes,undefined);
 }
});
test('same campaign name in two channels stays separate and can rank independently',()=>{
 const base=imported().records.filter(r=>r.campaign==='Generic Search');
 const rows=base.flatMap(r=>[{...r,campaign:'Shared',channel:'Search'},{...r,campaign:'Shared',channel:'Social',conversions:5}]);
 assert.equal(campaignGroups(rows).length,2);const r=run(rows);assert.equal(r.changes.length,2);assert.equal(r.top.channel,'Search');
 assert.equal(r.changes.find(x=>x.channel==='Social').previous.conversions,35);
});
test('missing spend and conversion cells remain unknown and block case comparisons',()=>{
 for(const field of ['spend','conversions']){const rows=imported().records.map(r=>({...r}));rows[0][field]=null;const r=run(rows);assert.match(r.error,new RegExp(field));}
 const rows=imported().records.map(r=>({...r}));rows.at(-1).spend=null;const r=run(rows,'spending');assert.equal(r.canShare,false);assert.equal(r.facts.find(x=>x.partial).share,null);
});
test('zero conversion denominators and negative adjustments are never costed or ranked',()=>{
 const zero=imported().records.map(r=>({...r,conversions:0}));assert.match(run(zero).error,/positive/);assert.equal(metricSummary(zero,'leads').cpc,null);
 const negative=imported().records.map(r=>({...r}));negative[0].conversions=-1;assert.match(run(negative).error,/negative adjustments/);assert.equal(metricSummary(negative,'leads').cpc,null);
 const spending=imported().records.map(r=>({...r}));spending.at(-1).spend=-1;assert.equal(run(spending,'spending').canShare,false);assert.equal(metricSummary(spending,'leads').cpc,null);
});
test('fractional conversions retain precision in evidence, counts and cost',()=>{
 const rows=imported().records.map(r=>({...r,conversions:r.conversions/2})),r=run(rows);assert.equal(r.top.previous.conversions,28);assert.equal(r.top.current.conversions,10.5);near(r.top.currentCost,700/10.5);assert.match(r.next,/10\.5/);
});
test('no meaningful campaign change returns no specific campaign recommendation',()=>{
 const rows=imported().records.map(r=>({...r,conversions:r.campaign==='Generic Search'?8:7})),r=run(rows);assert.equal(r.top,undefined);assert.match(r.next,/No named campaign/);
});
test('campaign spending gives valid shares and explains complete coverage',()=>{
 const rows=imported().records,r=run(rows,'spending');const generic=r.facts.find(x=>x.label==='Generic Search');near(generic.share,700/1190*100);assert.equal(generic.conversions,21);near(generic.cost,700/21);assert.doesNotMatch(r.next,/cut/i);
});
test('conversion definitions cannot silently conflict across saved snapshots',()=>{
 const d=imported(),p=filterPeriod(d.records,'7');const snap=(records,definition)=>makeSnapshot({records,data:{...d,conversionDefinition:definition},name:'Fictional',goal:'Leads or inquiries',plan:{},report:{},start:records[0].date,end:records.at(-1).date});
 const a=snap(p.previous,'leads'),b=snap(p.current,'bookings');assert.match(compareSnapshots(a,b).error,/definitions differ/);
 b.data.conversionDefinition='unknown';const r=compareSnapshots(a,b);assert.ok(r.metrics.includes('spend'));assert.ok(!r.metrics.includes('conversions'));assert.match(r.conversionWarning,/not confirmed/);assert.equal(r.cpc,false);
 assert.equal(a.data.conversionDefinition,'leads');
});
test('negative adjustments disable snapshot cost even when total is positive',()=>{
 const d=imported(),p=filterPeriod(d.records,'7');const snap=records=>makeSnapshot({records,data:d,name:'Fictional',goal:'Leads or inquiries',plan:{},report:{},start:records[0].date,end:records.at(-1).date});const a=snap(p.previous),b=snap(p.current);b.data.records[0].spend=-1;const r=compareSnapshots(a,b);assert.equal(r.cpc,false);
});
test('metric changes preserve zero baseline and fractional differences',()=>{
 const a=metricSummary([{spend:0,conversions:0,clicks:10,impressions:100}],'leads');
 const b=metricSummary([{spend:5,conversions:1.5,clicks:10,impressions:100}],'leads');
 assert.deepEqual(metricChange(b,a,'conversions'),{before:0,after:1.5,absolute:1.5,percent:null});
});
