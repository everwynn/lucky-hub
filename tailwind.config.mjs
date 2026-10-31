/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,ts,vue}'],
  theme: {
    extend: {
      colors: {
        'lucky-red': '#d92b2b',
        'lucky-blue': '#1d6fd0',
        // 语义色：具体色值由 global.css 的 CSS 变量按 :root / html.dark 分别给，
        // 组件里只写用途（bg-surface / text-muted …），切主题时无需改任何组件。
        // 用 "rgb(var(--x) / <alpha-value>)" 是为了让 bg-surface/85 这类透明度修饰符继续可用。
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        body: 'rgb(var(--c-body) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        sunken: 'rgb(var(--c-sunken) / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
