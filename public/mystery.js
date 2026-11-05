import {summarize, groupBy, addDays} from './analytics.js';

// Only compare complete, equal calendar windows; presence of a date cannot prove a complete export.
export function investigate(type, period, days) {
  const rows=period.current, current=summarize(rows), previous=summarize(period.previous);
  if (!rows.length) return {error:'Add a supported report or explore the demo to open a case.'};
  const complete=(s,k)=>s.count>0 && s[`${k}Coverage`]===s.count;
  if(type==='spending') {
    if (!rows.some(r=>r.campaign)) return {error:'Add a Campaign column with campaign names to investigate spending.'};
    if (!complete(current,'spend')) return {error:'This case needs a spend value on every selected row. Add the missing spend values to your report.'};
    const groups=groupBy(rows,'campaign').sort((a,b)=>b.spend-a.spend);
    return {title:'The campaign spending case', facts:groups.map(g=>({label:g.label,value:g.spend,rows:g.count})), total:current.spend, current, note:'Recorded spend by campaign. Campaigns with the same name are grouped across channels; unnamed rows are grouped together.', next:'Review the highest-spending campaign and check its results before considering a budget change.'};
  }
  const required=type==='expensive'?['spend','conversions']:['conversions'];
  if(days==='all') return {error:'Choose 7, 30, or 90 days to compare two equal periods.'};
  const n=Number(days), start=period.start, previousStart=addDays(start,-n), previousEnd=addDays(start,-1);
  if(new Set(rows.map(r=>r.date)).size!==n || new Set(period.previous.map(r=>r.date)).size!==n) return {error:`This case needs records for every day in both ${n}-day windows. Add the missing dates or choose another date range. A recorded day alone does not guarantee a complete export.`};
  const missing=required.filter(k=>!complete(current,k)||!complete(previous,k));
  if(missing.length) return {error:`This case needs ${missing.join(' and ')} on every row in both periods. Add the missing values to your report.`};
  if(type==='expensive' && (current.conversions<=0 || previous.conversions<=0)) return {error:'Cost per conversion needs a positive conversion total in each period. Check the conversion values or choose another case.'};
  const names=[...new Set([...rows,...period.previous].map(r=>r.campaign).filter(Boolean))];
  const changes=names.map(label=>{let a=summarize(rows.filter(r=>r.campaign===label)),b=summarize(period.previous.filter(r=>r.campaign===label));return {label,current:a,previous:b};}).filter(g=>g.current.count&&g.previous.count&&required.every(k=>complete(g.current,k)&&complete(g.previous,k))).sort((a,b)=>type==='results'?(a.current.conversions-a.previous.conversions)-(b.current.conversions-b.previous.conversions):(b.current.spend-b.previous.spend)-(a.current.spend-a.previous.spend));
  return {title:type==='expensive'?'The expensive conversions case':'The disappearing results case',current,previous,previousStart,previousEnd,changes, note:'Both windows have recorded rows on every day and complete required fields. This does not prove the export includes every campaign or conversion.',next:type==='expensive'?'Review campaigns with the largest recorded spend increases and check their conversion counts.':'Review campaigns with the largest recorded conversion decreases, then check tracking and context.'};
}
