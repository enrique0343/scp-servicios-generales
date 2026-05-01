/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primario: '#1A1A1A',
        secundario: '#4A4A4A',
        'bg-alt': '#F2F2F2',
        borde: '#BFBFBF',
        success: '#2D7A3E',
        warning: '#B8860B',
        danger: '#A02020',
      },
      fontFamily: {
        sans: ['"Century Gothic"', 'Futura', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
