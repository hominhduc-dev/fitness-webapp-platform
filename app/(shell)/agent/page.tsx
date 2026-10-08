import { AgentWorkspace } from "@/components/ai/agent-workspace"
import { requireAppSession } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"
import { agentMessages } from "@/lib/i18n/messages/agent"
import { redirect } from "next/navigation"

export default async function AgentPage() {
  const { profile } = await requireAppSession()
  if (profile.role !== "trainee" && profile.role !== "coach") redirect("/dashboard")
  const locale = await getServerLocale()
  return <section className="mx-auto flex h-[calc(100dvh-10rem)] min-h-[420px] max-w-3xl flex-col rounded-2xl border border-border bg-background">
    <h1 className="border-b border-border px-4 py-3 text-lg font-semibold">{agentMessages[locale].title}</h1>
    <AgentWorkspace key={profile.id} />
  </section>
}
