import {summarize, addDays, comparisonCoverage, percentChange} from './analytics.js';
import {metricSummary} from './marketing.js';

const complete=(s,k)=>s.count>0 && s[`${k}Coverage`]===s.count;
const nonNegative=(rows,fields)=>rows.every(r=>fields.every(k=>r[k]===null||r[k]===undefined||r[k]>=0));
const number=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(n):'unavailable';
const money=(n,currency='USD')=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(n):'unavailable';
const validCost=(s,rows)=>complete(s,'spend')&&complete(s,'conversions')&&nonNegative(rows,['spend','conversions'])&&s.conversions>0 ? s.spend/s.conversions : null;
const qualityIssue=data=>!!data?.qualityUnknown||(data?.duplicates||0)>0||(data?.errors||[]).some(e=>e.reason!=='summary row (excluded)');

// Group by both campaign and channel, so same-named campaigns do not merge.
export function campaignGroups(rows) {
 const groups=new Map();
 for(const row of rows){const channel=String(row.channel||'').trim(),campaign=String(row.campaign||'').trim();const id=JSON.stringify([channel,campaign]);if(!groups.has(id))groups.set(id,{id,channel,campaign,rows:[]});groups.get(id).rows.push(row)}
 return [...groups.values()].map(g=>({...g,label:g.campaign||'Unassigned campaign',summary:summarize(g.rows)}));
}
export function investigate(type, period, days, data=null, goal='') {
 const rows=period.current||[], oldRows=period.previous||[], current=summarize(rows), previous=summarize(oldRows);
 if(!rows.length)return {error:'Add a supported report or explore the demo to open a case.'};
 const currency=data?.currency||'USD';
 if(type==='spending'){
  if(!rows.some(r=>r.campaign))return {error:'Add a Campaign column with campaign names to investigate spending.'};
  const groups=campaignGroups(rows), clean=!qualityIssue(data), full=complete(current,'spend')&&clean, nonnegative=nonNegative(rows,['spend']);
  const canShare=full&&nonnegative&&current.spend>0;
  const facts=groups.map(g=>({label:g.label,campaign:g.campaign,channel:g.channel,value:g.summary.spend,rows:g.summary.count,spendCoverage:g.summary.spendCoverage,conversions:g.summary.conversions,conversionCoverage:g.summary.conversionsCoverage,cost:validCost(g.summary,g.rows),share:canShare&&g.summary.spend!==null?g.summary.spend/current.spend*100:null,partial:!complete(g.summary,'spend')})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)||a.label.localeCompare(b.label));
  const top=full&&nonnegative?facts.find(x=>x.value>0):null;
  const next=top?`Review ${top.label} (${top.channel||'unknown channel'}): recorded spend is ${money(top.value,currency)}${top.cost!==null?` and recorded cost per conversion is ${money(top.cost,currency)}`:''}. It has the largest recorded spend among campaign/channel groups with complete, non-negative spend. Check results and context before considering a budget change.`:'Review missing or adjusted spend values and import warnings before comparing campaigns or budgets.';
  return {title:'The campaign spending case',facts,total:current.spend,current,full,canShare,next,note:`Spend is present on ${current.spendCoverage} of ${current.count} records.${!clean?' Invalid or duplicate records make coverage uncertain.':''}${!nonnegative?' Negative adjustments mean spend shares are unavailable.':''} Campaigns are separated by channel; recorded totals may not represent every campaign.`};
 }
 const required=type==='expensive'?['spend','conversions']:['conversions'];
 if(days==='all')return {error:'Choose 7, 30, or 90 days to compare two equal periods.'};
 const n=Number(days),previousStart=addDays(period.start,-n),previousEnd=addDays(period.start,-1);
 if(new Set(rows.map(r=>r.date)).size!==n||new Set(oldRows.map(r=>r.date)).size!==n)return {error:`This case needs records for every day in both ${n}-day windows. Add the missing dates or choose another date range. A recorded day alone does not guarantee a complete export.`};
 const coverage=comparisonCoverage(oldRows,rows,n,data?[data]:[]);
 if(!coverage.safe)return {error:[...coverage.reasons,...coverage.differences.slice(0,5)].join(' ')+(coverage.differences.length>5?` and ${coverage.differences.length-5} more groups.`:''),coverage};
 // Website activity uses recorded clicks or impressions, never invented conversions.
 if(type==='results'&&goal==='Website activity'){
  const all=[...oldRows,...rows],usable=k=>complete(current,k)&&complete(previous,k)&&nonNegative(all,[k]);
  const metricKey=['clicks','impressions'].find(usable);
  if(!metricKey)return {error:'This activity case needs complete, non-negative clicks or impressions on every row in both periods. Review missing values or negative adjustments; CTR also needs complete clicks and positive impressions.',coverage};
  const before=metricSummary(oldRows,data?.conversionDefinition),after=metricSummary(rows,data?.conversionDefinition);
  const prior=new Map(campaignGroups(oldRows).map(g=>[g.id,g]));
  const changes=campaignGroups(rows).map(g=>{
   const old=prior.get(g.id),p=metricSummary(old.rows,data?.conversionDefinition),c=metricSummary(g.rows,data?.conversionDefinition);
   return {label:g.campaign||g.channel||'Unknown channel',campaign:g.campaign,channel:g.channel,previous:p,current:c,metricDelta:c[metricKey]-p[metricKey]};
  }).sort((a,b)=>a.metricDelta-b.metricDelta||a.label.localeCompare(b.label)||a.channel.localeCompare(b.channel));
  const top=changes.find(g=>g.metricDelta<0);
  const entity=top?(top.campaign?`${top.campaign} (${top.channel||'unknown channel'})`:top.channel||'unknown channel'):'';
  const why=top?`It has the largest recorded ${metricKey} decrease among the comparable campaign/channel groups.`:'';
  const next=top?`Review ${entity}: recorded ${metricKey} ${number(top.previous[metricKey])} → ${number(top.current[metricKey])}. ${why} Review report scope and traffic context; these data do not establish the cause.`:`No comparable campaign or channel has a recorded ${metricKey} decrease. Review the report and context before choosing a next step.`;
  const ctrNote=before.ctr===null||after.ctr===null?' CTR is unavailable unless clicks and impressions are complete and non-negative, with positive impressions.':'';
  const fallbackNote=metricKey==='impressions'&&all.some(r=>Number.isFinite(r.clicks))?' Clicks are incomplete or include negative adjustments, so they are not used for this ranking.':'';
  return {title:'The disappearing results case',activity:true,metricKey,current:after,previous:before,previousStart,previousEnd,changes,top,why,coverage,next,note:`Both periods have recorded rows for the observed campaign/channel groups on each date, with complete non-negative ${metricKey}.${fallbackNote}${ctrNote} Recorded rows cannot prove the export includes every campaign or event, or establish the reason for a change.`};
 }
 const missing=required.filter(k=>!complete(current,k)||!complete(previous,k));
 if(missing.length)return {error:`This case needs ${missing.join(' and ')} on every row in both periods. Add the missing values to your report.`};
 if(!nonNegative([...oldRows,...rows],required))return {error:'The required metrics contain negative adjustments. Review those adjustments before interpreting changes or cost per conversion; Waddle cannot safely rank these campaigns.'};
 if(type==='expensive'&&(current.conversions<=0||previous.conversions<=0))return {error:'Cost per conversion needs a positive conversion total in each period. Check the conversion values or choose another case.'};
 const prior=new Map(campaignGroups(oldRows).map(g=>[g.id,g]));
 const changes=campaignGroups(rows).flatMap(g=>{const old=prior.get(g.id);if(!old||!g.campaign)return [];const a=g.summary,b=old.summary;if(!required.every(k=>complete(a,k)&&complete(b,k)))return [];const before=validCost(b,old.rows),after=validCost(a,g.rows);return [{label:g.campaign,campaign:g.campaign,channel:g.channel,previous:b,current:a,previousCost:before,currentCost:after,conversionDelta:a.conversions-b.conversions,costDelta:before!==null&&after!==null?after-before:null}];});
 // Largest recorded conversion decrease first, then greatest increase in cost per conversion.
 changes.sort((a,b)=>a.conversionDelta-b.conversionDelta||(b.costDelta??-Infinity)-(a.costDelta??-Infinity)||a.label.localeCompare(b.label));
 const top=changes.find(g=>g.conversionDelta<0 || (type==='expensive'&&g.costDelta!==null&&g.costDelta>0));
 const why=top?(top.conversionDelta<0?'It has the largest recorded conversion decrease among comparable campaign/channel groups.':'Among comparable groups, it is the first with a calculable cost-per-conversion increase when ordered by conversion change, then cost change.'):'';
 let next=top?`Review ${top.label} (${top.channel||'unknown channel'}): recorded conversions ${number(top.previous.conversions)} → ${number(top.current.conversions)}${type==='expensive'?`, spend ${money(top.previous.spend,currency)} → ${money(top.current.spend,currency)}`:''}${top.previousCost!==null&&top.currentCost!==null?`, cost per conversion ${money(top.previousCost,currency)} → ${money(top.currentCost,currency)}`:''}. ${why} Check tracking, traffic or landing-page changes; these data do not establish the cause.`:`No named campaign has a recorded conversion decrease${type==='expensive'?' or a higher calculable cost per conversion':''}. Check coverage and context before choosing a test.`;
 return {title:type==='expensive'?'The expensive conversions case':'The disappearing results case',current,previous,previousStart,previousEnd,changes,top,previousCost:validCost(previous,oldRows),currentCost:validCost(current,rows),percentChanges:{spend:percentChange(current.spend,previous.spend),conversions:percentChange(current.conversions,previous.conversions),cost:percentChange(validCost(current,rows),validCost(previous,oldRows))},note:'Both windows contain recorded rows for the observed campaign and channel groups on each date, with the required values. This does not prove the export includes every campaign or conversion or identify what caused a change.',next};
}
