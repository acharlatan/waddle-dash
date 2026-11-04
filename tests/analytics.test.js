import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV, parseDate, parseNumber, suggestMapping, normalizeData, summarize, filterPeriod, groupBy, percentChange} from '../public/analytics.js';

test('quoted fields, escaped quotes, newlines and BOM survive CSV import', () => {
  const p = parseCSV('\ufeffDate,Channel,Campaign,Spend,Revenue,Conversions\r\n2026-01-01,"Paid, Search","A ""good""\nname","1,200",2400,12\r\n');
  assert.equal(p.rows[0][1], 'Paid, Search'); assert.equal(p.rows[0][2], 'A "good"\nname');
  const data = normalizeData(p, suggestMapping(p.headers)); assert.equal(data.records[0].spend,1200); assert.equal(data.records[0].revenue,2400);
});
test('rejects invalid dates, numbers and mismatched currencies rather than inventing data', () => {
  assert.equal(parseDate('2026-02-30'),null); assert.equal(parseDate('12/31/2026'),'2026-12-31'); assert.ok(Number.isNaN(parseNumber('12%')));
  const p=parseCSV('date,channel,spend,currency\n2026-01-01,Search,10,PHP');
  assert.throws(()=>normalizeData(p,suggestMapping(p.headers),'USD'),/currency/);
});
test('coverage and zero are distinct, and ROAS requires complete paired data and positive spend',()=>{
 const totals=summarize([{spend:10,revenue:20,conversions:0},{spend:null,revenue:5,conversions:null}]);
 assert.equal(totals.spend,10); assert.equal(totals.conversions,0); assert.equal(totals.roas,null);
 assert.equal(summarize([{spend:10,revenue:25,conversions:null}]).roas,2.5);
 assert.equal(summarize([{spend:0,revenue:25,conversions:null}]).roas,null);
});
test('date windows anchor to latest date and compare equal prior period',()=>{
 const rows=['2026-01-01','2026-01-02','2026-01-03','2026-01-04'].map(date=>({date,spend:1,revenue:2,conversions:1,channel:'Search'}));
 const f=filterPeriod(rows,2);assert.deepEqual(f.current.map(r=>r.date),['2026-01-03','2026-01-04']); assert.equal(f.previous.length,2); assert.equal(groupBy(rows,'channel')[0].revenue,8);assert.equal(percentChange(20,10),100);assert.equal(percentChange(20,0),null);
});
test('bad rows are counted and displayed; duplicate mappings are rejected',()=>{
 const p=parseCSV('date,channel,spend\n2026-01-01,Email,10\nnot-a-date,Email,20');const m=suggestMapping(p.headers);const x=normalizeData(p,m);assert.equal(x.records.length,1);assert.equal(x.errors[0].reason,'invalid date');assert.throws(()=>normalizeData(p,{...m,revenue:m.spend}),/only be mapped once/);
});
test('Google Ads-style report uses a user-specified channel and excludes identifiable summary rows',()=>{
 const p=parseCSV('Day,Campaign,Cost,Conversions,Conv. value\n2026-10-01,Autumn,100,8,400\n2026-10-01,Total: Account,100,8,400');
 const m={...suggestMapping(p.headers),revenue:4};const x=normalizeData(p,m,'USD',{defaultChannel:'Google Ads — Search'});
 assert.equal(x.records.length,1);assert.equal(x.records[0].channel,'Google Ads — Search');assert.equal(x.errors[0].reason,'summary row (excluded)');assert.equal(summarize(x.records).revenue,400);
});
test('duplicate records are warned about and not removed automatically',()=>{
 const p=parseCSV('Date,Channel,Spend\n2026-10-01,Search,10\n2026-10-01,Search,10');const x=normalizeData(p,suggestMapping(p.headers));assert.equal(x.duplicates,1);assert.equal(x.records.length,2);
});
test('click and impression columns import without manufacturing revenue or spend',()=>{
 const p=parseCSV('Day,Channel,Clicks,Impr.\n2026-10-01,Display,22,900');const x=normalizeData(p,suggestMapping(p.headers));const sum=summarize(x.records);assert.equal(sum.clicks,22);assert.equal(sum.impressions,900);assert.equal(sum.revenue,null);assert.equal(sum.roas,null);
});
