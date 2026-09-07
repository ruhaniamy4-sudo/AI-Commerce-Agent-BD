"use client";
import {useState} from "react";
import Link from 'next/link';
import {useQuery} from "@tanstack/react-query";
import {customersApi} from "@/lib/api";
import {PageHeader} from "@/components/layout/page-header";
import {WorkspacePanel,WorkspaceSearch,WorkspaceEmpty,WorkspacePagination} from "@/components/layout/workspace-surface";
import {Button} from "@/components/ui/button";
import {CreateCustomerDialog} from "@/components/customers/create-customer-dialog";
import {Plus,Users} from "lucide-react";
import {format} from "date-fns";
export default function CustomersPage(){
 const [page,setPage]=useState(1);const [searchQuery,setSearchQuery]=useState("");const [isCreateDialogOpen,setIsCreateDialogOpen]=useState(false);
 const {data:response,isLoading,error,refetch}=useQuery({queryKey:["customers",page,searchQuery],queryFn:()=>customersApi.getAll({page,limit:10,search:searchQuery})});
 const customers=response?.data||[];const pagination=response?.pagination;
 return <div><PageHeader title="Customers" description="The people behind your conversations. Keep their contact details and business context together." actions={<Button onClick={()=>setIsCreateDialogOpen(true)}><Plus size={15} className="mr-2"/>Add customer</Button>}/><WorkspacePanel title="Customer directory" description={`${pagination?.total||0} contacts in this workspace`} actions={<WorkspaceSearch value={searchQuery} onChange={value=>{setSearchQuery(value);setPage(1);}} placeholder="Search name, phone, or PSID"/>}>{isLoading?<p role="status" className="p-12 text-sm text-muted-foreground text-center">Loading your customers…</p>:error?<WorkspaceEmpty title="Customers unavailable" copy="We couldn’t load your contacts. Please try again." action={<Button variant="outline" onClick={()=>refetch()}>Try again</Button>}/>:customers.length?<div className="work-table-scroll"><table className="work-table"><thead><tr>{["Customer","Contact","Location","Language","Last activity"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{customers.map(customer=><tr key={customer._id}><td><div className="flex items-center gap-3"><span className="h-9 w-9 grid place-items-center rounded-full bg-primary/10 text-primary shrink-0"><Users size={15}/></span><div><Link href={`/customers/${customer._id}`} className="font-semibold hover:underline">{customer.name||"Unnamed customer"}</Link><small>{customer.psid?.slice(0,12)||"Manually added"}</small></div></div></td><td>{customer.phone||"No phone"}<small>{customer.email||"No email"}</small></td><td>{customer.city||"Not provided"}</td><td><span className="work-status">{customer.language||"en"}</span></td><td>{customer.updatedAt?format(new Date(customer.updatedAt),"MMM d, yyyy"):"Not available"}</td></tr>)}</tbody></table></div>:<WorkspaceEmpty title="Your customer list starts here." copy="Add a contact or connect a channel. Customers from conversations will appear in this workspace." action={<Button variant="outline" onClick={()=>setIsCreateDialogOpen(true)}>Add your first customer</Button>}/>}<WorkspacePagination page={page} totalPages={pagination?.totalPages||1} total={pagination?.total||0} onChange={setPage}/></WorkspacePanel><CreateCustomerDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}/></div>;
}
