'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { chatApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Bot, ImagePlus, Loader2, RotateCcw, Send, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    imageUrl?: string;
    timestamp: Date;
}

export default function ManualTestPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | undefined>(
        undefined
    );
    const [pendingImage, setPendingImage] = useState<string | undefined>(undefined);
    const [isUploading, setIsUploading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!input.trim() && !pendingImage) || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: input,
            imageUrl: pendingImage,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        const sentImage = pendingImage;
        setPendingImage(undefined);
        setIsLoading(true);

        try {
            const response = await chatApi.send(input, conversationId, sentImage);

            if (!conversationId) {
                setConversationId(response.conversationId);
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: response.reply,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Failed to send message:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content:
                    'Sorry, I encountered an error while processing your request.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const resetConversation = () => {
        setMessages([]);
        setConversationId(undefined);
    };

    return (
        <div className="flex flex-col h-full">
            <PageHeader
                title="Manual Test"
                description="Interact with the AI agent in real-time to test its responses and behavior."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={resetConversation}
                        className="flex items-center gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset Chat
                    </Button>
                }
            />
            <div className="flex-1 container px-6 py-8 flex flex-col min-h-0">
                <Card className="flex-1 flex flex-col min-h-0 border-none shadow-sm bg-muted/30">
                    <CardContent
                        className="flex-1 overflow-y-auto p-6 space-y-4"
                        ref={scrollRef}
                    >
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-muted-foreground">
                                <div className="p-4 rounded-full bg-primary/10">
                                    <Bot className="h-12 w-12 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-foreground">
                                        No messages yet
                                    </h3>
                                    <p className="max-w-xs">
                                        Start a conversation with the AI agent
                                        to test its current configuration and
                                        knowledge.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'flex flex-col gap-2 max-w-[80%]',
                                        msg.role === 'user'
                                            ? 'ml-auto items-end'
                                            : 'mr-auto items-start'
                                    )}
                                >
                                    <div className="flex items-center gap-2 px-1">
                                        {msg.role === 'assistant' && (
                                            <Bot className="h-4 w-4 text-primary" />
                                        )}
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {msg.role === 'user' ? 'You' : 'AI'}
                                        </span>
                                        {msg.role === 'user' && (
                                            <User className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div
                                        className={cn(
                                            'rounded-2xl px-4 py-2 text-sm shadow-sm',
                                            msg.role === 'user'
                                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                : 'bg-card text-card-foreground border rounded-tl-none'
                                        )}
                                    >
                                        {msg.imageUrl && (
                                            <div className="mb-2 rounded-lg overflow-hidden border bg-background/50">
                                                <img
                                                    src={msg.imageUrl}
                                                    alt="User uploaded"
                                                    className="max-h-[300px] w-full object-contain"
                                                />
                                            </div>
                                        )}
                                        <p className="whitespace-pre-wrap">
                                            {msg.content}
                                        </p>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground px-1">
                                        {msg.timestamp.toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                </div>
                            ))
                        )}
                        {isLoading && (
                            <div className="flex flex-col gap-2 mr-auto items-start max-w-[80%]">
                                <div className="flex items-center gap-2 px-1">
                                    <Bot className="h-4 w-4 text-primary" />
                                    <span className="text-xs font-medium text-muted-foreground">
                                        AI
                                    </span>
                                </div>
                                <div className="bg-card text-card-foreground border rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="p-4 bg-background border-t flex flex-col gap-4">
                        {pendingImage && (
                            <div className="relative h-24 w-24 rounded-lg overflow-hidden border shadow-sm group">
                                <img
                                    src={pendingImage}
                                    alt="Pending upload"
                                    className="h-full w-full object-cover"
                                />
                                <button
                                    onClick={() => setPendingImage(undefined)}
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-6 w-6 text-white" />
                                </button>
                            </div>
                        )}
                        <form
                            onSubmit={handleSend}
                            className="flex w-full items-center gap-2"
                        >
                            <div className="relative flex-1">
                                <Input
                                    placeholder="Type your message here..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    disabled={isLoading}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isLoading || isUploading}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                                >
                                    {isUploading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ImagePlus className="h-4 w-4" />
                                    )}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        setIsUploading(true);
                                        try {
                                            // Using the existing upload logic from ImageUpload component idea
                                            const { timestamp, signature, apiKey, cloudName, folder } = await chatApi.getSignature('chat-tests');

                                            const formData = new FormData();
                                            formData.append('file', file);
                                            formData.append('api_key', apiKey);
                                            formData.append('timestamp', timestamp.toString());
                                            formData.append('signature', signature);
                                            formData.append('folder', folder);

                                            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                                                method: 'POST',
                                                body: formData,
                                            });

                                            if (!response.ok) throw new Error('Upload failed');
                                            const data = await response.json();
                                            setPendingImage(data.secure_url);
                                        } catch (error) {
                                            console.error('Upload failed:', error);
                                        } finally {
                                            setIsUploading(false);
                                        }
                                    }}
                                    className="hidden"
                                    accept="image/*"
                                />
                            </div>
                            <Button
                                type="submit"
                                size="icon"
                                disabled={(!input.trim() && !pendingImage) || isLoading || isUploading}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
