import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yeahbuddy.fit"

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/dashboard",
          "/workout",
          "/meals",
          "/progress",
          "/trackweight",
          "/schedule",
          "/profile",
          "/coach",
          "/admin",
          "/auth",
          "/backend",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
