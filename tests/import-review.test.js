import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCSV,parseCSVRows,selectCSVHeader,suggestHeaderRow,suggestMapping,normalizeData} from '../public/analytics.js';
import {mappingSummary,summarizeImport,exclusionAdvice} from '../public/import-review.js';
const fixture=name=>readFileSync(new URL(`./fixtures/${name}.csv`,import.meta.url),'utf8');
const mapped=(name,options={})=>{const p=parseCSV(fixture(name)),m=suggestMapping(p.headers),d=normalizeData(p,m,'USD',options);return {p,m,d}};
test('mapping summary explains contact lists and a missing assigned source',()=>{
 const p=parseCSV(fixture('contact_list')),m=suggestMapping(p.headers),summary=mappingSummary(p,m);assert.equal(summary.contact,true);assert.ok(summary.missing.some(x=>x.includes('numeric metric')));assert.ok(summary.useful.includes('Campaign'));
 const g=parseCSV(fixture('google_ads_daily')),gm=suggestMapping(g.headers);assert.ok(mappingSummary(g,gm).missing.some(x=>x.includes('channel')));assert.equal(mappingSummary(g,gm,'Paid Search').assignedChannel,true);
});
test('valid lead report without revenue gets real date range and useful capability guidance',()=>{
 const {p,m,d}=mapped('synthetic_lead_shift',{defaultChannel:'Paid Search'});m.revenue=-1;const clean=normalizeData(p,m,'USD',{defaultChannel:'Paid Search'}),review=summarizeImport(clean,m,'leads');assert.equal(review.first,'2026-10-01');assert.equal(review.last,'2026-10-14');assert.equal(review.coverage.recordedDays,14);assert.deepEqual(review.comparisonWindows,[7]);assert.equal(review.analyses.find(x=>x.label==='Cost per recorded conversion').state,'available');assert.equal(review.analyses.find(x=>x.label==='ROAS').state,'unavailable');
});
test('capabilities do not invent ratios from negative, zero or missing records',()=>{
 const {m,d}=mapped('import_mixed_metrics');assert.deepEqual(d.records.map(r=>r.conversions),[1.5,0,2.25]);assert.deepEqual(d.records.map(r=>r.spend),[1200.5,-20,null]);const review=summarizeImport(d,m,'unknown');assert.equal(review.analyses.find(x=>x.label==='Cost per recorded conversion').state,'unavailable');assert.equal(review.analyses.find(x=>x.label==='Conversions per click').state,'unavailable');assert.equal(review.summary.spendCoverage,2);
});
test('comparison readiness blocks invalid excluded rows, missing groups and duplicates',()=>{
 const {p,m}=mapped('synthetic_lead_shift',{defaultChannel:'Paid Search'});const d=normalizeData(p,m,'USD',{defaultChannel:'Paid Search'});assert.deepEqual(summarizeImport(d,m).comparisonWindows,[7]);const extra={...d,duplicates:1};assert.deepEqual(summarizeImport(extra,m).comparisonWindows,[]);const rows=d.records.filter(r=>!(r.campaign==='Generic Search'&&r.date>='2026-10-08'));assert.deepEqual(summarizeImport({...d,records:rows},m).comparisonWindows,[]);
});
test('all invalid records retain actionable exclusion reasons for preflight',()=>{
 const p=parseCSV('Date,Channel,Spend\nnot-a-date,Search,12\n2026-10-01,Search,12%'),m=suggestMapping(p.headers);let error;try{normalizeData(p,m,'USD')}catch(e){error=e}assert.match(error.message,/No usable rows/);assert.equal(error.excludedRecords.length,2);assert.match(exclusionAdvice(error.excludedRecords[0]),/YYYY-MM-DD/);assert.match(exclusionAdvice(error.excludedRecords[1]),/Spend/);assert.match(exclusionAdvice(error.excludedRecords[1]),/decimal point/);
});
test('metadata, quoted commas, escaped quotes and multiline records stay supported',()=>{
 const raw=parseCSVRows(fixture('metadata_header'));assert.equal(suggestHeaderRow(raw),2);assert.equal(selectCSVHeader(raw,2).headers[0],'Day');const {d}=mapped('quoted_multiline');assert.equal(d.records[0].campaign,'A "good"\ncampaign');assert.equal(d.records[0].spend,1200);
});
test('broken quotes, extra fields and mixed currency have corrective blocking errors',()=>{
 assert.throws(()=>parseCSVRows('Date,Channel,Spend\n2026-10-01,Sea"rch,12'),/unexpected quote.*whole field/i);assert.throws(()=>parseCSVRows('Date,Channel,Spend\n2026-10-01,"Search,12'),/unclosed quoted field/i);
 const p=parseCSV('Date,Channel,Spend\n2026-10-01,Search,1,200');assert.throws(()=>normalizeData(p,suggestMapping(p.headers),'USD'),/more fields.*quote numbers/i);
 const mixed=parseCSV(fixture('mixed_symbols'));assert.throws(()=>normalizeData(mixed,suggestMapping(mixed.headers),'USD'),/Currency conflict.*marker.*EUR|Currency conflict.*marker.*€/i);
});
test('summary rows are explained and exact duplicates remain visible and retained',()=>{
 const {m,d}=mapped('totals_duplicates');assert.equal(d.records.length,2);assert.equal(d.duplicates,1);assert.equal(d.errors[0].reason,'summary row (excluded)');assert.match(exclusionAdvice(d.errors[0]),/double-counting/);assert.deepEqual(summarizeImport(d,m).comparisonWindows,[]);
});

test('duplicates among excluded summaries are not falsely described as retained',()=>{
 const p=parseCSV('Date,Channel,Spend\n2026-10-01,Search,10\n2026-10-01,Total: Account,10\n2026-10-01,Total: Account,10'),m=suggestMapping(p.headers),d=normalizeData(p,m,'USD');
 assert.equal(d.records.length,1);assert.equal(d.duplicates,0);assert.equal(d.excludedDuplicates,1);assert.equal(d.errors.length,2);
});
