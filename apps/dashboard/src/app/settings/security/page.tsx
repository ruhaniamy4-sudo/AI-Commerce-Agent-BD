'use client';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';
import { businessApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function SecurityPage(){
 const qc=useQueryClient();const [form,setForm]=useState({currentPassword:'',newPassword:'',confirm:''});const [error,setError]=useState('');
 const sessions=useQuery({queryKey:['security-sessions'],queryFn:businessApi.sessions});
 const change=useMutation({mutationFn:()=>businessApi.changePassword({currentPassword:form.currentPassword,newPassword:form.newPassword}),onSuccess:()=>void signOut({callbackUrl:'/login'}),onError:(cause:Error)=>setError(cause.message)});
 const revoke=useMutation({mutationFn:businessApi.revokeSession,onSuccess:()=>qc.invalidateQueries({queryKey:['security-sessions']})});
 function submit(event:React.FormEvent){event.preventDefault();setError('');if(form.newPassword!==form.confirm)return setError('Passwords do not match.');change.mutate();}
 return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Security</h1><p className="text-muted-foreground">Manage your password and signed-in devices.</p></div><Card className="max-w-2xl"><CardHeader><CardTitle>Change password</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-3">{error&&<p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Input type="password" autoComplete="current-password" placeholder="Current password" value={form.currentPassword} onChange={event=>setForm({...form,currentPassword:event.target.value})} required/><Input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} placeholder={`New password (${PASSWORD_MIN_LENGTH}+ characters)`} value={form.newPassword} onChange={event=>setForm({...form,newPassword:event.target.value})} required/><Input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} placeholder="Confirm new password" value={form.confirm} onChange={event=>setForm({...form,confirm:event.target.value})} required/><p className="text-xs text-muted-foreground">Changing your password signs out every device, including this one.</p><Button disabled={change.isPending}>{change.isPending?'Updating…':'Change password'}</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Active sessions</CardTitle></CardHeader><CardContent className="space-y-3">{sessions.isLoading&&<p>Loading sessions…</p>}{sessions.data?.filter(item=>!item.revokedAt).map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><div className="flex items-center gap-2"><b>{item.userAgent||'Unknown device'}</b>{item.current&&<Badge>Current</Badge>}</div><p className="text-xs text-muted-foreground">Signed in {new Date(item.createdAt).toLocaleString()} · expires {new Date(item.expiresAt).toLocaleString()}</p></div><Button size="sm" variant="outline" disabled={revoke.isPending} onClick={()=>revoke.mutate(item.id)}>{item.current?'Sign out':'Revoke'}</Button></div>)}{sessions.data&&!sessions.data.filter(item=>!item.revokedAt).length&&<p className="text-muted-foreground">No active sessions.</p>}</CardContent></Card></div>
}
