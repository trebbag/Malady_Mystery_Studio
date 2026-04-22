/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        panel: '0 24px 60px rgba(15, 23, 42, 0.12)',
      },
      colors: {
        shell: {
          950: '#071218',
          900: '#0b1821',
          800: '#102333',
          700: '#173248',
        },
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          300: '#67e8f9',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
        },
        sand: {
          50: '#fdf9f3',
          100: '#f8f1e6',
          200: '#efe1c7',
          500: '#b48a52',
        },
      },
      fontFamily: {
        display: ['"Avenir Next"', '"Segoe UI"', 'sans-serif'],
        body: ['"Avenir Next"', '"Segoe UI"', 'sans-serif'],
        mono: ['"SFMono-Regular"', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'shell-gradient': 'linear-gradient(180deg, rgba(7,18,24,1) 0%, rgba(16,35,51,1) 52%, rgba(253,249,243,1) 100%)',
      },
    },
  },
  plugins: [],
};
