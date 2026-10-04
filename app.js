// -----------------------------
// App configuration
// -----------------------------

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

const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const NWS_ALERTS_API = "https://api.weather.gov/alerts/active";

const WEATHER_REFRESH_MS = 15 * 60 * 1000;

const state = {
  location: { ...HOME_LOCATION },
  weather: null,
  alerts: [],
  refreshTimer: null
};

let locationSearchTimer = null;

const LOCATION_SEARCH_DELAY_MS = 350;
const LOCATION_SEARCH_MIN_LENGTH = 3;

// -----------------------------
// DOM references
// -----------------------------

const elements = {
  locationName: document.querySelector("#location-name"),
  lastUpdated: document.querySelector("#last-updated"),
  refreshButton: document.querySelector("#refresh-button"),
  themeButton: document.querySelector("#theme-button"),

  openLocationSearch: document.querySelector("#open-location-search"),
  locationPanel: document.querySelector("#location-panel"),
  locationForm: document.querySelector("#location-form"),
  locationInput: document.querySelector("#location-input"),
  locationResults: document.querySelector("#location-results"),
  useHomeLocation: document.querySelector("#use-home-location"),

  statusMessage: document.querySelector("#status-message"),
  alertsContainer: document.querySelector("#alerts-container"),

  currentCondition: document.querySelector("#current-condition"),
  currentTemperature: document.querySelector("#current-temperature"),
  currentIcon: document.querySelector("#current-icon"),
  feelsLike: document.querySelector("#feels-like"),
  todayHigh: document.querySelector("#today-high"),
  todayLow: document.querySelector("#today-low"),
  currentHumidity: document.querySelector("#current-humidity"),
  currentWind: document.querySelector("#current-wind"),
  currentGusts: document.querySelector("#current-gusts"),
  currentRainChance: document.querySelector("#current-rain-chance"),
  todayPrecipitation: document.querySelector("#today-precipitation"),
  sunTimes: document.querySelector("#sun-times"),

  todayHourlyStrip: document.querySelector("#today-hourly-strip"),
  fullHourlyList: document.querySelector("#full-hourly-list"),
  todayDailyList: document.querySelector("#today-daily-list"),
  fullDailyList: document.querySelector("#full-daily-list"),

  openNwsRadar: document.querySelector("#open-nws-radar"),
  openTwcRadar: document.querySelector("#open-twc-radar")
};

// -----------------------------
// Startup
// -----------------------------

document.addEventListener("DOMContentLoaded", init);

async function init() {
  loadTheme();
  bindEvents();
  //registerServiceWorker(); Disabling Service Worker Caching
  updateLocationHeading();

  await loadWeather();

  // Refresh while the app remains open.
  state.refreshTimer = window.setInterval(loadWeather, WEATHER_REFRESH_MS);
}

// -----------------------------
// Event handling
// -----------------------------

function bindEvents() {
  elements.locationInput.addEventListener("input", handleLocationInput);
  
  elements.refreshButton.addEventListener("click", loadWeather);
  elements.themeButton.addEventListener("click", toggleTheme);

  elements.openLocationSearch.addEventListener("click", toggleLocationPanel);
  elements.locationForm.addEventListener("submit", handleLocationSearch);
  elements.useHomeLocation.addEventListener("click", useHomeLocation);

  elements.openNwsRadar.addEventListener("click", openNwsRadar);
  elements.openTwcRadar.addEventListener("click", openWeatherChannelRadar);

  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => {
      showView(button.dataset.viewTarget);
    });
  });

  document.querySelectorAll(".view-link").forEach((button) => {
    button.addEventListener("click", () => {
      showView(button.dataset.targetView);
    });
  });
}

// -----------------------------
// Weather data fetching
// -----------------------------

async function loadWeather() {
  setLoading(true);
  showStatus("Updating weather…");

  try {
    const [weather, alerts] = await Promise.all([
      fetchWeather(state.location),
      fetchNwsAlerts(state.location)
    ]);

    state.weather = weather;
    state.alerts = alerts;

    renderWeather();
    renderAlerts();

    elements.lastUpdated.textContent = `Updated ${formatTime(new Date())}`;
    hideStatus();
  } catch (error) {
    console.error("Weather update failed:", error);
    showStatus(
      "Weather could not be updated. Check your connection and try again.",
      true
    );
  } finally {
    setLoading(false);
  }
}

