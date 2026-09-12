import { getLegalMetadata, LegalPage } from "@/components/legal/legal-page"

type Props = { searchParams: Promise<{ lang?: string | string[] }> }

export async function generateMetadata({ searchParams }: Props) {
  return getLegalMetadata("privacy", searchParams)
}

export default function PrivacyPolicyPage({ searchParams }: Props) {
  return <LegalPage kind="privacy" searchParams={searchParams} />
}
