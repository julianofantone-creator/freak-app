/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        freak: {
          pink: '#FF0066',
          'pink-light': '#FF3385',
          'pink-dark': '#CC0052',
          bg: '#000000',
          surface: '#0d0d0d',
          card: '#141414',
          border: '#1f1f1f',
          muted: '#6b7280',
        }
      },
      animation: {
        'ping-slow': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      boxShadow: {
        'pink': '0 0 20px rgba(255, 0, 102, 0.4)',
        'pink-lg': '0 0 40px rgba(255, 0, 102, 0.3)',
      }
    },
  },
  plugins: [],
}