async function fetchWeather(location) {
  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "precipitation"
    ].join(","),
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "is_day"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
      "sunrise",
      "sunset"
    ].join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "16"
  });

  const response = await fetch(`${WEATHER_API}?${params}`);

  if (!response.ok) {
    throw new Error(`Open-Meteo returned ${response.status}`);
  }

  return response.json();
}

async function fetchNwsAlerts(location) {
  // NWS alerts are only applicable to U.S. locations.
  if (location.countryCode !== "US") {
    return [];
  }

  const point = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
  const params = new URLSearchParams({ point });

  const response = await fetch(`${NWS_ALERTS_API}?${params}`, {
    headers: {
      Accept: "application/geo+json"
    }
  });

  if (!response.ok) {
    console.warn(`NWS alerts returned ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.features ?? [];
}

// -----------------------------
// Current conditions
// -----------------------------

function renderWeather() {
  if (!state.weather) {
    return;
  }

  renderCurrentConditions();
  renderHourlyForecast();
  renderDailyForecast();
}

function renderCurrentConditions() {
  const weather = state.weather;
  const current = weather.current;
  const today = getDailyForecasts(weather)[0];
  const currentHour = getCurrentHourlyForecast(weather);
  const condition = getWeatherCondition(current.weather_code, currentHour?.isDay);

  elements.currentCondition.textContent = condition.label;
  elements.currentTemperature.textContent = formatTemperature(current.temperature_2m);
  elements.currentIcon.textContent = condition.icon;
  elements.feelsLike.textContent =
    `Feels like ${formatTemperature(current.apparent_temperature)}`;

  elements.todayHigh.textContent = formatTemperature(today.maxTemp);
  elements.todayLow.textContent = formatTemperature(today.minTemp);
  elements.currentHumidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  elements.currentWind.textContent =
    `${Math.round(current.wind_speed_10m)} mph ${degreesToCompass(current.wind_direction_10m)}`;
  elements.currentGusts.textContent = `${Math.round(current.wind_gusts_10m)} mph`;
  elements.currentRainChance.textContent =
    `${Math.round(currentHour?.precipitationProbability ?? 0)}%`;
  elements.todayPrecipitation.textContent =
    `${formatPrecipitation(today.precipitation)} in`;
  elements.sunTimes.textContent =
    `${formatTimeString(today.sunrise)} / ${formatTimeString(today.sunset)}`;
}

// -----------------------------
// Hourly forecast
// -----------------------------

function renderHourlyForecast() {
  const next24 = getNextHours(state.weather, 24);

  elements.todayHourlyStrip.innerHTML = next24
    .map((hour, index) => buildHourlyCard(hour, index === 0))
    .join("");

  elements.fullHourlyList.innerHTML = next24
    .map((hour, index) => buildHourlyRow(hour, index === 0))
    .join("");
}

function buildHourlyCard(hour, isFirst) {
  const condition = getWeatherCondition(hour.weatherCode, hour.isDay);

  return `
    <article class="hour-card">
      <span class="hour-time">${isFirst ? "Now" : formatHour(hour.time)}</span>
      <span class="hour-icon" aria-hidden="true">${condition.icon}</span>
      <span class="hour-temp">${formatTemperature(hour.temperature)}</span>
      <div class="hour-rain">${Math.round(hour.precipitationProbability)}%</div>
    </article>
  `;
}

function buildHourlyRow(hour, isFirst = false) {
  const condition = getWeatherCondition(hour.weatherCode, hour.isDay);

  return `
    <div class="hour-row">
      <div>
        <div class="hour-row-time">${isFirst ? "Now" : formatHour(hour.time)}</div>
        <div class="hour-row-condition">${escapeHtml(condition.label)}</div>
      </div>

      <div class="hour-row-icon" aria-hidden="true">${condition.icon}</div>
      <div class="hour-row-rain">${Math.round(hour.precipitationProbability)}%</div>
      <div class="hour-row-temp">${formatTemperature(hour.temperature)}</div>
    </div>
  `;
}

// -----------------------------
// Daily forecast
// -----------------------------

function renderDailyForecast() {
  const days = getDailyForecasts(state.weather);

  elements.todayDailyList.innerHTML = days
    .slice(0, 7)
    .map((day) => buildDailyItem(day, false))
    .join("");

  elements.fullDailyList.innerHTML = days
    .map((day) => buildDailyItem(day, true))
    .join("");

  bindDailyExpanders();
}

function buildDailyItem(day, expandable) {
  const condition = getWeatherCondition(day.weatherCode, true);
  const dayHours = expandable ? getHoursForDate(state.weather, day.date) : [];

  const hourlyMarkup = dayHours.length
    ? `
      <div class="day-hourly">
        <p class="day-hourly-note">
          Hourly data is shown for the portion of this day available in the forecast.
        </p>
        ${dayHours.map((hour) => buildHourlyRow(hour)).join("")}
      </div>
    `
    : "";

  return `
    <article class="daily-item" data-date="${escapeHtml(day.date)}">
      <button
        class="daily-summary"
        type="button"
        ${expandable ? 'data-expand-day="true"' : 'data-open-forecast="true"'}
        aria-expanded="false"
      >
        <span class="daily-day">
          ${escapeHtml(formatDayName(day.date))}
          <span class="daily-date">${escapeHtml(formatShortDate(day.date))}</span>
        </span>

        <span class="daily-icon" aria-hidden="true">${condition.icon}</span>
        <span class="daily-rain">${Math.round(day.precipitationProbability)}%</span>

        <span class="daily-temps">
          <strong>${formatTemperature(day.maxTemp)}</strong>
          <span class="daily-low">${formatTemperature(day.minTemp)}</span>
        </span>
      </button>

      ${hourlyMarkup}
    </article>
  `;
}

function bindDailyExpanders() {
  document.querySelectorAll('[data-expand-day="true"]').forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".daily-item");
      const isExpanded = item.classList.toggle("expanded");

      button.setAttribute("aria-expanded", String(isExpanded));
    });
  });

  document.querySelectorAll('[data-open-forecast="true"]').forEach((button) => {
    button.addEventListener("click", () => showView("forecast"));
  });
}

// -----------------------------
// NWS weather alerts
// -----------------------------

function renderAlerts() {
  if (!state.alerts.length) {
    elements.alertsContainer.innerHTML = "";
    return;
  }

  elements.alertsContainer.innerHTML = state.alerts
    .map((feature) => {
      const properties = feature.properties ?? {};

      return `
        <details class="weather-alert">
          <summary>⚠ ${escapeHtml(properties.event ?? "Weather Alert")}</summary>

          <div class="alert-content">
            ${properties.headline ? `<p><strong>${escapeHtml(properties.headline)}</strong></p>` : ""}
            ${properties.description ? `<p>${escapeHtml(properties.description).replace(/\n/g, "<br>")}</p>` : ""}
            ${properties.instruction ? `<p><strong>Instructions:</strong><br>${escapeHtml(properties.instruction).replace(/\n/g, "<br>")}</p>` : ""}
          </div>
        </details>
      `;
    })
    .join("");
}

// -----------------------------
// Location search
// -----------------------------

function handleLocationInput() {
  const query = elements.locationInput.value.trim();

  // Cancel any pending search from the previous keystroke.
  window.clearTimeout(locationSearchTimer);

  // Clear suggestions when the input is too short.
  if (query.length < LOCATION_SEARCH_MIN_LENGTH) {
    elements.locationResults.innerHTML = "";
    return;
  }

  // Wait briefly so we don't call the API on every keystroke.
  locationSearchTimer = window.setTimeout(() => {
    searchLocations(query);
  }, LOCATION_SEARCH_DELAY_MS);
}

function toggleLocationPanel() {
  elements.locationPanel.classList.toggle("hidden");

  if (!elements.locationPanel.classList.contains("hidden")) {
    elements.locationInput.focus();
  }
}

function handleLocationSearch(event) {
  event.preventDefault();

  const query = elements.locationInput.value.trim();

  if (query.length < LOCATION_SEARCH_MIN_LENGTH) {
    return;
  }

  window.clearTimeout(locationSearchTimer);
  searchLocations(query);
}

async function searchLocations(query) {
  elements.locationResults.innerHTML =
    '<div class="status-message">Searching locations…</div>';

  try {
    const params = new URLSearchParams({
      name: query,
      count: "8",
      language: "en",
      format: "json",
      countryCode: "US"
    });

    const response = await fetch(`${GEOCODING_API}?${params}`);

    if (!response.ok) {
      throw new Error(`Geocoding returned ${response.status}`);
    }

    const data = await response.json();
    renderLocationResults(data.results ?? []);
  } catch (error) {
    console.error("Location search failed:", error);

    elements.locationResults.innerHTML =
      '<div class="status-message error">Location search failed. Please try again.</div>';
  }
}

function renderLocationResults(results) {
  if (!results.length) {
    elements.locationResults.innerHTML =
      '<div class="status-message">No matching U.S. locations were found.</div>';
    return;
  }

  elements.locationResults.innerHTML = results
    .map((result, index) => {
      const secondary = [result.admin1, result.country]
        .filter(Boolean)
        .join(", ");

      return `
        <button class="location-result" type="button" data-location-index="${index}">
          <strong>${escapeHtml(result.name)}</strong>
          <span>${escapeHtml(secondary)}</span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-location-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      const result = results[Number(button.dataset.locationIndex)];

      state.location = {
        name: result.name,
        admin1: result.admin1 ?? "",
        admin1Code: result.admin1_code ?? "",
        country: result.country ?? "United States",
        countryCode: result.country_code ?? "US",
        postalCode: "",
        latitude: result.latitude,
        longitude: result.longitude
      };

      elements.locationPanel.classList.add("hidden");
      elements.locationResults.innerHTML = "";
      elements.locationInput.value = "";

      updateLocationHeading();
      await loadWeather();
    });
  });
}

