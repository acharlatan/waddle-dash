// CSV and metric operations are intentionally independent of the UI.
export const METRICS = ['spend', 'revenue', 'conversions', 'clicks', 'impressions'];
const ALIASES = {
  date: ['date', 'day', 'report date', 'reporting date', 'start date'],
  channel: ['channel', 'marketing channel', 'source', 'platform', 'source medium'],
  campaign: ['campaign', 'campaign name', 'campaign title', 'campaign id'],
  spend: ['spend', 'cost', 'amount spent', 'ad spend', 'advertising cost', 'total spend'],
  revenue: ['revenue', 'sales', 'total revenue'],
  conversions: ['conversions', 'conversion', 'purchases', 'orders', 'total conversions'],
  clicks: ['clicks', 'click'],
  impressions: ['impressions', 'impr'],
  currency: ['currency', 'currency code', 'account currency']
};
const cleanHeader = s => String(s).toLowerCase().replace(/^\ufeff/, '').replace(/[^a-z0-9]+/g, ' ').trim();
export function suggestMapping(headers) {
  const used = new Set(), result = {};
  for (const [field, choices] of Object.entries(ALIASES)) {
    const i = headers.findIndex((h, n) => !used.has(n) && choices.includes(cleanHeader(h)));
    result[field] = i;
    if (i >= 0) used.add(i);
  }
  return result;
}
// Parse logical CSV records, preserving quoted commas, escaped quotes and multiline fields.
// Record numbers refer to nonempty CSV records, not physical lines.
export function parseCSVRows(input) {
  const text = String(input).replace(/^\ufeff/, '');
  const rows = []; let row = [], field = '', quoted = false, afterQuote = false;
  const finish = () => { row.push(field); if (row.some(c => c.trim() !== '')) rows.push(row); row = []; field = ''; afterQuote = false; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; afterQuote = true; }
      else field += ch;
    } else if (ch === '"' && field.length === 0 && !afterQuote) quoted = true;
    else if (ch === ',') { row.push(field); field = ''; afterQuote = false; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; finish(); }
    else if (afterQuote && !/\s/.test(ch)) throw new Error('The CSV contains unexpected characters after a closing quote.');
    else if (!afterQuote) field += ch;
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted field.');
  finish();
  if (rows.length < 2) throw new Error('Add a header row and at least one data record to your CSV.');
  // Allow at most 100 introductory records in addition to the existing 30,000 data limit.
  if (rows.length > 30101) throw new Error('This file has more than 30,000 data records plus 100 introductory records. Please split it into smaller files.');
  return rows;
}
export function suggestHeaderRow(rows) {
  let best = 0, bestScore = 0;
  for (const [i,row] of rows.slice(0,100).entries()) {
    const m = suggestMapping(row);
    const n = METRICS.filter(k => m[k] >= 0).length;
    const score = (m.date >= 0 ? 5 : 0) + n * 2 + (m.channel >= 0 ? 1 : 0) + (m.campaign >= 0 ? 1 : 0);
    if (m.date >= 0 && n && score > bestScore) { best = i; bestScore = score; }
  }
  return best;
}
export function selectCSVHeader(allRows, headerRow=0) {
  if (!Number.isInteger(headerRow) || headerRow < 0 || headerRow >= Math.min(allRows.length - 1,100)) throw new Error('Choose a header record with at least one record after it.');
  const headers = allRows[headerRow].map((h,i) => h.trim() || `Column ${i + 1}`);
  if (headers.length > 150) throw new Error('This file has more than 150 columns. Please remove unnecessary columns.');
  const rows = allRows.slice(headerRow + 1);
  if (rows.length > 30000) throw new Error('This file has more than 30,000 data records. Please split it into smaller files.');
  return {headers, rows, headerRow};
}
export function parseCSV(input, headerRow=0) { return selectCSVHeader(parseCSVRows(input), headerRow); }
export function looksLikeContactList(headers) {
  const names = headers.map(cleanHeader);
  const contacts = ['email','email address','first name','last name','contact id','lifecycle stage','lead status'].filter(k=>names.includes(k)).length;
  const mapping = suggestMapping(headers);
  return contacts >= 2 && !METRICS.some(k=>mapping[k]>=0);
}
export function parseDate(value) {
  const s = String(value || '').trim(); let y, m, d;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) [, y, m, d] = match;
  else { match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (!match) return null; [, m, d, y] = match; }
  y = Number(y); m = Number(m); d = Number(d);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || y > 2100 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}
