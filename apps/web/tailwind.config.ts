import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Aegis / Design tokens
        navy: '#030d0a',
        'navy-deep': '#021a12',
        'violet-deep': '#0a2e1f',
        ink: {
          DEFAULT: '#f0fdf4',
          2: 'rgba(220, 252, 231, 0.72)',
          3: 'rgba(187, 247, 208, 0.50)',
        },
        peri: {
          DEFAULT: '#10b981',
          2: '#34d399',
          hover: '#34d399',
        },
        line: {
          DEFAULT: 'rgba(52, 211, 153, 0.15)',
          subtle: 'rgba(52, 211, 153, 0.08)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter Tight', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Fira Code', 'ui-monospace', 'monospace'],
        serif: ['var(--font-serif)', 'Instrument Serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        'glass-card': 'inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 60px rgba(2,13,10,0.28)',
        'peri-glow': '0 8px 26px rgba(16,185,129,0.35)',
        'peri-glow-hover': '0 10px 34px rgba(52,211,153,0.5)',
      },
    },
  },
  plugins: [],
} satisfies Config;