async function useHomeLocation() {
  state.location = { ...HOME_LOCATION };

  elements.locationPanel.classList.add("hidden");
  elements.locationResults.innerHTML = "";
  elements.locationInput.value = "";

  updateLocationHeading();
  await loadWeather();
}

function updateLocationHeading() {
  const location = state.location;
  const region = getRegionLabel(location);

  elements.locationName.textContent =
    region ? `${location.name}, ${region}` : location.name;
}

// -----------------------------
// Radar links
// -----------------------------

function openNwsRadar() {
  const { latitude, longitude } = state.location;

  // radar.weather.gov stores a bookmarkable map center in its settings parameter.
  // If this format changes in the future, the generic radar page still remains useful.
  const settings = {
    agenda: {
      id: null,
      center: [longitude, latitude],
      location: null,
      zoom: 8.5
    },
    animating: true,
    base: "standard",
    artcc: false,
    county: true,
    cwa: false,
    rfc: false,
    state: true,
    menu: true,
    shortFusedOnly: false,
    opacity: {
      alerts: 0.8,
      local: 0.6,
      localStations: 0.8,
      national: 0.6
    }
  };

  try {
    const encoded = base64UrlEncode(JSON.stringify(settings));
    window.open(`https://radar.weather.gov/?settings=v1_${encoded}`, "_blank", "noopener");
  } catch (error) {
    console.warn("Could not create centered NWS radar link:", error);
    window.open("https://radar.weather.gov/", "_blank", "noopener");
  }
}

