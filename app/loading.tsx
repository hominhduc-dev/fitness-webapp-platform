import { AppLoadingScreen } from "@/components/layout/page-loading-state"
import { getServerMessages } from "@/lib/i18n/server"

export default async function Loading() {
  const messages = await getServerMessages()

  return <AppLoadingScreen variant="minimal" label={messages.common.loading} />
}
