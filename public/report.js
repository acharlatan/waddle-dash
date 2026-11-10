// Report excerpts carry their own context so a later date selection cannot relabel them.
export function reportSourceLabel(source) {
 return source==='google'?'Google Ads-style report':source==='demo'?'Fictional demo report':
  ['custom','other'].includes(source)?'Custom / other CSV':'Source not recorded';
}

export function reportProvenance({name,source,goal,currency,conversion,conversionConfirmed,example},period) {
 const file=name||'Unnamed report', dates=period?.start&&period?.end?`${period.start} – ${period.end}`:'Period not recorded';
 const definition=conversion ? `${conversion} (${example?'fictional example definition':conversionConfirmed?'user confirmed':'definition unconfirmed'})` : 'Conversion values unavailable in this selection';
 return `${example?'FICTIONAL DEMO · ':''}${file} · ${reportSourceLabel(source)} · ${dates} · Goal: ${goal||'not recorded'} · Currency: ${currency||'not recorded'} · ${definition}`;
}

export function briefingExcerpt(items, provenance) {
 const changed=items.find(item=>item.section==='What changed');
 const clue=items.find(item=>item.section==='Worth a closer look'&&item.title.startsWith('Look at '));
 const selected=[changed,clue].filter(Boolean);
 if(!selected.length)return '';
 return [`From Waddle Briefing · ${provenance}`,...selected.map(item=>`${item.section} — ${item.title}\n${item.body}\nLimit: ${item.limit}`)].join('\n\n');
}

export function planExcerpt(planText,caseContext,example=false) {
 if(!String(planText||'').trim())return '';
 const p=caseContext?.selectedPeriod;
 const original=p?.start&&p?.end?`Original case period: ${p.start} – ${p.end}.`:'Original case period was not recorded.';
 const earlier=caseContext?.earlierPeriod?.start&&caseContext?.earlierPeriod?.end?` Earlier comparison: ${caseContext.earlierPeriod.start} – ${caseContext.earlierPeriod.end}.`:'';
 const identity=caseContext?.campaign||caseContext?.channel?` ${[caseContext.campaign,caseContext.channel].filter(Boolean).join(' · ')}.`:'';
 return `${example?'FICTIONAL DEMO · ':''}Plan from My Work · ${original}${earlier}${identity}\n${planText}`;
}

export function appendReportText(existing,text) {
 return [existing,text].filter(value=>String(value||'').trim()).join('\n\n');
}

// A direct return is safe only while one unchanged, identifiable case was added.
export function caseReportDestination(report) {
 const type=typeof report?.investigation==='string'&&report.investigation.trim()&&['expensive','spending','results'].includes(report.investigationCaseType)?report.investigationCaseType:'';
 return type?{href:'#mystery',label:'Return to added case',caseType:type}:{href:'#mystery',label:'Open Mystery Lab'};
}

// Default new reports to available goal-relevant metrics. Existing explicit choices,
// and the original all-available default on older saved reports, remain intact.
export function reportMetricSelection(report, summary, goalKeys, legacy=false) {
 const keys=['spend','revenue','conversions','clicks','impressions','cpc','ctr','cvr','roas'];
 const hasChoices=keys.some(key=>Object.hasOwn(report||{},`include_${key}`));
 const defaults=new Set(legacy||hasChoices?keys:goalKeys);
 return Object.fromEntries(keys.map(key=>[`include_${key}`,report?.[`include_${key}`]??(defaults.has(key)&&summary[key]!==null&&summary[key]!==undefined)]));
}

// An explicit selection chooses which briefing observations are appended.
export function selectedBriefingExcerpt(items, provenance, selectedSections) {
 const allowed=new Set(selectedSections||[]);
 return briefingExcerpt(items.filter(item=>allowed.has(item.section)),provenance);
}

// Surface only an observation already produced by the rule-based Briefing.
export function reportLeadSuggestion(items) {
 return (items || []).find(item => item.section === 'Worth a closer look' && item.title?.startsWith('Look at ')) || (items || []).find(item => item.section === 'What changed') || null;
}
