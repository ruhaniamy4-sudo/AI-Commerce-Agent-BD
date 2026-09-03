'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, RotateCcw, Send, User } from 'lucide-react';
import { testAiApi, TestAiState } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { Input } from '@/components/ui/input';
import { SafeProductImage } from '@/components/ui/safe-product-image';
import { cn } from '@/lib/utils';
import { formatCurrency, stockLabel } from '@/lib/currency';
import { customerFacingText } from '@/lib/assistant-response';

const EMPTY_STATE: TestAiState = {
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
};

export default function TestAiPage() {
  const [state, setState] = useState<TestAiState>(EMPTY_STATE);
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    testAiApi.current().then(setState).catch((cause) => setError(cause.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [state.messages, loading]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    const imageUrl = images[0];
    if ((!text && !imageUrl) || loading) return;

    setInput('');
    setImages([]);
    setLoading(true);
    setError('');
    setState((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: `pending-${Date.now()}`,
          role: 'user',
          content: text,
          imageUrl,
          createdAt: new Date().toISOString(),
        },
      ],
    }));

    try {
      setState(await testAiApi.send(text, imageUrl));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI request failed');
      setState((current) => ({
        ...current,
        messages: current.messages.filter((m) => !m.id.startsWith('pending-')),
      }));
      await testAiApi.history().then(setState).catch(() => undefined);
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setLoading(true);
    setError('');
    try {
      setState(await testAiApi.newConversation());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start a new chat');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Test your AI</h1>
          <p className="text-muted-foreground">Real tenant-scoped agent · history persists</p>
        </div>
        <Button variant="outline" onClick={reset} disabled={loading}>
          <RotateCcw className="mr-2 h-4 w-4" />
          New conversation
        </Button>
      </div>

      <Card className="flex min-h-[600px] flex-1 flex-col">
        <CardHeader className="border-b py-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>SellPilot AI</span>
            <span className="font-normal text-muted-foreground">
              {state.usage.aiReplies} replies · {state.usage.llmCalls} LLM calls ·{' '}
              {state.usage.zeroLlmResponses} zero-LLM · {state.usage.totalTokens.toLocaleString()} tokens ·{' '}
              {state.usage.estimatedCost === null
                ? 'Cost unavailable'
                : `$${state.usage.estimatedCost.toFixed(4)}`}
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent ref={scroll} className="flex-1 space-y-4 overflow-y-auto p-5">
          {!loading && !state.messages.length && (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="mb-3 h-12 w-12 text-primary" />
              <b className="text-foreground">Say hello to your sales assistant</b>
              <p>Try “Black t-shirt ache?”</p>
            </div>
          )}

          {state.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex max-w-[90%] gap-2',
                message.role === 'user' ? 'ml-auto flex-row-reverse' : '',
              )}
            >
              {message.role === 'user' ? (
                <User className="mt-2 h-4 w-4" />
              ) : (
                <Bot className="mt-2 h-4 w-4 text-primary" />
              )}
              <div
                className={cn(
                  'space-y-2 whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'border bg-muted/40',
                )}
              >
                {message.imageUrl && (
                  <div className="h-40 w-40 overflow-hidden rounded-xl bg-background">
                    <SafeProductImage src={message.imageUrl} alt="Attached product" />
                  </div>
                )}
                {message.content && <p>{message.role === 'assistant' ? customerFacingText(message.content) : message.content}</p>}
                {message.products?.length ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {message.products.slice(0, 3).map((product, index) => (
                      <div
                        key={product.id || `${product.name}-${index}`}
                        className="overflow-hidden rounded-xl border bg-background"
                      >
                        {product.image && (
                          <div className="h-28 bg-muted">
                            <SafeProductImage src={product.image} alt={product.name} />
                          </div>
                        )}
                        <div className="p-2">
                          <b>{product.name}</b>
                          {product.price !== undefined && <p>{formatCurrency(product.price, product.currency)}</p>}
                          <p className="text-xs text-muted-foreground">
                            {stockLabel(product)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI is thinking…
            </div>
          )}
          {error && <p className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        </CardContent>

        <CardFooter className="border-t p-4">
          <form onSubmit={send} className="w-full space-y-3">
            {images.length > 0 && (
              <ImageUpload
                value={images}
                onChange={setImages}
                disabled={loading}
                folder="test-ai"
                maxFiles={1}
              />
            )}
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about your products, services, or policies…"
                disabled={loading}
              />
              {!images.length && (
                <ImageUpload
                  value={images}
                  onChange={setImages}
                  disabled={loading}
                  folder="test-ai"
                  maxFiles={1}
                />
              )}
              <Button type="submit" disabled={loading || (!input.trim() && !images.length)}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
