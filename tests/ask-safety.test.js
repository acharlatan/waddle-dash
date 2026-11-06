import test from 'node:test';
import assert from 'node:assert/strict';
import {rankChannelsByValue} from '../public/marketing.js';

const data={errors:[],duplicates:0,conversionDefinition:'purchases'};
test('channel ranking uses complete, non-negative recorded values and spend',()=>{
 const rows=[{channel:'Email',spend:100,revenue:300},{channel:'Search',spend:200,revenue:800}];
 assert.equal(rankChannelsByValue(rows,data,'roas').top.label,'Search');
 assert.equal(rankChannelsByValue(rows,data,'roas').top.roas,4);
 assert.equal(rankChannelsByValue(rows,data,'revenue').top.revenue,800);
});
test('channel ranking pauses for negative, missing, or zero-denominator inputs',()=>{
 assert.match(rankChannelsByValue([{channel:'Email',spend:-10,revenue:20},{channel:'Email',spend:110,revenue:180}],data,'roas').error,/non-negative/);
 assert.match(rankChannelsByValue([{channel:'Email',spend:10,revenue:null},{channel:'Search',spend:10,revenue:50}],data,'revenue').error,/complete/);
 assert.match(rankChannelsByValue([{channel:'Email',spend:0,revenue:10}],data,'roas').error,/positive spend/);
});
test('channel ranking pauses for retained duplicates and excluded invalid rows',()=>{
 const rows=[{channel:'Email',spend:10,revenue:20}];
 assert.match(rankChannelsByValue(rows,{...data,duplicates:1},'roas').error,/duplicates/);
 assert.match(rankChannelsByValue(rows,{...data,errors:[{reason:'invalid number'}]},'revenue').error,/invalid/);
 assert.equal(rankChannelsByValue(rows,{...data,errors:[{reason:'summary row (excluded)'}]},'roas').top.roas,2);
});
