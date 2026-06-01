import { dirname } from 'path';
import { fileURLToPath } from 'url';

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

export default nextConfig;
