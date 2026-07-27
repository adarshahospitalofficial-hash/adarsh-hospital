# Adarsh Hospital — Static Site Clone

This is a static HTML/CSS reconstruction of https://adarsh-hospital.lovable.app/,
built from the page's visible content and structure.

## Important note on images
My environment can't reach `lovable.app` or its image CDN directly, so the
images in `index.html` are **hotlinked** to the original site's asset URLs
(e.g. `https://adarsh-hospital.lovable.app/assets/hero-mother-child-Q0XY1HyI.jpg`).
They'll display fine as long as the person viewing this has an internet
connection and those assets stay live. If you want a fully offline copy:

1. Open each image URL in `index.html` in a browser
2. Save it into the `assets/` folder
3. Update the `src` attributes to point to `assets/filename.jpg` instead

## What's included
- `index.html` — full page markup (header, hero, about, services, packages,
  highlights, doctors, testimonials, contact form, footer)
- `style.css` — all styling, responsive down to mobile
- `assets/` — empty folder, ready for downloaded images if you want to go offline

## What's not included
- The original site's JavaScript interactivity (smooth-scroll animations,
  form submission handling, etc.) — this is a static reproduction of the
  content and layout, not a 1:1 code export of the original React/Vite build.
- The contact form here just shows a demo alert on submit; wire it up to
  a backend or form service (e.g. Formspree) to actually receive submissions.
