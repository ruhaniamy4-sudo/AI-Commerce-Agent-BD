"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  Bot,
  Check,
  Loader2,
  MessageCircle,
  Package,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  WandSparkles,
  X,
} from "lucide-react"
import { conversationsApi, testAiApi, TestAiMessage, TestAiState } from "@/lib/api"
import { customerFacingText } from "@/lib/assistant-response"
import { SafeProductImage } from "@/components/ui/safe-product-image"
import { ImageUpload } from "@/components/ui/image-upload"
import "./testing.css"

const EMPTY: TestAiState = {
  conversation: null,
  messages: [],
  usage: {
    aiReplies: 0,
    llmCalls: 0,
    nonGenerationAiCalls: 0,
    zeroLlmResponses: 0,
    llmAssistedResponses: 0,
    providers: [],
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
    averageTokensPerReply: 0,
    estimatedCost: null,
  },
}

function getSuggestedPrompts(businessType?: string): string[] {
  const type = String(businessType || "").toUpperCase()
  if (type === "VISA_CONSULTANCY" || type === "EDUCATION_CONSULTANCY") {
    return [
      "Canada application er requirements ki?",
      "Consultation book korte parbo?",
      "Service charge koto?",
      "Processing time koto?",
    ]
  }
  if (["AGENCY", "CLINIC_SERVICE", "SERVICE", "EDTECH", "SAAS", "REAL_ESTATE"].includes(type)) {
    return [
      "Ei service ta kivabe kaj kore?",
      "Price koto?",
      "Appointment available?",
      "Kotha theke start korbo?",
    ]
  }
  return [
    "Black hoodie ta ache?",
    "Delivery charge koto?",
    "COD available?",
    "Return policy ki?",
  ]
}

