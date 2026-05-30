import { AdminConsole } from "@/components/admin/admin-console"
import { requireAppSession } from "@/lib/auth/server"

export default async function AdminPage() {
  await requireAppSession({ role: "admin" })

  return <AdminConsole />
}
