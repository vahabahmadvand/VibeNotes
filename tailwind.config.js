/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          yellow: { bg: '#fffab3', header: '#fef08a', text: '#1e293b' },
          green: { bg: '#d9f99d', header: '#bef264', text: '#1e293b' },
          pink: { bg: '#fbcfe8', header: '#f472b6', text: '#1e293b' },
          purple: { bg: '#e9d5ff', header: '#d8b4fe', text: '#1e293b' },
          blue: { bg: '#bae6fd', header: '#7dd3fc', text: '#1e293b' },
          charcoal: { bg: '#27272a', header: '#18181b', text: '#f4f4f5' },
          grey: { bg: '#e4e4e7', header: '#d4d4d8', text: '#18181b' },
        }
      }
    },
  },
  plugins: [],
}
