'use client';

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Menu, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function DashboardShell({ children }: { children: React.ReactNode }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    if (pathname === '/login' || pathname === '/signup' || pathname === '/onboarding') return <>{children}</>;

    return (
        <div className="flex h-screen overflow-hidden bg-background font-sans antialiased text-foreground">
            {/* Desktop Sidebar */}
            <Sidebar className="hidden md:flex md:w-72 lg:w-80" />

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md md:hidden transition-opacity duration-300"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar Content */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] md:hidden",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <Sidebar onClose={() => setIsMobileMenuOpen(false)} className="h-full" />
            </div>

            <div className="flex flex-1 flex-col overflow-hidden relative">
                {/* Background Blobs for Visual Interest */}
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 dark:bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

                {/* Mobile Header */}
                <header className="flex h-20 items-center justify-between px-6 md:hidden glass border-b border-border relative z-10">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-xl transition-all active:scale-95"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-bold text-foreground tracking-tight text-lg">SellPilot</span>
                    </div>
                    <div className="w-10" /> {/* Spacer */}
                </header>

                <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8 relative z-10 scroll-smooth shadow-[inset_0_4px_20px_rgba(0,0,0,0.1)]">
                    {children}
                </main>
            </div>
        </div>
    );
}
