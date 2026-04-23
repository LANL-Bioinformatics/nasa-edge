import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import commonjs from 'vite-plugin-commonjs'
import path from 'node:path'
import autoprefixer from 'autoprefixer'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const API_URL = `${env.VITE_API_URL ?? 'http://localhost:5000'}`
  const PORT = `${env.VITE_PORT ?? '3000'}`

  return {
    base: './',
    build: {
      outDir: 'build',
    },
    css: {
      postcss: {
        plugins: [
          autoprefixer({}), // add options if needed
        ],
      },
    },
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      force: true,
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },
    plugins: [react(), commonjs()],
    resolve: {
      mainFields: [],
      alias: [
        {
          find: 'src/',
          replacement: `${path.resolve(__dirname, 'src')}/`,
        },
        {
          find: 'axios',
          replacement: path.resolve(__dirname, 'node_modules', 'axios/dist/esm/axios.js'),
        },
      ],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.scss'],
    },
    server: {
      // use 127.0.0.1 for testing ORCiD login
      host: '127.0.0.1',
      port: PORT,
      proxy: {
        '/api': {
          target: API_URL,
          changeOrigin: true,
        },
        '/projects': {
          target: API_URL,
          changeOrigin: true,
        },
        '/bulksubmissions': {
          target: API_URL,
          changeOrigin: true,
        },
        '/workflow-docs': {
          target: API_URL,
          changeOrigin: true,
        },
        '/jbrowse2': {
          target: API_URL,
          changeOrigin: true,
        },
        '/opaver_web': {
          target: API_URL,
          changeOrigin: true,
        },
        '/tmp': {
          target: API_URL,
          changeOrigin: true,
        },
      },
    },
  }
})
