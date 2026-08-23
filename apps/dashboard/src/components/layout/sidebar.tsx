'use client';

import { cn } from '@/lib/utils';
import {
    BookOpen,
    Bot,
    HelpCircle,
    Layers,
    LogOut,
    MessageSquare,
    Package,
    ShoppingCart,
    Terminal,
    TestTube,
    Users,
    X,
    TrendingUp,
    PlugZap,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';


const navigation = [
    { name: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
    { name: 'Agent AI', href: '/agent', icon: Bot },
    { name: 'Inbox', href: '/conversations', icon: MessageSquare },
    { name: 'Products', href: '/products', icon: ShoppingCart },
    { name: 'Categories', href: '/categories', icon: Layers },
    { name: 'Orders', href: '/orders', icon: Package },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Knowledge', href: '/knowledge', icon: BookOpen },
    { name: 'System Prompts', href: '/system-prompts', icon: Terminal },
    { name: 'Integrations', href: '/settings/integrations', icon: PlugZap },
];

const systemNav = [
    { name: 'Manual Test', href: '/manual-test', icon: TestTube },
    { name: 'System Errors', href: '/errors', icon: Terminal },
    { name: 'Unanswered', href: '/unanswered', icon: HelpCircle },
];

interface SidebarProps {
    onClose?: () => void;
    className?: string;
}

export function Sidebar({ onClose, className }: SidebarProps) {
    const pathname = usePathname();
    const { data: session } = useSession();

    const NavItem = ({ item }: { item: typeof navigation[0] }) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
        return (
            <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                    'group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground hover:translate-x-1'
                )}
            >
                <item.icon className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-primary-foreground" : "group-hover:text-primary"
                )} />
                {item.name}
            </Link>
        );
    };

    return (
        <div className={cn("flex h-full flex-col bg-background md:p-4", className)}>
            <div className="flex flex-col h-full glass-card rounded-2xl overflow-hidden border-border shadow-premium">
                {/* Logo Section */}
                <div className="flex h-20 items-center justify-between px-6 border-b border-border bg-muted/5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-primary/20">
                            <Bot className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-tight text-foreground leading-tight">Digitross</span>
                            <span className="text-[10px] font-medium text-primary uppercase tracking-widest">AI Agent</span>
                        </div>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="md:hidden p-2 hover:bg-accent rounded-xl transition-colors">
                            <X className="h-5 w-5 text-muted-foreground" />
                        </button>
                    )}
                </div>

                {/* Main Navigation */}
                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-hide">
                    <div className="space-y-1.5">
                        <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Management</p>
                        {navigation.filter((item) => item.href !== '/settings/integrations' || session?.role !== 'Staff').map((item) => (
                            <NavItem key={item.name} item={item} />
                        ))}
                    </div>

                    <div className="space-y-1.5">
                        <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">System</p>
                        {systemNav.map((item) => (
                            <NavItem key={item.name} item={item} />
                        ))}
                    </div>
                </div>

                {/* Footer Section */}
                <div className="p-4 border-t border-border bg-muted/5 space-y-2">

                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive group"
                    >
                        <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
