import {filterPeriod,addDays} from './analytics.js';
import {makeSnapshot} from './time-machine.js';
import {conversionLabel} from './marketing.js';

const number=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(n):'unavailable';
const money=(n,currency)=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:currency||'USD',maximumFractionDigits:2}).format(n):'unavailable';
export const PLAN_FIELDS=[['noticed','What I noticed'],['hypothesis','Possible explanation or question'],['test','One possible test'],['measure','What I’ll measure'],['review','When I’ll review it'],['limits','What this data doesn’t prove'],['notes','Experiment notes']];
export function formatPlan(plan={}) {return PLAN_FIELDS.filter(([k])=>String(plan[k]||'').trim()).map(([k,label])=>`${label}: ${plan[k]}`).join('\n')}

// These are editable suggestions, never conclusions or actions performed by Waddle.
export function makePlanDraft(result,type,period,data,days) {
 if(!result||result.error||!period?.current?.length)return null;
 const currency=data?.currency||'USD', word=conversionLabel(data?.conversionDefinition), current=`${period.start} – ${period.end}`;
 let noticed, hypothesis, test, measure;
 if(type==='spending'){
  const top=result.canShare?result.facts.find(x=>!x.partial && x.value>0):null;
  noticed=top?`${top.label} (${top.channel||'unknown channel'}) recorded ${money(top.value,currency)} spend in ${current}, on ${top.spendCoverage}/${top.rows} rows${top.conversions!==null?`, with ${number(top.conversions)} ${word} recorded on ${top.conversionCoverage}/${top.rows} rows`:''}.`:`In ${current}, recorded spend was ${money(result.total,currency)} across ${result.current.spendCoverage}/${result.current.count} rows. ${result.note}`;
  hypothesis='Could the recorded spend and results reflect a change in traffic, tracking, or campaign scope? This is a question to assess, not a conclusion.';
  test='Review the source report and conversion tracking; choose one campaign or landing-page change to test only if the context supports it.';
  measure='Recorded spend and conversions; cost per recorded conversion when complete and valid.';
 }else if(result.activity){
  const previous=`${result.previousStart} – ${result.previousEnd}`,key=result.metricKey,x=result.top;
  const entity=x?(x.campaign?`${x.campaign} (${x.channel||'unknown channel'})`:x.channel||'Unknown channel'):'The recorded report';
  const a=x?.previous||result.previous,b=x?.current||result.current;
  const ctr=a.ctr!==null&&b.ctr!==null?` Recorded CTR was ${a.ctr.toFixed(2)}% → ${b.ctr.toFixed(2)}%.`:'';
  noticed=`${entity}: ${number(a[key])} recorded ${key} in ${previous} and ${number(b[key])} in ${current}.${ctr}${x?' '+result.why:' No comparable group has a supported decrease to highlight.'}`;
  hypothesis='Could reporting scope, tracking, or traffic context help explain the recorded change? This is a question to review, not a conclusion.';
  test='Review the source report and relevant traffic and tracking context before choosing whether to run a test.';
  measure=`Recorded ${key}${a.ctr!==null&&b.ctr!==null?' and CTR when clicks and impressions are complete and valid':''}.`;
 }else if(result.top){
  const x=result.top,previous=`${result.previousStart} – ${result.previousEnd}`;
  const spend=type==='expensive'?` Spend was ${money(x.previous.spend,currency)} → ${money(x.current.spend,currency)}.`:'';
  const cost=x.previousCost!==null&&x.currentCost!==null?` Cost per recorded conversion was ${money(x.previousCost,currency)} → ${money(x.currentCost,currency)}.`:'';
  noticed=`${x.label} (${x.channel||'unknown channel'}) had ${number(x.previous.conversions)} ${word} in ${previous} and ${number(x.current.conversions)} in ${current}.${spend}${cost}`;
  hypothesis='Could traffic quality, the landing page, or conversion tracking have changed? These are possibilities to assess, not conclusions.';
  test='Review traffic or search terms and conversion tracking, then choose one landing-page change to test if appropriate.';
  measure=type==='expensive'?'Recorded conversions and cost per recorded conversion.':'Recorded conversions; add spend and cost per conversion if available.';
 }else{
  noticed=`${result.title}: ${number(result.previous.conversions)} ${word} in ${result.previousStart} – ${result.previousEnd} and ${number(result.current.conversions)} in ${current}. No named campaign has a supported standout.`;
  hypothesis='What context or report coverage should be checked before choosing a test? No explanation is established.';
  test='Review the report scope and tracking definitions before deciding whether there is a useful test.';
  measure='The complete recorded metrics relevant to the question.';
 }
 return {noticed,hypothesis,test,measure,review:days!=='all'&&Number.isFinite(Number(days))?`Review after the next ${Number(days)} comparable days, if enough data is available.`:'Choose a review date or period.',limits:'The report does not establish which factor caused the change. Confirm reporting scope, tracking and data coverage; missing records are not zero.',notes:''};
}

export function createDemoDataset(){
 const rows=[];
 for(let d=1;d<=14;d++){
  const date=`2026-10-${String(d).padStart(2,'0')}`;
  rows.push({date,channel:'Paid Search',campaign:'Brand Search',spend:70,revenue:null,conversions:7,clicks:100,impressions:2000});
  rows.push({date,channel:'Paid Search',campaign:'Generic Search',spend:100,revenue:null,conversions:d<=7?8:3,clicks:200,impressions:4000});
 }
 return {records:rows,errors:[],duplicates:0,currency:'USD',currencyCheckVersion:1,currencyNote:'Fictional demo amounts are in USD.',valueKind:'none',conversionDefinition:'leads',source:'demo'};
}
export function createDemoCheckin(data,plan={}){
 const p=filterPeriod(data.records,'7');
 const next=p.current.map(r=>({...r,date:addDays(r.date,7)}));
 const prior=makeSnapshot({records:p.current,data,name:'FICTIONAL · Baseline week',goal:'Leads or inquiries',plan,report:{},caseType:'expensive',start:p.start,end:p.end});
 const later=makeSnapshot({records:next,data,name:'FICTIONAL · Illustrative next week',goal:'Leads or inquiries',plan:{},report:{},caseType:'expensive',start:next[0].date,end:next.at(-1).date});
 prior.id='demo-earlier';later.id='demo-later';prior.status='planned';later.status='planned';
 return [prior,later];
}

// A current report is an in-memory comparison choice, not a saved snapshot.
export function makeCurrentComparison(data,name,goal,plan,report,period){
 if(!data||!period?.current?.length)return null;
 return {id:'session-current',name:`Current session · ${name}`,start:period.start,end:period.end,data:{...data,records:period.current.map(r=>({...r}))},goal,plan:{...plan},report:{...report},status:'current',notes:'Current session report; not saved as a snapshot.'};
}

// Only suggest the earlier plan when the report and the active plan have never been populated.
export function planForReportFromSnapshot(report,activePlan,snapshot){
 if(report?.experiment!==undefined||formatPlan(activePlan))return null;
 return formatPlan(snapshot?.plan)||null;
}
