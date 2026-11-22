/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: {
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          hover: 'var(--surface-hover)',
          active: 'var(--surface-active)',
        },
        ink: {
          DEFAULT: 'var(--text-1)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
        },
        line: {
          DEFAULT: 'var(--hairline)',
          strong: 'var(--hairline-strong)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          softer: 'var(--accent-soft-2)',
          on: 'var(--on-accent-strong)',
        },
        'accent-2': {
          DEFAULT: 'var(--accent-2)',
          soft: 'var(--accent-2-soft)',
          text: 'var(--accent-2-text)',
        },
        // v4: `text` is the variant to use when the hue is TEXT. DEFAULT is for
        // fills, icons and progress - the base hues only reach 2.19-3.91:1 on white.
        // v4.1: decorative-only hue family for the welcome hero word reel. Kept out
        // of the semantic set on purpose (see DESIGN.md 5.10-13) - never use these
        // to express state.
        hero: {
          1: 'var(--hero-1)',
          2: 'var(--hero-2)',
          3: 'var(--hero-3)',
          4: 'var(--hero-4)',
          5: 'var(--hero-5)',
          6: 'var(--hero-6)',
          7: 'var(--hero-7)',
        },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)', text: 'var(--success-text)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)', text: 'var(--danger-text)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)', text: 'var(--warning-text)' },
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        card: 'var(--shadow-card)',
        panel: 'var(--shadow-panel)',
        overlay: 'var(--shadow-overlay)',
      },
      // NOTE: these are NOT Tailwind's defaults - the whole radius scale is remapped.
      // sm=8px (default 2px), md=12px (default 6px), lg=16px (default 8px), xl=20px (default 12px).
      // v4 in use: sm (controls) / md (containers) / full (pills). lg and xl are reserved.
      // Never write rounded-[Npx]; off-scale values (6/9/10px) had crept into 23 places.
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', 'Arial', 'sans-serif'],
      },
      transitionTimingFunction: {
        enter: 'cubic-bezier(0.32, 0.72, 0.24, 1)',
      },
    },
  },
  plugins: [],
}
