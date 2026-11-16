/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        card: 'var(--bg-card)',
        hoverSurface: 'var(--bg-hover)',
        subtle: 'var(--bg-subtle)',
        navBar: 'var(--bg-nav)',
        borderSubtle: 'var(--border-subtle)',
        borderStrong: 'var(--border-strong)',
        ink: {
          DEFAULT: 'var(--text-main)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)'
        },
        accent: {
          primary: '#3B82F6',
          primaryHover: '#2563EB',
          secondary: '#06B6D4'
        }
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)'
      }
    }
  },
  plugins: []
};
