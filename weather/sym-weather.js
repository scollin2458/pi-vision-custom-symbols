(function (PV) {
    'use strict';

    function symbolVis() { }
    PV.deriveVisualizationFromBase(symbolVis);

    var definition = {
        typeName: 'weather',
        displayName: 'Weather',
        iconUrl: '/Scripts/app/editor/symbols/ext/Icons/weather.svg',
        visObjectType: symbolVis,
        datasourceBehavior: PV.Extensibility.Enums.DatasourceBehaviors.Single,
        getDefaultConfig: function () {
            return {
                DataShape: 'Value',
                Height: 320,
                Width: 360,
                CityQuery: 'Montreal',
                RefreshMinutes: 30
            };
        },
        configOptions: function (context, clickedElement, monitorOptions) {
            monitorOptions.push({
                title: 'Format Weather',
                mode: 'formatWeather'
            });
        }
    };

    symbolVis.prototype.init = function (scope, elem) {
        var self = this;
        var refreshTimer = null;
        var requestVersion = 0;
        var container = elem.find('.weather-symbol')[0] || elem[0];

        this.onDataUpdate = function () { };
        this.onConfigChange = onConfigChange;
        this.onResize = function () { };

        scope.$on('$destroy', function () {
            clearRefreshTimer();
        });

        function safeString(value) {
            if (value === null || value === undefined) {
                return '';
            }
            return String(value).trim();
        }

        function safeNumber(value, fallback) {
            var n = parseFloat(value);
            return isNaN(n) ? fallback : n;
        }

        function clamp(value, min, max, fallback) {
            var n = parseInt(value, 10);
            if (isNaN(n)) {
                n = fallback;
            }
            if (n < min) {
                n = min;
            }
            if (n > max) {
                n = max;
            }
            return n;
        }

        function ensureConfig() {
            scope.config.CityQuery = safeString(scope.config.CityQuery) || 'Montreal';
            scope.config.RefreshMinutes = clamp(scope.config.RefreshMinutes, 5, 240, 30);
        }

        function setText(selector, value) {
            var node = container.querySelector(selector);
            if (node) {
                node.textContent = value;
            }
        }

        function weatherCodeMap(code) {
            var map = {
                0: { label: 'Clear sky', emoji: '☀️' },
                1: { label: 'Mainly clear', emoji: '🌤️' },
                2: { label: 'Partly cloudy', emoji: '⛅' },
                3: { label: 'Overcast', emoji: '☁️' },
                45: { label: 'Fog', emoji: '🌫️' },
                48: { label: 'Depositing rime fog', emoji: '🌫️' },
                51: { label: 'Light drizzle', emoji: '🌦️' },
                53: { label: 'Drizzle', emoji: '🌦️' },
                55: { label: 'Dense drizzle', emoji: '🌧️' },
                56: { label: 'Light freezing drizzle', emoji: '🌨️' },
                57: { label: 'Freezing drizzle', emoji: '🌨️' },
                61: { label: 'Slight rain', emoji: '🌦️' },
                63: { label: 'Rain', emoji: '🌧️' },
                65: { label: 'Heavy rain', emoji: '🌧️' },
                66: { label: 'Light freezing rain', emoji: '🌨️' },
                67: { label: 'Freezing rain', emoji: '🌨️' },
                71: { label: 'Slight snow', emoji: '🌨️' },
                73: { label: 'Snow', emoji: '🌨️' },
                75: { label: 'Heavy snow', emoji: '❄️' },
                77: { label: 'Snow grains', emoji: '❄️' },
                80: { label: 'Rain showers', emoji: '🌦️' },
                81: { label: 'Rain showers', emoji: '🌧️' },
                82: { label: 'Violent rain showers', emoji: '⛈️' },
                85: { label: 'Snow showers', emoji: '🌨️' },
                86: { label: 'Heavy snow showers', emoji: '❄️' },
                95: { label: 'Thunderstorm', emoji: '⛈️' },
                96: { label: 'Thunderstorm with hail', emoji: '⛈️' },
                99: { label: 'Thunderstorm with hail', emoji: '⛈️' }
            };

            return map.hasOwnProperty(code) ? map[code] : { label: 'Unknown conditions', emoji: '🌍' };
        }

        function clearRefreshTimer() {
            if (refreshTimer) {
                window.clearTimeout(refreshTimer);
                refreshTimer = null;
            }
        }

        function scheduleRefresh() {
            clearRefreshTimer();
            refreshTimer = window.setTimeout(function () {
                fetchWeather();
            }, scope.config.RefreshMinutes * 60 * 1000);
        }

        function formatTimestamp(value) {
            if (!value) {
                return 'Updated time unavailable';
            }

            var date = new Date(value);
            if (isNaN(date.getTime())) {
                return 'Updated time unavailable';
            }

            return 'Updated ' + date.toLocaleString();
        }

        function applyLoadingState(message) {
            setText('.weather-status', message || 'Loading weather...');
            setText('.weather-city', scope.config.CityQuery || '--');
            setText('.weather-updated', '--');
        }

        function applyErrorState(message) {
            setText('.weather-status', 'Weather unavailable');
            setText('.weather-city', scope.config.CityQuery || '--');
            setText('.weather-updated', message || 'Unable to load weather data.');
            setText('.weather-temperature', '--°C');
            setText('.weather-description', 'Check the configured city name');
            setText('.weather-range', '--');
            setText('.weather-feels-like', '--');
            setText('.weather-humidity', '--');
            setText('.weather-wind', '--');
            setText('.weather-precipitation', '--');
            setText('.weather-emoji', '⚠️');
        }

        function applyWeatherState(geo, forecast) {
            var current = forecast.current || {};
            var daily = forecast.daily || {};
            var weatherDetails = weatherCodeMap(current.weather_code);
            var cityParts = [geo.name, geo.admin1, geo.country].filter(function (part, index, parts) {
                return !!safeString(part) && parts.indexOf(part) === index;
            });
            var maxTemp = daily.temperature_2m_max && daily.temperature_2m_max.length ? daily.temperature_2m_max[0] : null;
            var minTemp = daily.temperature_2m_min && daily.temperature_2m_min.length ? daily.temperature_2m_min[0] : null;
            var rainChance = daily.precipitation_probability_max && daily.precipitation_probability_max.length ? daily.precipitation_probability_max[0] : null;

            setText('.weather-status', 'Live weather from Open-Meteo');
            setText('.weather-city', cityParts.join(', ') || scope.config.CityQuery);
            setText('.weather-updated', formatTimestamp(current.time));
            setText('.weather-temperature', Math.round(safeNumber(current.temperature_2m, 0)) + '°C');
            setText('.weather-description', weatherDetails.label);
            setText('.weather-range', 'High ' + Math.round(safeNumber(maxTemp, 0)) + '° / Low ' + Math.round(safeNumber(minTemp, 0)) + '°');
            setText('.weather-feels-like', Math.round(safeNumber(current.apparent_temperature, 0)) + '°C');
            setText('.weather-humidity', Math.round(safeNumber(current.relative_humidity_2m, 0)) + '%');
            setText('.weather-wind', Math.round(safeNumber(current.wind_speed_10m, 0)) + ' km/h');
            setText('.weather-precipitation', Math.round(safeNumber(rainChance, 0)) + '%');
            setText('.weather-emoji', weatherDetails.emoji);
        }

        function fetchJson(url) {
            return fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }).then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            });
        }

        function fetchWeather() {
            ensureConfig();
            clearRefreshTimer();
            requestVersion += 1;
            var currentRequest = requestVersion;
            var encodedCity = encodeURIComponent(scope.config.CityQuery);
            var geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodedCity + '&count=1&language=en&format=json';

            applyLoadingState('Looking up city...');

            fetchJson(geocodingUrl)
                .then(function (geoResult) {
                    if (currentRequest !== requestVersion) {
                        return;
                    }

                    if (!geoResult || !geoResult.results || !geoResult.results.length) {
                        throw new Error('City not found');
                    }

                    var location = geoResult.results[0];
                    var forecastUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' +
                        encodeURIComponent(location.latitude) +
                        '&longitude=' + encodeURIComponent(location.longitude) +
                        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
                        '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
                        '&forecast_days=1&timezone=auto&wind_speed_unit=kmh';

                    applyLoadingState('Loading forecast...');

                    return fetchJson(forecastUrl).then(function (forecastResult) {
                        if (currentRequest !== requestVersion) {
                            return;
                        }

                        applyWeatherState(location, forecastResult || {});
                        scheduleRefresh();
                    });
                })
                .catch(function (error) {
                    if (currentRequest !== requestVersion) {
                        return;
                    }

                    applyErrorState(error && error.message ? error.message : 'Unknown error');
                    scheduleRefresh();
                });
        }

        ensureConfig();
        fetchWeather();
        self.fetchWeather = fetchWeather;

        function onConfigChange() {
            ensureConfig();
            fetchWeather();
        }
    };

    PV.symbolCatalog.register(definition);
})(window.PIVisualization);
