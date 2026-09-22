'use client';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Flag,Plus,Trash2,TriangleAlert} from 'lucide-react';
import {platformApi,type FeatureFlagRow} from '@/lib/platform-api';
import {Field,PageHeading,Panel,Status,Toggle,dateTime,percent} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';

type Draft={_id?:string;key:string;label:string;description:string;enabled:boolean;rolloutPercent:number;planSlugs:string;businessIds:string;killSwitch:boolean};
const blank:Draft={key:'',label:'',description:'',enabled:false,rolloutPercent:100,planSlugs:'',businessIds:'',killSwitch:false};
const list=(value:string)=>value.split(',').map(entry=>entry.trim()).filter(Boolean);
const toDraft=(row:FeatureFlagRow):Draft=>({_id:row._id,key:row.key,label:row.label,description:row.description,enabled:row.enabled,rolloutPercent:row.rolloutPercent,planSlugs:(row.planSlugs||[]).join(', '),businessIds:(row.businessIds||[]).join(', '),killSwitch:row.killSwitch});
const toPayload=(draft:Draft)=>({key:draft.key,label:draft.label,description:draft.description,enabled:draft.enabled,rolloutPercent:draft.rolloutPercent,planSlugs:list(draft.planSlugs),businessIds:list(draft.businessIds),killSwitch:draft.killSwitch});

