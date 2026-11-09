import {filterPeriod} from './analytics.js';

// Presentation only: saved records and snapshots are never written or changed here.
const hasText = value => typeof value === 'string' && !!value.trim();
const hasFields = fields => Object.values(fields || {}).some(hasText);

export function workDeskModel(state, savedItems = [], snapshots = []) {
 const active = !!(state.caseContext || hasFields(state.plan) || hasText(state.investigationTitle));
 const personal = !state.example && state.mode !== 'demo';
 const saved = personal ? savedItems.map(item => {
  const context = item.context;
  const records = item.session?.data?.records || [];
  const period = context?.selectedPeriod || (records.length ? filterPeriod(records, item.session.days) : null);
  // Snapshot links are specific to a saved copy. A shared family alone is not enough.
  const linked = snapshots.filter(snapshot => snapshot.investigationId === item.id && snapshot.investigationRootId === item.rootId);
  return {
   id:item.id, title:item.title, campaign:context?.campaign || '', channel:context?.channel || '',
   start:period?.start || '', end:period?.end || '', observation:context?.observation || item.session?.plan?.noticed || '',
   goal:item.session?.goal || '', savedAt:item.savedAt, linkedSnapshots:linked.length,
   checkins:Array.isArray(item.session?.checkins) ? item.session.checkins.length : 0
  };
 }) : [];
 return {active, hasPlan:hasFields(state.plan), saved};
}
