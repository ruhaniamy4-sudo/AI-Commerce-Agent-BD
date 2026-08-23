import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/marketing";

export const metadata: Metadata = { title: "Sign in", description: "Access information for provisioned Digitross workspaces." };

export default function SignInPage() { return <main><PageHero eyebrow="Workspace access" title="Sign in is available to provisioned teams." copy="Digitross is currently in early access. Workspace credentials and access instructions are provided directly during onboarding." /><section className="site-container pb-24"><div className="mx-auto max-w-xl surface-card p-7 sm:p-9"><div className="icon-tile"><KeyRound className="h-5 w-5" /></div><h2 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--ink)]">Need access to your workspace?</h2><p className="mt-3 leading-7 text-[var(--muted)]">Use the access link shared with your team. If you have not been onboarded yet, request an early-access walkthrough and we’ll map the right starting workflow.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/demo" className="button-primary">Request access <ArrowRight className="h-4 w-4" /></Link><Link href="/" className="button-secondary">Return home</Link></div><p className="mt-7 flex gap-2 border-t border-[var(--line)] pt-5 text-xs leading-5 text-[var(--muted)]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />We do not collect credentials on this public marketing site.</p></div></section></main>; }
