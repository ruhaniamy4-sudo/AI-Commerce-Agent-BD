"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { conversationsApi } from "@/lib/api"
import { PageHeader } from "@/components/layout/page-header"
import { WorkspacePanel, WorkspaceEmpty } from "@/components/layout/workspace-surface"
import { Loader2, ArrowLeft, Bot, User } from "lucide-react"
import { format } from "date-fns"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { customerFacingText } from "@/lib/assistant-response"
import { useState } from "react"
import { Send } from "lucide-react"
import {CustomerIntelligencePanel} from '@/components/customers/customer-intelligence-panel'


export default function ConversationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const conversationId = params.id as string
  const queryClient = useQueryClient()
  const [reply, setReply] = useState("")

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

  const replyMutation = useMutation({
    mutationFn: () => conversationsApi.reply(conversationId, reply.trim()),
    onSuccess: () => {
      setReply("")
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] })
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })

  return <div className="space-y-6">
    <PageHeader title="Conversation" description={`Customer history · ${conversation?.platform || 'Connected channel'}`}
      actions={<Button variant="outline" onClick={() => router.push('/conversations')}><ArrowLeft size={16} className="mr-2" />All conversations</Button>} />
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]"><WorkspacePanel title="Message history" description="Saved customer and assistant messages"
      actions={<div className="flex flex-wrap items-center gap-3"><span className="work-status">{conversation?.controlMode === 'HUMAN_ACTIVE' ? 'Human active' : 'AI active'}</span><Button size="sm" variant="outline" disabled={!conversation || controlMutation.isPending} onClick={() => controlMutation.mutate()}>{controlMutation.isPending ? 'Updating…' : conversation?.controlMode === 'HUMAN_ACTIVE' ? 'Return to AI' : 'Take over'}</Button></div>}>
      {controlMutation.isError && <p role="alert" className="p-5 text-sm text-destructive">Could not change conversation control. Please try again.</p>}
      {isLoading ? <p role="status" className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading conversation…</p>
      : error ? <WorkspaceEmpty title="Conversation unavailable" copy="Check your access or connection and try again." />
      : !messages?.length ? <WorkspaceEmpty title="No messages yet" copy="Customer and assistant messages will appear here." />
      : <div role="log" aria-label="Conversation history" className="max-h-[65dvh] space-y-6 overflow-y-auto p-4 sm:p-6">{messages.map((message) => <article key={message._id} className={cn('flex flex-col', message.role === 'user' ? 'items-start' : 'items-end')}>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">{message.role === 'user' || message.metadata?.source === 'human' ? <User size={14} /> : <Bot size={14} />}<span>{message.role === 'user' ? 'Customer' : message.metadata?.source === 'human' ? 'Your team' : 'SellPilot AI'}</span><time dateTime={message.createdAt}>{format(new Date(message.createdAt), 'MMM d, HH:mm')}</time></div>
        <p className={cn('max-w-[95%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[80%]',message.role === 'user' ? 'border border-border bg-muted text-foreground' : 'bg-primary text-primary-foreground')}>{message.role === 'user' || message.metadata?.source === 'human' ? message.content : customerFacingText(message.content)}</p>
      </article>)}</div>}
      <footer className="border-t border-border p-4">{conversation?.controlMode === 'HUMAN_ACTIVE' ? <form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (reply.trim()) replyMutation.mutate() }}><input className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" value={reply} onChange={event => setReply(event.target.value)} placeholder="Reply as your team…" maxLength={2000}/><Button type="submit" disabled={!reply.trim() || replyMutation.isPending}>{replyMutation.isPending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}<span className="ml-2">Send</span></Button></form> : <p className="text-center text-xs text-muted-foreground">Take over this conversation to reply manually.</p>}{replyMutation.isError && <p className="mt-2 text-xs text-destructive">The reply could not be delivered. Check the channel connection and try again.</p>}</footer>
    </WorkspacePanel><CustomerIntelligencePanel conversationId={conversationId}/></div>
  </div>
}
