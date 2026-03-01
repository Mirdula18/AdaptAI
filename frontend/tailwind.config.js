/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F3F1FF',
          100: '#EAE6FD',
          200: '#D4CCFB',
          300: '#B5A8F7',
          400: '#9680F2',
          500: '#6C63FF',
          600: '#5A4FE0',
          700: '#4A3FC2',
          800: '#3B32A3',
          900: '#2D2685',
        },
        surface: {
          50: '#FAFAFF',
          100: '#F5F3FF',
          200: '#EAE6FD',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
