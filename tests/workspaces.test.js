import test from 'node:test';
import assert from 'node:assert/strict';
import {WORKSPACE_LINKS,pageFromHash,workspaceForPage,switchSessionMode,orderedAskQuestions} from '../public/workspaces.js';

test('legacy routes remain reachable and identify their parent workspace',()=>{
 const routes={overview:'home',mystery:'investigate',campaigns:'investigate',channels:'investigate',insights:'investigate',ask:'investigate',planner:'work',timeline:'work',report:'reports',guide:'settings',data:'settings'};
 for(const [route,workspace] of Object.entries(routes)){
  assert.equal(pageFromHash(`#${route}`),route);
  assert.equal(workspaceForPage(route),workspace);
 }
 assert.equal(pageFromHash('#investigate'),'investigate');
 assert.equal(pageFromHash('#work'),'work');
 assert.equal(pageFromHash('#unrecognized'),'overview');
 assert.deepEqual(WORKSPACE_LINKS.investigate.map(([page])=>page),['investigate','mystery','campaigns','channels','insights','ask']);
 assert.deepEqual(WORKSPACE_LINKS.work.map(([page])=>page),['work','planner','timeline']);
});

test('switching modes restores each session’s dataset, filters, selected campaign, and edited work',()=>{
 const personalData={records:[{campaign:'Spring',channel:'Email'}]};
 const personalPlan={noticed:'Personal edit'},personalReport={notes:'Report edit'};
 const state={mode:'personal',data:personalData,name:'Personal CSV',goal:'Leads or inquiries',days:'7',metric:'conversions',sort:'name',caseType:'results',compareA:'first',compareB:'second',compareConfirmed:true,plan:personalPlan,report:personalReport,search:'Spring',question:'changes',hasCampaignSelection:true,campaign:'Spring',campaignChannel:'Email',campaignReturn:'mystery'};
 const slots={personal:null,demo:null};
 const demo=()=>({data:{records:[{campaign:'Demo'}]},name:'Fictional demo',example:true,goal:'Leads or inquiries',days:'7',plan:{},report:{}});
 assert.equal(switchSessionMode(state,slots,'demo',demo),true);
 assert.equal(state.name,'Fictional demo');assert.equal(state.search,'');assert.equal(state.hasCampaignSelection,false);
 state.plan.noticed='Demo edit';state.search='Demo';state.question='coverage';
 assert.equal(switchSessionMode(state,slots,'personal',demo),true);
 assert.equal(state.data,personalData);assert.equal(state.plan,personalPlan);assert.equal(state.report,personalReport);
 assert.deepEqual([state.goal,state.days,state.caseType,state.search,state.question],['Leads or inquiries','7','results','Spring','changes']);
 assert.deepEqual([state.hasCampaignSelection,state.campaign,state.campaignChannel,state.campaignReturn],[true,'Spring','Email','mystery']);
 assert.deepEqual([state.compareA,state.compareB,state.compareConfirmed],['first','second',true]);
 assert.equal(switchSessionMode(state,slots,'demo',demo),true);
 assert.equal(state.plan.noticed,'Demo edit');assert.equal(state.search,'Demo');assert.equal(state.question,'coverage');
 assert.equal(switchSessionMode(state,slots,'demo',demo),false);
});

test('a new personal session does not inherit fictional data or edits',()=>{
 const state={mode:'demo',data:{records:[{campaign:'Fictional'}]},name:'Demo',plan:{noticed:'Fictional'},report:{notes:'Fictional'},search:'Demo'};
 const slots={personal:null,demo:null};
 switchSessionMode(state,slots,'personal',()=>{throw new Error('should not create a demo')});
 assert.equal(state.data,null);assert.deepEqual(state.plan,{});assert.deepEqual(state.report,{});
 assert.equal(state.search,'');assert.equal(state.hasCampaignSelection,false);
});

test('Ask Waddle prioritizes relevant general questions outside sales without removing existing questions',()=>{
 assert.deepEqual(orderedAskQuestions('Leads or inquiries'),['changes','coverage','best','revenue']);
 assert.deepEqual(orderedAskQuestions('Website activity'),['changes','coverage','best','revenue']);
 assert.deepEqual(orderedAskQuestions('Sales'),['best','revenue','changes','coverage']);
});
