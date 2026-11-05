import {METRICS,looksLikeContactList,dateCoverage,filterPeriod,comparisonCoverage,summarize,addDays} from './analytics.js';
import {metricSummary,normalizeDefinition} from './marketing.js';

export const FIELD_NAMES={date:'Date',channel:'Channel',campaign:'Campaign',spend:'Spend',revenue:'Revenue or conversion value',conversions:'Conversions',clicks:'Clicks',impressions:'Impressions',currency:'Currency'};
export function mappingSummary(parsed,mapping,defaultChannel=''){
 const selected=Object.entries(FIELD_NAMES).filter(([key])=>mapping[key]>=0).map(([key,label])=>({key,label,header:parsed.headers[mapping[key]]}));
 const missing=[];if(!(mapping.date>=0))missing.push('a date');if(!(mapping.channel>=0)&&!String(defaultChannel).trim())missing.push('a channel column or assigned channel');if(!METRICS.some(k=>mapping[k]>=0))missing.push('at least one numeric metric');
 const useful=['campaign','spend','conversions','revenue','clicks','impressions','currency'].filter(k=>!(mapping[k]>=0)).map(k=>FIELD_NAMES[k]);
 return {selected,missing,useful,contact:looksLikeContactList(parsed.headers),assignedChannel:!(mapping.channel>=0)&&!!String(defaultChannel).trim()};
}
export function exclusionAdvice(error){
 const field=FIELD_NAMES[error.field]||error.field;
 switch(error.reason){
  case 'invalid date':return 'Date is missing or unsupported. Use a real date in YYYY-MM-DD or MM/DD/YYYY format.';
  case 'missing channel':return 'Channel is blank. Fill the mapped channel cell, or remove that mapping and assign one channel for all rows.';
  case 'invalid number':return `Invalid number${field?` in ${field}`:''}. Use a decimal point and optional comma thousands separators; quote values containing commas. Use -10 or (10) for negative adjustments.`;
  case 'no metric values':return 'All mapped metrics are blank on this row. Provide at least one recorded numeric metric; blank is not zero.';
  case 'summary row (excluded)':return 'Identified report total excluded to avoid double-counting. Check for other overlapping totals that may not be detected.';
  default:return 'This record could not be safely imported. Check its date, channel and selected metric values.';
 }
}
export function summarizeImport(result,mapping,definition='unknown'){
 const rows=result.records,s=metricSummary(rows,definition),first=rows[0].date,last=rows.at(-1).date,coverage=dateCoverage(rows,first,last);
 const names=rows.filter(r=>String(r.campaign||'').trim()).length;
 const paired=s.count>0&&s.spendCoverage===s.count&&s.conversionsCoverage===s.count;
 const rawCost=paired&&rows.every(r=>r.spend>=0&&r.conversions>=0)&&s.conversions>0;
 const analyses=[
  {label:'Recorded metrics',state:'available',detail:'Explore the selected metrics and their row coverage; partial totals are labeled.'},
  {label:'Campaign investigation',state:names===rows.length?'available':names?'limited':'unavailable',detail:names===rows.length?'Named campaigns can be explored. Comparisons also need matching campaign/channel coverage.':names?`Campaign names are present on ${names} of ${rows.length} rows. Unnamed rows limit campaign comparisons.`:'Map a Campaign column with campaign names to investigate individual campaigns.'},
  {label:'Cost per recorded conversion',state:rawCost?'available':'unavailable',detail:rawCost?'Complete non-negative spend divided by positive recorded conversions. A lead analysis does not require revenue.':'Needs spend and conversions on every analyzed row, no negative adjustments in those fields, and positive conversions.'},
  {label:'ROAS',state:s.roas!==null?'available':'unavailable',detail:s.roas!==null?'Recorded value divided by spend. ROAS is not profit; platform-reported conversion value is not verified revenue.':'Needs complete non-negative spend and value on the analyzed rows, and positive spend. Revenue is not required for a lead analysis.'},
  {label:'CTR',state:s.ctr!==null?'available':'unavailable',detail:s.ctr!==null?'Recorded clicks divided by recorded impressions.':'Needs complete non-negative clicks and positive impressions on the analyzed rows.'},
  {label:'Conversions per click',state:s.cvr!==null?'available':'unavailable',detail:s.cvr!==null?'Recorded conversions divided by clicks; these do not necessarily represent unique people.':normalizeDefinition(definition)==='unknown'?'Confirm what the conversion column counts; complete non-negative conversions and positive clicks are also needed.':'Needs complete non-negative conversions and positive clicks on the analyzed rows.'}
 ];
 const windows=[];let sevenDayDetail='';
 for(const days of [7,30,90]){
  const p=filterPeriod(rows,String(days)),check=comparisonCoverage(p.previous,p.current,days,[result]);
  if(days===7){const now=dateCoverage(p.current,p.start,p.end),before=dateCoverage(p.previous,addDays(p.start,-days),addDays(p.start,-1));sevenDayDetail=`Latest 7 days: ${now.recordedDays}/7 days have rows; prior 7 days: ${before.recordedDays}/7. ${[...check.reasons,...check.differences.slice(0,3)].join(' ')}`.trim()}
  if(check.safe){const a=summarize(p.previous),b=summarize(p.current);const shared=METRICS.some(k=>a[`${k}Coverage`]===a.count&&b[`${k}Coverage`]===b.count);if(shared)windows.push(days);else if(days===7)sevenDayDetail+=' No mapped metric is complete on all rows in both periods.';}
 }
 return {first,last,coverage,summary:s,namedCampaignRows:names,analyses,comparisonWindows:windows,sevenDayDetail};
}
