# App icon

Original gold L monogram on charcoal, matching the app's existing header mark and warm gold palette. The editable sources are `liquide-icon.svg` (opaque full icon) and `liquide-monogram.svg` (transparent mark). No external font or stock logo is required.

- `../icon.png`: opaque RGB 1024 × 1024 launcher/iOS icon.
- `../android-icon-foreground.png`: transparent adaptive-icon layer; the mark stays within Android's central safe area.
- `../android-icon-background.png`: full-bleed charcoal background.
- `../android-icon-monochrome.png`: white alpha-mask mark for Android themed icons.
- `../favicon.png`: browser icon.
- `../splash-icon.png`: transparent mark available for splash configuration.
- `icon-preview.png`: rounded-square and circular mask preview, not a launcher asset.

Render the SVGs to PNG with an SVG renderer when editing; keep the main icon opaque, and preserve transparency in the adaptive and monochrome marks.
