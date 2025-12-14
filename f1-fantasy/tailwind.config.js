/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        f1: {
          red: '#e10600',
          dark: '#15151e',
          card: '#1f1f2e',
          gray: '#6b7280'
        }
      }
    },
  },
  plugins: [],
}