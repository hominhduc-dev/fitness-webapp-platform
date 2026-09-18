import { AppSplash } from "@/components/layout/app-splash"
import { getServerMessages } from "@/lib/i18n/server"

export default async function Loading() {
  const messages = await getServerMessages()

  return <AppSplash fullScreen={false} label={messages.shell.loadingWorkspace} />
}
