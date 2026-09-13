import { Bot, Facebook, Globe, MessageCircle, User, FlaskConical, AlertCircle } from 'lucide-react';

export type InboxChannel = 'messenger' | 'whatsapp' | 'web' | 'test' | 'other';

const CHANNELS: Record<InboxChannel, { label: string; icon: typeof Globe; className: string }> = {
    messenger: { label: 'Messenger', icon: Facebook, className: 'bg-[#0084FF]/10 text-[#0084FF]' },
    whatsapp: { label: 'WhatsApp', icon: MessageCircle, className: 'bg-[#25D366]/10 text-[#128C7E]' },
    web: { label: 'Website', icon: Globe, className: 'bg-primary/10 text-primary' },
    test: { label: 'Test AI', icon: FlaskConical, className: 'bg-amber-500/10 text-amber-600' },
    other: { label: 'Other', icon: Globe, className: 'bg-muted text-muted-foreground' },
};

/** Where the customer wrote from — the first thing a merchant needs to know. */
export function ChannelBadge({ channel }: { channel?: string }) {
    const { label, icon: Icon, className } = CHANNELS[(channel as InboxChannel) || 'other'] || CHANNELS.other;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
            <Icon size={12} />
            {label}
        </span>
    );
}

/** Who owes this customer a reply right now. */
export function HandlerBadge({ controlMode, needsHumanHandoff }: { controlMode?: string; needsHumanHandoff?: boolean }) {
    if (needsHumanHandoff) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-600">
                <AlertCircle size={12} />
                Needs you
            </span>
        );
    }
    const human = controlMode === 'HUMAN_ACTIVE';
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${human ? 'bg-violet-500/10 text-violet-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
            {human ? <User size={12} /> : <Bot size={12} />}
            {human ? 'You' : 'AI'}
        </span>
    );
}
