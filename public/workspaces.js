// The existing hash routes remain valid; workspaces are navigation over them.
export const WORKSPACE_PAGES = Object.freeze({
 overview: 'home',
 investigate: 'investigate', mystery: 'investigate', campaigns: 'investigate',
 channels: 'investigate', insights: 'investigate', ask: 'investigate',
 work: 'work', planner: 'work', investigations: 'work', timeline: 'work',
 report: 'reports', guide: 'settings', data: 'settings'
});

export const WORKSPACE_LINKS = Object.freeze({
 investigate: [
  ['investigate', 'Start here'], ['mystery', 'Mystery Lab'], ['campaigns', 'Campaigns'],
  ['channels', 'Channels'], ['insights', 'Insights'], ['ask', 'Ask Waddle']
 ],
 work: [['work', 'Start here'], ['planner', 'My next step'], ['investigations', 'Saved investigations'], ['timeline', 'Time Machine']]
});

export function pageFromHash(hash) {
 const page = String(hash || '').replace(/^#/, '');
 return Object.hasOwn(WORKSPACE_PAGES, page) ? page : 'overview';
}

export function workspaceForPage(page) {
 return WORKSPACE_PAGES[page] || 'home';
}

// A briefing link opens a view that can actually examine the metric it mentions.
export function destinationForMetric(goal, metric) {
 if (metric === 'spend') return {page:'mystery',caseType:'spending'};
 if (goal === 'Website activity' && ['clicks','impressions','ctr'].includes(metric)) return {page:'mystery',caseType:'results'};
 if (metric === 'cpc') return {page:'mystery',caseType:'expensive'};
 if (metric === 'conversions') return {page:'mystery',caseType:'results'};
 return {page:'channels',caseType:''};
}

export function openCampaignDetail(state,campaign,channel,origin) {
 state.campaign=campaign;state.campaignChannel=channel;state.hasCampaignSelection=true;
 if(origin!=='campaigns')state.campaignReturn=['mystery','channels'].includes(origin)?origin:'';
 state.focusCampaign=true;
}

export function openChannelDetail(state,channel,origin) {
 state.selectedChannel=channel;state.hasChannelSelection=true;
 if(origin!=='channels')state.channelReturn=['mystery','campaigns'].includes(origin)?origin:'';
 state.focusChannel=true;
}

// Keep every existing question available while making the starting choices fit the goal.
export function orderedAskQuestions(goal) {
 const general=['changes','coverage'], value=['best','revenue'];
 return goal==='Sales' ? [...value,...general] : [...general,...value];
}

// Preserve a deliberately started blank report when its first dataset is added.
// Once a dataset exists, ordinary imports still require replacement confirmation.
export function isBlankReportDraft(state) {
 return !state?.data && state?.report?.blankDraft === true;
}

// A linked follow-up or a first import into a blank report carries drafts forward.
// Other imports start a separate session after the replacement confirmation.
export function draftsForImport(state, linkedFollowup) {
 if (!linkedFollowup) return {plan:{},report:{},planCaseType:'',checkins:[]};
 return {
  plan:structuredClone(state.plan || {}), report:structuredClone(state.report || {}),
  planCaseType:state.planCaseType || '', checkins:structuredClone(state.checkins || [])
 };
}

// Keep the user's workspace goal when starting a later report, without assuming its source or definitions.
export function laterReportGoal(state){
 const goals=['Sales','Leads or inquiries','Bookings','Website activity','Other'];
 return state.mode==='personal'&&state.data&&goals.includes(state.goal)?state.goal:null;
}

// Each mode keeps its own in-memory navigation and draft context. No storage writes occur here.
const SESSION_FIELDS = [
 'data', 'name', 'example', 'goal', 'days', 'metric', 'sort', 'caseType',
 'compareA', 'compareB', 'compareConfirmed', 'report', 'plan', 'search', 'question',
 'hasCampaignSelection', 'campaign', 'campaignChannel', 'campaignReturn', 'hasChannelSelection', 'selectedChannel', 'channelReturn', 'planCaseType',
 'caseContext','investigationTitle','investigationId','investigationRootId','investigationDirty','checkins'
];

export function switchSessionMode(state, slots, mode, createDemo) {
 if (mode === state.mode) return false;
 slots[state.mode] = Object.fromEntries(SESSION_FIELDS.map(key => [key, state[key]]));
 const empty = {
  data:null, name:'', example:false, goal:'Sales', days:'30', metric:'revenue', sort:'revenue',
  caseType:'expensive', compareA:'', compareB:'', compareConfirmed:false, report:{}, plan:{},
  search:'', question:'', hasCampaignSelection:false, campaign:'', campaignChannel:'', campaignReturn:'', hasChannelSelection:false, selectedChannel:'', channelReturn:'', planCaseType:'',
  caseContext:null,investigationTitle:'',investigationId:'',investigationRootId:'',investigationDirty:false,checkins:[]
 };
 const next = slots[mode] || (mode === 'demo' ? {...empty, ...createDemo()} : empty);
 Object.assign(state, next, {mode});
 return true;
}