const DOLLAR_CURRENCIES = ['USD','CAD','AUD'];
// Markers can coexist only when they agree. A bare $ is ambiguous across dollar currencies.
export function monetaryMarkers(value) {
  const text = String(value ?? ''); const allowed = [];
  const specific = /(?<![A-Za-z])(?:USD|CAD|AUD|EUR|GBP|PHP)(?![A-Za-z])|US\$|CA\$|C\$|AU\$|A\$|€|£|₱|\$/gi;
  let m; while ((m = specific.exec(text))) {
    const token = m[0].toUpperCase();
    allowed.push(token==='$' ? DOLLAR_CURRENCIES : token==='€' ? ['EUR'] : token==='£' ? ['GBP'] : token==='₱' ? ['PHP'] : token==='US$' ? ['USD'] : ['CA$','C$'].includes(token) ? ['CAD'] : ['AU$','A$'].includes(token) ? ['AUD'] : [token]);
  }
  const unknown = text.match(/(?<![A-Za-z])[A-Za-z]{3,}(?![A-Za-z])/g)?.filter(x=>!['USD','CAD','AUD','EUR','GBP','PHP'].includes(x.toUpperCase())) || [];
  return {allowed, unknown};
}
export function parseNumber(value) {
  let s = String(value ?? '').trim(); if (!s) return null;
  const negative = /^\(.*\)$/.test(s); if (negative) s = s.slice(1,-1);
  s = s.replace(/(?<![A-Za-z])(?:USD|CAD|AUD|EUR|GBP|PHP)(?![A-Za-z])|US\$|CA\$|C\$|AU\$|A\$|[$€£₱\s]/gi, '');
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(s)) return NaN;
  s = s.replace(/,/g, '');
  const n = Number(s); return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : NaN;
}
export function normalizeData(parsed, mapping, currency = 'USD', options = {}) {
  const fields = Object.values(mapping).filter(x => Number.isInteger(x) && x >= 0);
  if (new Set(fields).size !== fields.length) throw new Error('Each selected column can only be mapped once.');
  if (!Number.isInteger(mapping.date) || mapping.date < 0 || (!(mapping.channel >= 0) && !String(options.defaultChannel || '').trim()) || !METRICS.some(x => mapping[x] >= 0)) {
    if (looksLikeContactList(parsed.headers)) throw new Error('This looks like a contact or lead list. Waddle needs a dated campaign-performance report with at least one numeric metric; map compatible columns if available, or export a performance report.');
    throw new Error('Choose a date, a channel or assigned source, and at least one numeric metric (spend, value, conversions, clicks or impressions).');
  }
  if (!['USD','CAD','AUD','EUR','GBP','PHP'].includes(currency)) throw new Error('Choose a reporting currency. Waddle cannot infer the meaning of an ambiguous $ symbol or convert currencies.');
  const extraIndex=parsed.rows.findIndex(row=>row.length>parsed.headers.length);
  if(extraIndex>=0) throw new Error(`CSV record ${(parsed.headerRow||0)+extraIndex+2} has more fields than the selected header. Choose the correct header or fix extra delimiters (quote numbers containing commas) before importing.`);
  const records=[], errors=[], seen=new Set(); let duplicates=0, evidenceCount=0, ambiguousDollar=false;
  for (let index=0; index<parsed.rows.length; index++) {
    const raw=parsed.rows[index]; const signature=JSON.stringify(raw); if (seen.has(signature)) duplicates++; else seen.add(signature);
    const get=field=>mapping[field]>=0 ? String(raw[mapping[field]] ?? '').trim() : '';
    const recordNo=(parsed.headerRow || 0)+index+2;
    const rowCurrency=get('currency').toUpperCase();
    if (rowCurrency) { evidenceCount++; if (!/^[A-Z]{3}$/.test(rowCurrency) || rowCurrency!==currency) throw new Error(`Currency conflict at CSV record ${recordNo}: currency column says ${rowCurrency.slice(0,20)}, but ${currency} is selected. Use one currency per file; no conversion is performed.`); }
    for (const field of ['spend','revenue']) {
      const text=get(field); if (!text) continue;
      const found=monetaryMarkers(text);
      if (found.unknown.length) throw new Error(`Unrecognized currency marker at CSV record ${recordNo} in ${field}: ${found.unknown[0].slice(0,20)}. Use a supported code or remove the marker after verifying the currency.`);
      for (const allowed of found.allowed) { evidenceCount++; if (allowed.length>1) ambiguousDollar=true; if (!allowed.includes(currency)) throw new Error(`Currency conflict at CSV record ${recordNo} in ${field}: the amount's currency does not match ${currency}. Check the currency symbol or code; Waddle cannot combine or convert currencies.`); }
    }
    const date=parseDate(get('date')), channel=get('channel') || (mapping.channel<0 ? String(options.defaultChannel || '').trim() : '');
    const summaryRow=raw.some(cell=>/^(?:grand\s+total|account\s+total|campaign\s+total|total(?:\s*[:\-]|\s+campaigns\s*$|\s*$)|all\s+campaigns$|all\s+channels$)/i.test(String(cell).trim()));
    const values=Object.fromEntries(METRICS.map(k=>[k,mapping[k]>=0 ? parseNumber(get(k)) : null]));
    const reason=summaryRow ? 'summary row (excluded)' : !date ? 'invalid date' : !channel ? 'missing channel' : METRICS.some(k=>Number.isNaN(values[k])) ? 'invalid number' : METRICS.every(k=>values[k]===null) ? 'no metric values' : null;
    if (reason) { errors.push({record:index+1,csvRecord:recordNo,reason}); continue; }
    records.push({date,channel:channel.slice(0,160),campaign:get('campaign').slice(0,160),...values});
  }
  if (!records.length) throw new Error('No usable rows found. Review the header, mappings, date format (YYYY-MM-DD or MM/DD/YYYY), and numeric values.');
  records.sort((a,b)=>a.date.localeCompare(b.date));
  const currencyNote=!evidenceCount ? `No currency markers were found; ${currency} is user-selected and cannot be verified from the file.` : ambiguousDollar ? `A bare $ can represent USD, CAD or AUD. You selected ${currency}; Waddle cannot verify which dollar currency the file means.` : `Explicit currency markers are consistent with ${currency}; Waddle does not convert currencies.`;
  return {records, errors, currency, duplicates, mapped:Object.fromEntries(METRICS.map(k=>[k,mapping[k]>=0])),currencyCheckVersion:1,currencyNote};
}
export function summarize(rows) {
  const result = {count:rows.length};
  for (const key of METRICS) {
    const values = rows.map(r => r[key]).filter(n => n !== null && Number.isFinite(n));
    result[key] = values.length ? values.reduce((a, b) => a + b, 0) : null;
    result[`${key}Coverage`] = values.length;
  }
  result.roas = result.revenue !== null && result.spend !== null && result.spend > 0 && result.revenueCoverage === rows.length && result.spendCoverage === rows.length ? result.revenue / result.spend : null;
  return result;
}
export function addDays(iso, days) { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
export function filterPeriod(rows, days) {
  if (!rows.length) return {current:[], previous:[], start:null, end:null};
  const end = rows[rows.length-1].date;
  const start = days === 'all' ? rows[0].date : addDays(end, -(Number(days)-1));
  const current = rows.filter(r=>r.date>=start && r.date<=end);
  const previous = days === 'all' ? [] : rows.filter(r=>r.date>=addDays(start,-Number(days)) && r.date<start);
  return {current, previous, start, end};
}
export function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) { const label = row[key] || (key === 'campaign' ? 'Unassigned campaign' : 'Unknown'); if (!groups.has(label)) groups.set(label, []); groups.get(label).push(row); }
  return [...groups].map(([label, records]) => ({label, ...summarize(records)})).sort((a,b) => (b.revenue ?? -Infinity) - (a.revenue ?? -Infinity) || a.label.localeCompare(b.label));
}
export function percentChange(current, previous) {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous) * 100;
}

