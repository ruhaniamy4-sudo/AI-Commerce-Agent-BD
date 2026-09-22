'use client';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Megaphone,Send,Trash2} from 'lucide-react';
import {platformApi,type Announcement} from '@/lib/platform-api';
import {Field,PageHeading,Panel,Status,dateTime,since} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';

type Draft={_id?:string;title:string;body:string;severity:string;audience:string;planSlugs:string;subscriptionStatuses:string;businessIds:string;dismissible:boolean;emailDelivery:boolean;startsAt:string;endsAt:string};
const blank:Draft={title:'',body:'',severity:'info',audience:'all',planSlugs:'',subscriptionStatuses:'',businessIds:'',dismissible:true,emailDelivery:false,startsAt:'',endsAt:''};
const SEVERITIES=['info','success','warning','critical'];
const AUDIENCES:Array<[string,string]>=[['all','Every workspace'],['plan','Specific plans'],['status','Specific subscription statuses'],['business','Named workspaces']];
const STATUSES=['TRIAL','ACTIVE','PAST_DUE','EXPIRED','CANCELLED','SUSPENDED'];
const toneFor=(severity:string)=>severity==='critical'?'danger':severity==='warning'?'warning':severity==='success'?'success':'info';
const localInput=(value?:string)=>value?new Date(value).toISOString().slice(0,16):'';

const toDraft=(row:Announcement):Draft=>({
 _id:row._id,title:row.title,body:row.body,severity:row.severity,audience:row.audience,
 planSlugs:(row.planSlugs||[]).join(', '),subscriptionStatuses:(row.subscriptionStatuses||[]).join(', '),
 businessIds:(row.businessIds||[]).join(', '),dismissible:row.dismissible,emailDelivery:row.emailDelivery,
 startsAt:localInput(row.startsAt),endsAt:localInput(row.endsAt),
});

const toPayload=(draft:Draft)=>({
 title:draft.title,body:draft.body,severity:draft.severity,audience:draft.audience,
 planSlugs:draft.planSlugs.split(',').map(entry=>entry.trim()).filter(Boolean),
 subscriptionStatuses:draft.subscriptionStatuses.split(',').map(entry=>entry.trim()).filter(Boolean),
 businessIds:draft.businessIds.split(',').map(entry=>entry.trim()).filter(Boolean),
 dismissible:draft.dismissible,emailDelivery:draft.emailDelivery,
 startsAt:draft.startsAt||undefined,endsAt:draft.endsAt||undefined,
});

