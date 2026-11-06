// The existing hash routes remain valid; workspaces are navigation over them.
export const WORKSPACE_PAGES = Object.freeze({
 overview: 'home',
 investigate: 'investigate', mystery: 'investigate', campaigns: 'investigate',
 channels: 'investigate', insights: 'investigate', ask: 'investigate',
 work: 'work', planner: 'work', timeline: 'work',
 report: 'reports', guide: 'settings', data: 'settings'
});

export const WORKSPACE_LINKS = Object.freeze({
 investigate: [
  ['investigate', 'Start here'], ['mystery', 'Mystery Lab'], ['campaigns', 'Campaigns'],
  ['channels', 'Channels'], ['insights', 'Insights'], ['ask', 'Ask Waddle']
 ],
 work: [['work', 'Start here'], ['planner', 'My next step'], ['timeline', 'Time Machine']]
});

export function pageFromHash(hash) {
 const page = String(hash || '').replace(/^#/, '');
 return Object.hasOwn(WORKSPACE_PAGES, page) ? page : 'overview';
}

export function workspaceForPage(page) {
 return WORKSPACE_PAGES[page] || 'home';
}

// Keep every existing question available while making the starting choices fit the goal.
export function orderedAskQuestions(goal) {
 const general=['changes','coverage'], value=['best','revenue'];
 return goal==='Sales' ? [...value,...general] : [...general,...value];
}

// Each mode keeps its own in-memory navigation and draft context. No storage writes occur here.
const SESSION_FIELDS = [
 'data', 'name', 'example', 'goal', 'days', 'metric', 'sort', 'caseType',
 'compareA', 'compareB', 'compareConfirmed', 'report', 'plan', 'search', 'question',
 'hasCampaignSelection', 'campaign', 'campaignChannel', 'campaignReturn'
];

export function switchSessionMode(state, slots, mode, createDemo) {
 if (mode === state.mode) return false;
 slots[state.mode] = Object.fromEntries(SESSION_FIELDS.map(key => [key, state[key]]));
 const empty = {
  data:null, name:'', example:false, goal:'Sales', days:'30', metric:'revenue', sort:'revenue',
  caseType:'expensive', compareA:'', compareB:'', compareConfirmed:false, report:{}, plan:{},
  search:'', question:'', hasCampaignSelection:false, campaign:'', campaignChannel:'', campaignReturn:''
 };
 const next = slots[mode] || (mode === 'demo' ? {...empty, ...createDemo()} : empty);
 Object.assign(state, next, {mode});
 return true;
}
