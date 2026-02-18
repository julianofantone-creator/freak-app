/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#8b5cf6', // Purple
          600: '#7c3aed',
          700: '#6d28d9',
          900: '#4c1d95',
        },
        accent: {
          50: '#fdf2f8',
          500: '#ef4444', // Red
          600: '#dc2626',
        },
        freak: {
          purple: '#8b5cf6',
          red: '#ef4444',
          dark: '#0f0f0f',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
}