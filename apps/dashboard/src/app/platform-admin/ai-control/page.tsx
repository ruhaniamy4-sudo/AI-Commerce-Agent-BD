'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Bot,Gauge} from 'lucide-react';
import {platformApi,type PlatformBusiness} from '@/lib/platform-api';
import {ExportLink,PageHeading,Panel,StatCard,Status,Toolbar,percent} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';
import {Button} from '@/components/ui/button';

const AI_STATES:Record<string,{label:string;tone:'success'|'warning'|'danger'|'neutral'}>={
 ENABLED:{label:'Enabled',tone:'success'},
 SUSPENDED_BY_PLATFORM:{label:'Suspended by platform',tone:'danger'},
 SUSPENDED_BY_SUBSCRIPTION:{label:'Suspended by subscription',tone:'warning'},
 DISABLED_BY_MERCHANT:{label:'Disabled by merchant',tone:'neutral'},
};

/**
 * Per-workspace AI access. Deliberately separate from business status and from
 * human takeover: pausing a workspace's AI is a commercial or safety decision, and
 * an operator should be able to make it without touching anything else.
 */
export default function AiControl(){
 const confirm=useConfirm();
 const can=useCan();
 const qc=useQueryClient();
 const [search,setSearch]=useState('');
 const [problem,setProblem]=useState('');
 const {data,isLoading}=useQuery({queryKey:['ai-control',search],queryFn:()=>platformApi.businesses(search,'',1)});
 const invalidate=()=>qc.invalidateQueries({queryKey:['ai-control']});

 const change=useMutation({
  mutationFn:async(business:PlatformBusiness)=>{
   const suspended=business.aiAccess?.status==='SUSPENDED_BY_PLATFORM';
   const why=await confirm({
    title:`${suspended?'Resume':'Suspend'} AI for ${business.name}?`,
    description:suspended?'Automated replies start again on the next customer message.':'Customers keep messaging, but the agent stops replying until this is resumed.',
    consequences:suspended?undefined:['Future automated replies only — nothing already sent changes','Their team can still reply by hand','The workspace is told why if a paused reply is set'],
    confirmLabel:suspended?'Resume AI':'Suspend AI',
    tone:suspended?'neutral':'danger',
    reason:{label:'Reason (kept in the audit log)',placeholder:'Why this is happening'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.setAIStatus(business._id,suspended?'ENABLED':'SUSPENDED_BY_PLATFORM',why);
  },
  onSuccess:invalidate,
  onError:(error:Error)=>{if(error.message!=='Cancelled')setProblem(error.message)},
 });

 const manage=can('ai.manage');
 const rows=data?.data||[];
 const suspended=rows.filter(row=>row.aiAccess?.status?.startsWith('SUSPENDED')).length;
 const spend=rows.reduce((total,row)=>total+(row.usage.cost||0),0);

 return <div>
  <PageHeading eyebrow="AI & intelligence" title="AI control" copy="Which workspaces the agent is answering for, what each is consuming, and the switch to pause one." actions={<>
   <Link className="platform-control" href="/platform-admin/ai-config">Model & routing</Link>
   <ExportLink href={platformApi.exportUrl('usage','this_month')} label="Export usage"/>
  </>}/>

  {problem&&<p className="platform-banner danger">{problem}</p>}

  <div className="platform-metrics">
   <StatCard label="Workspaces shown" value={rows.length} detail="Matching the current search" tone="violet"/>
   <StatCard label="AI suspended" value={suspended} detail="By platform or subscription" tone="amber"/>
   <StatCard label="Requests this month" value={rows.reduce((total,row)=>total+(row.usage.requests||0),0)} detail="Across the workspaces shown" tone="blue"/>
   <StatCard label="Estimated spend" value={`$${spend.toFixed(4)}`} detail="Where cost is known" tone="green"/>
  </div>

  <Panel title="Workspaces" copy="A limit shown as plan means the workspace has no override of its own" action={<Toolbar>
   <input className="platform-control" placeholder="Search workspaces" value={search} onChange={event=>setSearch(event.target.value)}/>
  </Toolbar>}>
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Workspace</th><th>Business</th><th>Subscription</th><th>AI access</th><th>Request limit</th><th>Requests</th><th>Cost</th><th /></tr></thead><tbody>
    {rows.map(business=>{
     const state=AI_STATES[business.aiAccess?.status||'ENABLED']||AI_STATES.ENABLED;
     const cap=business.aiAccess?.monthlyRequestLimit;
     const used=cap?percent((business.usage.requests/cap)*100):null;
     return <tr key={business._id}>
      <td><Link href={`/platform-admin/businesses/${business._id}`}><strong>{business.name}</strong></Link><small>{business.owner?.email||'No owner recorded'}</small></td>
      <td><Status tone={business.status==='active'?'success':'danger'}>{business.status}</Status></td>
      <td>{business.subscription?.status||'Not configured'}</td>
      <td><Status tone={state.tone}>{state.label}</Status>{business.aiAccess?.reason&&<small>{business.aiAccess.reason}</small>}</td>
      <td>{cap?<>{cap.toLocaleString()}<small>{used} used</small></>:<span style={{color:'var(--pa-faint)'}}>Plan allowance</span>}</td>
      <td>{business.usage.requests.toLocaleString()}</td>
      <td>{business.usage.unknown?'Partially unknown':`$${business.usage.cost.toFixed(4)}`}</td>
      <td><div className="platform-actions">
       <Link className="platform-control" href={`/platform-admin/businesses/${business._id}`}><Gauge size={13}/> Limits</Link>
       {manage&&<Button variant="outline" size="sm" onClick={()=>change.mutate(business)}>{business.aiAccess?.status==='SUSPENDED_BY_PLATFORM'?'Resume AI':'Suspend AI'}</Button>}
      </div></td>
     </tr>;
    })}
   </tbody></table>
   {!isLoading&&!rows.length&&<div className="platform-empty"><Bot size={20}/>No workspaces match this search.</div>}</div>
  </Panel>
 </div>;
}
