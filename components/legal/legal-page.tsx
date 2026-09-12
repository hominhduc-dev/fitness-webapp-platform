import Link from "next/link"
import type { Metadata } from "next"
import { getServerLocale } from "@/lib/i18n/server"
import { legalMessages } from "@/lib/i18n/messages/legal"

type LegalKind = "privacy" | "terms"
type LegalSearchParams = Promise<{ lang?: string | string[] }>

async function getLegalLocale(searchParams: LegalSearchParams) {
  const { lang } = await searchParams
  return lang === "vi" || lang === "en" ? lang : getServerLocale()
}

export async function getLegalMetadata(kind: LegalKind, searchParams: LegalSearchParams): Promise<Metadata> {
  const locale = await getLegalLocale(searchParams)
  const { title, description } = legalMessages[locale][kind]
  const path = kind === "privacy" ? "/privacy-policy" : "/terms-of-service"
  return {
    title, description,
    alternates: { canonical: path, languages: { en: `${path}?lang=en`, vi: `${path}?lang=vi` } },
    openGraph: { title, description, url: path, type: "website" },
  }
}

export async function LegalPage({ kind, searchParams }: { kind: LegalKind; searchParams: LegalSearchParams }) {
  const locale = await getLegalLocale(searchParams)
  const copy = legalMessages[locale]
  const document = copy[kind]
  const path = kind === "privacy" ? "/privacy-policy" : "/terms-of-service"
  const linkClass = "inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"

  return (
    <div lang={locale} className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-6">
          <Link href="/" className="text-xl font-semibold tracking-tight">YeahBuddy Fitness</Link>
          <nav aria-label="Language" className="flex gap-4">
            <Link href={`${path}?lang=vi`} hrefLang="vi" lang="vi" aria-current={locale === "vi" ? "page" : undefined} className={linkClass}>Tiếng Việt</Link>
            <Link href={`${path}?lang=en`} hrefLang="en" lang="en" aria-current={locale === "en" ? "page" : undefined} className={linkClass}>English</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-16">
        <Link href="/" className={linkClass}>← {copy.home}</Link>
        <div className="mb-10 mt-6 max-w-3xl">
          <p className="mb-4 text-sm text-muted-foreground">{copy.updated}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{document.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{document.description}</p>
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
          <nav aria-label={copy.contents} className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-6">
            <p className="mb-3 font-semibold">{copy.contents}</p>
            <ol className="space-y-1 text-sm">
              {document.sections.map((section, index) => <li key={section.title}><a href={`#section-${index + 1}`} className={linkClass}>{index + 1}. {section.title}</a></li>)}
              <li><a href="#contact" className={linkClass}>{copy.contact}</a></li>
            </ol>
          </nav>
          <article className="min-w-0 space-y-9">
            {document.sections.map((section, index) => (
              <section id={`section-${index + 1}`} key={section.title} className="scroll-mt-6">
                <h2 className="mb-3 text-xl font-semibold tracking-tight">{index + 1}. {section.title}</h2>
                <p className="leading-8 text-muted-foreground">{section.body}</p>
                {kind === "privacy" && index === 4 && <a href="https://developers.google.com/terms/api-services-user-data-policy" className={linkClass}>Google API Services User Data Policy ↗</a>}
                {kind === "privacy" && index === 5 && <a href="https://myaccount.google.com/connections" className={linkClass}>Google Account — {locale === "vi" ? "Quản lý kết nối" : "Manage connections"} ↗</a>}
              </section>
            ))}
            <section id="contact" className="scroll-mt-6 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-xl font-semibold">{copy.contact}</h2>
              <p className="leading-8 text-muted-foreground">{copy.contactCopy}</p>
              <a href="mailto:hoominhduc@gmail.com" className={`${linkClass} break-all`}>hoominhduc@gmail.com</a>
            </section>
          </article>
        </div>
      </main>
      <footer className="border-t border-border px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">© 2026 YeahBuddy Fitness</span>
          <nav aria-label={copy.contents} className="flex flex-wrap gap-5">
            <Link href={`/privacy-policy?lang=${locale}`} className={linkClass}>{copy.privacy.title}</Link>
            <Link href={`/terms-of-service?lang=${locale}`} className={linkClass}>{copy.terms.title}</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
