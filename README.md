# Personal Weather

A lightweight, mobile-first weather Progressive Web App (PWA) designed for Android.

The app defaults to **Ranson, West Virginia**, but you can search for another U.S. city or ZIP code at any time.

## Features

- Current conditions
- Feels-like temperature
- High and low temperature
- Humidity
- Wind and gusts
- Precipitation probability and amount
- Sunrise and sunset
- Next 24 hours
- Up to 16 days of forecast data
- Expandable hourly forecasts for individual forecast days
- National Weather Service alerts
- External NWS and Weather Channel radar links
- Dark theme by default with a light-theme toggle
- Installable as an Android PWA
- No API keys
- No backend server
- No database

## Data sources

### Open-Meteo

Open-Meteo supplies the current, hourly, daily, and location-search data.

- Forecast API: https://open-meteo.com/en/docs
- Geocoding API: https://open-meteo.com/en/docs/geocoding-api

### National Weather Service

The National Weather Service API supplies active U.S. weather alerts.

- API documentation: https://www.weather.gov/documentation/services-web-api
- Alerts documentation: https://www.weather.gov/documentation/services-web-alerts

### Radar

Radar is intentionally opened outside the PWA.

- NWS radar: https://radar.weather.gov/
- Weather Channel radar: https://weather.com/weather/radar/

The NWS link is generated with the selected latitude and longitude so the radar
opens near that location. The Weather Channel link is generated from the selected
place name.

## Project structure

```text
ranson-weather/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── service-worker.js
├── README.md
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```

## GitHub Pages deployment

1. Create a new public GitHub repository.
2. Upload all files and folders from this project.
3. Open the repository's **Settings**.
4. Select **Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select your main branch and the `/ (root)` folder.
7. Save the setting.
8. GitHub will provide the public Pages URL after deployment.

Because all asset paths are relative, the app works correctly when hosted from a
GitHub Pages project path such as:

```text
https://yourusername.github.io/ranson-weather/
```

## Installing on Android

1. Open the GitHub Pages site in Chrome.
2. Open Chrome's menu.
3. Choose **Add to Home screen** or **Install app**.
4. Launch it from the new Weather icon.

## Changing the default home location

The permanent default location is near the top of `app.js`:

```javascript
const HOME_LOCATION = {
  name: "Ranson",
  admin1: "West Virginia",
  admin1Code: "WV",
  country: "United States",
  countryCode: "US",
  postalCode: "25438",
  latitude: 39.2951,
  longitude: -77.8606
};
```

Update those values if you ever want to change the built-in home location.

## Refresh behavior

Weather updates:

- when the app opens
- when you tap the refresh button
- every 15 minutes while the app remains open

The service worker caches only the local application files. Weather API responses
are intentionally fetched from the network so stale forecasts are not served as
current data.

## Maintenance notes

The main JavaScript file is split into commented sections:

- app configuration
- event handling
- weather fetching
- current conditions
- hourly forecast
- daily forecast
- NWS alerts
- location search
- radar links
- navigation
- theme handling
- data/formatting helpers
- PWA registration

The CSS file is similarly divided into visual sections to make future changes
easier to locate.

## Cost

The application itself requires no paid hosting or backend. GitHub Pages can host
the static files, and the APIs used by this personal project do not require an API
key.
