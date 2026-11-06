import {summarize, comparisonCoverage, dateCoverage, parseDate} from './analytics.js';
import {normalizeDefinition} from './marketing.js';
export {STORAGE_KEY} from './archive.js';
export function makeSnapshot({records,data,name,goal,plan,report,caseType,start,end}) {
 if(!records.length) throw new Error('There are no records in the selected period to save.');
 const dates=records.map(r=>r.date).sort();
 return {id:globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,savedAt:new Date().toISOString(),name,goal,plan:{...plan},report:{...report},caseType:caseType||'',data:{...data,records:records.map(r=>({...r}))},start:start||dates[0],end:end||dates.at(-1),status:'planned',notes:''};
}
// Restore into memory only; never mutate or repair the persisted legacy snapshot.
export function snapshotDataForSession(snapshot){
 const data=structuredClone(snapshot?.data);
 if(!data||!Array.isArray(data.records)||!data.records.length)throw Error('This snapshot has no readable records. It has not been changed.');
 if(!['USD','CAD','AUD','EUR','GBP','PHP'].includes(data.currency))throw Error('This snapshot has no supported recorded currency. View its saved plan here or reimport the original report; it has not been changed.');
 if(data.records.some(r=>Number.isFinite(r.revenue))&&!['revenue','conversion'].includes(data.valueKind))throw Error('This snapshot does not say what its recorded value means. View its saved plan here or reimport the original report; it has not been changed.');
 const unknown=!Array.isArray(data.errors)||!Number.isInteger(data.duplicates)||!!data.qualityUnknown;
 if(!Array.isArray(data.errors))data.errors=[];if(!Number.isInteger(data.duplicates))data.duplicates=0;
 if(unknown)data.qualityUnknown=true;
 data.records.sort((a,b)=>a.date.localeCompare(b.date));return data;
}
export function compareSnapshots(a,b) {
 if(!a||!b||a.id===b.id) return {error:'Choose two different saved snapshots.'};
 if(!a.data||!b.data||!Array.isArray(a.data.records)||!Array.isArray(b.data.records))return {error:'A saved report is unreadable. Its data has not been changed.'};
 if(![a.start,a.end,b.start,b.end].every(d=>typeof d==='string'&&parseDate(d)===d)||a.start>a.end||b.start>b.end)return {error:'At least one report has an invalid or missing reporting period.'};
 if(a.start>b.start) [a,b]=[b,a];
 if(a.end>=b.start) return {error:'These date ranges overlap. Choose non-overlapping periods to avoid counting the same dates twice.'};
 if(!a.data.currency||!b.data.currency||!a.data.source||!b.data.source||!a.data.valueKind||!b.data.valueKind)return {error:'A report is missing its source, currency, or value meaning. Reimport the original report before comparing.'};
 if(a.data.currency!==b.data.currency) return {error:'Currencies differ. Waddle cannot compare or convert them.'};
 if(a.data.source!==b.data.source || a.data.valueKind!==b.data.valueKind) return {error:'The sources or value definitions differ. Choose reports with matching source and value type.'};
 const days=s=>(Date.parse(s.end+'T00:00:00Z')-Date.parse(s.start+'T00:00:00Z'))/86400000+1;
 if(days(a)!==days(b))return {error:'These periods have different lengths. Save equal-length reporting periods for a fairer comparison.'};
 for(const s of [a,b]) {const c=dateCoverage(s.data.records,s.start,s.end);if(c.recordedDays!==days(s) || s.data.records.some(r=>r.date<s.start||r.date>s.end))return {error:'At least one period has missing dates or rows outside its selected window. A recorded date still does not prove the export is complete.'};}
 if(a.data.currencyCheckVersion!==1 || b.data.currencyCheckVersion!==1) return {error:'At least one snapshot predates currency-symbol checks. Its data remains saved, but the original currency markers cannot be verified; reimport the original reports and save new snapshots to compare safely.'};
 if([a.data,b.data].some(d=>d.qualityUnknown||!Array.isArray(d.errors)||!Number.isInteger(d.duplicates)))return {error:'A report is missing its import quality history. Reimport the original reports before comparing; existing snapshots remain unchanged.'};
 const coverage=comparisonCoverage(a.data.records,b.data.records,days(a),[a.data,b.data]);
 if(!coverage.safe)return {error:[...coverage.reasons,...coverage.differences.slice(0,5)].join(' ')};
 const definitionA=normalizeDefinition(a.data.conversionDefinition),definitionB=normalizeDefinition(b.data.conversionDefinition);
 if(definitionA!=='unknown'&&definitionB!=='unknown'&&definitionA!==definitionB)return {error:'Conversion definitions differ between snapshots. Choose snapshots with matching definitions.'};
 const unknownDefinition=definitionA==='unknown'||definitionB==='unknown';
 const old=summarize(a.data.records), recent=summarize(b.data.records);
 const complete=(s,k)=>s.count>0&&s[`${k}Coverage`]===s.count;
 const metrics=['spend','revenue','conversions','clicks','impressions'].filter(k=>complete(old,k)&&complete(recent,k)&&[...a.data.records,...b.data.records].every(r=>r[k]>=0)&&!(unknownDefinition&&(k==='conversions'||(k==='revenue'&&a.data.valueKind==='conversion'))));
 const cpc=!unknownDefinition&&complete(old,'spend')&&complete(recent,'spend')&&complete(old,'conversions')&&complete(recent,'conversions')&&old.conversions>0&&recent.conversions>0&&[...a.data.records,...b.data.records].every(r=>r.spend>=0&&r.conversions>=0);
 if(!metrics.length)return {error:unknownDefinition?'No safely comparable metrics remain. Confirm the conversion definition for each original report and save new snapshots.':'No shared metric has complete non-negative values on every row in both snapshots.'};
 return {a,b,old,recent,metrics,cpc,conversionWarning:unknownDefinition?'Conversion definitions are not confirmed on both snapshots. Conversion counts, cost per conversion and platform-reported conversion value are withheld from this comparison.':''};
}
