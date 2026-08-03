/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // NES-ish 8-bit palette
        ink: '#151527',
        slate: '#3b3b5c',
        paper: '#f4ecd8',
        parchment: '#e8dcc0',
        retro: {
          red: '#e43b44',
          orange: '#f77622',
          yellow: '#feae34',
          gold: '#ffd93d',
          green: '#63c74d',
          teal: '#2ce8c5',
          blue: '#0099db',
          navy: '#124e89',
          purple: '#8e5ec2',
          pink: '#ff6b9d',
          grey: '#a7a7c5',
        },
      },
      fontFamily: {
        // Press Start 2P carries the 8-bit identity, but it is close to
        // unreadable below ~11px. It is reserved for headings, buttons and the
        // logo; everything else -- labels, body copy and all numerals -- uses
        // Space Grotesk, which keeps the geometric retro feel while staying
        // legible at small sizes.
        pixel: ['"Press Start 2P"', 'monospace'],
        body: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        num: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Explicit pixel-font ramp, so headings never fall below legibility.
        'pixel-xs': ['0.6875rem', { lineHeight: '1.8', letterSpacing: '0.02em' }],
        'pixel-sm': ['0.8125rem', { lineHeight: '1.7', letterSpacing: '0.01em' }],
        'pixel-md': ['1rem', { lineHeight: '1.6' }],
        'pixel-lg': ['1.375rem', { lineHeight: '1.5' }],
        'pixel-xl': ['1.875rem', { lineHeight: '1.45' }],
      },
      boxShadow: {
        pixel: '4px 4px 0 0 #151527',
        'pixel-sm': '2px 2px 0 0 #151527',
        'pixel-lg': '8px 8px 0 0 #151527',
        'pixel-inset': 'inset 3px 3px 0 0 rgba(0,0,0,0.25)',
      },
      keyframes: {
        blink: { '0%,49%': { opacity: 1 }, '50%,100%': { opacity: 0 } },
        'press-in': {
          '0%': { transform: 'translate(0,0)' },
          '100%': { transform: 'translate(4px,4px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.9) translateY(8px)', opacity: 0 },
          '100%': { transform: 'scale(1) translateY(0)', opacity: 1 },
        },
      },
      animation: {
        blink: 'blink 1s steps(1) infinite',
        marquee: 'marquee 24s linear infinite',
        'pop-in': 'pop-in 160ms ease-out',
      },
    },
  },
  plugins: [],
}
