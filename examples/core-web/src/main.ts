import { ViteSSG } from 'vite-ssg'

import App from './App.vue'
import { routes } from '@/router'

import './styles/main.scss'

const BUILD_ID = import.meta.env.VITE_BUILD_ID

if (!BUILD_ID) {
    throw new Error('Missing Build ID')
}

const SERVICE_HOST = import.meta.env.VITE_SERVICE_HOST

if (!SERVICE_HOST) {
    throw new Error('Missing Service Host')
}

export const createApp = ViteSSG(
    App,
    {
        routes,
    },
)
