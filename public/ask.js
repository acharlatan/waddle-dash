import {conversionLabel, metricSummary, normalizeDefinition} from './marketing.js';

const present=(rows,key)=>rows.some(row=>Number.isFinite(row[key]));
const number=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(n):'not recorded';
const money=(n,currency)=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:currency||'USD',maximumFractionDigits:2}).format(n):'not recorded';
const qualityIssue=data=>(data?.duplicates||0)>0||(data?.errors||[]).some(e=>e.reason!=='summary row (excluded)');

// Keep the existing value questions available without recommending ROAS for every goal.
export function askQuestions(goal,data,rows=[]){
 const value=data?.valueKind==='conversion'?'platform-reported conversion value':'revenue';
 const word=conversionLabel(data?.conversionDefinition);
 const labels={
  goal:goal==='Website activity'?'What activity is recorded?':goal==='Leads or inquiries'||goal==='Bookings'?`What do my ${word} and costs show?`:goal==='Sales'?`What do spend, ${word}, and value show?`:'What do my recorded metrics show?',
  changes:'What changed?', coverage:'What coverage is recorded?',
  best:'Which channel has the best ROAS?', revenue:`Where is ${value} highest?`
 };
 const primary=['goal'];
 if(goal==='Sales'&&present(rows,'revenue')&&present(rows,'spend'))primary.push('best');
 if(goal==='Sales'&&present(rows,'revenue'))primary.push('revenue');
 primary.push('changes','coverage');
 return {primary:primary.map(key=>({key,label:labels[key]})),other:['best','revenue'].filter(key=>!primary.includes(key)).map(key=>({key,label:labels[key]}))};
}

// Totals disclose partial fields; ratios are withheld when their inputs are unsafe.
export function answerGoalSummary(goal,period,data){
 const rows=period?.current||[];
 if(!rows.length)return 'Add a supported report or try the fictional demo to review recorded metrics.';
 const s=metricSummary(rows,data?.conversionDefinition),word=conversionLabel(data?.conversionDefinition);
 const value=data?.valueKind==='conversion'?'platform-reported conversion value':'revenue';
 const defs={spend:['Spend',true],revenue:[value,true],conversions:[word,false],clicks:['Recorded clicks',false],impressions:['Recorded impressions',false]};
 const keys=goal==='Website activity'?['clicks','impressions']:goal==='Leads or inquiries'||goal==='Bookings'?['conversions','spend']:goal==='Sales'?['conversions','spend','revenue']:['conversions','spend','clicks','impressions','revenue'].filter(k=>present(rows,k));
 const values=keys.map(key=>{const [label,isMoney]=defs[key],v=s[key],cov=s[`${key}Coverage`],negative=rows.some(r=>Number.isFinite(r[key])&&r[key]<0);return `${label}: ${isMoney?money(v,data?.currency):number(v)}${cov<s.count?` (${cov}/${s.count} rows; ${cov?'partial':'not available'})`:''}${negative?' (includes negative adjustments)':''}`});
 const uncertain=qualityIssue(data);
 if(goal==='Website activity'&&(present(rows,'clicks')||present(rows,'impressions'))){
  values.push(`CTR: ${!uncertain&&s.ctr!==null?`${s.ctr.toFixed(2)}% (recorded clicks ÷ recorded impressions)`:'unavailable; it needs complete, non-negative clicks and positive impressions, without unresolved duplicate or invalid-record warnings'}`);
 }else if((goal==='Leads or inquiries'||goal==='Bookings')&&(present(rows,'spend')||present(rows,'conversions'))){
  const unit=({leads:'recorded lead',bookings:'recorded booking',purchases:'recorded purchase'})[normalizeDefinition(data?.conversionDefinition)]||'recorded conversion';
  values.push(`Cost per ${unit}: ${!uncertain&&s.cpc!==null?money(s.cpc,data?.currency):'unavailable; it needs complete, non-negative spend and positive recorded conversions, without unresolved duplicate or invalid-record warnings'}`);
 }else if(goal==='Sales'&&(present(rows,'spend')||present(rows,'revenue'))){
  values.push(`ROAS: ${!uncertain&&s.roas!==null?`${s.roas.toFixed(2)}x (${value} ÷ spend)`:'unavailable; it needs complete, non-negative value and positive spend, without unresolved duplicate or invalid-record warnings'}`);
 }
 const disclaimer=goal==='Website activity'?'These are recorded events, not sessions or unique people.':data?.valueKind==='conversion'?'Platform-reported conversion value is not verified revenue or profit.':'These are recorded values; they do not establish cause or profit.';
 return `Selected ${period.start} – ${period.end}. ${values.join('; ')}. ${disclaimer} The report cannot prove export completeness.`;
}
