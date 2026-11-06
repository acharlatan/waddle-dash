import {METRICS,parseDate} from './analytics.js';
import {STORAGE_KEY} from './archive.js';

// Each save has its own immutable key. Saving a later copy cannot replace an earlier one.
export const INVESTIGATION_PREFIX='waddle-investigation-v1:';
const ownObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const copy=x=>JSON.parse(JSON.stringify(x));
const validRow=r=>ownObject(r)&&typeof r.date==='string'&&parseDate(r.date)===r.date&&typeof r.channel==='string'&&typeof r.campaign==='string'&&METRICS.every(k=>r[k]===null||Number.isFinite(r[k]));
const textFields=x=>ownObject(x)&&Object.values(x).every(v=>typeof v==='string'||typeof v==='boolean');
const currencies=['USD','CAD','AUD','EUR','GBP','PHP'],sources=['google','custom','other'],values=['none','revenue','conversion'];
const validContext=x=>x===null||(ownObject(x)&&typeof x.caseType==='string'&&typeof x.question==='string'&&ownObject(x.selectedPeriod)&&typeof x.selectedPeriod.start==='string'&&typeof x.selectedPeriod.end==='string'&&typeof x.observation==='string'&&typeof x.limitations==='string'&&ownObject(x.quality));

export function captureCaseContext({type,result,period,days,data,goal}){
 if(!result||result.error||!period?.current?.length)return null;
 const selected=result.top||(type==='spending'&&result.canShare?result.facts.find(x=>!x.partial&&x.value>0):null);
 const summary=x=>x?Object.fromEntries(['spend','revenue','conversions','clicks','impressions','ctr'].filter(k=>Number.isFinite(x[k])).map(k=>[k,x[k]])):null;
 return {caseType:type,question:result.title,goal,source:data?.source??null,currency:data?.currency??null,conversionDefinition:data?.conversionDefinition??'unknown',valueKind:data?.valueKind??null,
  selectedPeriod:{start:period.start,end:period.end,days},earlierPeriod:result.previousStart?{start:result.previousStart,end:result.previousEnd}:null,
  campaign:selected?.campaign||'',channel:selected?.channel||'',observation:result.next||'',limitations:result.note||'',
  figures:selected?{earlier:summary(selected.previous),later:summary(selected.current),earlierCost:selected.previousCost??null,laterCost:selected.currentCost??null,spend:selected.value??null,spendRows:selected.spendCoverage??null,rows:selected.rows??null}:null,
  quality:{excluded:Array.isArray(data?.errors)?data.errors.length:null,duplicates:Number.isFinite(data?.duplicates)?data.duplicates:null,currencyNote:data?.currencyNote||''}};
}

function datasetCopy(data){
 if(!data||data.qualityUnknown||!Array.isArray(data.records)||!data.records.length||!Array.isArray(data.errors)||!Number.isInteger(data.duplicates)||data.duplicates<0)throw Error('This report does not include the import quality details needed to save it safely. Reimport the original report; existing snapshots stay unchanged.');
 if(!currencies.includes(data.currency)||!sources.includes(data.source)||!values.includes(data.valueKind))throw Error('This older report is missing its source, currency, or value meaning. Reimport the original report before saving a connected investigation; existing snapshots stay unchanged.');
 const records=data.records.map(r=>({date:r.date,channel:String(r.channel||''),campaign:String(r.campaign||''),...Object.fromEntries(METRICS.map(k=>[k,r[k]??null]))}));
 if(records.length>30000||!records.every(validRow))throw Error('Some normalized records could not be validated. The investigation was not saved.');
 return {records,errors:data.errors.map(e=>({record:e.record,csvRecord:e.csvRecord,reason:e.reason,field:e.field})),currency:data.currency,duplicates:data.duplicates??null,excludedDuplicates:data.excludedDuplicates??null,mapped:ownObject(data.mapped)?copy(data.mapped):{},currencyCheckVersion:data.currencyCheckVersion??null,currencyNote:data.currencyNote||'',source:data.source??null,valueKind:data.valueKind??null,conversionDefinition:data.conversionDefinition??'unknown'};
}

