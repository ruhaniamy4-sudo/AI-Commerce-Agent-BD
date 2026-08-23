'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { customersApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const customerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().min(10, 'Valid phone number is required'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    language: z.enum(['en', 'bn', 'hi']),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CreateCustomerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateCustomerDialog({ open, onOpenChange }: CreateCustomerDialogProps) {
    const queryClient = useQueryClient();

    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            language: 'en',
        },
    });

    const { mutate: createCustomer, isPending } = useMutation({
        mutationFn: (values: CustomerFormValues) => {
            // Generate a manual PSID for dashboard-created customers
            const manualPsid = `MANUAL_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            return customersApi.create({
                ...values,
                psid: manualPsid,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success('Customer entity synchronized successfully');
            onOpenChange(false);
            form.reset();
        },
        onError: (error: unknown) => {
            const apiError = error as { response?: { data?: { error?: string } } };
            const message = error instanceof Error ? error.message : apiError.response?.data?.error || 'Failed to synchronize entity';
            toast.error(message);
        },
    });

    const onSubmit = (values: CustomerFormValues) => {
        createCustomer(values);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] glass-card border-white/5 bg-background shadow-premium p-0 overflow-hidden rounded-[2rem]">
                <div className="p-8 space-y-6">
                    <DialogHeader>
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg mb-4">
                            <UserPlus className="h-7 w-7 text-primary" />
                        </div>
                        <DialogTitle className="text-3xl font-black text-white tracking-tight">Initialize Entity</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium">
                            Create a new node in the customer matrix with manual signature.
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Entity Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g., John Doe"
                                                {...field}
                                                className="h-12 bg-white/[0.03] border-white/5 rounded-xl focus:bg-white/[0.05] transition-all text-white placeholder:text-muted-foreground/30"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[10px] uppercase font-bold tracking-tight text-red-400" />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Signal Phone</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="017..."
                                                    {...field}
                                                    className="h-12 bg-white/[0.03] border-white/5 rounded-xl focus:bg-white/[0.05] transition-all text-white placeholder:text-muted-foreground/30"
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[10px] uppercase font-bold tracking-tight text-red-400" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="language"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Core Dialect</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 bg-white/[0.03] border-white/5 rounded-xl focus:bg-white/[0.05] transition-all text-white">
                                                        <SelectValue placeholder="Language" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-popover border-white/10 rounded-xl">
                                                    <SelectItem value="en" className="text-sm font-medium">English</SelectItem>
                                                    <SelectItem value="bn" className="text-sm font-medium">Bengali</SelectItem>
                                                    <SelectItem value="hi" className="text-sm font-medium">Hindi</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Endpoint (Optional)</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="john@nexus.com"
                                                {...field}
                                                className="h-12 bg-white/[0.03] border-white/5 rounded-xl focus:bg-white/[0.05] transition-all text-white placeholder:text-muted-foreground/30"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[10px] uppercase font-bold tracking-tight text-red-400" />
                                    </FormItem>
                                )}
                            />

                            <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                                <ShieldCheck className="h-4 w-4 text-primary" />
                                <span className="text-[10px] font-bold text-primary/80 uppercase tracking-widest">Manual Node Verification Enabled</span>
                            </div>

                            <DialogFooter className="pt-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => onOpenChange(false)}
                                    className="h-12 px-6 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 transition-all text-[11px] font-black uppercase tracking-widest"
                                >
                                    Abort
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isPending}
                                    className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all ml-4"
                                >
                                    {isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Synchronizing...
                                        </>
                                    ) : (
                                        'Initialize Node'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
