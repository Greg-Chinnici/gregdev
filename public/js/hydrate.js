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

const ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  sunCloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="7" r="2.5" fill="currentColor"/><path d="M8 1.5v1.5M2 7h1.5M3.6 2.6l1 1M12.4 2.6l-1 1"/><path d="M17 19a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.2A3.2 3.2 0 0 0 8 19h9z" fill="currentColor" stroke="none"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 18a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.3A3.5 3.5 0 0 0 7 18h10z"/></svg>',
  fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h16M3 12h18M5 16h14M4 20h16"/></svg>',
  drizzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 14a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.3A3.5 3.5 0 0 0 7 14h10z" fill="currentColor"/><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2"/></svg>',
  rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 14a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.3A3.5 3.5 0 0 0 7 14h10z" fill="currentColor"/><path d="M8 17l-2 4M12 17l-2 4M16 17l-2 4"/></svg>',
  snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 14a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.3A3.5 3.5 0 0 0 7 14h10z" fill="currentColor"/><path d="M9 17v4M7.5 18.5l3 1M7.5 19.5l3-1M15 17v4M13.5 18.5l3 1M13.5 19.5l3-1"/></svg>',
  sleet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 14a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.3A3.5 3.5 0 0 0 7 14h10z" fill="currentColor"/><path d="M8 17l-2 4M16 17l-2 4M11 17v3.5M9.5 18.5l3 1M9.5 19.5l3-1"/></svg>',
  thunder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M17 12a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.3A3.5 3.5 0 0 0 7 12h10z" fill="currentColor"/><path d="M12 13l-3 6h3l-1 4 4-6h-3l2-4z" fill="currentColor"/></svg>',
  unknown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none"/></svg>',
};

const WMO = {
  0:  { label: 'clear sky',                    icon: 'sun' },
  1:  { label: 'mainly clear',                 icon: 'sunCloud' },
  2:  { label: 'partly cloudy',                icon: 'sunCloud' },
  3:  { label: 'overcast',                     icon: 'cloud' },
  45: { label: 'fog',                          icon: 'fog' },
  48: { label: 'depositing rime fog',          icon: 'fog' },
  51: { label: 'light drizzle',                icon: 'drizzle' },
  53: { label: 'drizzle',                      icon: 'drizzle' },
  55: { label: 'dense drizzle',                icon: 'rain' },
  56: { label: 'light freezing drizzle',       icon: 'sleet' },
  57: { label: 'freezing drizzle',             icon: 'sleet' },
  61: { label: 'light rain',                   icon: 'drizzle' },
  63: { label: 'rain',                         icon: 'rain' },
  65: { label: 'heavy rain',                   icon: 'rain' },
  66: { label: 'light freezing rain',          icon: 'sleet' },
  67: { label: 'freezing rain',                icon: 'sleet' },
  71: { label: 'light snow',                   icon: 'snow' },
  73: { label: 'snow',                         icon: 'snow' },
  75: { label: 'heavy snow',                   icon: 'snow' },
  77: { label: 'snow grains',                  icon: 'snow' },
  80: { label: 'light showers',                icon: 'drizzle' },
  81: { label: 'showers',                      icon: 'rain' },
  82: { label: 'violent showers',              icon: 'thunder' },
  85: { label: 'light snow showers',           icon: 'snow' },
  86: { label: 'snow showers',                 icon: 'snow' },
  95: { label: 'thunderstorm',                 icon: 'thunder' },
  96: { label: 'thunderstorm w/ light hail',   icon: 'thunder' },
  99: { label: 'thunderstorm w/ hail',         icon: 'thunder' },
};

const UNKNOWN = { label: 'unknown', icon: 'unknown' };

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
    const todayCond = WMO[todayCode] || UNKNOWN;
    const todayHi = Math.round((daily.temperature_2m_max || [])[0]);
    const todayLo = Math.round((daily.temperature_2m_min || [])[0]);
    const todaySummary = todayCode != null
      ? `${todayHi}° / ${todayLo}° · <span class="weather-icon" aria-hidden="true">${ICONS[todayCond.icon]}</span>${todayCond.label}`
      : 'forecast unavailable';

    const rows = days.map((iso, i) => {
      const code = (daily.weather_code || [])[i];
      const cond = WMO[code] || UNKNOWN;
      const hi = Math.round((daily.temperature_2m_max || [])[i]);
      const lo = Math.round((daily.temperature_2m_min || [])[i]);
      const precip = (daily.precipitation_sum || [])[i];
      const precipText = precip > 0 ? `${precip.toFixed(2)}"` : '—';
      return `
        <tr>
          <td>${formatDay(iso, i)}</td>
          <td><span class="weather-icon" aria-hidden="true">${ICONS[cond.icon]}</span>${cond.label}</td>
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
