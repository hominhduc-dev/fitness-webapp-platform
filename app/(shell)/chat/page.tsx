import { redirect } from "next/navigation"
import { AIChatPanel } from "@/components/ai/chat-bubble"
import { requireAppSession } from "@/lib/auth/server"

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { profile } = await requireAppSession()
  if (profile.role !== "trainee" && profile.role !== "coach") redirect("/dashboard")
  const { mode } = await searchParams
  return <AIChatPanel key={`${profile.id}:${mode ?? "chat"}`} initialAgentMode={mode === "agent"} />
}
