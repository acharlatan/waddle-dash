import {summarize, percentChange} from './analytics.js';
export const DEFINITIONS = ['unknown','leads','bookings','purchases','other'];
export function normalizeDefinition(value){return DEFINITIONS.includes(value)?value:'unknown'}
export function conversionLabel(value){return ({leads:'recorded leads',bookings:'recorded bookings',purchases:'recorded purchases',other:'recorded conversions',unknown:'recorded conversions'})[normalizeDefinition(value)]}
const complete=(s,k)=>s.count>0&&s[`${k}Coverage`]===s.count;
const nonnegative=(rows,keys)=>rows.every(r=>keys.every(k=>r[k]===null||r[k]===undefined||r[k]>=0));
// Ratios require every selected row to have both fields; missing values are never zero.
export function metricSummary(rows,definition='unknown'){
 const s=summarize(rows);
 s.cpc=complete(s,'spend')&&complete(s,'conversions')&&nonnegative(rows,['spend','conversions'])&&s.conversions>0?s.spend/s.conversions:null;
 s.ctr=complete(s,'clicks')&&complete(s,'impressions')&&nonnegative(rows,['clicks','impressions'])&&s.impressions>0?s.clicks/s.impressions*100:null;
 s.cvr=normalizeDefinition(definition)!=='unknown'&&complete(s,'clicks')&&complete(s,'conversions')&&nonnegative(rows,['clicks','conversions'])&&s.clicks>0?s.conversions/s.clicks*100:null;
 if(!nonnegative(rows,['spend','revenue']))s.roas=null;
 return s;
}
export function goalMetricKeys(goal,s,hasData=true){
 if(goal==='Leads or inquiries'||goal==='Bookings'){
  const fourth=s.cvr!==null?'cvr':s.clicks!==null?'clicks':s.impressions!==null?'impressions':null;
  return ['conversions','spend','cpc',...(fourth?[fourth]:[])];
 }
 if(goal==='Website activity'){
  const keys=['clicks','impressions','ctr','spend'].filter(k=>s[k]!==null);
  return keys.length?keys:(hasData?[]:['clicks','impressions','ctr']);
 }
 if(goal==='Other'){
  const keys=['conversions','spend','clicks','impressions','revenue'].filter(k=>s[k]!==null);
  return keys.length?keys.slice(0,4):(hasData?[]:['conversions','spend','clicks','impressions']);
 }
 return ['spend','revenue','conversions','roas'];
}
export function defaultMetric(goal,rows){
 const available=k=>rows.some(r=>Number.isFinite(r[k]));
 const keys=goal==='Website activity'?['clicks','impressions','spend','conversions','revenue']:goal==='Leads or inquiries'||goal==='Bookings'?['conversions','spend','clicks','impressions','revenue']:['revenue','conversions','spend','clicks','impressions'];
 return keys.find(available)||'revenue';
}
export function metricChange(current,previous,key){
 if(!previous?.count||current[key]===null||previous[key]===null||current[key]===undefined||previous[key]===undefined)return null;
 if(['spend','revenue','conversions','clicks','impressions'].includes(key)&&(!complete(current,key)||!complete(previous,key)))return null;
 return {before:previous[key],after:current[key],absolute:current[key]-previous[key],percent:percentChange(current[key],previous[key])};
}
