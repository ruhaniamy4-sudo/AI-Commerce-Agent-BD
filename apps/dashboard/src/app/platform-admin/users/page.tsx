'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {LogOut,MailCheck,Users as UsersIcon} from 'lucide-react';
import {platformApi,type PlatformUser} from '@/lib/platform-api';
import {ExportLink,Pager,PageHeading,Panel,StatCard,Status,Toolbar,dateOnly,dateTime,since} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';
import {Button} from '@/components/ui/button';

const ROLES=['Owner','Admin','Staff'];

export default function Users(){
 const confirm=useConfirm();
 const can=useCan();
 const qc=useQueryClient();
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const [problem,setProblem]=useState('');
 const {data,isLoading}=useQuery({queryKey:['platform-users',search,page],queryFn:()=>platformApi.users(search,page)});
 const invalidate=()=>qc.invalidateQueries({queryKey:['platform-users']});
 const fail=(error:Error)=>{if(error.message!=='Cancelled')setProblem(error.message)};

 const setStatus=useMutation({
  mutationFn:async(user:PlatformUser)=>{
   const disabling=user.status==='active';
   const why=await confirm({
    title:`${disabling?'Suspend':'Reactivate'} ${user.name}?`,
    description:disabling?'They are signed out and cannot sign in again until reactivated.':'They can sign in again.',
    confirmLabel:disabling?'Suspend user':'Reactivate user',
    tone:disabling?'danger':'neutral',
    reason:{label:'Reason (kept in the audit log)',placeholder:'Why this is happening'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.setUserStatus(user._id,disabling?'disabled':'active',why);
  },
  onSuccess:invalidate,onError:fail,
 });

 const verify=useMutation({
  mutationFn:async(user:PlatformUser)=>{
   const why=await confirm({
    title:`Mark ${user.email} as verified?`,
    description:'Use this only when you have confirmed the address another way — it bypasses the verification email.',
    confirmLabel:'Mark verified',tone:'warning',
    reason:{label:'How the address was confirmed',placeholder:'e.g. confirmed on a support call'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.verifyUserEmail(user._id,why);
  },
  onSuccess:invalidate,onError:fail,
 });

 const revoke=useMutation({
  mutationFn:async(user:PlatformUser)=>{
   const why=await confirm({
    title:`Sign ${user.name} out everywhere?`,
    description:'Every browser and device is signed out. Their account stays active and they can sign in again.',
    confirmLabel:'Revoke sessions',tone:'warning',
    reason:{label:'Reason (kept in the audit log)',placeholder:'Why this is needed'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.revokeUserSessions(user._id,why);
  },
  onSuccess:invalidate,onError:fail,
 });

 const changeRole=useMutation({
  mutationFn:async({user,businessId,businessName,role}:{user:PlatformUser;businessId:string;businessName:string;role:string})=>{
   const why=await confirm({
    title:`Make ${user.name} ${role} of ${businessName}?`,
    description:'Their permissions in that workspace change on their next request.',
    confirmLabel:'Change role',
    reason:{label:'Reason (kept in the audit log)',placeholder:'Why this is changing'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.setMembershipRole(user._id,businessId,role,why);
  },
  onSuccess:invalidate,onError:fail,
 });

 const manage=can('users.manage');
 const rows=data?.data||[];
 return <div>
  <PageHeading eyebrow="Merchants" title="Users" copy="Merchant accounts, their workspace roles, and account state. Credentials are never exposed." actions={<>
   <Status tone="info">{data?.pagination.total.toLocaleString()||0} accounts</Status>
   <ExportLink href={platformApi.exportUrl('users')}/>
  </>}/>

  {problem&&<p className="platform-banner danger">{problem}</p>}

  <div className="platform-metrics">
   <StatCard label="Accounts" value={data?.pagination.total||0} detail="Every merchant user" tone="violet"/>
   <StatCard label="On this page" value={rows.length} detail="Matching the current search" tone="blue"/>
   <StatCard label="Unverified emails" value={rows.filter(user=>!user.emailVerified).length} detail="In the current result set" tone="amber"/>
   <StatCard label="Suspended" value={rows.filter(user=>user.status!=='active').length} detail="In the current result set" tone="green"/>
  </div>

  <Panel title="Accounts" copy="Role changes, verification, and sign-outs are all audited" action={<Toolbar>
   <input className="platform-control" placeholder="Search name or email" value={search} onChange={event=>{setSearch(event.target.value);setPage(1)}}/>
  </Toolbar>}>
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>User</th><th>Workspaces</th><th>Email</th><th>Account</th><th>Last active</th><th>Joined</th><th /></tr></thead><tbody>
    {rows.map(user=><tr key={user._id}>
     <td><strong>{user.name}</strong><small>{user.email}</small></td>
     <td>{user.memberships.length
      ?user.memberships.map(membership=><div key={`${membership.business?._id}-${membership.role}`} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
       <Link href={`/platform-admin/businesses/${membership.business?._id}`}>{membership.business?.name||'Unknown workspace'}</Link>
       {manage&&membership.business?._id
        ?<select className="platform-control" value={membership.role} onChange={event=>changeRole.mutate({user,businessId:membership.business!._id,businessName:membership.business!.name,role:event.target.value})}>{ROLES.map(role=><option key={role}>{role}</option>)}</select>
        :<span className="platform-chip">{membership.role}</span>}
      </div>)
      :<span style={{color:'var(--pa-faint)'}}>No workspace</span>}</td>
     <td>{user.emailVerified?<Status tone="success">Verified</Status>:<Status tone="warning">Unverified</Status>}</td>
     <td><Status tone={user.status==='active'?'success':'danger'}>{user.status}</Status></td>
     <td>{user.lastSeenAt?<>{since(user.lastSeenAt)} ago<small>{dateTime(user.lastSeenAt)}</small></>:'Never recorded'}</td>
     <td>{dateOnly(user.createdAt)}</td>
     <td><div className="platform-actions">
      {manage&&!user.emailVerified&&<Button variant="outline" size="sm" onClick={()=>verify.mutate(user)}><MailCheck size={13}/></Button>}
      {manage&&<Button variant="outline" size="sm" onClick={()=>revoke.mutate(user)}><LogOut size={13}/></Button>}
      {manage&&<Button variant="outline" size="sm" onClick={()=>setStatus.mutate(user)}>{user.status==='active'?'Suspend':'Reactivate'}</Button>}
     </div></td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!rows.length&&<div className="platform-empty"><UsersIcon size={20}/>No users match this search.</div>}</div>
   {data&&<Pager page={data.pagination.page} totalPages={data.pagination.totalPages} total={data.pagination.total} onPage={setPage}/>}
  </Panel>
 </div>;
}
