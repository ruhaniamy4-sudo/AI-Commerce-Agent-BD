'use client';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {CheckCircle2,FileText,Plus,Trash2} from 'lucide-react';
import {platformApi,type PromptRow} from '@/lib/platform-api';
import {Field,PageHeading,Panel,Status,dateTime} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';

type Draft={_id?:string;name:string;description:string;content:string};
const blank:Draft={name:'',description:'',content:''};

/**
 * The shared system prompt drives every tenant's agent, so authoring it belongs to
 * platform operations rather than to any one merchant. Exactly one entry is live,
 * and activating another swaps it on the next conversation turn.
 */
export default function Prompts(){
 const confirm=useConfirm();
 const can=useCan();
 const qc=useQueryClient();
 const [draft,setDraft]=useState<Draft|null>(null);
 const [error,setError]=useState('');
 const {data,isLoading}=useQuery({queryKey:['platform-prompts'],queryFn:platformApi.prompts});
 const invalidate=()=>qc.invalidateQueries({queryKey:['platform-prompts']});

 const save=useMutation({
  mutationFn:(entry:Draft)=>entry._id?platformApi.updatePrompt(entry._id,entry):platformApi.createPrompt(entry),
  onSuccess:()=>{setDraft(null);setError('');invalidate()},
  onError:(problem:Error)=>setError(problem.message),
 });

 const activate=useMutation({
  mutationFn:async(row:PromptRow)=>{
   const why=await confirm({
    title:`Make "${row.name}" the live prompt?`,
    description:'Every workspace uses this prompt from their next conversation turn. Replies already sent are unaffected.',
    consequences:['Applies to all tenants at once','The currently live prompt is deactivated','The change is recorded in the audit log'],
    confirmLabel:'Activate prompt',tone:'warning',
    reason:{label:'Reason (kept in the audit log)',placeholder:'Why this prompt is going live'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.activatePrompt(row._id,why);
  },
  onSuccess:invalidate,
 });

 const remove=useMutation({
  mutationFn:async(row:PromptRow)=>{
   if(!await confirm({title:`Delete "${row.name}"?`,description:'This cannot be undone.',confirmLabel:'Delete prompt',tone:'danger'}))throw new Error('Cancelled');
   return platformApi.deletePrompt(row._id);
  },
  onSuccess:invalidate,
  onError:(problem:Error)=>setError(problem.message),
 });

 const manage=can('prompts.manage');
 const live=data?.find(row=>row.isActive);
 return <div>
  <PageHeading eyebrow="AI & intelligence" title="Prompt library" copy="The shared agent prompt, versioned. One entry is live for every workspace at a time." actions={manage?<Button size="sm" onClick={()=>{setError('');setDraft({...blank})}}><Plus size={14}/> New prompt</Button>:<Status tone="info">Read-only for your role</Status>}/>

  {error&&<p className="platform-banner danger">{error}</p>}
  <p className="platform-banner info"><FileText size={14}/>Merchants can no longer edit this prompt from their own dashboard — it is global, and per-workspace wording belongs in their Training page.</p>

  {live&&<Panel title={`Live prompt: ${live.name}`} copy={`Last updated ${dateTime(live.updatedAt)}`} action={<Status tone="success">Serving every workspace</Status>}>
   <pre className="platform-code">{live.content}</pre>
  </Panel>}

  <Panel title="All prompts" copy="Drafts have no effect until activated" className={live?'mt-4':undefined}>
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Prompt</th><th>Length</th><th>State</th><th>Updated</th><th /></tr></thead><tbody>
    {data?.map(row=><tr key={row._id}>
     <td><strong>{row.name}</strong><small>{row.description||row.content.slice(0,90)}</small></td>
     <td>{row.content.length.toLocaleString()} chars</td>
     <td>{row.isActive?<Status tone="success">Live</Status>:<Status tone="neutral">Draft</Status>}</td>
     <td>{dateTime(row.updatedAt)}</td>
     <td><div className="platform-actions">
      {manage&&<Button variant="outline" size="sm" onClick={()=>{setError('');setDraft({_id:row._id,name:row.name,description:row.description||'',content:row.content})}}>Edit</Button>}
      {manage&&!row.isActive&&<Button variant="outline" size="sm" onClick={()=>activate.mutate(row)}><CheckCircle2 size={13}/> Activate</Button>}
      {manage&&!row.isActive&&<Button variant="outline" size="sm" onClick={()=>remove.mutate(row)}><Trash2 size={13}/></Button>}
     </div></td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!data?.length&&<div className="platform-empty"><FileText size={20}/>No prompts stored yet.</div>}</div>
  </Panel>

  <Dialog open={Boolean(draft)} onOpenChange={next=>!next&&setDraft(null)}>
   <DialogContent className="border-(--pa-line-strong) bg-(--pa-panel) text-(--pa-text) sm:max-w-3xl">
    <DialogHeader><DialogTitle>{draft?._id?'Edit prompt':'New prompt'}</DialogTitle></DialogHeader>
    {draft&&<div className="platform-form-grid">
     <Field label="Name"><input value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></Field>
     <Field label="Description" hint="What makes this version different."><input value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></Field>
     <Field label="Prompt" wide hint="At least 20 characters. Saving does not make it live.">
      <textarea value={draft.content} onChange={event=>setDraft({...draft,content:event.target.value})} style={{minHeight:280,fontFamily:'var(--font-geist-mono, ui-monospace), monospace'}}/>
     </Field>
     {error&&<p className="platform-banner danger" style={{gridColumn:'1 / -1'}}>{error}</p>}
     <Button disabled={save.isPending} onClick={()=>save.mutate(draft)} style={{gridColumn:'1 / -1'}}>{save.isPending?'Saving…':'Save prompt'}</Button>
    </div>}
   </DialogContent>
  </Dialog>
 </div>;
}
