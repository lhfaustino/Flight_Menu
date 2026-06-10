import { dirname } from 'path';
import { fileURLToPath } from 'url';
import withPWA from '@ducanh2912/next-pwa';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {
        root: __dirname,
    },
    experimental: {
        proxyClientMaxBodySize: '50mb',
        serverActions: {
            bodySizeLimit: '50mb',
        },
    },
};

export default withPWA({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
})(nextConfig);