export function TestingWorkspace({ onOpenLive }: { onOpenLive: (conversationId?: string) => void }) {
  const [state, setState] = useState<TestAiState>(EMPTY)
  const [input, setInput] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const scroll = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  const liveQuery = useQuery({
    queryKey: ["assistant-activity"],
    queryFn: () => conversationsApi.getAll({ limit: 40, sortBy: "updatedAt", order: "desc" }),
    refetchInterval: 20000,
  })
  const live = useMemo(
    () => (liveQuery.data?.data || []).filter(item => item.platform !== "manual" && !item.conversationId.startsWith("test_")),
    [liveQuery.data?.data]
  )

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    testAiApi
      .newConversation()
      .then(setState)
      .catch(cause => setError(cause instanceof Error ? cause.message : "Unable to start Test AI"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (scroll.current) {
      scroll.current.scrollTop = scroll.current.scrollHeight
    }
  }, [state.messages, sending])

  const latestAssistant = [...state.messages].reverse().find(message => message.role === "assistant")
  const products = latestAssistant?.products || []
  const intent = latestAssistant?.intent || inferIntent(state.messages)
  const signals = deriveSignals(state.messages)
  const score = Math.min(96, (state.context?.intentScore || 0) + signals.length * 12)
  const prompts = useMemo(() => getSuggestedPrompts(state.context?.businessType), [state.context?.businessType])

  async function send(event?: FormEvent, promptText?: string) {
    event?.preventDefault()
    const message = (promptText ?? input).trim()
    const imageUrl = images[0]
    if ((!message && !imageUrl) || sending) return
    setInput("")
    setImages([])
    setSending(true)
    setError("")
    setState(current => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: `pending-${Date.now()}`,
          role: "user",
          content: message,
          imageUrl,
          createdAt: new Date().toISOString(),
        },
      ],
    }))
    try {
      const updated = await testAiApi.send(message, imageUrl)
      setState(updated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI request failed")
      await testAiApi.history().then(setState).catch(() => undefined)
    } finally {
      setSending(false)
    }
  }

  async function reset() {
    setState(EMPTY)
    setInput("")
    setImages([])
    setLoading(true)
    setError("")
    try {
      const refreshed = await testAiApi.newConversation()
      setState(refreshed)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start a new chat")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="test-workspace">
      <header className="test-workspace-toolbar">
        <div className="test-toolbar-left">
          <div className="test-mode-tabs" role="tablist" aria-label="Assistant modes">
            <button className="test-mode-tab is-active" role="tab" aria-selected="true">
              <Bot size={15} />
              <span>Test AI</span>
            </button>
            <button
              className="test-mode-tab"
              role="tab"
              aria-selected="false"
              onClick={() => onOpenLive()}
            >
              <Users size={15} />
              <span>Live supervision</span>
              {live.filter(item => item.controlMode === "AI_ACTIVE").length > 0 && (
                <span className="test-tab-badge">
                  {live.filter(item => item.controlMode === "AI_ACTIVE").length}
                </span>
              )}
            </button>
          </div>
          <span className="test-toolbar-tagline">
            Sandbox environment · Real merchant products &amp; knowledge connected
          </span>
        </div>
        <div className="test-toolbar-right">
          <button
            className="test-btn-ghost"
            onClick={reset}
            disabled={loading || sending}
            title="Start a fresh test conversation"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span>New chat</span>
          </button>
          <Link className="test-btn-outline" href="/training">
            <Sparkles size={15} />
            <span>Train AI</span>
          </Link>
        </div>
      </header>

      <div className="test-workspace-layout">
        <section className="test-console-card">
          <div className="test-console-header">
            <div className="test-customer-pill">
              <div className="test-avatar-circle">
                <span>C</span>
                <i className="test-avatar-pulse" />
              </div>
              <div>
                <h2>Customer simulation</h2>
                <p>Private testing sandbox · Test how your AI sales agent replies</p>
              </div>
            </div>
            <div className="test-console-header-actions">
              <span className="test-badge-sandbox">
                <span className="test-badge-dot" /> Sandbox
              </span>
            </div>
          </div>

          <div className="test-chat-scroll" ref={scroll} role="log" aria-label="Customer conversation simulation">
            {!loading && !state.messages.length && (
              <div className="test-hero-empty">
                <div className="test-hero-brand-mark intro-fade-scale">
                  <Bot size={26} />
                </div>
                <h1 className="test-hero-title intro-fade-up intro-delay-1">Test your sales AI</h1>
                <p className="test-hero-subtitle intro-fade-up intro-delay-2">
                  See how <span className="test-brand-accent">SellPilot</span> handles a customer.
                </p>
                <p className="test-hero-desc intro-fade-up intro-delay-3">
                  SellPilot will search your products and knowledge, then respond exactly as your AI sales employee would.
                </p>
                <div className="test-hero-prompts intro-fade-up intro-delay-4">
                  {prompts.map((prompt, index) => (
                    <button
                      key={prompt}
                      type="button"
                      className={`test-prompt-btn prompt-stagger-${index}`}
                      onClick={() => void send(undefined, prompt)}
                    >
                      <Sparkles size={13} />
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {state.messages.map(message => (
              <TestMessageItem key={message.id} message={message} />
            ))}

            {sending && (
              <article className="test-chat-message assistant">
                <div className="test-message-meta">
                  <span>
                    <span className="test-mini-brand">
                      <Bot size={13} />
                    </span>
                    SellPilot AI
                  </span>
                </div>
                <div className="test-bubble test-typing">
                  <i />
                  <i />
                  <i />
                </div>
              </article>
            )}

            {error && (
              <div className="test-error-card">
                <p>{error}</p>
              </div>
            )}
          </div>

          <footer className="test-composer">
            {images.length > 0 && (
              <div className="test-image-preview-bar">
                <div className="test-preview-thumb">
                  <SafeProductImage src={images[0]} alt="Uploaded customer attachment" />
                  <button
                    type="button"
                    onClick={() => setImages([])}
                    className="test-remove-thumb"
                    aria-label="Remove image"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={send} className="test-composer-box">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                placeholder="Ask as a customer… (Press Enter to send, Shift+Enter for new line)"
                rows={1}
                disabled={sending}
              />
              <div className="test-composer-bar">
                <div className="test-composer-tools">
                  <ImageUpload
                    value={images}
                    onChange={setImages}
                    disabled={sending}
                    folder="test-ai"
                    maxFiles={1}
                  />
                  <div className="test-live-indicator" title="Connected to real catalog &amp; business facts">
                    <span className="test-live-dot" />
                    <span>Products and knowledge are live</span>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={sending || (!input.trim() && !images.length)}
                  className="test-send-button"
                  aria-label="Send message"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
          </footer>
        </section>

        <aside className="test-activity-panel">
          <div className="test-activity-header">
            <div>
              <span className="test-kicker">AI ACTIVITY</span>
              <h2>Sales Operation</h2>
            </div>
            <button
              type="button"
              className="test-open-live-btn"
              onClick={() => onOpenLive()}
              title="Switch to live customer conversations"
            >
              <MessageCircle size={14} />
              <span>Open live</span>
            </button>
          </div>

          <div className="test-activity-content">
            <section className="test-understanding-card">
              <div className="test-understanding-head">
                <div className="test-sparkle-icon">
                  <WandSparkles size={18} />
                </div>
                <div className="test-understanding-text">
                  <small>AI UNDERSTANDING</small>
                  <strong>{intent.replaceAll("_", " ")}</strong>
                </div>
                <span className="test-score-pill">{score}%</span>
              </div>
              <div className="test-metrics-grid">
                <div className="test-metric-cell">
                  <small>Response quality</small>
                  <strong>{state.usage.aiReplies ? "Grounded" : "Waiting"}</strong>
                </div>
                <div className="test-metric-cell">
                  <small>Purchase intent</small>
                  <strong>{score > 69 ? "High" : score > 35 ? "Medium" : "Low"}</strong>
                </div>
                <div className="test-metric-cell">
                  <small>Knowledge used</small>
                  <strong>{state.context?.knowledgeUsed ? "Yes" : "Not yet"}</strong>
                </div>
                <div className="test-metric-cell">
                  <small>Order stage</small>
                  <strong>{state.context?.salesStage || "Discovery"}</strong>
                </div>
              </div>
            </section>

            <section className="test-card-section">
              <h3>Signals detected</h3>
              {signals.length ? (
                <ul className="test-signal-list">
                  {signals.map(signal => (
                    <li key={signal}>
                      <Check size={14} />
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="test-empty-notice">
                  Ask about price, stock, delivery, payment, or ordering to inspect AI intent signals.
                </p>
              )}
            </section>

            <section className="test-card-section">
              <h3>Matched products</h3>
              {products.length ? (
                <div className="test-matched-products">
                  {products.slice(0, 3).map((product, index) => (
                    <ProductRowItem key={product.id || index} product={product} />
                  ))}
                </div>
              ) : (
                <p className="test-empty-notice">
                  Catalog matches will appear with live price and inventory.
                </p>
              )}
            </section>

            <section className="test-usage-card">
              <div className="test-usage-row">
                <span>Test session</span>
                <strong>
                  {state.usage.aiReplies} {state.usage.aiReplies === 1 ? "reply" : "replies"} ·{" "}
                  {state.usage.totalTokens.toLocaleString()} tokens
                </strong>
              </div>
              {state.usage.zeroLlmResponses > 0 && (
                <div className="test-usage-zero">
                  <span className="test-zero-dot" />
                  <span>{state.usage.zeroLlmResponses} zero-latency deterministic replies</span>
                </div>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}

function TestMessageItem({ message }: { message: TestAiMessage }) {
  const customer = message.role === "user"
  const text = customer ? message.content : customerFacingText(message.content)
  return (
    <article className={`test-chat-message ${customer ? "customer" : "assistant"}`}>
      <div className="test-message-meta">
        <span>
          {customer ? (
            <span className="test-user-avatar">U</span>
          ) : (
            <span className="test-mini-brand">
              <Bot size={13} />
            </span>
          )}
          {customer ? "Customer" : "SellPilot AI"}
        </span>
        <time>
          {new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(
            new Date(message.createdAt)
          )}
        </time>
      </div>
      <div className="test-bubble">
        {message.imageUrl && (
          <div className="test-bubble-image">
            <SafeProductImage src={message.imageUrl} alt="Customer attachment" />
          </div>
        )}
        <p>{text}</p>
        {message.products && message.products.length > 0 && (
          <div className="test-bubble-products">
            {message.products.slice(0, 3).map((product, index) => (
              <ProductRowItem key={product.id || index} product={product} />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

function ProductRowItem({ product }: { product: NonNullable<TestAiMessage["products"]>[number] }) {
  const stock = product.stock != null ? (product.stock > 0 ? `${product.stock} in stock` : "Out of stock") : "In stock"
  const isOutOfStock = product.stock === 0
  return (
    <div className="test-product-item">
      <div className="test-product-media">
        {product.image ? (
          <SafeProductImage src={product.image} alt={product.name} />
        ) : (
          <Package size={17} />
        )}
      </div>
      <div className="test-product-info">
        <strong>{product.name}</strong>
        <div className="test-product-sub">
          <span className="test-product-price">
            {product.price != null ? `৳${Number(product.price).toLocaleString()}` : "Price unlisted"}
          </span>
          <span className={`test-product-stock-tag ${isOutOfStock ? "out" : "in"}`}>
            {stock}
          </span>
        </div>
      </div>
    </div>
  )
}

function inferIntent(messages: TestAiMessage[]): string {
  const text = [...messages].reverse().find(message => message.role === "user")?.content.toLowerCase() || ""
  if (/order|korte chai|buy|কিনতে/.test(text)) return "order_request"
  if (/cod|cash on delivery|bkash|nagad|payment|টাকা/.test(text)) return "payment_question"
  if (/delivery|charge|ডেলিভারি/.test(text)) return "delivery_question"
  if (/price|koto|দাম/.test(text)) return "price_inquiry"
  if (/return|warranty|refund|রিটার্ন/.test(text)) return "support_request"
  if (/stock|available|ache|ase|স্টক/.test(text)) return "product_inquiry"
  return "general_inquiry"
}

function deriveSignals(messages: TestAiMessage[]): string[] {
  const text = messages
    .filter(message => message.role === "user")
    .map(message => message.content.toLowerCase())
    .join(" ")
  const matchers: Array<[RegExp, string]> = [
    [/price|koto|দাম/, "Asked product price"],
    [/available|ache|ase|stock|স্টক/, "Checked availability"],
    [/delivery|charge|ডেলিভারি/, "Asked about delivery"],
    [/cod|cash on delivery|bkash|nagad|payment|টাকা/, "Checked payment options"],
    [/order|korte chai|buy|কিনতে/, "Requested an order"],
  ]
  return matchers.filter(([pattern]) => pattern.test(text)).map(([, label]) => label)
}
