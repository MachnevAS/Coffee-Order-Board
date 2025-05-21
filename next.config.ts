
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.freepik.com', // Added freepik.com
        port: '',
        pathname: '/**',
      }
    ],
  },
  // The explicit 'env' block has been removed.
  // Environment variables are automatically loaded by Next.js from .env files
  // and are accessible via process.env on the server-side.
  // For client-side exposure, use NEXT_PUBLIC_ prefix in your .env file.
};

export default nextConfig;
