// CSV and metric operations are intentionally independent of the UI.
export const METRICS = ['spend', 'revenue', 'conversions'];
const ALIASES = {
  date: ['date', 'day', 'report date', 'reporting date', 'start date'],
  channel: ['channel', 'marketing channel', 'source', 'platform', 'source medium'],
  campaign: ['campaign', 'campaign name', 'campaign title', 'campaign id'],
  spend: ['spend', 'cost', 'amount spent', 'ad spend', 'advertising cost', 'total spend'],
  revenue: ['revenue', 'conversion value', 'conversions value', 'purchase value', 'sales', 'total revenue', 'conversion revenue'],
  conversions: ['conversions', 'conversion', 'purchases', 'orders', 'total conversions'],
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
export function parseCSV(input) {
  const text = String(input).replace(/^\ufeff/, '');
  const rows = []; let row = [], field = '', quoted = false, afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; afterQuote = true; }
      else field += ch;
    } else if (ch === '"' && field.length === 0 && !afterQuote) quoted = true;
    else if (ch === ',') { row.push(field); field = ''; afterQuote = false; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(c => c.trim() !== '')) rows.push(row);
      row = []; field = ''; afterQuote = false;
    } else if (afterQuote && !/\s/.test(ch)) throw new Error('The CSV contains unexpected characters after a closing quote.');
    else if (!afterQuote) field += ch;
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted field.');
  row.push(field); if (row.some(c => c.trim() !== '')) rows.push(row);
  if (rows.length < 2) throw new Error('Add a header row and at least one data row to your CSV.');
  if (rows.length > 30001) throw new Error('This file has more than 30,000 data rows. Please split it into smaller files.');
  const headers = rows.shift().map((h, i) => h.trim() || `Column ${i + 1}`);
  if (headers.length > 150) throw new Error('This file has more than 150 columns. Please remove unnecessary columns.');
  return {headers, rows};
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
export function parseNumber(value) {
  let s = String(value ?? '').trim(); if (!s) return null;
  const negative = /^\(.*\)$/.test(s); if (negative) s = s.slice(1, -1);
  s = s.replace(/[$€£₱\s]/g, '');
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(s)) return NaN;
  s = s.replace(/,/g, '');
  const n = Number(s); return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : NaN;
}
export function normalizeData(parsed, mapping, currency = 'USD') {
  const fields = Object.values(mapping).filter(x => Number.isInteger(x) && x >= 0);
  if (new Set(fields).size !== fields.length) throw new Error('Each selected column can only be mapped once.');
  if (mapping.date < 0 || mapping.channel < 0 || !METRICS.some(x => mapping[x] >= 0)) throw new Error('Please select a date, a channel, and at least one metric.');
  const records = [], errors = []; let mismatch = 0;
  for (let index = 0; index < parsed.rows.length; index++) {
    const raw = parsed.rows[index]; const get = field => mapping[field] >= 0 ? (raw[mapping[field]] ?? '').trim() : '';
    const date = parseDate(get('date')), channel = get('channel');
    const values = Object.fromEntries(METRICS.map(k => [k, mapping[k] >= 0 ? parseNumber(get(k)) : null]));
    const rowCurrency = get('currency').toUpperCase();
    if (rowCurrency && rowCurrency !== currency) mismatch++;
    const reason = !date ? 'invalid date' : !channel ? 'missing channel' : METRICS.some(k => Number.isNaN(values[k])) ? 'invalid number' : METRICS.every(k => values[k] === null) ? 'no metric values' : null;
    if (reason) { errors.push({record: index + 1, reason}); continue; }
    records.push({date, channel:channel.slice(0, 160), campaign:get('campaign').slice(0, 160), ...values});
  }
  if (mismatch) throw new Error(`${mismatch} row(s) have a currency that does not match ${currency}. Use a single currency and select it above.`);
  if (!records.length) throw new Error('No usable rows found. Check your column choices, dates (YYYY-MM-DD or MM/DD/YYYY), and numbers.');
  records.sort((a,b) => a.date.localeCompare(b.date));
  return {records, errors, currency, mapped: Object.fromEntries(METRICS.map(k => [k, mapping[k] >= 0]))};
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
