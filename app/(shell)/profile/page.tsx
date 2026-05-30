import { ProfileClient, type ProfileClientInitialData } from "@/components/profile-client"
import { requireAppSession } from "@/lib/auth/server"
import { fetchWeightEntries } from "@/lib/fitness/api"

export default async function ProfilePage() {
  const { accessToken, profile } = await requireAppSession()
  const weightEntries = await fetchWeightEntries(accessToken, 365).catch(() => [])
  const initialData: ProfileClientInitialData = {
    profile,
    weightEntries,
  }

  return <ProfileClient initialData={initialData} />
}
