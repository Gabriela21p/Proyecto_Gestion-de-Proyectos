// Centralizamos el acceso a la API para que el navegador siempre hable con el
// mismo origen. En Docker, Next reenvía estas llamadas al contenedor `api`.
const apiInternalUrl = process.env.API_INTERNAL_URL || 'http://localhost:4000'

const nextConfig = {
  async rewrites() {
    // Este proxy también evita tener que repartir la URL interna del backend
    // entre cada pantalla del frontend.
    return [
      {
        source: '/api/:path*',
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ]
  },
}
module.exports = nextConfig
