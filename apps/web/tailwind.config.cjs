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
          600: '#22465f',
        },
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
        },
        sand: {
          50: '#fdf9f3',
          100: '#f8f1e6',
          200: '#efe1c7',
          300: '#dccdb5',
          500: '#b48a52',
        },
        cream: {
          50: '#fffdf8',
        },
      },
      fontFamily: {
        display: ['"Avenir Next"', '"Segoe UI"', 'sans-serif'],
        body: ['"Avenir Next"', '"Segoe UI"', 'sans-serif'],
        mono: ['"SFMono-Regular"', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'shell-gradient': 'linear-gradient(180deg, rgba(251,246,237,1) 0%, rgba(247,241,232,1) 52%, rgba(240,227,207,1) 100%)',
        'creator-canvas': 'radial-gradient(circle at 88% 8%, rgba(20,184,200,0.18), transparent 26%), radial-gradient(circle at 18% 18%, rgba(180,138,82,0.16), transparent 28%), linear-gradient(180deg, #fbf6ed 0%, #f7f1e8 46%, #f0e3cf 100%)',
      },
    },
  },
  plugins: [],
};
