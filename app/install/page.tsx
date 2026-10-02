import Link from "next/link"
import type { Metadata } from "next"

import { InstallGuide } from "@/components/pwa/install-guide"
import { installMessages } from "@/lib/i18n/messages/install"
import { getServerLocale } from "@/lib/i18n/server"

type Props = { searchParams: Promise<{ lang?: string | string[] }> }

async function getInstallLocale(searchParams: Props["searchParams"]) {
  const { lang } = await searchParams
  return lang === "vi" || lang === "en" ? lang : getServerLocale()
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { title, description } = installMessages[await getInstallLocale(searchParams)]
  return {
    title,
    description,
    alternates: { canonical: "/install", languages: { en: "/install?lang=en", vi: "/install?lang=vi" } },
    openGraph: { title, description, url: "/install", type: "website" },
  }
}

/** Public, so a coach can send the link to a client who has not signed in yet. */
export default async function InstallPage({ searchParams }: Props) {
  const locale = await getInstallLocale(searchParams)
  const copy = installMessages[locale]
  const linkClass =
    "inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"

  return (
    <div lang={locale} className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-6">
          <Link href="/" className="text-xl font-semibold tracking-tight">YeahBuddy Fitness</Link>
          <nav aria-label="Language" className="flex gap-4">
            <Link href="/install?lang=vi" hrefLang="vi" lang="vi" aria-current={locale === "vi" ? "page" : undefined} className={linkClass}>Tiếng Việt</Link>
            <Link href="/install?lang=en" hrefLang="en" lang="en" aria-current={locale === "en" ? "page" : undefined} className={linkClass}>English</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] md:px-6 md:py-12">
        <Link href="/" className={linkClass}>← {copy.home}</Link>
        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{copy.description}</p>
        </div>
        <InstallGuide copy={copy} />
      </main>
    </div>
  )
}
