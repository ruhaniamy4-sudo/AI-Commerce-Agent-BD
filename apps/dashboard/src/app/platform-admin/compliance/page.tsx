'use client';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {CheckCircle2,ScrollText,ShieldCheck,Trash2} from 'lucide-react';
import {platformApi} from '@/lib/platform-api';
import {PageHeading,Panel,StatCard,Status,dateTime} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';
import {Button} from '@/components/ui/button';
import {SettingsEditor} from '@/components/platform/settings-registry';

/**
 * Retention and deletion in one place: what is held past its window, the deletion
 * requests that have to be answered within the SLA, and the purge that enforces it.
 */
export default function Compliance(){
 const confirm=useConfirm();
 const can=useCan();
 const qc=useQueryClient();
 const {data,isLoading}=useQuery({queryKey:['platform-compliance'],queryFn:platformApi.compliance});
 const invalidate=()=>qc.invalidateQueries({queryKey:['platform-compliance']});

 const purge=useMutation({
  mutationFn:async(dataset:{id:string;label:string;expired:number;days:number})=>{
   const why=await confirm({
    title:`Delete ${dataset.expired.toLocaleString()} expired ${dataset.label.toLowerCase()} records?`,
    description:`Everything older than the ${dataset.days}-day retention window is removed permanently.`,
    consequences:['This cannot be undone','Up to 5,000 records are removed per run','The purge is recorded in the audit log'],
    confirmLabel:'Purge now',tone:'danger',
    reason:{label:'Reason (kept in the audit log)',placeholder:'Why this purge is being run'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.purgeRetention(dataset.id,why);
  },
  onSuccess:invalidate,
 });

 const complete=useMutation({
  mutationFn:async(request:{_id:string;providerUserHash:string})=>{
   const why=await confirm({
    title:'Mark this deletion request complete?',
    description:`Confirm the data for ${request.providerUserHash}… has actually been removed before recording it as done.`,
    confirmLabel:'Mark complete',tone:'warning',
    reason:{label:'What was done',placeholder:'Describe the deletion performed'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.completeDeletionRequest(request._id,why);
  },
  onSuccess:invalidate,
 });

 const manage=can('compliance.manage');
 const pending=data?.requests.filter(request=>request.status!=='COMPLETED').length||0;
 const overdue=data?.requests.filter(request=>request.overdue).length||0;
 const expiredTotal=data?.datasets.reduce((total,dataset)=>total+dataset.expired,0)||0;

 return <div>
  <PageHeading eyebrow="Governance" title="Data & privacy" copy="Retention windows, expired data, and the deletion requests the platform is obliged to answer." actions={<Status tone={overdue?'danger':pending?'warning':'success'}>{overdue?`${overdue} overdue`:pending?`${pending} open`:'Nothing outstanding'}</Status>}/>

  <div className="platform-metrics">
   <StatCard label="Open requests" value={pending} detail={`SLA ${data?.sla||0} hours`} tone="violet"/>
   <StatCard label="Overdue requests" value={overdue} detail="Past the configured SLA" tone="amber"/>
   <StatCard label="Records past retention" value={expiredTotal.toLocaleString()} detail="Across every dataset" tone="blue"/>
   <StatCard label="Tenant export" value={data?.exportEnabled?'Enabled':'Disabled'} detail="Operator data export" tone="green"/>
  </div>

  <Panel title="Retention" copy="A window of 0 keeps data indefinitely, so nothing is ever deleted by surprise">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Dataset</th><th>Window</th><th>Stored</th><th>Past window</th><th /></tr></thead><tbody>
    {data?.datasets.map(dataset=><tr key={dataset.id}>
     <td><strong>{dataset.label}</strong><small><code>{dataset.settingKey}</code></small></td>
     <td>{dataset.days?`${dataset.days} days`:<Status tone="info">Kept indefinitely</Status>}</td>
     <td>{dataset.total.toLocaleString()}</td>
     <td>{dataset.expired?<Status tone="warning">{dataset.expired.toLocaleString()} expired</Status>:'—'}</td>
     <td>{manage&&dataset.expired>0&&<Button variant="outline" size="sm" onClick={()=>purge.mutate(dataset)}><Trash2 size={13}/> Purge</Button>}</td>
    </tr>)}
   </tbody></table>
   {isLoading&&<div className="platform-empty">Loading retention state…</div>}</div>
  </Panel>

  <Panel title="Deletion requests" copy="Received from Meta's data deletion callback" className="mt-4">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Reference</th><th>Status</th><th>Received</th><th>Completed</th><th /></tr></thead><tbody>
    {data?.requests.map(request=><tr key={request._id}>
     <td><strong>{request.providerUserHash}…</strong><small>Provider user reference</small></td>
     <td>{request.status==='COMPLETED'?<Status tone="success">Completed</Status>:request.overdue?<Status tone="danger">Overdue</Status>:<Status tone="warning">{request.status.replaceAll('_',' ')}</Status>}</td>
     <td>{dateTime(request.createdAt)}</td>
     <td>{dateTime(request.completedAt)}</td>
     <td>{manage&&request.status!=='COMPLETED'&&<Button variant="outline" size="sm" onClick={()=>complete.mutate(request)}><CheckCircle2 size={13}/> Complete</Button>}</td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!data?.requests.length&&<div className="platform-empty"><ScrollText size={20}/>No deletion requests received.</div>}</div>
  </Panel>

  <SettingsEditor className="mt-4" categories={['compliance']} title="Retention & policy configuration" copy="Windows, the deletion SLA, and the policy links shown to merchants."/>

  <p className="platform-banner info" style={{marginTop:15}}><ShieldCheck size={14}/>A single workspace can be exported or erased from its own detail page, under Merchants → Businesses.</p>
 </div>;
}
