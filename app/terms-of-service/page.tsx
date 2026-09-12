import { getLegalMetadata, LegalPage } from "@/components/legal/legal-page"

type Props = { searchParams: Promise<{ lang?: string | string[] }> }

export async function generateMetadata({ searchParams }: Props) {
  return getLegalMetadata("terms", searchParams)
}

export default function TermsOfServicePage({ searchParams }: Props) {
  return <LegalPage kind="terms" searchParams={searchParams} />
}