function openWeatherChannelRadar() {
  const location = state.location;
  const region = getRegionLabel(location);
  const locationText = [location.name, region, location.countryCode]
    .filter(Boolean)
    .join(" ");

  const url =
    //`https://weather.com/weather/radar/interactive/l/${encodeURIComponent(locationText)}`;
    'https://weather.com/us/west-virginia/city/ranson/radar';

  window.open(url, "_blank", "noopener");
}

function base64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// -----------------------------
// Navigation
// -----------------------------

function showView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active-view", view.dataset.view === viewName);
  });

  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTarget === viewName);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// -----------------------------
// Theme handling
// -----------------------------

function loadTheme() {
  const savedTheme = localStorage.getItem("weather-theme");
  setTheme(savedTheme === "light" ? "light" : "dark");
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme;
  setTheme(currentTheme === "light" ? "dark" : "light");
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("weather-theme", theme);

  elements.themeButton.textContent = theme === "dark" ? "☀" : "☾";
  elements.themeButton.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
  );

  const themeColor = theme === "dark" ? "#101318" : "#f5f7fb";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", themeColor);
}

// -----------------------------
// Forecast data helpers
// -----------------------------

function getNextHours(weather, count) {
  const hourly = normalizeHourlyData(weather);
  const now = Date.now();

  let startIndex = hourly.findIndex((hour) => {
    return new Date(hour.time).getTime() >= now;
  });

  if (startIndex === -1) {
    startIndex = 0;
  }

  return hourly.slice(startIndex, startIndex + count);
}

function getCurrentHourlyForecast(weather) {
  return getNextHours(weather, 1)[0] ?? null;
}

function getHoursForDate(weather, date) {
  return normalizeHourlyData(weather).filter((hour) => {
    return hour.time.startsWith(date);
  });
}

