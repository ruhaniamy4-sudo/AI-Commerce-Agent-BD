"use client"

import { useQuery } from "@tanstack/react-query"
import { conversationsApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/layout/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CardContent } from "@/components/ui/card"
import { ArrowDownAZ, ArrowUpAZ, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, MessageSquare, Search, Zap, Signal } from "lucide-react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function ConversationsPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("updatedAt")
  const [order, setOrder] = useState<"asc" | "desc">("desc")

  const { data: response, isLoading, error } = useQuery({
    queryKey: ["conversations", page, searchQuery, sortBy, order],
    queryFn: () =>
      conversationsApi.getAll({
        page,
        limit: 10,
        search: searchQuery,
        sortBy,
        order,
      }),
  })

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(1)
  }

  const { data: conversations, pagination } = response || {}

  if (error) {
    return (
      <div className="flex flex-col h-full min-h-[80vh] items-center justify-center p-8">
        <div className="h-24 w-24 bg-rose-500/10 rounded-3xl flex items-center justify-center border border-rose-500/20 mb-8">
          <Signal className="h-10 w-10 text-rose-500 animate-pulse" />
        </div>
        <h2 className="text-3xl font-black text-white tracking-tighter mb-2">Signal Interrupted</h2>
        <p className="text-muted-foreground text-center max-w-sm font-medium">Unable to synchronize with the neural nexus. Verify your uplink status.</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="mt-8 rounded-2xl bg-white/5 border-white/10 text-white font-bold h-14 px-12 hover:bg-white/10">Retry Sync</Button>
      </div>
    )
  }

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

  return (
    <div className="flex flex-col h-full min-h-[90vh]">
      <PageHeader
        title="Signal Terminal"
        description="Monitor and orchestrate real-time AI-to-Entity interactions across all channels."
      />
      <div className="py-8">
        <div className="glass-card rounded-3xl overflow-hidden border-white/5 shadow-premium">
          <div className="p-8 border-b border-white/5 bg-white/[0.01]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white tracking-tight">Active Streams</h2>
                <p className="text-sm text-muted-foreground font-medium">{pagination?.total || 0} active communication channels</p>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/5">
                  <Button
                    variant="ghost"
                    className={cn(
                      "h-10 text-[10px] font-black uppercase tracking-widest px-4 rounded-xl transition-all",
                      sortBy === 'updatedAt' ? "bg-white text-black shadow-xl" : "text-muted-foreground hover:text-white"
                    )}
                    onClick={() => {
                      if (sortBy === 'updatedAt') {
                        setOrder(order === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('updatedAt')
                        setOrder('desc')
                      }
                      setPage(1)
                    }}
                  >
                    Recent
                    {sortBy === 'updatedAt' && (
                      order === 'desc' ? <ArrowDownAZ className="ml-2 h-3.5 w-3.5" /> : <ArrowUpAZ className="ml-2 h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    className={cn(
                      "h-10 text-[10px] font-black uppercase tracking-widest px-4 rounded-xl transition-all",
                      sortBy === 'messageCount' ? "bg-white text-black shadow-xl" : "text-muted-foreground hover:text-white"
                    )}
                    onClick={() => {
                      if (sortBy === 'messageCount') {
                        setOrder(order === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('messageCount')
                        setOrder('desc')
                      }
                      setPage(1)
                    }}
                  >
                    Density
                    {sortBy === 'messageCount' && (
                      order === 'desc' ? <ArrowDownAZ className="ml-2 h-3.5 w-3.5" /> : <ArrowUpAZ className="ml-2 h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="relative w-full md:w-80 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="Search client or payload..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-12 h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:bg-white/[0.05] transition-all shadow-inner text-white placeholder:text-muted-foreground/30"
                  />
                </div>
              </div>
            </div>
          </div>
          <CardContent className="p-0">
            {conversations && conversations.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/[0.02] hover:bg-white/[0.02] border-b border-white/5">
                      <TableHead className="font-bold py-5 pl-8 text-muted-foreground uppercase text-[10px] tracking-widest">Entity Signature</TableHead>
                      <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Payload Snippet</TableHead>
                      <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Temporal Log</TableHead>
                      <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Pulse</TableHead>
                      <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest text-right pr-8">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations.map((conversation) => (
                      <TableRow
                        key={conversation._id}
                        className="cursor-pointer hover:bg-white/[0.02] transition-colors group border-b border-white/[0.02]"
                        onClick={() => router.push(`/conversations/${conversation._id}`)}
                      >
                        <TableCell className="py-6 pl-8">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg group-hover:scale-110 transition-transform">
                              <span className="font-black text-primary text-[10px] tracking-tighter">
                                {(conversation.customer?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-base font-black text-white tracking-tight truncate max-w-[150px]">{conversation.customer?.name || 'External Envoy'}</span>
                              <span className="text-[10px] text-muted-foreground font-mono mt-0.5 opacity-60 italic">{conversation.customer?.phone || 'Encrypted Signal'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <div className="max-w-[320px] text-xs font-medium text-muted-foreground/80 line-clamp-2 leading-relaxed italic pr-4">
                            &quot;{conversation.lastMessage || <span className="opacity-30">Zero payload detected</span>}&quot;
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white tracking-tighter">
                              {format(new Date(conversation.updatedAt), "MMM d, HH:mm")}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest mt-0.5">
                              REF: {conversation.conversationId?.slice(-8).toUpperCase() || conversation._id.slice(-8).toUpperCase()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 w-fit">
                            <Zap className="h-3 w-3 text-amber-400 group-hover:animate-pulse" />
                            <span className="text-[10px] font-black text-white">{conversation.messageCount || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-6 text-right pr-8">
                          <Button variant="ghost" size="icon" className="h-10 w-10 bg-white/5 border border-white/10 text-white group-hover:text-primary group-hover:bg-white/10 rounded-xl transition-all">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="p-8 border-t border-white/5 bg-white/[0.01] flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Channel Stream Index {pagination?.page || 1} / {pagination?.totalPages || 1}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setPage(1)}
                      disabled={pagination?.page === 1}
                      className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 text-white disabled:opacity-20 transition-all hover:bg-white/10 p-0"
                    >
                      <ChevronsLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination?.page === 1}
                      className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 text-white disabled:opacity-20 transition-all hover:bg-white/10 p-0"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="h-12 px-6 flex items-center justify-center bg-primary text-white font-black text-xs rounded-2xl shadow-xl shadow-primary/20">
                      {pagination?.page || 1}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(pagination?.totalPages || 1, p + 1))}
                      disabled={pagination?.page === pagination?.totalPages}
                      className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 text-white disabled:opacity-20 transition-all hover:bg-white/10 p-0"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPage(pagination?.totalPages || 1)}
                      disabled={pagination?.page === pagination?.totalPages}
                      className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 text-white disabled:opacity-20 transition-all hover:bg-white/10 p-0"
                    >
                      <ChevronsRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-40 text-center space-y-6">
                <div className="h-24 w-24 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-2xl">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/20" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Stream Silence Detected</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">No communication signals currently active in this terminal sector.</p>
                </div>
              </div>
            )}
          </CardContent>
        </div>
      </div>
      <div className="h-20" />
    </div>
  )
}
