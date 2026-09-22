'use client';
import {useQuery} from '@tanstack/react-query';
import {HeartPulse,RefreshCw} from 'lucide-react';
import {platformApi} from '@/lib/platform-api';
import {PageHeading,Panel,StatCard,Status} from '@/components/platform/platform-ui';
import {Button} from '@/components/ui/button';

const HEALTHY=['up','ok','connected','configured','running'];
const toneOf=(value:string)=>HEALTHY.includes(value)?'success':['degraded','not_configured','needs key'].includes(value)?'warning':'danger';

export default function Health(){
 const {data,isLoading,refetch,isFetching}=useQuery({queryKey:['platform-health'],queryFn:platformApi.health,refetchInterval:30000});
 const services:Array<[string,string,string]>=data?[
  ['Agent API',data.api,'Serves the dashboard, storefront, and every channel webhook'],
  ['MongoDB',data.mongo,'The business database. Everything stops without it'],
  ['Redis',data.redis,'Background jobs, webhook processing, and courier sync'],
  ['Worker',data.worker,'Processes the queues Redis holds'],
  [`AI provider (${data.aiProvider})`,data.aiConfigured?'configured':'needs key','Generates merchant replies'],
  ['Facebook integration',data.facebook,'Inbound Messenger events and outbound replies'],
  ['Courier encryption',data.steadfastEncryption,'Protects stored courier credentials'],
  ['Media storage',data.storage,'Product images and customer media'],
 ]:[];

 return <div>
  <PageHeading eyebrow="Operations" title="Platform health" copy="Live dependency checks and configuration presence. Secret values are never returned." actions={<>
   <Status tone={data?.status==='ok'?'success':'warning'}>{data?.status==='ok'?'All core systems up':'Degraded'}</Status>
   <Button variant="outline" size="sm" onClick={()=>refetch()} disabled={isFetching}><RefreshCw size={13}/> Refresh</Button>
  </>}/>

  <div className="platform-metrics">
   <StatCard label="Overall status" value={data?.status==='ok'?'Operational':'Degraded'} detail="Refreshed every 30 seconds" tone={data?.status==='ok'?'green':'amber'}/>
   <StatCard label="Active Facebook channels" value={data?.facebookChannels||0} detail="Connected merchant Pages" tone="violet"/>
   <StatCard label="Courier connections" value={data?.steadfastConnections||0} detail="Workspaces with delivery connected" tone="blue"/>
   <StatCard label="AI provider" value={data?.aiProvider||'—'} detail={data?.aiConfigured?'Credentials present':'Credentials missing'} tone="amber"/>
  </div>

  <Panel title="Services" copy="What each dependency carries, so a red line says what is actually broken">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Service</th><th>State</th><th>What it does</th></tr></thead><tbody>
    {services.map(([name,state,purpose])=><tr key={name}>
     <td><strong>{name}</strong></td>
     <td><Status tone={toneOf(state)}>{state.replaceAll('_',' ')}</Status></td>
     <td>{purpose}</td>
    </tr>)}
   </tbody></table>
   {isLoading&&<div className="platform-empty"><HeartPulse size={20}/>Checking dependencies…</div>}</div>
  </Panel>
 </div>;
}
