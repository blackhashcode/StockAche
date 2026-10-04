# Design system

StockAche uses an 8-bit retro look: chunky 3px borders, hard offset shadows,
no rounded corners and a tight palette. Pressed buttons sink into their own
shadow.

The look comes from shapes and colour, **not** from setting everything in a
pixel font. Press Start 2P is close to unreadable below about 11px, so it is
kept to headings, buttons and the logo. Everything people actually read —
labels, body copy and every number — uses Space Grotesk.

## Type scale

| Class | Font | Size | Used for |
| --- | --- | --- | --- |
| `.h-display` | Press Start 2P | 22–30px | Hero headline |
| `.h-page` | Press Start 2P | 16px | Page titles |
| `.h-section` | Press Start 2P | 13px | Section headings |
| `.h-card` | Press Start 2P | 11px | Card headings |
| `.eyebrow` | Space Grotesk 600 | 12px | Small caps labels and metadata |
| `.pixel-label` | Space Grotesk 600 | 12px | Form field labels |
| `.price`, `.stat-value` | Space Grotesk 700 | 16–30px | Currency and figures |
| body, inputs | Space Grotesk 400 | 16px | Body copy and form controls |

Nothing renders below 12px except Press Start 2P glyphs at 11px, that face's
legibility floor. Numbers use tabular figures, so columns line up and totals
don't shift as digits change.

## Building blocks

Defined in `frontend/src/index.css` and `frontend/tailwind.config.js`:

- `.pixel-box`, `.pixel-box-lg`: bordered panel with a hard shadow
- `.pixel-btn`: button that depresses into its shadow when clicked
- `.pixel-input`: inset form field
- `.pixel-tag`: status chip

Reusable React components live in `frontend/src/components/ui.jsx`: `Button`,
`Card`, `Tag`, `Field`, `Input`, `Select`, `Modal`, `Stat`, `MoneyRow` and
friends.
