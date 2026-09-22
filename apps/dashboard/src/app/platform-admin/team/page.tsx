'use client';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {KeyRound,ShieldCheck,UserPlus} from 'lucide-react';
import {platformApi,type RoleDefinition,type TeamMember} from '@/lib/platform-api';
import {Field,PageHeading,Panel,Status,dateTime} from '@/components/platform/platform-ui';
import {useCan,usePlatformIdentity} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';

const blank={name:'',email:'',password:'',role:'SUPPORT',notes:''};

export default function Team(){
 const confirm=useConfirm();
 const can=useCan();
 const {data:identity}=usePlatformIdentity();
 const qc=useQueryClient();
 const [draft,setDraft]=useState<typeof blank|null>(null);
 const [error,setError]=useState('');
 const roles=useQuery({queryKey:['platform-roles'],queryFn:platformApi.roles});
 const team=useQuery({queryKey:['platform-team'],queryFn:platformApi.team});
 const invalidate=()=>qc.invalidateQueries({queryKey:['platform-team']});

 const create=useMutation({
  mutationFn:(payload:typeof blank)=>platformApi.createTeamMember({...payload,reason:`Added ${payload.role} administrator`}),
  onSuccess:()=>{setDraft(null);setError('');invalidate()},
  onError:(problem:Error)=>setError(problem.message),
 });

 const changeRole=useMutation({
  mutationFn:async({member,role}:{member:TeamMember;role:string})=>{
   const why=await confirm({title:`Change ${member.name} to ${role}?`,description:'Their access changes on their next request; they are not signed out.',confirmLabel:'Change role',reason:{label:'Reason (kept in the audit log)',placeholder:'Why this is changing'}});
   if(!why)throw new Error('Cancelled');
   return platformApi.updateTeamMember(member._id,{role,reason:why});
  },
  onSuccess:invalidate,
 });

 const changeStatus=useMutation({
  mutationFn:async(member:TeamMember)=>{
   const disabling=member.status==='active';
   const why=await confirm({title:`${disabling?'Disable':'Reactivate'} ${member.name}?`,description:disabling?'Their sessions stop working immediately and they cannot sign in again.':'They can sign in to the console again.',confirmLabel:disabling?'Disable administrator':'Reactivate',tone:disabling?'danger':'neutral',reason:{label:'Reason (kept in the audit log)',placeholder:'Why this is happening'}});
   if(!why)throw new Error('Cancelled');
   return platformApi.updateTeamMember(member._id,{status:disabling?'disabled':'active',reason:why});
  },
  onSuccess:invalidate,
 });

 const resetPassword=useMutation({
  mutationFn:async(member:TeamMember)=>{
   const why=await confirm({title:`Reset the password for ${member.name}?`,description:'Enter the temporary password to set. They are required to change it after signing in.',confirmLabel:'Set password',tone:'warning',reason:{label:'Temporary password',placeholder:'At least 10 characters',minLength:10}});
   if(!why)throw new Error('Cancelled');
   return platformApi.resetTeamPassword(member._id,why,'Administrator password reset by an operator');
  },
  onSuccess:invalidate,
 });

 const manage=can('team.manage');
 return <div>
  <PageHeading eyebrow="Governance" title="Admin team" copy="Who can operate SellPilot, what their role allows, and every change to it." actions={manage?<Button size="sm" onClick={()=>{setError('');setDraft({...blank})}}><UserPlus size={14}/> Add administrator</Button>:<Status tone="info">Read-only for your role</Status>}/>

  <Panel title="Administrators" copy="Role changes, suspensions, and password resets are all audited">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Administrator</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Added</th><th /></tr></thead><tbody>
    {team.data?.map(member=><tr key={member._id}>
     <td><strong>{member.name}</strong><small>{member.email}{member.mustChangePassword?' · must change password':''}</small></td>
     <td>{manage&&member._id!==identity?.id
      ?<select className="platform-control" value={member.role} onChange={event=>changeRole.mutate({member,role:event.target.value})}>{(roles.data||[]).map(role=><option key={role.role} value={role.role}>{role.role}</option>)}</select>
      :<Status tone={member.role==='OWNER'?'info':'neutral'}>{member.role}</Status>}</td>
     <td><Status tone={member.status==='active'?'success':'danger'}>{member.status}</Status></td>
     <td>{dateTime(member.lastLoginAt)}</td>
     <td>{dateTime(member.createdAt)}</td>
     <td><div className="platform-actions">
      {manage&&<Button variant="outline" size="sm" onClick={()=>resetPassword.mutate(member)}><KeyRound size={13}/></Button>}
      {manage&&member._id!==identity?.id&&<Button variant="outline" size="sm" onClick={()=>changeStatus.mutate(member)}>{member.status==='active'?'Disable':'Reactivate'}</Button>}
     </div></td>
    </tr>)}
   </tbody></table>
   {!team.isLoading&&!team.data?.length&&<div className="platform-empty">No administrators found.</div>}</div>
  </Panel>

  <Panel title="What each role can do" copy="The same matrix authorises the API and builds this navigation" className="mt-4">
   <div className="platform-grid equal">{(roles.data||[]).map(role=><RoleCard key={role.role} role={role}/>)}</div>
  </Panel>

  <Dialog open={Boolean(draft)} onOpenChange={next=>!next&&setDraft(null)}>
   <DialogContent className="border-(--pa-line-strong) bg-(--pa-panel) text-(--pa-text) sm:max-w-xl">
    <DialogHeader><DialogTitle>Add administrator</DialogTitle></DialogHeader>
    {draft&&<div className="platform-form-grid">
     <Field label="Full name"><input value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></Field>
     <Field label="Work email"><input type="email" value={draft.email} onChange={event=>setDraft({...draft,email:event.target.value})}/></Field>
     <Field label="Role" hint={(roles.data||[]).find(role=>role.role===draft.role)?.description}>
      <select value={draft.role} onChange={event=>setDraft({...draft,role:event.target.value})}>{(roles.data||[]).map(role=><option key={role.role} value={role.role}>{role.role}</option>)}</select>
     </Field>
     <Field label="Temporary password" hint="They must change it after their first sign-in."><input type="password" value={draft.password} onChange={event=>setDraft({...draft,password:event.target.value})}/></Field>
     <Field label="Notes" wide><textarea value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></Field>
     {error&&<p className="platform-banner danger" style={{gridColumn:'1 / -1'}}><ShieldCheck size={14}/>{error}</p>}
     <Button disabled={create.isPending} onClick={()=>create.mutate(draft)} style={{gridColumn:'1 / -1'}}>{create.isPending?'Adding…':'Add administrator'}</Button>
    </div>}
   </DialogContent>
  </Dialog>
 </div>;
}

function RoleCard({role}:{role:RoleDefinition}){
 const wildcard=role.permissions.includes('*');
 return <section className="platform-panel"><div className="platform-panel-body">
  <strong style={{fontSize:11}}>{role.role}</strong>
  <p style={{color:'var(--pa-muted)',fontSize:9,lineHeight:1.6,margin:'6px 0 10px'}}>{role.description}</p>
  <div className="platform-chips">{wildcard?<span className="platform-chip">Every permission</span>:role.permissions.map(permission=><span className="platform-chip" key={permission}>{permission}</span>)}</div>
 </div></section>;
}
