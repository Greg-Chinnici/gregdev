// hydrate the page from data served by the `data` branch.
// the workflow at .github/workflows/hydrate.yml writes manifest.json
// + one file per source. add new sources there; this script reads the
// manifest and dispatches per `kind`.

// TODO: set to "<owner>/<repo>" (e.g. "greg-chinnici/greg-chinnici.github.io")
const REPO = 'greg-chinnici/gregdev';
const DATA_URL = `https://raw.githubusercontent.com/${REPO}/data`;

async function fetchJSON(path) {
  const res = await fetch(`${DATA_URL}/${path}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

const WMO = {
  0: 'clear sky',
  1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'depositing rime fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'dense drizzle',
  56: 'light freezing drizzle', 57: 'freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  66: 'light freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow',
  77: 'snow grains',
  80: 'light showers', 81: 'showers', 82: 'violent showers',
  85: 'light snow showers', 86: 'snow showers',
  95: 'thunderstorm', 96: 'thunderstorm w/ light hail', 99: 'thunderstorm w/ hail',
};

function formatDay(iso, i) {
  const d = new Date(iso + 'T12:00:00');
  if (i === 0) return 'today';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const renderers = {
  weather: (data, el) => {
    const place = data.place || 'weather';
    const daily = data.daily || {};
    const days = daily.time || [];
    const todayCode = (daily.weather_code || [])[0];
    const todayHi = Math.round((daily.temperature_2m_max || [])[0]);
    const todayLo = Math.round((daily.temperature_2m_min || [])[0]);
    const todaySummary = todayCode != null
      ? `${todayHi}° / ${todayLo}° · ${WMO[todayCode] || 'unknown'}`
      : 'forecast unavailable';

    const rows = days.map((iso, i) => {
      const code = (daily.weather_code || [])[i];
      const hi = Math.round((daily.temperature_2m_max || [])[i]);
      const lo = Math.round((daily.temperature_2m_min || [])[i]);
      const precip = (daily.precipitation_sum || [])[i];
      const precipText = precip > 0 ? `${precip.toFixed(2)}"` : '—';
      return `
        <tr>
          <td>${formatDay(iso, i)}</td>
          <td>${WMO[code] || 'unknown'}</td>
          <td class="num">${hi}° / ${lo}°</td>
          <td class="num">${precipText}</td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="weather-head">
        <span class="weather-place">${place}</span>
        <span class="weather-summary">${todaySummary}</span>
      </div>
      <table class="weather-table">
        <thead><tr><th>day</th><th>conditions</th><th class="num">hi / lo</th><th class="num">precip</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="muted weather-source">source: open-meteo.com</p>
    `;
  },
};

async function hydrate() {
  const target = document.querySelector('[data-hydrate-target]');
  const stamp = document.querySelector('[data-updated]');
  if (!target) return;

  let manifest;
  try {
    manifest = await fetchJSON('manifest.json');
  } catch {
    return; // data branch not populated yet — leave placeholder in place
  }

  if (stamp && manifest.updated) {
    stamp.textContent = `updated ${new Date(manifest.updated).toLocaleString()}`;
  }

  const sources = manifest.sources || [];
  if (sources.length === 0) return;

  target.innerHTML = '';
  for (const src of sources) {
    const render = renderers[src.kind];
    if (!render) continue;
    try {
      const data = await fetchJSON(src.file);
      const block = document.createElement('div');
      block.className = `source source-${src.kind}`;
      render(data, block);
      target.appendChild(block);
    } catch (e) {
      console.warn(`hydrate ${src.kind} failed`, e);
    }
  }
}

hydrate();
