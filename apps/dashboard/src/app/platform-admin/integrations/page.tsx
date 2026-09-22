'use client';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {PlugZap,ShieldCheck,TriangleAlert} from 'lucide-react';
import {platformApi} from '@/lib/platform-api';
import {PageHeading,Panel,StatCard,Status,dateTime} from '@/components/platform/platform-ui';

const label=(id:Record<string,string>)=>Object.values(id).filter(Boolean).join(' · ')||'Unspecified';
const sum=(rows:Array<{count:number}>|undefined)=>(rows||[]).reduce((total,row)=>total+row.count,0);

export default function Integrations(){
 const {data,isLoading}=useQuery({queryKey:['platform-integrations'],queryFn:platformApi.integrations});
 const attention=(data?.facebookConnections||[]).filter(connection=>connection.reauthorizationRequired||connection.lastErrorCode).length;
 const needsReview=(data?.training||[]).reduce((total,row)=>total+(row.needsReview||0),0);

 return <div>
  <PageHeading eyebrow="Channels" title="Integration health" copy="Connection and training metadata only — credentials and Page identifiers are never returned." actions={<>
   <Status tone={attention?'warning':'success'}>{attention?`${attention} connections need attention`:'All connections healthy'}</Status>
   <Link className="platform-control" href="/platform-admin/providers">Provider settings</Link>
  </>}/>

  <div className="platform-metrics">
   <StatCard label="Channel connections" value={sum(data?.channels)} detail={`Across ${data?.businesses||0} workspaces`} tone="violet"/>
   <StatCard label="Courier connections" value={sum(data?.couriers)} detail="Delivery integrations" tone="blue"/>
   <StatCard label="Training sources" value={sum(data?.training)} detail={`${needsReview} entries need review`} tone="amber"/>
   <StatCard label="Needs attention" value={attention} detail="Reauthorisation or last error" tone="green"/>
  </div>

  <div className="platform-grid equal">
   <Panel title="Channels" copy="By platform and connection state">
    <div className="platform-kv">{(data?.channels||[]).map((row,index)=><div key={index}><dt>{label(row._id)}</dt><dd>{row.count.toLocaleString()}</dd></div>)}</div>
    {!isLoading&&!data?.channels.length&&<div className="platform-empty"><PlugZap size={20}/>No channels connected.</div>}
   </Panel>
   <Panel title="Couriers" copy="By provider and state">
    <div className="platform-kv">{(data?.couriers||[]).map((row,index)=><div key={index}><dt>{label(row._id)}</dt><dd>{row.count.toLocaleString()}</dd></div>)}</div>
    {!isLoading&&!data?.couriers.length&&<div className="platform-empty">No courier integrations connected.</div>}
   </Panel>
  </div>

  <Panel title="Training sources" copy="Website and catalogue ingestion, by type and state" className="mt-4">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Source</th><th>Sources</th><th>Products</th><th>Knowledge</th><th>Failed scans</th><th>Needs review</th><th>Last success</th></tr></thead><tbody>
    {(data?.training||[]).map((row,index)=><tr key={index}>
     <td><strong>{label(row._id)}</strong></td>
     <td>{row.count.toLocaleString()}</td>
     <td>{(row.products||0).toLocaleString()}</td>
     <td>{(row.knowledge||0).toLocaleString()}</td>
     <td>{row.failedScans?<Status tone="danger">{row.failedScans}</Status>:'—'}</td>
     <td>{row.needsReview?<Status tone="warning">{row.needsReview}</Status>:'—'}</td>
     <td>{dateTime(row.lastSuccessful)}</td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!data?.training.length&&<div className="platform-empty">No training sources configured.</div>}</div>
  </Panel>

  <Panel title="Facebook Page connections" copy="Most recently active first" className="mt-4">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Workspace</th><th>Page</th><th>State</th><th>Last event</th><th>Last verified</th><th>Attention</th></tr></thead><tbody>
    {(data?.facebookConnections||[]).map(connection=><tr key={connection._id}>
     <td><strong>{connection.businessName||'Unknown workspace'}</strong></td>
     <td>{connection.pageName}<small>{connection.pageCategory||'Facebook Page'}</small></td>
     <td><Status tone={connection.connectionStatus==='connected'?'success':connection.connectionStatus==='disconnected'?'danger':'warning'}>{connection.connectionStatus}</Status></td>
     <td>{dateTime(connection.lastEventAt)}</td>
     <td>{dateTime(connection.lastVerifiedAt)}</td>
     <td>{connection.reauthorizationRequired
      ?<Status tone="danger"><TriangleAlert size={10}/> Reauthorisation required</Status>
      :connection.lastErrorCode?<Status tone="warning">{connection.lastErrorCode}</Status>
      :<Status tone="success"><ShieldCheck size={10}/> Healthy</Status>}</td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!data?.facebookConnections.length&&<div className="platform-empty">No Facebook Pages connected.</div>}</div>
  </Panel>
 </div>;
}
