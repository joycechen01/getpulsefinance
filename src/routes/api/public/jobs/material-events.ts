import {createFileRoute} from "@tanstack/react-router";
import {authenticateCronRequest} from "@/integrations/supabase/cron-auth";
import {z} from "zod";
export const Route=createFileRoute("/api/public/jobs/material-events")({server:{handlers:{POST:async({request})=>{
 const failure=await authenticateCronRequest(request);if(failure)return failure;
 const body=z.object({kind:z.literal("events")}).safeParse(await request.json());if(!body.success)return Response.json({error:"Invalid request"},{status:400});
 const {runEventMonitor}=await import("@/lib/event-monitor.server");
 const waitUntil=(request as Request&{waitUntil?:(p:Promise<unknown>)=>void}).waitUntil;
 if(waitUntil){waitUntil(runEventMonitor().catch(e=>console.error("Event monitor paused",e)));return Response.json({accepted:true});}
 // Dev/local fallback awaits the same bounded work; no untracked promise is started.
 try{return Response.json(await runEventMonitor());}catch{return Response.json({error:"Event check paused"},{status:502});}
}}}});