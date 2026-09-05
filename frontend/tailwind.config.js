/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        field: 'rgb(var(--field-rgb) / <alpha-value>)',
        panel: 'rgb(var(--panel-rgb) / <alpha-value>)',
        'panel-raised': 'rgb(var(--panel-raised-rgb) / <alpha-value>)',
        rule: 'rgb(var(--rule-rgb) / <alpha-value>)',
        'rule-strong': 'rgb(var(--rule-strong-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        'ink-dim': 'rgb(var(--ink-dim-rgb) / <alpha-value>)',
        'ink-faint': 'rgb(var(--ink-faint-rgb) / <alpha-value>)',
        traffic: 'rgb(var(--traffic-rgb) / <alpha-value>)',
        'traffic-ink': 'rgb(var(--traffic-ink-rgb) / <alpha-value>)',
        subject: 'rgb(var(--subject-rgb) / <alpha-value>)',
        conflict: 'rgb(var(--conflict-rgb) / <alpha-value>)',
        ghost: 'rgb(var(--ghost-rgb) / <alpha-value>)',
        committed: 'rgb(var(--committed-rgb) / <alpha-value>)',
        weather: 'rgb(var(--weather-rgb) / <alpha-value>)',
      },
      fontFamily: {
        ui: ['Archivo', 'system-ui', 'sans-serif'],
        narrow: ['"Archivo Narrow"', 'Archivo', 'system-ui', 'sans-serif'],
        data: ['"Azeret Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
        tiny: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.4rem' }],
        md: ['1.0625rem', { lineHeight: '1.5rem' }],
        lg: ['1.1875rem', { lineHeight: '1.6rem' }],
        xl: ['1.375rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.625rem', { lineHeight: '2rem' }],
      },
    },
  },
  plugins: [],
};
