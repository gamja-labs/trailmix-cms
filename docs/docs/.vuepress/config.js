import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'
import { viteBundler } from '@vuepress/bundler-vite'
import generateFile from 'vite-plugin-generate-file'
import path from 'path'

import dotenv from 'dotenv';
dotenv.config();

export default defineUserConfig({
    lang: 'en-US',

    title: 'Trailmix CMS',
    description: 'Type-safe content management system for NestJS',

    theme: defaultTheme({
        logo: '/images/emblem.svg',

        navbar: [
            '/',
            '/introduction',
            '/installation',
            '/configuration',
            {
                text: 'Guides',
                children: [
                    '/database-models',
                    '/database-collections',
                    '/controllers',
                ],
            },
        ],

        sidebar: [
            '/',
            '/introduction',
            '/installation',
            '/configuration',
            {
                text: 'Database',
                children: [
                    '/database-models',
                    '/database-collections',
                ],
            },
            {
                text: 'CMS',
                children: [
                    '/controllers',
                ],
            },
        ],

        head: [
            // favicon
            ['link', { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' }],
            ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
            ['link', { rel: 'shortcut icon', href: '/favicon.ico' }],
            ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
            ['link', { rel: 'manifest', href: '/site.webmanifest' }],

            // font
            ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
            ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
            ["link", { href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap", rel: "stylesheet" }],

            ["link", { href: "https://fonts.googleapis.com/css2?family=B612+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap", rel: "stylesheet" }],
        ],
    }),

    bundler: viteBundler({
        viteOptions: {
            plugins: [
                generateFile([
                    {
                        type: 'json',
                        output: path.resolve(__dirname, 'dist', 'build.json'),
                        data: {
                            "version": require('../../package.json').version,
                            "build_id": process.env.VITE_BUILD_ID,
                        }
                    }
                ])
            ],
        },
    }),
})
