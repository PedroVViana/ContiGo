/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Desativar a análise estática de tipos durante o build
  typescript: {
    ignoreBuildErrors: true
  },
  // Desativar a verificação de linting durante o build
  eslint: {
    ignoreDuringBuilds: true
  },
  // As propriedades abaixo agora são padrão no Next.js 15+
  // appDir: true,
  // swcMinify: true,
  
  // Configurações específicas para ambientes de produção
  webpack: (config, { isServer }) => {
    // Configurações adicionais para o webpack se necessário
    return config;
  },
  
  // Habilitando o runtime ESM para compatibilidade com o serverless
  experimental: {
    // serverMinification: true,
  },
  
  // Configurações para fallback estático
  output: 'standalone',
};

module.exports = nextConfig; 