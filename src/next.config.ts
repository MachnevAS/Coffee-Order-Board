
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
    // remotePatterns теперь не нужны для ProductCard, так как используется unoptimized={true}.
    // Оставляем пустым, если нет других компонентов, использующих next/image с оптимизацией.
    remotePatterns: [
       // При необходимости сюда можно будет добавить паттерны для других использований next/image,
       // где оптимизация Next.js желательна.
       // Например, для аватаров пользователей, если они будут загружаться с определенных хостов.
    ],
  },
};

export default nextConfig;
