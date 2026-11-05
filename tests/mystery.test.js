import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPeriod} from '../public/analytics.js';
import {investigate} from '../public/mystery.js';
const rows=Array.from({length:14},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,channel:'Search',campaign:'Autumn',spend:i<7?10:20,conversions:i<7?2:1}));
test('compares equal windows with complete evidence',()=>{const r=investigate('expensive',filterPeriod(rows,'7'),'7');assert.equal(r.previous.spend,70);assert.equal(r.current.spend,140);assert.equal(r.previous.conversions,14);assert.equal(r.current.conversions,7)});
test('blocks missing days and missing metrics instead of inventing values',()=>{assert.match(investigate('results',filterPeriod(rows.slice(1),'7'),'7').error,/every day/);const copy=rows.map(x=>({...x}));copy[10].spend=null;assert.match(investigate('expensive',filterPeriod(copy,'7'),'7').error,/spend/)});
test('zero conversions cannot produce cost per conversion',()=>{const copy=rows.map(x=>({...x,conversions:0}));assert.match(investigate('expensive',filterPeriod(copy,'7'),'7').error,/positive/)});
test('spending case requires campaign names and complete spend',()=>{const p=filterPeriod(rows,'7');assert.equal(investigate('spending',p,'7').facts[0].value,140);const copy=rows.map(x=>({...x,campaign:''}));assert.match(investigate('spending',filterPeriod(copy,'7'),'7').error,/Campaign/)});