export default function Flags(){
 const confirm=useConfirm();
 const can=useCan();
 const qc=useQueryClient();
 const [draft,setDraft]=useState<Draft|null>(null);
 const [error,setError]=useState('');
 const {data,isLoading}=useQuery({queryKey:['platform-flags'],queryFn:platformApi.flags});
 const plans=useQuery({queryKey:['platform-plans'],queryFn:platformApi.plans});
 const invalidate=()=>qc.invalidateQueries({queryKey:['platform-flags']});

 const save=useMutation({
  mutationFn:(entry:Draft)=>entry._id?platformApi.updateFlag(entry._id,toPayload(entry)):platformApi.createFlag(toPayload(entry)),
  onSuccess:()=>{setDraft(null);setError('');invalidate()},
  onError:(problem:Error)=>setError(problem.message),
 });

 /** Toggling from the table is the common case, so it writes the row straight back. */
 const quick=useMutation({mutationFn:({row,change}:{row:FeatureFlagRow;change:Partial<FeatureFlagRow>})=>platformApi.updateFlag(row._id,{...toPayload(toDraft(row)),...change,planSlugs:row.planSlugs,businessIds:row.businessIds}),onSuccess:invalidate});

 const kill=useMutation({
  mutationFn:async(row:FeatureFlagRow)=>{
   const engaging=!row.killSwitch;
   if(engaging&&!await confirm({title:`Kill "${row.label}"?`,description:'Every workspace loses this capability immediately, whatever their plan or rollout bucket says.',confirmLabel:'Engage kill switch',tone:'danger'}))throw new Error('Cancelled');
   return platformApi.updateFlag(row._id,{...toPayload(toDraft(row)),killSwitch:engaging});
  },
  onSuccess:invalidate,
 });

 const remove=useMutation({
  mutationFn:async(row:FeatureFlagRow)=>{
   if(!await confirm({title:`Delete the flag "${row.key}"?`,description:'Code still asking for this flag will read it as off.',confirmLabel:'Delete flag',tone:'danger'}))throw new Error('Cancelled');
   return platformApi.deleteFlag(row._id);
  },
  onSuccess:invalidate,
 });

 const manage=can('flags.manage');
 return <div>
  <PageHeading eyebrow="Configuration" title="Feature flags" copy="Ship a capability to one workspace, one plan, or a percentage of the platform — and turn it off in one action." actions={manage?<Button size="sm" onClick={()=>{setError('');setDraft({...blank})}}><Plus size={14}/> New flag</Button>:<Status tone="info">Read-only for your role</Status>}/>

  <Panel title="Rollout" copy="A workspace stays in the same percentage bucket between loads, so a feature never flickers">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Flag</th><th>On</th><th>Rollout</th><th>Plan scope</th><th>Workspace overrides</th><th>Updated</th><th /></tr></thead><tbody>
    {data?.map(row=><tr key={row._id}>
     <td><strong>{row.label}</strong><small><code>{row.key}</code>{row.description?` · ${row.description}`:''}</small></td>
     <td><Toggle label={`Enable ${row.label}`} checked={row.enabled} disabled={!manage||row.killSwitch} onChange={enabled=>quick.mutate({row,change:{enabled}})}/></td>
     <td>{row.killSwitch?<Status tone="danger">Killed</Status>:percent(row.rolloutPercent)}</td>
     <td>{row.planSlugs?.length?row.planSlugs.join(', '):'All plans'}</td>
     <td>{row.businessIds?.length?`${row.businessIds.length} workspaces`:'—'}</td>
     <td>{dateTime(row.updatedAt)}</td>
     <td><div className="platform-actions">
      {manage&&<Button variant="outline" size="sm" onClick={()=>{setError('');setDraft(toDraft(row))}}>Edit</Button>}
      {manage&&<Button variant="outline" size="sm" onClick={()=>kill.mutate(row)}><TriangleAlert size={13}/> {row.killSwitch?'Release':'Kill'}</Button>}
      {manage&&<Button variant="outline" size="sm" onClick={()=>remove.mutate(row)}><Trash2 size={13}/></Button>}
     </div></td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!data?.length&&<div className="platform-empty"><Flag size={20}/>No feature flags defined.</div>}</div>
  </Panel>

  <Dialog open={Boolean(draft)} onOpenChange={next=>!next&&setDraft(null)}>
   <DialogContent className="border-(--pa-line-strong) bg-(--pa-panel) text-(--pa-text) sm:max-w-xl">
    <DialogHeader><DialogTitle>{draft?._id?'Edit flag':'New flag'}</DialogTitle></DialogHeader>
    {draft&&<div className="platform-form-grid">
     <Field label="Key" hint="What the code asks for. Lowercase, dots and dashes."><input value={draft.key} disabled={Boolean(draft._id)} onChange={event=>setDraft({...draft,key:event.target.value})} placeholder="channel.whatsapp"/></Field>
     <Field label="Label"><input value={draft.label} onChange={event=>setDraft({...draft,label:event.target.value})}/></Field>
     <Field label="Description" wide><textarea value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></Field>
     <Field label="Rollout percent" hint="100 means every eligible workspace."><input type="number" min={0} max={100} value={draft.rolloutPercent} onChange={event=>setDraft({...draft,rolloutPercent:Number(event.target.value)})}/></Field>
     <Field label="Plan slugs" hint={`Empty means all plans. Available: ${(plans.data||[]).map(plan=>plan.slug).join(', ')||'none yet'}`}><input value={draft.planSlugs} onChange={event=>setDraft({...draft,planSlugs:event.target.value})}/></Field>
     <Field label="Workspace overrides" wide hint="Comma-separated workspace ids that always get the feature, whatever the rollout says."><input value={draft.businessIds} onChange={event=>setDraft({...draft,businessIds:event.target.value})}/></Field>
     <label style={{display:'flex',gap:7,alignItems:'center',fontSize:9,color:'var(--pa-body)'}}><input type="checkbox" checked={draft.enabled} onChange={event=>setDraft({...draft,enabled:event.target.checked})}/> Enabled</label>
     <label style={{display:'flex',gap:7,alignItems:'center',fontSize:9,color:'var(--pa-body)'}}><input type="checkbox" checked={draft.killSwitch} onChange={event=>setDraft({...draft,killSwitch:event.target.checked})}/> Kill switch engaged</label>
     {error&&<p className="platform-banner danger" style={{gridColumn:'1 / -1'}}>{error}</p>}
     <Button disabled={save.isPending} onClick={()=>save.mutate(draft)} style={{gridColumn:'1 / -1'}}>{save.isPending?'Saving…':'Save flag'}</Button>
    </div>}
   </DialogContent>
  </Dialog>
 </div>;
}
