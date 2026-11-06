import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPeriod} from '../public/analytics.js';
import {investigate} from '../public/mystery.js';
import {createDemoDataset,makePlanDraft} from '../public/journey.js';
import {destinationForMetric,openCampaignDetail,openChannelDetail,switchSessionMode} from '../public/workspaces.js';

function activityData(){
 const data=createDemoDataset();
 data.conversionDefinition='unknown';
 data.records=data.records.map(r=>({...r,spend:null,revenue:null,conversions:null,clicks:r.campaign==='Generic Search'&&r.date>='2026-10-08'?80:r.clicks}));
 return data;
}
const activity=(d)=>investigate('results',filterPeriod(d.records,'7'),'7',d,'Website activity');

test('website activity follows a recorded clicks decline into an editable plan without conversions',()=>{
 const d=activityData(),p=filterPeriod(d.records,'7'),r=activity(d);
 assert.equal(r.activity,true);assert.equal(r.metricKey,'clicks');assert.equal(r.top.label,'Generic Search');assert.equal(r.top.channel,'Paid Search');
 assert.equal(r.top.previous.clicks,1400);assert.equal(r.top.current.clicks,560);assert.equal(r.top.previous.ctr,5);assert.equal(r.top.current.ctr,2);
 assert.equal(r.previousStart,'2026-10-01');assert.equal(r.previousEnd,'2026-10-07');
 assert.match(r.next,/largest recorded clicks decrease/);assert.match(r.note,/cannot prove/);assert.match(r.next,/do not establish the cause/);
 const draft=makePlanDraft(r,'results',p,d,'7');
 for(const text of ['Generic Search','Paid Search','1,400','560','2026-10-01','2026-10-14','5.00%','2.00%'])assert.ok(draft.noticed.includes(text),text);
 assert.doesNotMatch(draft.noticed,/conversions|sessions/i);assert.match(draft.measure,/clicks/);assert.match(draft.review,/7 comparable days/);
 draft.test='My own review';assert.equal(draft.test,'My own review');
});

test('impressions can support activity when clicks are absent, incomplete or adjusted',()=>{
 for(const change of ['absent','missing','negative']){
  const d=activityData();d.records=d.records.map(r=>({...r,clicks:change==='absent'?null:r.clicks,impressions:r.campaign==='Generic Search'&&r.date>='2026-10-08'?2000:r.impressions}));
  if(change==='missing')d.records[0].clicks=null;
  if(change==='negative')d.records[0].clicks=-1;
  const r=activity(d);assert.equal(r.metricKey,'impressions');assert.equal(r.top.label,'Generic Search');assert.equal(r.top.previous.impressions,28000);assert.equal(r.top.current.impressions,14000);assert.equal(r.previous.ctr,null);
  if(change!=='absent')assert.match(r.note,/incomplete or include negative/);
 }
});

test('activity comparisons do not turn missing or newly appearing campaign rows into zero',()=>{
 for(const earlierOnly of [true,false]){
  const d=activityData();d.records=d.records.filter(r=>r.campaign!=='Generic Search'||(earlierOnly?r.date<'2026-10-08':r.date>='2026-10-08'));
  const r=activity(d);assert.match(r.error,/not recorded in the (earlier|later) period/);assert.equal(r.top,undefined);
 }
});

test('activity keeps same-named campaigns distinct across channels',()=>{
 const d=activityData(),generic=d.records.filter(r=>r.campaign==='Generic Search');
 d.records=generic.flatMap(r=>[{...r,campaign:'Shared',channel:'Search'},{...r,campaign:'Shared',channel:'Social',clicks:50}]);
 const r=activity(d);assert.equal(r.changes.length,2);assert.equal(r.top.campaign,'Shared');assert.equal(r.top.channel,'Search');assert.equal(r.changes.find(x=>x.channel==='Social').current.clicks,350);
});

