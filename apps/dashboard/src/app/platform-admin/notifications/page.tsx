'use client';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Bell,Plus} from 'lucide-react';
import {platformApi,type NotificationTemplateRow} from '@/lib/platform-api';
import {Field,PageHeading,Panel,Status,Toggle,dateTime} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {SettingsEditor} from '@/components/platform/settings-registry';

type Draft={_id?:string;event:string;locale:string;subject:string;body:string;enabled:boolean};
const blank:Draft={event:'welcome',locale:'bn',subject:'',body:'',enabled:true};

export default function Notifications(){
 const can=useCan();
 const qc=useQueryClient();
 const [draft,setDraft]=useState<Draft|null>(null);
 const [error,setError]=useState('');
 const {data,isLoading}=useQuery({queryKey:['platform-notifications'],queryFn:platformApi.notifications});
 const invalidate=()=>qc.invalidateQueries({queryKey:['platform-notifications']});

 const save=useMutation({
  mutationFn:(entry:Draft)=>entry._id
   ?platformApi.updateTemplate(entry._id,{subject:entry.subject,body:entry.body,enabled:entry.enabled})
   :platformApi.createTemplate(entry),
  onSuccess:()=>{setDraft(null);setError('');invalidate()},
  onError:(problem:Error)=>setError(problem.message),
 });

 const toggle=useMutation({mutationFn:(row:NotificationTemplateRow)=>platformApi.updateTemplate(row._id,{subject:row.subject,body:row.body,enabled:!row.enabled}),onSuccess:invalidate});

 const manage=can('settings.manage');
 const variablesFor=(event:string)=>data?.events.find(entry=>entry.event===event)?.variables||[];
 return <div>
  <PageHeading eyebrow="Configuration" title="Notification templates" copy="The wording of every transactional message, editable per event and locale." actions={manage?<Button size="sm" onClick={()=>{setError('');setDraft({...blank})}}><Plus size={14}/> Add locale variant</Button>:<Status tone="info">Read-only for your role</Status>}/>

  <p className="platform-banner info"><Bell size={14}/>Verification and password-reset email is sent from these templates today. The rest are stored ready for the surfaces that will send them, and a disabled template stops its email.</p>

  <Panel title="Templates" copy="Variables in double braces are replaced when the message is sent">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Event</th><th>Locale</th><th>Subject</th><th>Sent today</th><th>Enabled</th><th>Updated</th><th /></tr></thead><tbody>
    {data?.templates.map(row=><tr key={row._id}>
     <td><strong>{row.event.replaceAll('_',' ')}</strong><small>{variablesFor(row.event).map(name=>`{{${name}}}`).join(' ')}</small></td>
     <td>{row.locale}</td>
     <td>{row.subject}</td>
     <td>{data.wired.includes(row.event)?<Status tone="success">Live</Status>:<Status tone="neutral">Stored</Status>}</td>
     <td><Toggle label={`Enable ${row.event}`} checked={row.enabled} disabled={!manage} onChange={()=>toggle.mutate(row)}/></td>
     <td>{dateTime(row.updatedAt)}</td>
     <td>{manage&&<Button variant="outline" size="sm" onClick={()=>{setError('');setDraft({_id:row._id,event:row.event,locale:row.locale,subject:row.subject,body:row.body,enabled:row.enabled})}}>Edit</Button>}</td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!data?.templates.length&&<div className="platform-empty"><Bell size={20}/>No templates stored yet.</div>}</div>
  </Panel>

  <SettingsEditor className="mt-4" categories={['notification']} title="Delivery configuration" copy="Who transactional email comes from and which events are allowed to send."/>

  <Dialog open={Boolean(draft)} onOpenChange={next=>!next&&setDraft(null)}>
   <DialogContent className="border-(--pa-line-strong) bg-(--pa-panel) text-(--pa-text) sm:max-w-2xl">
    <DialogHeader><DialogTitle>{draft?._id?'Edit template':'Add locale variant'}</DialogTitle></DialogHeader>
    {draft&&<div className="platform-form-grid">
     <Field label="Event">
      <select value={draft.event} disabled={Boolean(draft._id)} onChange={event=>setDraft({...draft,event:event.target.value})}>{(data?.events||[]).map(entry=><option key={entry.event} value={entry.event}>{entry.event.replaceAll('_',' ')}</option>)}</select>
     </Field>
     <Field label="Locale" hint="A two-letter code such as bn or en."><input value={draft.locale} disabled={Boolean(draft._id)} onChange={event=>setDraft({...draft,locale:event.target.value.toLowerCase()})}/></Field>
     <Field label="Subject" wide><input value={draft.subject} onChange={event=>setDraft({...draft,subject:event.target.value})}/></Field>
     <Field label="Body" wide hint={`Available variables: ${variablesFor(draft.event).map(name=>`{{${name}}}`).join(', ')||'none'}`}>
      <textarea value={draft.body} onChange={event=>setDraft({...draft,body:event.target.value})} style={{minHeight:180}}/>
     </Field>
     <label style={{display:'flex',gap:7,alignItems:'center',fontSize:9,color:'var(--pa-body)'}}><input type="checkbox" checked={draft.enabled} onChange={event=>setDraft({...draft,enabled:event.target.checked})}/> Enabled</label>
     {error&&<p className="platform-banner danger" style={{gridColumn:'1 / -1'}}>{error}</p>}
     <Button disabled={save.isPending} onClick={()=>save.mutate(draft)} style={{gridColumn:'1 / -1'}}>{save.isPending?'Saving…':'Save template'}</Button>
    </div>}
   </DialogContent>
  </Dialog>
 </div>;
}
