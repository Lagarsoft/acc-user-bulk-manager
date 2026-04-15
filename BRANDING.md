# Lagarsoft Branding Guidelines

## Brand Identity

**Company:** Lagarsoft LLC  
**Website:** https://www.lagarsoft.com  
**Tagline:** "We transform your projects into coded solutions for the AEC world"  
**Positioning:** Autodesk Certified Partner — consulting, staff augmentation, and software development for the AEC industry

---

## Color Palette

| Name | Role | Hex | RGB |
|---|---|---|---|
| Smart Blue | Primary | `#0066CC` | 0, 102, 204 |
| Mint Leaf | Primary | `#00C389` | 0, 195, 137 |
| Cinnabar | Secondary | `#E04E39` | 224, 78, 57 |
| Pacific Blue | Secondary | `#18BBCC` | 24, 187, 204 |
| Carbon Black | Secondary | `#191919` | 25, 25, 25 |
| Duckie Yellow | Alternative | `#FFE66D` | 255, 230, 109 |

All colors are registered as Tailwind CSS custom tokens in `app/globals.css`:

```css
--color-lgs-smart-blue: #0066CC;
--color-lgs-mint-leaf: #00C389;
--color-lgs-cinnabar: #E04E39;
--color-lgs-pacific-blue: #18BBCC;
--color-lgs-carbon-black: #191919;
--color-lgs-duckie-yellow: #FFE66D;
```

Usage examples: `bg-lgs-smart-blue`, `text-lgs-mint-leaf`, `border-lgs-cinnabar`

---

## Logo Files

| File | Format | Use |
|---|---|---|
| `public/lagarsoft-logo-square.svg` | SVG 121×100 | Header, favicon, login page — compact placement |
| `public/lagarsoft-logo-horizontal.svg` | SVG 580×100 | Footer, wide layouts |
| `app/icon.svg` | SVG | Browser tab favicon (Next.js App Router convention) |

Both logos use Carbon Black (`#191919`) fill. On dark backgrounds, apply `brightness-0 invert` (Tailwind) to render them white.

---

## Typography

**Font:** Inter (Google Fonts)  
Loaded via `next/font/google` in `app/layout.tsx`. No changes from the Autodesk Platform Services baseline.

---

## Social & Contact

| Channel | URL |
|---|---|
| Website | https://www.lagarsoft.com |
| LinkedIn | https://www.linkedin.com/company/lagarsoft-llc/ |

No other social networks.

---

## In-App Brand Placement

### Header (`app/layout.tsx`)
- Lagarsoft square logo (white/inverted, 28px) on the left, links to lagarsoft.com
- Vertical divider (`bg-white/20`) separates logo from app name
- Background: APS Dark (`#0D2B3E`) — kept for Autodesk ecosystem consistency

### Footer (`app/components/Footer.tsx`)
- Height: `h-14` (matches header)
- Background: Carbon Black (`#191919`)
- Left: horizontal logo (white/inverted, 120px wide), links to lagarsoft.com
- Right: LinkedIn link + copyright `© YYYY Lagarsoft LLC`

### Login Page (`app/components/LoginCard.tsx`)
- Lagarsoft square logo at the top of the card (48px, full color)
- "Built by Lagarsoft — Autodesk Certified Partner" attribution at the bottom

### Page Metadata (`app/layout.tsx`)
- Title: `"Forma User Bulk Manager by Lagarsoft"`
- OG site name: `"Lagarsoft"`
- OG URL: `https://www.lagarsoft.com`

---

## Usage Notes

- **APS blue (`#0696D7`) is intentionally kept** for the core workflow UI (buttons, focus rings, step indicators) to maintain visual consistency with the Autodesk ecosystem.
- Lagarsoft colors are used in chrome elements (header background alternative, footer, login card) and are available for future feature UI.
- All external Lagarsoft links must use `target="_blank" rel="noopener noreferrer"`.
