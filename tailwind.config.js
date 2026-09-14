/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#102a39',
        panel2: '#0d2330',
        ink: '#edfafa',
        muted: '#9bb8c2',
        line: '#1d4657',
        teal: '#2ad6c5',
        green: '#39ff99',
        amber: '#f4c152',
        red: '#ff7865',
      },
    },
  },
  plugins: [],
};
