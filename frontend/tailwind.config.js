/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          '"Microsoft YaHei UI"',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: [
          '"Cascadia Code"',
          '"JetBrains Mono"',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        soft: '0 2px 10px -2px rgba(15, 23, 42, 0.06), 0 1px 3px -1px rgba(15, 23, 42, 0.04)',
        drawer: '-12px 0 36px -8px rgba(15, 23, 42, 0.14)',
        modal: '0 24px 60px -12px rgba(15, 23, 42, 0.28)',
      },
    },
  },
  plugins: [],
}
