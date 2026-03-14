# Exoplanet Transit Calculator

A lightweight browser tool for finding the next observable exoplanet transit from a specific geographic location.

This project is built as a static website and is ideal for observers who want to quickly check whether a known transit is visible from their site under basic altitude and twilight constraints.

## Features

- Find the next observable transit from your observing location
- Search multiple future epochs until a valid event is found
- Accept transit ephemeris values such as `T0`, orbital period, and duration
- Accept target star coordinates in sexagesimal or decimal format
- Use manual coordinates or browser geolocation for the observer site
- Apply observing constraints for target altitude, solar altitude, and baseline time
- Show transit timing in both UTC and a selected local timezone
- Display key observing phases: observation start, ingress, mid-transit, egress, and observation end
- Include Moon phase, illumination, and Moon-target separation
- Explain why earlier candidate transits were skipped

## How It Works

The calculator:

1. Starts from the current time and predicts future transit epochs using the entered ephemeris.
2. Converts the supplied mid-transit value from `BJD_TDB` to `JD_UTC`.
3. Computes target altitude and Sun altitude during the transit window.
4. Marks a transit as observable only if:
   - the target stays above the minimum altitude for the full transit, and
   - the Sun stays below the chosen solar altitude limit for the full transit.
5. Returns up to 3 observable future transits.

The app uses the browser build of [`astronomy-engine`](https://github.com/cosinekitty/astronomy) for sidereal time, horizon coordinates, Moon data, and Solar System geometry.

## Inputs

### Ephemeris

- `Reference mid-transit (BJD_TDB)`: known mid-transit reference time
- `Orbital period (days)`: time between transits
- `Transit duration (hours)`: total duration from ingress to egress

### Target Star Coordinates

- `Right Ascension`: `HH:MM:SS.ss` or decimal hours
- `Declination`: `DD:MM:SS.ss` or decimal degrees

### Observer Location

- `Latitude`
- `Longitude`
- `Elevation`
- `Timezone`
- `Use My Location`: fills the site coordinates from browser geolocation if permitted

### Observing Constraints

- `Minimum target altitude`: lowest acceptable altitude for the target
- `Sun altitude limit`: twilight/darkness cutoff, such as `-12`
- `Baseline before/after transit`: extra out-of-transit observing time
- `Epochs to search`: number of future transits to test

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- [`astronomy-engine`](https://www.npmjs.com/package/astronomy-engine) loaded from CDN

## Run Locally

Because this is a static site, you can run it with any simple local server.

### Option 1: Open directly

Open `index.html` in your browser.

### Option 2: Use a local server

If you have Python installed:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Project Structure

```text
.
|-- index.html   # App layout and input form
|-- style.css    # Visual styling
|-- script.js    # Transit calculations and rendering logic
|-- favicon.svg
`-- CNAME        # Custom domain for GitHub Pages
```

## Deployment

This repository is structured for static hosting and can be deployed easily with:

- GitHub Pages
- Netlify
- Vercel static hosting
- Any standard web server

The included `CNAME` file suggests the site is intended for GitHub Pages with a custom domain.

## Limitations

- This tool checks observability across the transit itself, not across the full baseline window.
- Time conversion from `BJD_TDB` to `JD_UTC` uses a simplified fixed `TDB-UTC` offset.
- Weather, clouds, seeing, and local horizon obstructions are not included.
- The timezone list is currently limited to a small set of common options plus UTC.
- This is intended as a practical planning tool and should be cross-checked for precision-critical observations.

## Future Improvements

- Full baseline-window observability checks
- Custom timezone input or automatic timezone detection for all locations
- Support for loading targets from exoplanet catalogs
- Export results as CSV or calendar events
- Better mobile layout and input presets

## Live Site

Custom domain:

```text
https://exo.sahilnetwork.cc
```

## License

Add a license file if you want others to reuse or contribute to this project more easily.
