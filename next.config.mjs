/** @type {import('next').NextConfig} */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    proxyTimeout: 120_000,
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ]
  },
}

export default nextConfig
