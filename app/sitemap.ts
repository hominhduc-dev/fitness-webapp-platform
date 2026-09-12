import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yeahbuddy.fit"

  return [
    ...["privacy-policy", "terms-of-service"].map((path) => ({
      url: `${siteUrl}/${path}`,
      lastModified: new Date("2026-09-12"),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/reset-password`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ]
}
