/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'mono': ['JetBrains Mono', 'Noto Sans KR', 'monospace'],
        'sans': ['Outfit', 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', 'sans-serif'],
      },
      colors: {
        scenaria: {
          bg: '#1a1a1a',
          panel: '#242424',
          border: '#333333',
          accent: '#DC2626',
        }
      }
    },
  },
  plugins: [],
}
