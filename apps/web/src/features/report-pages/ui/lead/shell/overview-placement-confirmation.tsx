import { AlertDialog } from "@weeklyreport/ui/components/ui/alert-dialog";
import { Button } from "@weeklyreport/ui/components/ui/button";
import {useEffect,useRef,useState} from "react";

export type OccupiedWeek="current"|"next";

export function usePlacementConfirmation(scope:string|null){
 const pending=useRef<((accept:boolean)=>void)|null>(null);
 const [prompt,setPrompt]=useState<{week:OccupiedWeek;scope:string|null}|null>(null);
 useEffect(()=>()=>{pending.current?.(false);pending.current=null;},[scope]);
 const choose=(accept:boolean)=>{pending.current?.(accept);pending.current=null;setPrompt(null);};
 const ask=(week:OccupiedWeek)=>new Promise<boolean>(resolve=>{
  pending.current?.(false);pending.current=resolve;setPrompt({week,scope});
 });
 return {ask,week:prompt?.scope===scope?prompt?.week:null,choose};
}

export function OverviewPlacementConfirmation({week,choose}:{week:OccupiedWeek|null|undefined;choose:(accept:boolean)=>void}){
 if(!week)return null;
 const current=week==="current";
 return <AlertDialog.Root open onOpenChange={open=>{if(!open)choose(false);}}><AlertDialog.Portal>
 <AlertDialog.Overlay className="fixed inset-0 z-(--layer-overlay) bg-overlay"/>
 <AlertDialog.Content className="fixed top-1/2 left-1/2 z-(--layer-dialog) w-[min(24rem,95vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-4 shadow-md">
 <AlertDialog.Title>{current?"Already in This week":"Already planned in Next week"}</AlertDialog.Title>
 <AlertDialog.Description>{current?"Nothing was moved: This week already has this item.":"Bring the existing Next week record into This week?"}</AlertDialog.Description>
 <div className="flex justify-end gap-2">{!current&&<AlertDialog.Cancel asChild><Button variant="ghost" onClick={()=>choose(false)}>Cancel</Button></AlertDialog.Cancel>}
 <AlertDialog.Action asChild><Button onClick={()=>choose(true)}>{current?"Use the This week item":"Bring into This week"}</Button></AlertDialog.Action></div>
 </AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
}
