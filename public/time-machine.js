import {summarize, comparisonCoverage, dateCoverage} from './analytics.js';
import {normalizeDefinition} from './marketing.js';
export const STORAGE_KEY='waddle-time-machine-v1';
export function makeSnapshot({records,data,name,goal,plan,report,caseType,start,end}) {
 if(!records.length) throw new Error('There are no records in the selected period to save.');
 const dates=records.map(r=>r.date).sort();
 return {id:globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,savedAt:new Date().toISOString(),name,goal,plan:{...plan},report:{...report},caseType:caseType||'',data:{...data,records:records.map(r=>({...r}))},start:start||dates[0],end:end||dates.at(-1),status:'ongoing',notes:''};
}
export function compareSnapshots(a,b) {
 if(!a||!b||a.id===b.id) return {error:'Choose two different saved snapshots.'};
 if(a.start>b.start) [a,b]=[b,a];
 if(a.end>=b.start) return {error:'These date ranges overlap. Choose non-overlapping periods to avoid counting the same dates twice.'};
 if(a.data.currency!==b.data.currency) return {error:'Currencies differ. Waddle cannot compare or convert them.'};
 if(a.data.source!==b.data.source || a.data.valueKind!==b.data.valueKind) return {error:'The sources or value definitions differ. Choose reports with matching source and value type.'};
 const days=s=>(Date.parse(s.end+'T00:00:00Z')-Date.parse(s.start+'T00:00:00Z'))/86400000+1;
 if(days(a)!==days(b))return {error:'These periods have different lengths. Save equal-length reporting periods for a fairer comparison.'};
 for(const s of [a,b]) {const c=dateCoverage(s.data.records,s.start,s.end);if(c.recordedDays!==days(s) || s.data.records.some(r=>r.date<s.start||r.date>s.end))return {error:'At least one period has missing dates or rows outside its selected window. A recorded date still does not prove the export is complete.'};}
 if(a.data.currencyCheckVersion!==1 || b.data.currencyCheckVersion!==1) return {error:'At least one snapshot predates currency-symbol checks. Its data remains saved, but the original currency markers cannot be verified; reimport the original reports and save new snapshots to compare safely.'};
 const coverage=comparisonCoverage(a.data.records,b.data.records,days(a),[a.data,b.data]);
 if(!coverage.safe)return {error:[...coverage.reasons,...coverage.differences.slice(0,5)].join(' ')};
 const definitionA=normalizeDefinition(a.data.conversionDefinition),definitionB=normalizeDefinition(b.data.conversionDefinition);
 if(definitionA!=='unknown'&&definitionB!=='unknown'&&definitionA!==definitionB)return {error:'Conversion definitions differ between snapshots. Choose snapshots with matching definitions.'};
 const unknownDefinition=definitionA==='unknown'||definitionB==='unknown';
 const old=summarize(a.data.records), recent=summarize(b.data.records);
 const complete=(s,k)=>s.count>0&&s[`${k}Coverage`]===s.count;
 const metrics=['spend','revenue','conversions','clicks','impressions'].filter(k=>complete(old,k)&&complete(recent,k)&&!(unknownDefinition&&(k==='conversions'||(k==='revenue'&&a.data.valueKind==='conversion'))));
 const cpc=!unknownDefinition&&complete(old,'spend')&&complete(recent,'spend')&&complete(old,'conversions')&&complete(recent,'conversions')&&old.conversions>0&&recent.conversions>0&&[...a.data.records,...b.data.records].every(r=>r.spend>=0&&r.conversions>=0);
 if(!metrics.length)return {error:unknownDefinition?'No safely comparable metrics remain. Confirm the conversion definition for each original report and save new snapshots.':'No shared metric has values on every row in both snapshots.'};
 return {a,b,old,recent,metrics,cpc,conversionWarning:unknownDefinition?'Conversion definitions are not confirmed on both snapshots. Conversion counts, cost per conversion and platform-reported conversion value are withheld from this comparison.':''};
}
