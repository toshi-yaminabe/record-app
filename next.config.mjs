import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    APP_VERSION: version,
  },
  // Prisma Client をwebpackバンドルから除外し、Node.jsのrequireで読み込む
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
