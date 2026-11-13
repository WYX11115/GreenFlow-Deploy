import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#11251f',
        moss: '#164f3b',
        leaf: '#2f7d56',
        mint: '#b9e5c9',
        cream: '#f4f1e8',
        sun: '#f4c95d'
      },
      boxShadow: {
        panel: '0 20px 55px -28px rgba(17, 37, 31, 0.28)'
      }
    }
  },
  plugins: []
} satisfies Config;

