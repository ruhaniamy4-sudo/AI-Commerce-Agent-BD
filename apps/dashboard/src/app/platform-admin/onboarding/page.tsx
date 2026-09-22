'use client';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {Rocket} from 'lucide-react';
import {platformApi} from '@/lib/platform-api';
import {PageHeading,Panel,StatCard,Status,dateOnly} from '@/components/platform/platform-ui';

const STAGES:Array<[string,string]>=[
 ['created','Workspace created'],
 ['product_added','First product added'],
 ['knowledge_added','Knowledge added'],
 ['channel_configured','Channel connected'],
 ['ai_tested','AI tested'],
 ['complete','Onboarding complete'],
];
const STEPS:Array<[string,string]>=[['productAdded','Product'],['knowledgeAdded','Knowledge'],['channelConfigured','Channel'],['aiTested','AI test']];

/**
 * Where new workspaces stop. The funnel is ordered by the step a workspace has
 * reached, and the list below is the oldest unfinished ones first — the accounts
 * where an operator reaching out is worth more than another automated nudge.
 */
export default function Onboarding(){
 const {data,isLoading}=useQuery({queryKey:['platform-onboarding'],queryFn:platformApi.onboarding});
 const funnel=data?.funnel||{};
 const total=Object.values(funnel).reduce((sum,count)=>sum+count,0);
 const complete=funnel.complete||0;
 const stalled=data?.stuck.filter(row=>row.ageDays>=7).length||0;

 return <div>
  <PageHeading eyebrow="Merchants" title="Onboarding pipeline" copy="How far each new workspace has got, and which ones have stopped." actions={<Status tone={stalled?'warning':'success'}>{stalled?`${stalled} stalled over a week`:'Nothing stalled'}</Status>}/>

  <div className="platform-metrics">
   <StatCard label="Workspaces" value={total} detail="Every workspace ever created" tone="violet"/>
   <StatCard label="Completed onboarding" value={complete} detail={total?`${Math.round((complete/total)*100)}% of all workspaces`:'None yet'} tone="green"/>
   <StatCard label="In progress" value={total-complete} detail="Started but not finished" tone="blue"/>
   <StatCard label="Stalled over a week" value={stalled} detail="Worth an operator reaching out" tone="amber"/>
  </div>

  <Panel title="Funnel" copy="The furthest step each workspace has reached">
   <ul className="platform-funnel">{STAGES.map(([stage,label])=>{
    const count=funnel[stage]||0;
    return <li key={stage}>
     <span>{label}</span><b>{count.toLocaleString()}</b>
     <div className="platform-meter"><span style={{width:`${total?(count/total)*100:0}%`}}/></div>
    </li>;
   })}</ul>
  </Panel>

  <Panel title="Oldest unfinished workspaces" copy="Ordered by how long they have been waiting" className="mt-4">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Workspace</th><th>Reached</th><th>Steps done</th><th>Age</th><th>Created</th><th>Status</th></tr></thead><tbody>
    {data?.stuck.map(row=><tr key={row._id}>
     <td><Link href={`/platform-admin/businesses/${row._id}`}><strong>{row.name}</strong></Link><small>{row._id}</small></td>
     <td>{STAGES.find(([stage])=>stage===row.stage)?.[1]||row.stage}</td>
     <td><div className="platform-chips">{STEPS.map(([key,label])=><span className="platform-chip" key={key} style={row.onboarding?.[key]?{borderColor:'var(--pa-success)',color:'var(--pa-success)'}:undefined}>{label}</span>)}</div></td>
     <td><Status tone={row.ageDays>=14?'danger':row.ageDays>=7?'warning':'neutral'}>{row.ageDays} days</Status></td>
     <td>{dateOnly(row.createdAt)}</td>
     <td><Status tone={row.status==='active'?'success':'danger'}>{row.status}</Status></td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!data?.stuck.length&&<div className="platform-empty"><Rocket size={20}/>Every workspace has finished onboarding.</div>}</div>
  </Panel>
 </div>;
}