export default function Announcements(){
 const confirm=useConfirm();
 const can=useCan();
 const qc=useQueryClient();
 const [draft,setDraft]=useState<Draft|null>(null);
 const [error,setError]=useState('');
 const {data,isLoading}=useQuery({queryKey:['platform-announcements'],queryFn:platformApi.announcements});
 const plans=useQuery({queryKey:['platform-plans'],queryFn:platformApi.plans});
 const invalidate=()=>qc.invalidateQueries({queryKey:['platform-announcements']});

 const save=useMutation({
  mutationFn:(entry:Draft)=>entry._id?platformApi.updateAnnouncement(entry._id,toPayload(entry)):platformApi.createAnnouncement(toPayload(entry)),
  onSuccess:()=>{setDraft(null);setError('');invalidate()},
  onError:(problem:Error)=>setError(problem.message),
 });

 const publish=useMutation({
  mutationFn:async(row:Announcement)=>{
   const going=row.status!=='published';
   const audience=row.audience==='all'?'every workspace':'the workspaces it targets';
   const why=await confirm({
    title:going?`Publish "${row.title}"?`:`Take "${row.title}" down?`,
    description:going?`It appears in ${audience} on their next dashboard load.`:'Merchants stop seeing it immediately.',
    confirmLabel:going?'Publish':'Take down',
    tone:going?'neutral':'warning',
    reason:{label:'Reason (kept in the audit log)',placeholder:'Why this is going out'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.setAnnouncementStatus(row._id,going?'published':'draft',why);
  },
  onSuccess:invalidate,
 });

 const remove=useMutation({
  mutationFn:async(row:Announcement)=>{
   if(!await confirm({title:`Delete "${row.title}"?`,description:'This cannot be undone.',confirmLabel:'Delete',tone:'danger'}))throw new Error('Cancelled');
   return platformApi.deleteAnnouncement(row._id);
  },
  onSuccess:invalidate,
 });

 const manage=can('announcements.manage');
 const live=data?.filter(row=>row.status==='published').length||0;
 return <div>
  <PageHeading eyebrow="Command center" title="Announcements" copy="Tell merchants about maintenance, pricing, incidents, and new capability — targeted, scheduled, and audited." actions={<>
   <Status tone={live?'success':'neutral'}>{live} live</Status>
   {manage&&<Button size="sm" onClick={()=>{setError('');setDraft({...blank})}}><Megaphone size={14}/> New announcement</Button>}
  </>}/>

  <Panel title="All announcements" copy="Drafts are invisible to merchants until published">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Announcement</th><th>Severity</th><th>Audience</th><th>Window</th><th>Status</th><th>Author</th><th /></tr></thead><tbody>
    {data?.map(row=><tr key={row._id}>
     <td><strong>{row.title}</strong><small>{row.body.slice(0,110)}{row.body.length>110?'…':''}</small></td>
     <td><Status tone={toneFor(row.severity)}>{row.severity}</Status></td>
     <td>{row.audience==='all'?'Every workspace':row.audience==='plan'?`Plans: ${row.planSlugs.join(', ')}`:row.audience==='status'?`Status: ${row.subscriptionStatuses.join(', ')}`:`${row.businessIds.length} workspaces`}</td>
     <td>{row.startsAt||row.endsAt?<>{dateTime(row.startsAt)}<small>until {row.endsAt?dateTime(row.endsAt):'further notice'}</small></>:'Immediate, no end'}</td>
     <td><Status tone={row.status==='published'?'success':row.status==='expired'?'neutral':'info'}>{row.status}</Status>{row.publishedAt&&<small>{since(row.publishedAt)} ago</small>}</td>
     <td>{row.authorName||'—'}</td>
     <td><div className="platform-actions">
      {manage&&<Button variant="outline" size="sm" onClick={()=>{setError('');setDraft(toDraft(row))}}>Edit</Button>}
      {manage&&<Button variant="outline" size="sm" onClick={()=>publish.mutate(row)}><Send size={13}/> {row.status==='published'?'Take down':'Publish'}</Button>}
      {manage&&<Button variant="outline" size="sm" onClick={()=>remove.mutate(row)}><Trash2 size={13}/></Button>}
     </div></td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!data?.length&&<div className="platform-empty"><Megaphone size={20}/>Nothing has been announced yet.</div>}</div>
  </Panel>

  <Dialog open={Boolean(draft)} onOpenChange={next=>!next&&setDraft(null)}>
   <DialogContent className="border-(--pa-line-strong) bg-(--pa-panel) text-(--pa-text) sm:max-w-2xl">
    <DialogHeader><DialogTitle>{draft?._id?'Edit announcement':'New announcement'}</DialogTitle></DialogHeader>
    {draft&&<div className="platform-form-grid">
     <Field label="Title" wide><input value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></Field>
     <Field label="Message" wide hint="Plain text. Merchants see this in their dashboard."><textarea value={draft.body} onChange={event=>setDraft({...draft,body:event.target.value})}/></Field>
     <Field label="Severity"><select value={draft.severity} onChange={event=>setDraft({...draft,severity:event.target.value})}>{SEVERITIES.map(value=><option key={value}>{value}</option>)}</select></Field>
     <Field label="Audience"><select value={draft.audience} onChange={event=>setDraft({...draft,audience:event.target.value})}>{AUDIENCES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
     {draft.audience==='plan'&&<Field label="Plan slugs" wide hint={`Available: ${(plans.data||[]).map(plan=>plan.slug).join(', ')||'none yet'}`}><input value={draft.planSlugs} onChange={event=>setDraft({...draft,planSlugs:event.target.value})} placeholder="growth, business"/></Field>}
     {draft.audience==='status'&&<Field label="Subscription statuses" wide hint={`Available: ${STATUSES.join(', ')}`}><input value={draft.subscriptionStatuses} onChange={event=>setDraft({...draft,subscriptionStatuses:event.target.value})} placeholder="PAST_DUE, EXPIRED"/></Field>}
     {draft.audience==='business'&&<Field label="Workspace ids" wide hint="Comma-separated. Copy an id from the Businesses table."><input value={draft.businessIds} onChange={event=>setDraft({...draft,businessIds:event.target.value})}/></Field>}
     <Field label="Starts" hint="Leave empty to start as soon as it is published."><input type="datetime-local" value={draft.startsAt} onChange={event=>setDraft({...draft,startsAt:event.target.value})}/></Field>
     <Field label="Ends" hint="After this it expires on its own."><input type="datetime-local" value={draft.endsAt} onChange={event=>setDraft({...draft,endsAt:event.target.value})}/></Field>
     <label style={{display:'flex',gap:7,alignItems:'center',fontSize:9,color:'var(--pa-body)'}}><input type="checkbox" checked={draft.dismissible} onChange={event=>setDraft({...draft,dismissible:event.target.checked})}/> Merchants can dismiss it</label>
     <label style={{display:'flex',gap:7,alignItems:'center',fontSize:9,color:'var(--pa-body)'}}><input type="checkbox" checked={draft.emailDelivery} onChange={event=>setDraft({...draft,emailDelivery:event.target.checked})}/> Also flag for email delivery</label>
     {error&&<p className="platform-banner danger" style={{gridColumn:'1 / -1'}}>{error}</p>}
     <Button disabled={save.isPending} onClick={()=>save.mutate(draft)} style={{gridColumn:'1 / -1'}}>{save.isPending?'Saving…':draft._id?'Save announcement':'Save as draft'}</Button>
    </div>}
   </DialogContent>
  </Dialog>
 </div>;
}
