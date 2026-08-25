"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { conversationsApi } from "@/lib/api"
import { PageHeader } from "@/components/layout/page-header"
import { CardContent } from "@/components/ui/card"
import { Loader2, ArrowLeft, Bot, User, Clock, Terminal, Zap } from "lucide-react"
import { format } from "date-fns"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"


export default function ConversationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const conversationId = params.id as string
  const queryClient = useQueryClient()

  const { data: conversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => conversationsApi.getById(conversationId),
  })

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: () => conversationsApi.getMessages(conversationId),
  })

  const controlMutation = useMutation({
    mutationFn: () => conversation?.controlMode === "HUMAN_ACTIVE"
      ? conversationsApi.returnToAI(conversationId)
      : conversationsApi.takeOver(conversationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["conversation", conversationId], updated)
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

  if (error) {
    return (
      <div className="flex flex-col h-full min-h-[80vh] items-center justify-center p-8">
        <div className="h-24 w-24 bg-rose-500/10 rounded-3xl flex items-center justify-center border border-rose-500/20 mb-8">
          <Terminal className="h-10 w-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-black text-foreground tracking-tighter mb-2">Conversation unavailable</h2>
        <p className="text-muted-foreground text-center max-w-sm font-medium">Check your access or connection and try again.</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-8 rounded-2xl font-bold h-14 px-12">Back to conversations</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-[90vh]">
      <PageHeader
        title="Conversation"
        description={`Customer message history · ${conversation?.platform || 'channel'}`}
        actions={
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2 h-14 px-8 rounded-2xl bg-white/5 border-white/10 text-white hover:bg-white/10 font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-black/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to conversations
          </Button>
        }
      />
      <div className="py-8">
        <div className="glass-card rounded-3xl overflow-hidden border-white/5 shadow-premium bg-black/20 backdrop-blur-3xl min-h-[70vh] flex flex-col">
          <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground tracking-widest uppercase">Message history</h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">Persisted customer and AI messages</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border",
                conversation?.controlMode === "HUMAN_ACTIVE"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              )}>
                {conversation?.controlMode === "HUMAN_ACTIVE" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {conversation?.controlMode === "HUMAN_ACTIVE" ? "Human Active" : "AI Active"}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!conversation || controlMutation.isPending}
                onClick={() => controlMutation.mutate()}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                {controlMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : conversation?.controlMode === "HUMAN_ACTIVE" ? "Return to AI" : "Take Over"}
              </Button>
            </div>
          </div>

          <CardContent className="flex-1 p-8 overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
            <div className="space-y-12">
              {messages && messages.length > 0 ? (
                messages.map((message, idx) => (
                  <div
                    key={message._id}
                    className={cn(
                      "flex flex-col group animate-in fade-in slide-in-from-bottom-4 duration-500",
                      message.role === "user" ? "items-start" : "items-end"
                    )}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className={cn(
                      "flex items-center gap-3 mb-3",
                      message.role === "user" ? "flex-row" : "flex-row-reverse"
                    )}>
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center border",
                        message.role === "user"
                          ? "bg-white/10 border-white/10 text-white"
                          : "bg-primary/10 border-primary/20 text-primary"
                      )}>
                        {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-[0.2em]",
                          message.role === "user" ? "text-muted-foreground" : "text-primary text-right"
                        )}>
                          {message.role === "user" ? "Customer" : "SellPilot AI"}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
                          <span className="text-[9px] text-muted-foreground/60 font-mono italic">
                            {format(new Date(message.createdAt), "HH:mm:ss.SSS")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "relative max-w-[85%] md:max-w-xl group-hover:scale-[1.01] transition-transform duration-300",
                        message.role === "user"
                          ? "bg-white/[0.04] text-white border-l-2 border-white/20 rounded-2xl rounded-tl-none p-6"
                          : "bg-primary text-white border-r-2 border-primary/50 shadow-2xl shadow-primary/20 rounded-2xl rounded-tr-none p-6 text-right"
                      )}
                    >
                      <p className="text-sm md:text-base font-medium leading-relaxed whitespace-pre-wrap tracking-tight">
                        {message.content}
                      </p>
                      <div className={cn(
                        "absolute -bottom-6 opacity-0 group-hover:opacity-40 transition-opacity text-[8px] font-mono tracking-tighter uppercase",
                        message.role === "user" ? "left-0" : "right-0"
                      )}>
                        {message.role === 'user' ? 'Customer message' : 'AI reply'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-40 text-center space-y-6">
                  <div className="h-20 w-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10 shadow-inner">
                    <Terminal className="h-8 w-8 text-muted-foreground/20" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-foreground">No messages yet</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">This conversation exists but no messages have been recorded.</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <div className="p-8 bg-white/[0.01] border-t border-white/5">
            <div className="flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">
              <div className="h-[1px] w-24 bg-gradient-to-r from-transparent to-white/10" />
              End of conversation history
              <div className="h-[1px] w-24 bg-gradient-to-l from-transparent to-white/10" />
            </div>
          </div>
        </div>
      </div>
      <div className="h-20" />
    </div>
  )
}
