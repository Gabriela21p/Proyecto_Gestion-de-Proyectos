// frontend/next.config.js
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*', // Redirige a Flask
      },
    ]
  },
}
module.exports = nextConfig