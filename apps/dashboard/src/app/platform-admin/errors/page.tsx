'use client';
import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {CircleAlert,RefreshCw} from 'lucide-react';
import {platformApi} from '@/lib/platform-api';
import {PageHeading,Panel,StatCard,Status,Toolbar,dateTime,since} from '@/components/platform/platform-ui';
import {Button} from '@/components/ui/button';

export default function Errors(){
 const [type,setType]=useState('');
 const [search,setSearch]=useState('');
 const {data,isLoading,refetch,isFetching}=useQuery({queryKey:['platform-errors'],queryFn:platformApi.errors,refetchInterval:60000});

 const types=useMemo(()=>[...new Set((data||[]).map(entry=>entry.type))].sort(),[data]);
 const rows=useMemo(()=>(data||[]).filter(entry=>
  (!type||entry.type===type)&&(!search||entry.message.toLowerCase().includes(search.toLowerCase()))
 ),[data,type,search]);
 const lastHour=(data||[]).filter(entry=>Date.now()-new Date(entry.timestamp).getTime()<3600000).length;

 return <div>
  <PageHeading eyebrow="Operations" title="Errors" copy="The most recent application errors, with tokens and keys stripped before they leave the server." actions={<>
   <Status tone={lastHour>10?'danger':lastHour?'warning':'success'}>{lastHour} in the last hour</Status>
   <Button variant="outline" size="sm" onClick={()=>refetch()} disabled={isFetching}><RefreshCw size={13}/> Refresh</Button>
  </>}/>

  <div className="platform-metrics">
   <StatCard label="Recorded errors" value={data?.length||0} detail="Most recent 100" tone="violet"/>
   <StatCard label="Last hour" value={lastHour} detail="Worth looking at now" tone="amber"/>
   <StatCard label="Distinct types" value={types.length} detail="Grouped by error type" tone="blue"/>
   <StatCard label="Matching filter" value={rows.length} detail="In the current view" tone="green"/>
  </div>

  <Panel title="Recent errors" copy="Stack traces and raw context stay server-side" action={<Toolbar>
   <input className="platform-control" placeholder="Search message" value={search} onChange={event=>setSearch(event.target.value)}/>
   <select className="platform-control" value={type} onChange={event=>setType(event.target.value)}><option value="">All types</option>{types.map(value=><option key={value}>{value}</option>)}</select>
  </Toolbar>}>
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Type</th><th>Message</th><th>When</th></tr></thead><tbody>
    {rows.map(entry=><tr key={entry._id}>
     <td><Status tone="danger">{entry.type}</Status></td>
     <td><span style={{display:'block',maxWidth:720,wordBreak:'break-word'}}>{entry.message}</span></td>
     <td>{since(entry.timestamp)} ago<small>{dateTime(entry.timestamp)}</small></td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!rows.length&&<div className="platform-empty"><CircleAlert size={20}/>{data?.length?'No errors match this filter.':'No errors logged.'}</div>}</div>
  </Panel>
 </div>;
}
