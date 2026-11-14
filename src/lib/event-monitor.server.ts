import {supabaseAdmin} from "@/integrations/supabase/client.server";
import {z} from "zod";
import {gmail} from "./digest.server";
import {reviewEvents,sendEvent} from "./phase5.server";
export async function runEventMonitor(){
 const mailbox=await gmail("profile");if(!mailbox.emailAddress)throw new Error("Gmail identity is unavailable.");
 // Never let another app account use the builder's personal Gmail credentials.
 const {data:users,error}=await supabaseAdmin.auth.admin.listUsers({page:1,perPage:1000});if(error)throw error;
 const owner=users.users.find(u=>u.email?.toLowerCase()===mailbox.emailAddress?.toLowerCase());if(!owner)return {checked:0};
 const {data:profile}=await supabaseAdmin.from("profiles").select("delivery_email,material_event_email_enabled").eq("id",owner.id).maybeSingle();if(!profile?.material_event_email_enabled)return {checked:0};
 const {data:monitor}=await supabaseAdmin.from("event_monitor").select("*").eq("user_id",owner.id).maybeSingle();if(!monitor||monitor.paused_reason)return {checked:0};
 const now=new Date().toISOString();const {data:claimed}=await supabaseAdmin.from("event_monitor").update({lease_until:new Date(Date.now()+60000).toISOString()}).eq("user_id",owner.id).or(`lease_until.is.null,lease_until.lt.${now}`).select("user_id");if(!claimed?.length)return {checked:0};
 try{const {data:holdings}=await supabaseAdmin.from("holdings").select("ticker").eq("user_id",owner.id).order("ticker");if(!holdings?.length)return {checked:0};
 // One holding and at most one event per run, no background AI calls.
 const holding=holdings[monitor.cursor%holdings.length];if(!holding)return {checked:0};const result=await reviewEvents(holding.ticker);
 const event=result.events.filter(e=>e.filed>=monitor.enabled_since.slice(0,10)).sort((a,b)=>a.filed.localeCompare(b.filed));
 const {data:delivered}=await supabaseAdmin.from("event_deliveries").select("accession").eq("user_id",owner.id);
 const pending=event.find(e=>!delivered?.some(d=>d.accession===e.accession));if(pending)await sendEvent(owner.id,z.string().email().parse(profile.delivery_email??mailbox.emailAddress),pending);
 await supabaseAdmin.from("event_monitor").update({cursor:(monitor.cursor+1)%holdings.length,last_checked_at:now}).eq("user_id",owner.id);return {checked:1};
 }catch(e){await supabaseAdmin.from("event_monitor").update({paused_reason:e instanceof Error?e.message:"Event delivery check failed"}).eq("user_id",owner.id);throw e;}
 finally{await supabaseAdmin.from("event_monitor").update({lease_until:null}).eq("user_id",owner.id);}
}