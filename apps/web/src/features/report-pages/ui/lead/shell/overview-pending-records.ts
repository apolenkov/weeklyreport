import type {ReportSectionReadModel} from "@weeklyreport/shared";

import {sectionToDraftPayload} from "../../../../report-sections";
import {formSectionOf} from "../../../../report-sections/model/form-section";
import type {ReadyEditor} from "./use-overview-controller";

interface PendingRecord {id:string;label:string;overviewFocus:string;fields:string}
function records(section:ReportSectionReadModel){
 const payload=sectionToDraftPayload(section);
 const indexed=new Map<string,PendingRecord>();
 function add(kind:string,stableId:string|undefined|null,text:string,product:string|undefined|null,activity:string|undefined|null,fields:unknown){
  const id=`unsaved:${kind}:${stableId??indexed.size}`;
  const overviewFocus=product?`product:${product}`:activity?`activity:${activity}`:"report-details";
  const old=indexed.get(id);
  indexed.set(id,{id,overviewFocus,label:`Unsaved ${kind}: ${text}`,fields:(old?.fields??"")+JSON.stringify(fields)});
 }
 for(const item of payload.items)add("item",item.stableId,item.text,item.projectId,item.activityId,{...item,id:undefined});
 for(const risk of payload.risks)add("risk",risk.stableId,risk.risk,risk.projectId,risk.activityId,{...risk,id:undefined});
 for(const decision of payload.decisions??[])add("decision",decision.stableId,decision.text,decision.productId,decision.activityId,{...decision,id:undefined});
 return indexed;
}

export function overviewPendingRecords(editor:ReadyEditor|null){
 const saved=editor?.view.data.byPeriodData?.section;
 if(!editor || !saved || saved.reportSectionId!==editor.draft.section.reportSectionId || !(editor.draft.autosave.dirty||editor.draft.autosave.isInFlight))return [];
 const before=records(formSectionOf(saved));
 const after=records(editor.draft.section);
 const pending:PendingRecord[]=[];
 for(const [key,row] of new Map([...before,...after])){
   if(before.get(key)?.fields!==after.get(key)?.fields)pending.push(row);
 }
 return pending;
}
