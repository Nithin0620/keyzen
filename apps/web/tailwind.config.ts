import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        foreground: '#ffffff',
        surface: {
          50: '#1a1a1a',
          100: '#141414',
          200: '#0f0f0f',
          300: '#0a0a0a',
          400: '#050505',
        },
        border: '#222222',
        'border-muted': '#171717',
        accent: {
          DEFAULT: '#22c55e', // Light green
          hover: '#4ade80',
          glow: 'rgba(34, 197, 94, 0.15)',
          dark: '#15803d',
          emerald: '#10b981',
          light: '#86efac',
        },
        muted: {
          DEFAULT: '#888888',
          foreground: '#737373',
          dark: '#525252',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
