import * as path from 'path';
import { ViteSSGOptions } from 'vite-ssg';

import type { UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import generateFile from 'vite-plugin-generate-file'

import dotenv from 'dotenv';
dotenv.config();

const config: UserConfig & { ssgOptions?: ViteSSGOptions } = {
    server: {
        port: 5175,
    },
    plugins: [
        vue(),
        generateFile([
            {
                type: 'json',
                output: './build.json',
                data: {
                    "version": require('./package.json').version,
                    "build_id": process.env.VITE_BUILD_ID,
                }
            }
        ])
    ],
    optimizeDeps: {
        exclude: [],
        include: [
            // Mono repo packages here
        ],
    },
    build: {
        commonjsOptions: {
            include: [
                /node_modules/
            ],
        },
    },
    ssgOptions: {
        script: 'async',
        formatting: 'prettify',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    }

};

export default config;
