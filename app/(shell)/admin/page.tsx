import { AdminConsole } from "@/components/admin/admin-console"
import { requireAppSession } from "@/lib/auth/server"

export default async function AdminPage() {
  await requireAppSession({ role: "admin" })

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <AdminConsole />
    </div>
  )
}