function normalizeHourlyData(weather) {
  return weather.hourly.time.map((time, index) => ({
    time,
    temperature: weather.hourly.temperature_2m[index],
    apparentTemperature: weather.hourly.apparent_temperature[index],
    humidity: weather.hourly.relative_humidity_2m[index],
    precipitationProbability: weather.hourly.precipitation_probability[index] ?? 0,
    precipitation: weather.hourly.precipitation[index] ?? 0,
    weatherCode: weather.hourly.weather_code[index],
    windSpeed: weather.hourly.wind_speed_10m[index],
    windDirection: weather.hourly.wind_direction_10m[index],
    windGusts: weather.hourly.wind_gusts_10m[index],
    isDay: Boolean(weather.hourly.is_day[index])
  }));
}

function getDailyForecasts(weather) {
  return weather.daily.time.map((date, index) => ({
    date,
    weatherCode: weather.daily.weather_code[index],
    maxTemp: weather.daily.temperature_2m_max[index],
    minTemp: weather.daily.temperature_2m_min[index],
    precipitation: weather.daily.precipitation_sum[index] ?? 0,
    precipitationProbability:
      weather.daily.precipitation_probability_max[index] ?? 0,
    maxWind: weather.daily.wind_speed_10m_max[index],
    maxGusts: weather.daily.wind_gusts_10m_max[index],
    sunrise: weather.daily.sunrise[index],
    sunset: weather.daily.sunset[index]
  }));
}

// -----------------------------
// Weather-code display mapping
// -----------------------------

function getWeatherCondition(code, isDay = true) {
  const dayIcon = isDay ? "☀️" : "🌙";

  if (code === 0) {
    return { label: "Clear", icon: dayIcon };
  }

  if (code === 1) {
    return { label: "Mostly clear", icon: isDay ? "🌤️" : "🌙" };
  }

  if (code === 2) {
    return { label: "Partly cloudy", icon: "⛅" };
  }

  if (code === 3) {
    return { label: "Cloudy", icon: "☁️" };
  }

  if ([45, 48].includes(code)) {
    return { label: "Fog", icon: "🌫️" };
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return { label: "Drizzle", icon: "🌦️" };
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: "Rain", icon: "🌧️" };
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: "Snow", icon: "🌨️" };
  }

  if ([95, 96, 99].includes(code)) {
    return { label: "Thunderstorms", icon: "⛈️" };
  }

  return { label: "Mixed conditions", icon: "🌥️" };
}

// -----------------------------
// Formatting helpers
// -----------------------------

function formatTemperature(value) {
  if (!Number.isFinite(value)) {
    return "--°";
  }

  return `${Math.round(value)}°`;
}

function formatPrecipitation(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (value === 0) {
    return "0";
  }

  return value < 0.01 ? "<0.01" : value.toFixed(2);
}

function formatHour(timeString) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric"
  }).format(new Date(timeString));
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatTimeString(timeString) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timeString));
}

function formatDayName(dateString) {
  const date = new Date(`${dateString}T12:00:00`);

  if (isSameLocalDate(date, new Date())) {
    return "Today";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short"
  }).format(date);
}

function formatShortDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(`${dateString}T12:00:00`));
}

function isSameLocalDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function degreesToCompass(degrees) {
  if (!Number.isFinite(degrees)) {
    return "";
  }

  const directions = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
  ];

  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function getRegionLabel(location) {
  if (location.admin1Code) {
    return location.admin1Code;
  }

  return location.admin1 ?? "";
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

// -----------------------------
// UI status helpers
// -----------------------------

function setLoading(isLoading) {
  elements.refreshButton.disabled = isLoading;
  elements.refreshButton.setAttribute("aria-busy", String(isLoading));
}

function showStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.remove("hidden");
  elements.statusMessage.classList.toggle("error", isError);
}

function hideStatus() {
  elements.statusMessage.classList.add("hidden");
  elements.statusMessage.classList.remove("error");
}

// //////// Disabling Service Worker Caching //////
// -----------------------------
// Progressive Web App
// -----------------------------

// function registerServiceWorker() {
//   if (!("serviceWorker" in navigator)) {
//     return;
//   }

//   window.addEventListener("load", () => {
//     navigator.serviceWorker.register("./service-worker.js").catch((error) => {
//       console.warn("Service worker registration failed:", error);
//     });
//   });
// }