test('a channel-only report can support an activity case without inventing a campaign name',()=>{
 const d=activityData();d.records=d.records.filter(r=>r.campaign==='Generic Search').map(r=>({...r,campaign:''}));
 const r=activity(d);assert.equal(r.top.campaign,'');assert.equal(r.top.channel,'Paid Search');assert.match(r.next,/Paid Search/);assert.doesNotMatch(r.next,/Generic Search/);
 const draft=makePlanDraft(r,'results',filterPeriod(d.records,'7'),d,'7');assert.match(draft.noticed,/Paid Search/);assert.doesNotMatch(draft.noticed,/Generic Search/);
});

test('activity pauses on unsafe coverage, duplicates or absent and negative metrics',()=>{
 const missingDay=activityData();missingDay.records=missingDay.records.filter(r=>r.date!=='2026-10-03');assert.match(activity(missingDay).error,/every day/);
 const duplicates=activityData();duplicates.duplicates=1;assert.match(activity(duplicates).error,/duplicate/);
 const invalid=activityData();invalid.errors=[{reason:'invalid number'}];assert.match(activity(invalid).error,/invalid records/);
 const missing=activityData();missing.records=missing.records.map(r=>({...r,clicks:null,impressions:null}));assert.match(activity(missing).error,/complete, non-negative clicks or impressions/);
 const negative=activityData();negative.records=negative.records.map(r=>({...r,clicks:-1,impressions:-1}));assert.match(activity(negative).error,/negative adjustments/);
});

test('zero impressions with clicks compares recorded clicks but never invents CTR',()=>{
 const d=activityData();d.records=d.records.map(r=>({...r,impressions:0}));const r=activity(d);assert.equal(r.metricKey,'clicks');assert.equal(r.current.ctr,null);assert.equal(r.top.current.ctr,null);assert.match(r.note,/CTR is unavailable/);
});

test('unchanged activity has no highlighted recommendation',()=>{
 const d=activityData();d.records=d.records.map(r=>({...r,clicks:r.campaign==='Generic Search'?200:100}));const r=activity(d);assert.equal(r.top,undefined);assert.match(r.next,/No comparable campaign or channel/);
 const draft=makePlanDraft(r,'results',filterPeriod(d.records,'7'),d,'7');assert.match(draft.noticed,/No comparable group/);
});

test('briefing destinations and detail navigation keep report, dates, goal and edited work',()=>{
 assert.deepEqual(destinationForMetric('Website activity','clicks'),{page:'mystery',caseType:'results'});
 assert.deepEqual(destinationForMetric('Website activity','ctr'),{page:'mystery',caseType:'results'});
 assert.deepEqual(destinationForMetric('Leads or inquiries','spend'),{page:'mystery',caseType:'spending'});
 assert.deepEqual(destinationForMetric('Sales','revenue'),{page:'channels',caseType:''});
 const data=activityData(),plan={test:'My edit'},report={notes:'Do not replace'},state={mode:'personal',data,goal:'Website activity',days:'7',caseType:'results',planCaseType:'results',plan,report,search:'Shared'};
 openCampaignDetail(state,'Shared','Search','mystery');assert.deepEqual([state.campaign,state.campaignChannel,state.campaignReturn],['Shared','Search','mystery']);
 openChannelDetail(state,'Search','campaigns');assert.deepEqual([state.selectedChannel,state.channelReturn],['Search','campaigns']);
 assert.equal(state.data,data);assert.equal(state.plan,plan);assert.equal(state.report,report);assert.deepEqual([state.days,state.goal,state.caseType,state.search],['7','Website activity','results','Shared']);
 const slots={personal:null,demo:null};switchSessionMode(state,slots,'demo',()=>({data:createDemoDataset(),plan:{},report:{}}));switchSessionMode(state,slots,'personal',()=>({}));
 assert.deepEqual([state.campaign,state.campaignChannel,state.selectedChannel,state.channelReturn,state.planCaseType],['Shared','Search','Search','campaigns','results']);assert.equal(state.report,report);
 openCampaignDetail(state,'Shared','Social','channels');assert.equal(state.campaignReturn,'channels');assert.equal(state.campaignChannel,'Social');
});
