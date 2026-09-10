'use client';

import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {Product} from '@/types';
import {apiClient} from '@/lib/api-client';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export type SellingStatus='active'|'limited'|'disabled';
export function availableUnits(product:Product) {
    const variants=product.variants?.filter(variant=>variant.isActive!==false)||[];
    if(!variants.length)return product.stock;
    return variants.some(variant=>typeof variant.stock!=='number')?null:variants.reduce((sum,variant)=>sum+(variant.stock||0),0);
}
export function StatusLabel({status}:{status:SellingStatus}) {
    return <span className={`product-status ${status}`}><i/>{status==='active'?'Active':status==='limited'?'Limited':'Disabled'}</span>;
}
export function useProductSelling(onSaved?:(product:Product)=>void) {
    const [disabling,setDisabling]=useState<Product|null>(null);
    const [reason,setReason]=useState('Out of Stock');
    const client=useQueryClient();
    const mutation=useMutation({
        mutationFn:({id,status,reason}:{id:string;status:SellingStatus;reason?:string})=>apiClient.patch<Product>(`/api/products/${id}/ai-selling`,{status,reason}),
        onSuccess:product=>{
            void client.invalidateQueries({queryKey:['products']});
            void client.invalidateQueries({queryKey:['product-detail',product._id]});
            onSaved?.(product);
            setDisabling(null);
        },
    });
    const change=(product:Product,status:SellingStatus)=>{
        mutation.reset();
        if(status==='disabled'){setReason('Out of Stock');setDisabling(product);}
        else mutation.mutate({id:product._id,status});
    };
    const confirmation=<Dialog open={!!disabling} onOpenChange={open=>{if(!open&&!mutation.isPending)setDisabling(null);}}>
        <DialogContent><DialogHeader><DialogTitle>Turn Off AI Selling?</DialogTitle><DialogDescription>The AI agent will stop recommending this product and will not accept new orders for this product.</DialogDescription></DialogHeader>
            <p className="text-sm font-semibold">{disabling?.name}</p>
            <fieldset className="space-y-3 my-3"><legend className="mb-3 text-sm font-semibold">Reason</legend>
                {['Out of Stock','Temporarily unavailable','Discontinued'].map(value=><label key={value} className="flex gap-3 items-center rounded-xl border p-3 text-sm cursor-pointer"><input type="radio" name="disable-reason" checked={reason===value} onChange={()=>setReason(value)}/>{value}</label>)}
            </fieldset>
            {mutation.isError&&<p role="alert" className="text-sm text-destructive">Could not update selling status. Check your administrator access and try again.</p>}
            <div className="flex justify-end gap-3"><Button variant="outline" disabled={mutation.isPending} onClick={()=>setDisabling(null)}>Cancel</Button><Button disabled={mutation.isPending} onClick={()=>disabling&&mutation.mutate({id:disabling._id,status:'disabled',reason})}>{mutation.isPending?'Saving…':'Turn Off'}</Button></div>
        </DialogContent>
    </Dialog>;
    return {change,confirmation,isPending:mutation.isPending,isError:mutation.isError&&!disabling};
}
