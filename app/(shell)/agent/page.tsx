import { redirect } from "next/navigation"

export default function AgentPage() {
  redirect("/chat?mode=agent")
}
