/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Support theme switching
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent, #0f766e)',
        muted: 'var(--muted, #64748b)',
        darkbg: '#0f172a',
        darkcard: '#1e293b'
      }
    },
  },
  plugins: [],
}
