import {summarize} from './analytics.js';
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
 for(const s of [a,b]) if(new Set(s.data.records.map(r=>r.date)).size!==days(s)) return {error:'At least one period has missing dates. A recorded date still does not prove the export is complete.'};
 const old=summarize(a.data.records), recent=summarize(b.data.records);
 const complete=(s,k)=>s.count>0&&s[`${k}Coverage`]===s.count;
 const metrics=['spend','revenue','conversions','clicks','impressions'].filter(k=>complete(old,k)&&complete(recent,k));
 const cpc=complete(old,'spend')&&complete(recent,'spend')&&complete(old,'conversions')&&complete(recent,'conversions')&&old.conversions>0&&recent.conversions>0;
 if(!metrics.length)return {error:'No shared metric has values on every row in both snapshots.'};
 return {a,b,old,recent,metrics,cpc};
}
