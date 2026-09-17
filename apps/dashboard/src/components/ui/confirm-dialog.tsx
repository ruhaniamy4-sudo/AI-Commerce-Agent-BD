"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Info, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The workspace's own confirmation step.
 *
 * The browser's `confirm()` cannot be styled, blocks the whole tab, and puts the
 * page's hostname above the question — so a merchant is asked to delete their
 * product by something that looks like a browser warning. This keeps the same
 * shape as the call it replaces, so a site reads almost identically:
 *
 *     if (!(await confirm({ title: "Delete this product?" }))) return;
 *
 * When an action must be justified, `reason` turns the same dialog into confirm
 * and explain in one step, and the promise resolves with the text instead:
 *
 *     const why = await confirm({ title: "Suspend this business?", reason: {...} });
 *     if (!why) return;
 *
 * Cancel, Escape and a click outside all resolve to a refusal, so no destructive
 * action can proceed without an answer.
 */

export type ConfirmTone = "danger" | "warning" | "neutral";

export interface ReasonField {
    label: string;
    placeholder?: string;
    /** Short enough to be quick, long enough to be a real reason. */
    minLength?: number;
}

export interface ConfirmOptions {
    title: string;
    /** One sentence on what will actually happen. */
    description?: React.ReactNode;
    /** The specific things this affects — a short list reads faster than a paragraph. */
    consequences?: string[];
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
    /** Ask why, and hand the answer back instead of a plain yes. */
    reason?: ReasonField;
}

interface ConfirmFn {
    (options: ConfirmOptions & { reason: ReasonField }): Promise<string | null>;
    (options: ConfirmOptions): Promise<boolean>;
}

const TONES: Record<ConfirmTone, { icon: typeof Info; ring: string; variant: "destructive" | "default" }> = {
    danger: { icon: Trash2, ring: "bg-destructive/10 text-destructive", variant: "destructive" },
    warning: { icon: AlertTriangle, ring: "bg-amber-500/10 text-amber-600", variant: "default" },
    neutral: { icon: Info, ring: "bg-primary/10 text-primary", variant: "default" },
};

type Request = ConfirmOptions & { resolve: (answer: boolean | string | null) => void };

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [request, setRequest] = React.useState<Request | null>(null);
    const [reason, setReason] = React.useState("");

    const confirm = React.useCallback((options: ConfirmOptions) => {
        setReason("");
        return new Promise<boolean | string | null>((resolve) => {
            setRequest({ ...options, resolve });
        });
    }, []);

    // Whatever closes the dialog, the caller always gets an answer back.
    const answer = React.useCallback((accepted: boolean) => {
        setRequest((current) => {
            if (!current) return null;
            if (current.reason) current.resolve(accepted ? reason.trim() : null);
            else current.resolve(accepted);
            return null;
        });
    }, [reason]);

    const tone = TONES[request?.tone || "danger"];
    const Icon = tone.icon;
    const minimum = request?.reason?.minLength ?? 3;
    const canConfirm = !request?.reason || reason.trim().length >= minimum;

    return (
        <ConfirmContext.Provider value={confirm as unknown as ConfirmFn}>
            {children}
            <DialogPrimitive.Root open={Boolean(request)} onOpenChange={(open) => !open && answer(false)}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 z-100 bg-slate-950/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                    <DialogPrimitive.Content
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();
                            const root = event.currentTarget as HTMLElement;
                            // A reason has to be typed, so start there; otherwise land on
                            // Cancel rather than on the button that cannot be undone.
                            const target = root.querySelector<HTMLElement>("[data-confirm-reason]")
                                || root.querySelector<HTMLElement>("[data-confirm-cancel]");
                            target?.focus();
                        }}
                        className="fixed left-1/2 top-1/2 z-101 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-(--sp-shadow-floating) duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                    >
                        <div className="flex gap-4">
                            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tone.ring)} aria-hidden>
                                <Icon size={19} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <DialogPrimitive.Title className="text-base font-semibold leading-6">
                                    {request?.title}
                                </DialogPrimitive.Title>
                                <DialogPrimitive.Description
                                    className={request?.description ? "mt-2 text-sm leading-6 text-muted-foreground" : "sr-only"}
                                >
                                    {request?.description || "This action needs your confirmation."}
                                </DialogPrimitive.Description>

                                {Boolean(request?.consequences?.length) && (
                                    <ul className="mt-3 space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                                        {request!.consequences!.map((line) => (
                                            <li key={line} className="flex gap-2">
                                                <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                                                <span>{line}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {request?.reason && (
                                    <label className="mt-4 block text-xs font-medium text-muted-foreground">
                                        {request.reason.label}
                                        <textarea
                                            data-confirm-reason
                                            rows={2}
                                            value={reason}
                                            placeholder={request.reason.placeholder}
                                            onChange={(event) => setReason(event.target.value)}
                                            className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-hidden focus:border-primary"
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button data-confirm-cancel variant="outline" onClick={() => answer(false)}>
                                {request?.cancelLabel || "Cancel"}
                            </Button>
                            <Button variant={tone.variant} disabled={!canConfirm} onClick={() => answer(true)}>
                                {request?.confirmLabel || "Confirm"}
                            </Button>
                        </div>
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </ConfirmContext.Provider>
    );
}

/** Ask before doing something the merchant cannot take back. */
export function useConfirm(): ConfirmFn {
    const confirm = React.useContext(ConfirmContext);
    if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
    return confirm;
}

/** A button that asks first and only then runs — saves repeating the same three lines. */
export function ConfirmButton({
    options,
    onConfirmed,
    children,
    pending,
    ...props
}: React.ComponentProps<typeof Button> & {
    options: ConfirmOptions;
    onConfirmed: () => void | Promise<void>;
    pending?: boolean;
}) {
    const confirm = useConfirm();
    return (
        <Button
            {...props}
            disabled={props.disabled || pending}
            onClick={async () => {
                if (await confirm(options)) await onConfirmed();
            }}
        >
            {pending ? <Loader2 size={15} className="mr-2 animate-spin" /> : null}
            {children}
        </Button>
    );
}