export function makeInvestigation(state,id,now=new Date().toISOString(),asNew=false){
 if(state.mode==='demo'||state.example)throw Error('Fictional demo work stays in memory and cannot be saved with personal investigations.');
 if(!id||typeof id!=='string')throw Error('Could not create a unique investigation ID. Nothing was saved.');
 const title=String(state.investigationTitle||'').trim();if(!title)throw Error('Add a title or question before saving.');
 if(title.length>200)throw Error('Keep the title or question under 200 characters.');
 const data=datasetCopy(state.data),context=state.caseContext?copy(state.caseContext):null;
 const rootId=asNew?id:(state.investigationRootId||id);
 return {kind:'waddle-investigation',version:1,id,rootId,parentId:asNew?null:(state.investigationId||null),title,savedAt:now,context,
  session:{data,name:String(state.name||''),goal:state.goal,days:state.days,metric:state.metric,sort:state.sort,caseType:state.caseType||'',planCaseType:state.planCaseType||'',
   hasCampaignSelection:!!state.hasCampaignSelection,campaign:state.campaign||'',campaignChannel:state.campaignChannel||'',hasChannelSelection:!!state.hasChannelSelection,selectedChannel:state.selectedChannel||'',
   plan:copy(state.plan||{}),report:copy(state.report||{}),checkins:copy(state.checkins||[])}};
}

export function isReadableInvestigation(x,key){
 return ownObject(x)&&x.kind==='waddle-investigation'&&x.version===1&&typeof x.id==='string'&&!!x.id&&key===INVESTIGATION_PREFIX+x.id&&typeof x.rootId==='string'&&typeof x.title==='string'&&typeof x.savedAt==='string'&&Number.isFinite(Date.parse(x.savedAt))&&validContext(x.context)&&ownObject(x.session)&&typeof x.session.name==='string'&&ownObject(x.session.data)&&currencies.includes(x.session.data.currency)&&sources.includes(x.session.data.source)&&values.includes(x.session.data.valueKind)&&Number.isInteger(x.session.data.duplicates)&&x.session.data.duplicates>=0&&Array.isArray(x.session.data.records)&&x.session.data.records.length>0&&x.session.data.records.length<=30000&&x.session.data.records.every(validRow)&&Array.isArray(x.session.data.errors)&&x.session.data.errors.every(e=>ownObject(e)&&typeof e.reason==='string')&&textFields(x.session.plan)&&textFields(x.session.report)&&Array.isArray(x.session.checkins)&&['7','30','90','all'].includes(x.session.days)&&['Sales','Leads or inquiries','Bookings','Website activity','Other'].includes(x.session.goal)&&['','expensive','spending','results'].includes(x.session.caseType)&&['revenue','spend','conversions','clicks','impressions'].includes(x.session.metric)&&['revenue','spend','conversions','roas','name','clicks','impressions'].includes(x.session.sort);
}

export function readInvestigations(storage){
 const result={items:[],locked:false,error:''};
 try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(INVESTIGATION_PREFIX))continue;let item;try{item=JSON.parse(storage.getItem(key))}catch{result.locked=true;continue}if(isReadableInvestigation(item,key))result.items.push(item);else result.locked=true}
  if(result.locked)result.error='Some saved investigations have an unsupported or damaged format. They have not been changed; new saves are paused.';
  result.items.sort((a,b)=>b.savedAt.localeCompare(a.savedAt)||a.id.localeCompare(b.id));
 }catch(error){result.locked=true;result.error='Saved investigations could not be read. Existing browser data has not been changed.'}
 return result;
}

export function saveInvestigation(storage,archive,listing,item){
 if(!archive.enabled||archive.locked)throw Error('Turn on local saving and resolve any snapshot archive warning first.');
 if(listing.locked)throw Error(listing.error||'The saved investigation list is unavailable. Nothing was saved.');
 const key=INVESTIGATION_PREFIX+item.id;if(!isReadableInvestigation(item,key))throw Error('The investigation could not be validated. Nothing was saved.');
 try{if(storage.getItem(STORAGE_KEY)!==archive.raw)throw Error('The saved-work setting changed in another tab. Reload the saved list and try again.');
  if(storage.getItem(key)!==null)throw Error('That investigation ID already exists. The saved copy was not changed.');
  storage.setItem(key,JSON.stringify(item));
 }catch(error){if(/changed in another tab|already exists/.test(error.message))throw error;throw Error('Could not save: browser storage may be full or unavailable. Previous saved work has not been changed.')}
 return item;
}

export function restoreInvestigation(item){
 if(!isReadableInvestigation(item,INVESTIGATION_PREFIX+item?.id))throw Error('This saved investigation cannot be opened safely. It has not been changed.');
 const s=copy(item.session);
 return {...s,caseContext:item.context?copy(item.context):null,investigationTitle:item.title,investigationId:item.id,investigationRootId:item.rootId,investigationDirty:false,example:false,search:'',question:'',compareA:'',compareB:'',compareConfirmed:false,campaignReturn:'',channelReturn:''};
}

export function newInvestigationId(cryptoObject=globalThis.crypto){
 if(typeof cryptoObject?.randomUUID==='function')return cryptoObject.randomUUID();
 if(typeof cryptoObject?.getRandomValues!=='function')throw Error('This browser cannot create a safe unique ID. Nothing was saved.');
 const bytes=cryptoObject.getRandomValues(new Uint8Array(16));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
