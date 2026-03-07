# Custom Styling

The frontend supports injecting a custom CSS file at runtime — no rebuild required. This lets each community apply their own branding on top of the default styles.

## How it works

The frontend's `index.html` includes a `<link>` pointing to `/custom.css`. If no file is found at that path the element removes itself silently.

When you mount a file at `/usr/share/nginx/html/custom.css` inside the frontend container, it is served automatically by nginx and applied on top of the default Tailwind styles.

## Docker Compose example

```yaml
services:
  frontend:
    image: ghcr.io/your-org/your-fork-frontend:latest
    volumes:
      - ./custom.css:/usr/share/nginx/html/custom.css:ro
    ports:
      - "80:80"
```

Create `custom.css` next to your `compose.yml`:

```css
/* Example: change the primary accent colour from amber to purple */
:root {
  --color-accent: #7c3aed;
}

/* Override the navbar brand colour */
nav a.text-amber-700 {
  color: #7c3aed !important;
}

/* Override buttons */
.bg-amber-500 {
  background-color: #7c3aed !important;
}
.hover\:bg-amber-600:hover {
  background-color: #6d28d9 !important;
}
```

## Key CSS classes & selectors

The UI is built with [Tailwind CSS v3](https://tailwindcss.com/). The following classes and selectors are the most useful override targets:

### Colours

The default palette is **amber / stone**. To change the accent colour, override the Tailwind utility classes in `custom.css`:

| Purpose | Light mode class | Dark mode class |
|---------|-----------------|-----------------|
| Primary buttons | `.bg-amber-500` | `.dark .bg-amber-500` |
| Button hover | `.hover\:bg-amber-600` | `.dark .hover\:bg-amber-600` |
| Navbar brand | `nav a.text-amber-700` | `.dark nav a.text-amber-500` |
| Link hover colour | `.hover\:text-amber-600` | `.dark .hover\:text-amber-400` |
| Active tab / badge | `.bg-amber-500` | — |
| Score bars (Pig game) | `—` (inline styles; hard to override) | — |

### Typography

```css
/* Change the base font */
body {
  font-family: 'Your Font', sans-serif;
}
```

The dyslexic font toggle (OpenDyslexic) is applied via `html.font-dyslexic *` — your font-family override will be overridden when dyslexic mode is active.

### Layout

```css
/* Narrow the max content width */
.max-w-7xl { max-width: 72rem; }

/* Adjust navbar background */
nav.bg-white\/80 { background-color: rgba(255, 255, 255, 0.95); }
```

### Dark mode

Dark mode is applied via the `dark` class on `<html>`. To target dark mode variants:

```css
.dark body {
  background-color: #1a1a2e;
}
```

## Notes

- The custom CSS is loaded **after** all Tailwind styles, so it takes precedence.
- Tailwind generates utility classes with escaped characters (e.g. `hover\:bg-amber-600`). Use the escaped form in your CSS selectors.
- If you need to override many colours systematically, consider using CSS custom properties (variables) and targeting the Tailwind classes that use them.
- Changes take effect immediately after nginx picks up the mounted file — no container restart needed (nginx serves static files directly).
