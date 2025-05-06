
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
        hostname: 'images.unsplash.com', // Added unsplash.com
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com', // Added pexels.com
        port: '',
        pathname: '/**',
      }
    ],
  },
  // Add environment variables for Google Sheets API
  env: {
    GOOGLE_SHEETS_API_KEY: process.env.GOOGLE_SHEETS_API_KEY, 
    GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
    GOOGLE_SHEET_NAME: process.env.GOOGLE_SHEET_NAME,
    GOOGLE_USERS_SHEET_NAME: process.env.GOOGLE_USERS_SHEET_NAME,
    GOOGLE_HISTORY_SHEET_NAME: process.env.GOOGLE_HISTORY_SHEET_NAME, // Add history sheet name
    // Add Service Account credentials
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
    IRON_SESSION_PASSWORD: process.env.IRON_SESSION_PASSWORD,
  },
};

export default nextConfig;

