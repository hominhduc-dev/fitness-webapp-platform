"use client"

import { Bot, Dumbbell, Loader2, Send, Sparkles, UtensilsCrossed, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { sendAIChatMessage } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"

type Message = { role: "user" | "assistant"; content: string }

const QUICK_ACTIONS = [
  {
    label: "Tạo chương trình tập",
    icon: Dumbbell,
    href: "/workout/ai-generate",
  },
  {
    label: "AI gợi ý thực đơn",
    icon: UtensilsCrossed,
    href: "/meals",
    hint: "Bấm nút 'AI gợi ý' trên trang Meals",
  },
] as const

const SUGGESTIONS = [
  "Tôi nên tập gì hôm nay?",
  "Cho tôi tips giảm cân",
  "Cách tăng cơ hiệu quả?",
  "Nên ăn gì trước khi tập?",
]

function AIChatBubble() {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || !session?.access_token || isLoading) return

    setInput("")
    const userMsg: Message = { role: "user", content: msg }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    try {
      const result = await sendAIChatMessage(session.access_token, msg, messages)
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }])
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Xin lỗi, tôi không thể trả lời lúc này. Vui lòng thử lại." }])
    } finally {
      setIsLoading(false)
    }
  }, [input, session?.access_token, isLoading, messages])

  if (!session) return null

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "ai-bubble-trigger fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-[60] flex size-14 items-center justify-center rounded-full border border-white/15 shadow-2xl backdrop-blur-xl transition-all hover:scale-105 md:bottom-5 md:right-5 md:z-40",
          open
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="glass-surface fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-3 right-3 z-[59] flex h-[min(600px,calc(100dvh-7.5rem-env(safe-area-inset-bottom)))] flex-col overflow-hidden rounded-[24px] border bg-background shadow-2xl md:bottom-24 md:left-auto md:right-5 md:z-40 md:h-[min(520px,calc(100vh-120px))] md:w-[min(380px,calc(100vw-40px))] md:rounded-2xl">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b bg-primary/5 px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">AI Coach</p>
              <p className="text-[11px] text-muted-foreground">Hỏi đáp fitness & dinh dưỡng</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                {/* Quick Actions */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Tính năng AI</p>
                  {QUICK_ACTIONS.map((action) => (
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
                  <p className="text-xs font-medium text-muted-foreground">Hỏi AI Coach</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
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
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                      msg.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    {msg.content}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    AI đang trả lời...
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
                placeholder="Hỏi về tập luyện, dinh dưỡng..."
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