// Date coverage is evidence of recorded rows only, never proof of a complete export.
export function dateCoverage(rows, start, end) {
  const days = start && end ? Math.floor((Date.parse(end+'T00:00:00Z') - Date.parse(start+'T00:00:00Z')) / 86400000) + 1 : 0;
  const observed = new Set(rows.map(r=>r.date).filter(d=>d>=start && d<=end));
  const dates=[...observed].sort(),missingDays=Math.max(0,days-observed.size),missingDates=[];
  if(missingDays && start && end){const cursor=new Date(start+'T00:00:00Z'),last=Date.parse(end+'T00:00:00Z');while(cursor.getTime()<=last&&missingDates.length<14){const iso=cursor.toISOString().slice(0,10);if(!observed.has(iso))missingDates.push(iso);cursor.setUTCDate(cursor.getUTCDate()+1)}}
  return {days:Math.max(0,days),recordedDays:observed.size,missingDays,missingDates,first:dates[0]||null,last:dates.at(-1)||null};
}
export function comparisonCoverage(previous, current, days, datasets=[]) {
  const reasons=[], differences=[];
  if (!Number.isFinite(Number(days)) || Number(days)<1 || !previous.length || !current.length) return {safe:false,reasons:['Two equal date windows with recorded data are needed.'],differences};
  const n=Number(days), prevDates=new Set(previous.map(r=>r.date)), curDates=new Set(current.map(r=>r.date));
  if(datasets.some(d=>(d?.errors||[]).some(e=>e.reason!=='summary row (excluded)'))) reasons.push('The import excluded invalid records, so period totals may be incomplete. Correct the source file and reimport to compare safely.');
  if(datasets.some(d=>(d?.duplicates||0)>0)) reasons.push('The import retained exact duplicate records; review and remove any unintended duplicates before comparing.');
  if (prevDates.size!==n || curDates.size!==n) reasons.push('Both periods need recorded rows on every date; days without rows are not treated as zero.');
  // Channel + campaign preserves distinct names across channels; unassigned campaigns are never invented.
  const group=rows=>{const map=new Map();for(const row of rows){const channel=String(row.channel||'').trim(), campaign=String(row.campaign||'').trim();const key=JSON.stringify([channel,campaign]);if(!map.has(key))map.set(key,{channel,campaign,dates:new Set()});map.get(key).dates.add(row.date)}return map};
  const a=group(previous),b=group(current);
  for(const key of new Set([...a.keys(),...b.keys()])){
    const old=a.get(key),recent=b.get(key),g=old||recent;
    const label=g.campaign ? `${g.campaign} (${g.channel||'unknown channel'})` : `${g.channel||'Unknown channel'} (campaign not specified)`;
    if(!old||!recent) differences.push(`${label}: ${!old?'not recorded in the earlier period':'not recorded in the later period'}`);
    else if(old.dates.size!==n||recent.dates.size!==n) differences.push(`${label}: rows recorded on ${old.dates.size}/${n} earlier days and ${recent.dates.size}/${n} later days`);
  }
  if(differences.length) reasons.push('Campaign or channel coverage differs or is incomplete. Missing rows are not zeros: the difference could reflect an export filter, a new or paused campaign, or another cause.');
  if([...previous,...current].some(r=>!String(r.campaign||'').trim()) && [...previous,...current].some(r=>String(r.campaign||'').trim())) reasons.push('Some records have campaign names and others do not, so campaign coverage cannot be verified.');
  return {safe:reasons.length===0,reasons,differences};
}
