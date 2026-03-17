/** @type {import('next').NextConfig} */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
