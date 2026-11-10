import test from 'node:test';
import assert from 'node:assert/strict';
import {reportSourceLabel,reportProvenance,briefingExcerpt,planExcerpt,appendReportText,caseReportDestination,reportMetricSelection,selectedBriefingExcerpt} from '../public/report.js';

test('report provenance retains the actual source, definitions and selected period',()=>{
 const context={name:'Fictional leads.csv',source:'google',goal:'Leads or inquiries',currency:'USD',conversion:'Recorded leads',conversionConfirmed:true,example:false};
 const period={start:'2026-10-08',end:'2026-10-14'};
 const text=reportProvenance(context,period);
 for(const value of ['Fictional leads.csv','Google Ads-style report','2026-10-08','2026-10-14','Leads or inquiries','USD','Recorded leads','user confirmed'])assert.ok(text.includes(value),value);
 assert.match(reportProvenance({...context,conversionConfirmed:false},period),/definition unconfirmed/);
 assert.match(reportProvenance({...context,example:true},period),/FICTIONAL DEMO.*fictional example definition/);
 assert.equal(reportSourceLabel(undefined),'Source not recorded');
 assert.match(reportProvenance({},{start:null,end:null}),/Period not recorded.*Currency: not recorded.*Conversion values unavailable/);
});

test('briefing excerpts include only relevant observations and state their limits',()=>{
 const items=[
  {section:'What changed',title:'Recorded leads decreased',body:'56 to 21 in the compared periods.',limit:'This does not establish cause.'},
  {section:'Worth a closer look',title:'Look at Generic Search',body:'Spend stayed at $700.',limit:'Coverage cannot prove completeness.'},
  {section:'A good next step',title:'Check tracking',body:'A possible next step.',limit:'Review context.'}
 ];
 const text=briefingExcerpt(items,'Report · 2026-10-08 – 2026-10-14');
 assert.match(text,/From Waddle Briefing.*2026-10-08/);assert.match(text,/56 to 21/);assert.match(text,/Spend stayed at \$700/);assert.match(text,/does not establish cause/);assert.doesNotMatch(text,/A possible next step/);
 const withoutClue=briefingExcerpt([{...items[0]},{...items[1],title:'No safe standout yet'}],'source');
 assert.doesNotMatch(withoutClue,/Spend stayed/);
});

test('plan excerpts preserve their original period instead of borrowing current dates',()=>{
 const context={selectedPeriod:{start:'2026-10-08',end:'2026-10-14'},earlierPeriod:{start:'2026-10-01',end:'2026-10-07'},campaign:'Generic Search',channel:'Paid Search'};
 const excerpt=planExcerpt('My edited test.',context);
 context.selectedPeriod.start='2026-11-01';
 assert.match(excerpt,/2026-10-08 – 2026-10-14/);assert.match(excerpt,/2026-10-01 – 2026-10-07/);assert.match(excerpt,/Generic Search · Paid Search/);assert.doesNotMatch(excerpt,/2026-11-01/);
 assert.match(planExcerpt('My note',null),/Original case period was not recorded/);
 assert.equal(planExcerpt('',context),'');
});

test('appending retains edited report text and never fabricates a blank section',()=>{
 const edited='A note the user edited.';const appended=appendReportText(edited,'A dated check-in.');
 assert.equal(appended,'A note the user edited.\n\nA dated check-in.');
 assert.equal(appendReportText(edited,''),edited);assert.equal(appendReportText('', 'A dated check-in.'),'A dated check-in.');
});

test('a report can return to its identifiable added case without guessing for other text',()=>{
 assert.deepEqual(caseReportDestination({investigation:'A dated case',investigationCaseType:'spending'}),{href:'#mystery',label:'Return to added case',caseType:'spending'});
 assert.deepEqual(caseReportDestination({investigation:'A dated case',investigationCaseType:'unknown'}),{href:'#mystery',label:'Open Mystery Lab'});
 assert.deepEqual(caseReportDestination({investigation:'',investigationCaseType:'spending'}),{href:'#mystery',label:'Open Mystery Lab'});
 assert.deepEqual(caseReportDestination({}),{href:'#mystery',label:'Open Mystery Lab'});
});

test('new reports default to available goal metrics, including legitimate zeroes',()=>{
 const summary={spend:700,revenue:null,conversions:0,clicks:42,impressions:100,cpc:0,ctr:0.42,cvr:0,roas:null};
 const choices=reportMetricSelection({},summary,['spend','conversions','revenue']);
 assert.equal(choices.include_spend,true);assert.equal(choices.include_conversions,true);
 assert.equal(choices.include_revenue,false);assert.equal(choices.include_clicks,false);
});

test('saved reports preserve metric choices and old reports retain their previous available defaults',()=>{
 const summary={spend:700,revenue:100,conversions:2,clicks:42,impressions:100,cpc:10,ctr:0.42,cvr:0.05,roas:0.14};
 const explicit=reportMetricSelection({include_spend:false,include_clicks:true},summary,['conversions']);
 assert.equal(explicit.include_spend,false);assert.equal(explicit.include_clicks,true);assert.equal(explicit.include_revenue,true);
 const legacy=reportMetricSelection({},summary,['conversions'],true);
 assert.equal(legacy.include_spend,true);assert.equal(legacy.include_revenue,true);assert.equal(legacy.include_clicks,true);
});

test('briefing append includes only the observations the user selected',()=>{
 const items=[{section:'What changed',title:'Recorded leads fell',body:'56 to 21.',limit:'No cause established.'},{section:'Worth a closer look',title:'Look at Generic Search',body:'Spend was $700.',limit:'Coverage is uncertain.'}];
 const text=selectedBriefingExcerpt(items,'Fictional report · October',['Worth a closer look']);
 assert.match(text,/Generic Search/);assert.match(text,/October/);assert.doesNotMatch(text,/56 to 21/);
 assert.equal(selectedBriefingExcerpt(items,'Fictional report',[]),'');
});
