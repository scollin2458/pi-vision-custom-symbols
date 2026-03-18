# Weather custom symbol

This folder contains the files for the `weather` PI Vision custom symbol.

## What it does

The symbol uses the Open-Meteo public APIs to:

1. geocode the configured city name;
2. retrieve the current weather for the resolved location; and
3. display a compact weather card in PI Vision.

## Files

- `symbol-weather.js`: symbol registration, API calls, data formatting, and refresh logic.
- `symbol-weather-template.html`: weather card markup.
- `symbol-weather-config.html`: configuration pane for the city and refresh interval.
- `weather.svg`: icon for the symbol in the PI Vision editor.

## Configuration options

- **City**: city name used for geocoding. Default: `Quebec`.
- **Refresh interval (minutes)**: automatic refresh period for the weather data. Default: `30` minutes.

## External services

- Geocoding API: `https://geocoding-api.open-meteo.com/v1/search`
- Forecast API: `https://api.open-meteo.com/v1/forecast`

These services are queried directly from the browser at runtime, so the PI Vision client must be able to reach the Open-Meteo endpoints.
