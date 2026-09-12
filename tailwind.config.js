/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef3fb',
          100: '#d9e4f5',
          200: '#b3c9e8',
          300: '#84a6d8',
          400: '#5480c2',
          500: '#2f5ba6',
          600: '#1d4486',
          700: '#14306b',
          800: '#0e2350',
          900: '#0b1f4d',
          950: '#060f28',
        },
        gold: {
          50: '#fbf7e8',
          100: '#f6ecc9',
          200: '#eedc9e',
          300: '#e7c55a',
          400: '#d9ae35',
          500: '#c9a227',
          600: '#9a7b1e',
          700: '#7a6117',
        },
        debit: {
          50: '#fff1f2',
          100: '#ffe4e6',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
        },
        credit: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warn: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)',
        card: '0 1px 2px rgb(15 23 42 / 0.05), 0 8px 24px -8px rgb(15 23 42 / 0.12)',
        pop: '0 12px 40px -8px rgb(15 23 42 / 0.25)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
};
