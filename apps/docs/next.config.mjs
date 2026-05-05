import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@linea/ui'],
};

export default withMDX(config);
