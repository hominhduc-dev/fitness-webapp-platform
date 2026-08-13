"use client"

import { Bot, Dumbbell, Loader2, Send, Sparkles, UtensilsCrossed } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { AIMessage } from "@/components/ai/ai-message"
import { ChatProgramCard } from "@/components/ai/chat-program-card"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { sendAIChatMessage, type AIChatAction } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"

type Message = { role: "user" | "assistant"; content: string; action?: AIChatAction }

function getChatCopy(locale: "en" | "vi") {
  if (locale === "vi") {
    return {
      ariaOpen: "Mở AI Coach",
      error: "Xin lỗi, tôi không thể trả lời lúc này. Vui lòng thử lại.",
      features: "Tính năng AI",
      loading: "AI đang trả lời...",
      placeholder: "Hỏi về tập luyện, dinh dưỡng...",
      prompt: "Hỏi AI Coach",
      subtitle: "Hỏi đáp fitness & dinh dưỡng",
      actions: [
        { label: "Tạo chương trình tập", icon: Dumbbell, href: "/workout/ai-generate" },
        { label: "AI gợi ý thực đơn", icon: UtensilsCrossed, href: "/meals", hint: "Bấm nút 'AI gợi ý' trên trang Meals" },
      ],
      suggestions: ["Tôi nên tập gì hôm nay?", "Cho tôi tips giảm cân", "Cách tăng cơ hiệu quả?", "Nên ăn gì trước khi tập?"],
    }
  }

  return {
    ariaOpen: "Open AI Coach",
    error: "Sorry, I cannot answer right now. Please try again.",
    features: "AI features",
    loading: "AI is responding...",
    placeholder: "Ask about training or nutrition...",
    prompt: "Ask AI Coach",
    subtitle: "Fitness and nutrition Q&A",
    actions: [
      { label: "Create a workout program", icon: Dumbbell, href: "/workout/ai-generate" },
      { label: "AI meal suggestions", icon: UtensilsCrossed, href: "/meals", hint: "Use the AI suggestion button on the Meals page" },
    ],
    suggestions: ["What should I train today?", "Give me weight-loss tips", "How can I build muscle effectively?", "What should I eat before training?"],
  }
}

function AIChatBubble() {
  const { session } = useAuth()
  const { locale } = useLocale()
  const copy = getChatCopy(locale)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!open) return

    const handleOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer)
    return () => document.removeEventListener("pointerdown", handleOutsidePointer)
  }, [open])

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || !session?.access_token || isLoading) return

    setInput("")
    const userMsg: Message = { role: "user", content: msg }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    try {
      // Only the plain transcript goes back to the model — action payloads are
      // client-side render state, not conversation history.
      const transcript = messages.map(({ role, content }) => ({ role, content }))
      const result = await sendAIChatMessage(session.access_token, msg, transcript)
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply, action: result.action }])
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: copy.error }])
    } finally {
      setIsLoading(false)
    }
  }, [copy.error, input, session?.access_token, isLoading, messages])

  if (!session) return null

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          type="button"
          aria-label={copy.ariaOpen}
          onClick={() => setOpen(true)}
          className="ai-bubble-trigger fixed right-4 top-[calc(1rem+env(safe-area-inset-top))] z-[60] flex size-14 items-center justify-center rounded-full border border-white/15 bg-primary text-primary-foreground shadow-2xl backdrop-blur-xl transition-all hover:scale-105 md:bottom-5 md:right-5 md:top-auto md:z-40"
        >
          <Sparkles className="size-6" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div ref={panelRef} className="glass-surface fixed left-3 right-3 top-[calc(5.25rem+env(safe-area-inset-top))] z-[59] flex h-[min(600px,calc(100dvh-6.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] flex-col overflow-hidden rounded-[24px] border bg-background shadow-2xl md:bottom-24 md:left-auto md:right-5 md:top-auto md:z-40 md:h-[min(520px,calc(100vh-120px))] md:w-[min(380px,calc(100vw-40px))] md:rounded-2xl">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b bg-primary/5 px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">AI Coach</p>
              <p className="text-[11px] text-muted-foreground">{copy.subtitle}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                {/* Quick Actions */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{copy.features}</p>
                  {copy.actions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted"
                    >
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        <action.icon className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{action.label}</p>
                        {"hint" in action && (
                          <p className="text-[11px] text-muted-foreground">{action.hint}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Suggestions */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{copy.prompt}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {copy.suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void handleSend(s)}
                        className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-muted"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "ml-auto max-w-[85%] whitespace-pre-wrap bg-primary text-primary-foreground"
                        : msg.action
                          ? "bg-muted"
                          : "max-w-[85%] bg-muted",
                    )}
                  >
                    {msg.role === "user" ? msg.content : <AIMessage content={msg.content} />}
                    {msg.action && session?.access_token && (
                      <ChatProgramCard action={msg.action} accessToken={session.access_token} />
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    {copy.loading}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder={copy.placeholder}
                className="flex-1 rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                disabled={isLoading}
              />
              <Button
                size="icon"
                className="size-10 shrink-0 rounded-xl"
                disabled={!input.trim() || isLoading}
                onClick={() => void handleSend()}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export { AIChatBubble }
