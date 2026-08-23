"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { agentApi } from "@/lib/api"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Loader2, Square, Activity, Timer, Zap, ShieldCheck, Database, Cpu, Power, AlertCircle } from "lucide-react"
import { format } from "date-fns"


export default function AgentPage() {
  const queryClient = useQueryClient()

  const { data: status, isLoading, error } = useQuery({
    queryKey: ["agent-status"],
    queryFn: () => agentApi.getStatus(),
    refetchInterval: 5000,
  })

  const startMutation = useMutation({
    mutationFn: () => agentApi.start(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-status"] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => agentApi.stop(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-status"] })
    },
  })

  const handleStart = () => startMutation.mutate()
  const handleStop = () => stopMutation.mutate()

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

  if (error) {
    return (
      <div className="flex flex-col h-full min-h-[80vh] items-center justify-center p-8">
        <div className="h-24 w-24 bg-rose-500/10 rounded-3xl flex items-center justify-center border border-rose-500/20 mb-8">
          <AlertCircle className="h-10 w-10 text-rose-500 animate-pulse" />
        </div>
        <h2 className="text-3xl font-black text-white tracking-tighter mb-2">Nexus Connectivity Error</h2>
        <p className="text-muted-foreground text-center max-w-sm font-medium">The neural uplink to the core agent has been severed. Re-initialization required.</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="mt-8 rounded-2xl bg-white/5 border-white/10 text-white font-bold h-14 px-12 hover:bg-white/10">Re-Establish Link</Button>
      </div>
    )
  }

  const currentStatus = status?.status || "stopped"
  const isActive = currentStatus === "active"

  return (
    <div className="flex flex-col h-full min-h-[90vh]">
      <PageHeader
        title="Command Orbit"
        description="Strategic oversight and operational control of the active neural workforce."
        actions={
          <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isActive ? "bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-rose-500"
            )} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">
              Link Status: {isActive ? "Uplink Secure" : "Dormant"}
            </span>
          </div>
        }
      />

      <div className="py-8">
        <div className="grid gap-8 md:grid-cols-3">
          <Card className="glass-card border-white/5 shadow-premium rounded-3xl overflow-hidden bg-white/[0.01]">
            <CardHeader className="p-8 pb-4">
              <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl font-black text-white tracking-tight text-primary">Core Vitality</CardTitle>
              <CardDescription className="text-muted-foreground/60 font-medium">Operational metrics and heartbeat</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">State</span>
                  <Badge className={cn(
                    "rounded-full px-4 py-1.5 font-black uppercase text-[10px] tracking-widest border-none",
                    isActive ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                  )}>
                    {isActive ? "ACTIVE" : "OFFLINE"}
                  </Badge>
                </div>
                {status?.lastActivity && (
                  <div className="flex flex-col gap-2 p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Zap className="h-3 w-3 text-amber-400" /> Human Activity Log
                    </span>
                    <p className="text-sm font-bold text-white tracking-tight">
                      {format(new Date(status.lastActivity), "MMM d, HH:mm:ss")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/5 shadow-premium rounded-3xl overflow-hidden bg-white/[0.01]">
            <CardHeader className="p-8 pb-4">
              <div className="bg-violet-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-violet-500/20">
                <Timer className="h-6 w-6 text-violet-400" />
              </div>
              <CardTitle className="text-xl font-black text-white tracking-tight">Automation Logic</CardTitle>
              <CardDescription className="text-muted-foreground/60 font-medium">Autonomous trigger parameters</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="flex flex-col gap-6">
                <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5 space-y-4">
                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                    Agent initializes autonomously after <span className="text-white font-black underline decoration-primary underline-offset-4">{status?.autoStartRule?.inactivityMinutes || 5} cycles</span> of operator dormancy.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      status?.autoStartRule?.enabled !== false ? "bg-emerald-500" : "bg-muted"
                    )} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Protocol: {status?.autoStartRule?.enabled !== false ? "ENABLED" : "BYPASSED"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/5 shadow-premium rounded-3xl overflow-hidden bg-white/[0.01]">
            <CardHeader className="p-8 pb-4">
              <div className="bg-amber-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-amber-500/20">
                <ShieldCheck className="h-6 w-6 text-amber-400" />
              </div>
              <CardTitle className="text-xl font-black text-white tracking-tight">Defense Clusters</CardTitle>
              <CardDescription className="text-muted-foreground/60 font-medium">Safety and compliance layers</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                  <Database className="h-5 w-5 text-muted-foreground/30 mb-2" />
                  <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground">Vector DB</span>
                  <span className="text-[10px] font-black text-white mt-1 uppercase tracking-widest">Uplink.256</span>
                </div>
                <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                  <Cpu className="h-5 w-5 text-muted-foreground/30 mb-2" />
                  <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground">Processor</span>
                  <span className="text-[10px] font-black text-white mt-1 uppercase tracking-widest text-primary">Neural.V8</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-3 glass-card border-white/5 shadow-premium rounded-3xl overflow-hidden bg-white/[0.01] border-t-4 border-t-primary/20">
            <CardHeader className="p-8 border-b border-white/5 bg-white/[0.01]">
              <CardTitle className="text-2xl font-black text-white tracking-tighter uppercase tracking-widest">Operator Console</CardTitle>
              <CardDescription className="text-muted-foreground font-medium">Manual override and agent orchestration</CardDescription>
            </CardHeader>
            <CardContent className="p-12">
              <div className="flex flex-col md:flex-row items-center justify-center gap-12">
                <div className="flex flex-col items-center gap-6">
                  <Button
                    onClick={handleStart}
                    disabled={isActive || startMutation.isPending}
                    className={cn(
                      "h-24 w-24 rounded-full border-none transition-all shadow-2xl relative group",
                      isActive
                        ? "bg-white/[0.05] text-muted-foreground cursor-not-allowed"
                        : "bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-110 active:scale-90 shadow-emerald-500/40"
                    )}
                  >
                    {startMutation.isPending ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <Power className="h-10 w-10" />
                    )}
                  </Button>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Initialize Agent</span>
                    <span className="text-[8px] font-medium text-muted-foreground">Status: {isActive ? "Running" : "Ready"}</span>
                  </div>
                </div>

                <div className="h-px w-24 md:h-24 md:w-px bg-white/10" />

                <div className="flex flex-col items-center gap-6">
                  <Button
                    onClick={handleStop}
                    disabled={!isActive || stopMutation.isPending}
                    className={cn(
                      "h-24 w-24 rounded-full border-none transition-all shadow-2xl relative group",
                      !isActive
                        ? "bg-white/[0.05] text-muted-foreground cursor-not-allowed"
                        : "bg-rose-500 hover:bg-rose-600 text-white hover:scale-110 active:scale-90 shadow-rose-500/40"
                    )}
                  >
                    {stopMutation.isPending ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <Square className="h-10 w-10 fill-current" />
                    )}
                  </Button>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Deactivate Agent</span>
                    <span className="text-[8px] font-medium text-muted-foreground">Security: Encrypted Stop</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="h-20" />
    </div>
  )
}
