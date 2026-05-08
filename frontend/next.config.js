// frontend/next.config.js
const apiInternalUrl = process.env.API_INTERNAL_URL || 'http://localhost:4000'

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ]
  },
}
module.exports = nextConfig
