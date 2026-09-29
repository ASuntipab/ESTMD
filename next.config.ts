import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'exceljs'],
  // Produces .next/standalone: a self-contained server folder to copy onto the
  // host, so the server does not need `npm install` or the full node_modules.
  output: 'standalone',
}

export default nextConfig
