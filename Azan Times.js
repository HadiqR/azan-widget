// Azan Times — Scriptable widget
// Shows Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha for a saved location.
// Tap the widget to switch between your saved locations.
// Data source: Aladhan API (https://aladhan.com) — Method: University of Islamic Sciences, Karachi (ID 1)

const LOCATIONS = [
  { name: "New York", lat: 11.2588, lon: 75.7804 },
  { name: "London", lat: 12.9500, lon: 77.6608 },
  { name: "Tokyo", lat: 12.9351, lon: 77.6398 },
];

const METHOD = 1; // University of Islamic Sciences, Karachi
const SELECTED_KEY = "azan_widget_selected_location";
const CACHE_KEY_PREFIX = "azan_widget_cache_";

const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.documentsDirectory(), "azan_widget_cache");
if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir);

function getSelectedIndex() {
  const path = fm.joinPath(cacheDir, SELECTED_KEY + ".txt");
  if (fm.fileExists(path)) {
    const idx = parseInt(fm.readString(path));
    if (!isNaN(idx) && idx >= 0 && idx < LOCATIONS.length) return idx;
  }
  return 0; // default to first location
}

function setSelectedIndex(idx) {
  const path = fm.joinPath(cacheDir, SELECTED_KEY + ".txt");
  fm.writeString(path, String(idx));
}

function cachePath(idx) {
  return fm.joinPath(cacheDir, CACHE_KEY_PREFIX + idx + ".json");
}

function saveCache(idx, data) {
  fm.writeString(cachePath(idx), JSON.stringify(data));
}

function loadCache(idx) {
  const path = cachePath(idx);
  if (fm.fileExists(path)) {
    try {
      return JSON.parse(fm.readString(path));
    } catch (e) {
      return null;
    }
  }
  return null;
}

async function fetchTimings(loc) {
  const ts = Math.floor(Date.now() / 1000);
  const url = `https://api.aladhan.com/v1/timings/${ts}?latitude=${loc.lat}&longitude=${loc.lon}&method=${METHOD}`;
  const req = new Request(url);
  const json = await req.loadJSON();
  const t = json.data.timings;
  const clean = (s) => s.split(" ")[0]; // strip timezone suffix like "(IST)"
  return {
    fajr: clean(t.Fajr),
    sunrise: clean(t.Sunrise),
    dhuhr: clean(t.Dhuhr),
    asr: clean(t.Asr),
    maghrib: clean(t.Maghrib),
    isha: clean(t.Isha),
    date: json.data.date.readable,
    fetchedAt: Date.now(),
  };
}

function formatTime(t) {
  // Convert "HH:MM" 24hr to 12hr with am/pm, lowercase, no leading zero
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

async function buildWidget(idx) {
  const loc = LOCATIONS[idx];
  let timings;
  let stale = false;

  try {
    timings = await fetchTimings(loc);
    saveCache(idx, timings);
  } catch (e) {
    const cached = loadCache(idx);
    if (cached) {
      timings = cached;
      stale = true;
    } else {
      const w = new ListWidget();
      w.addText("Couldn't load prayer times. Open app to retry.");
      return w;
    }
  }

  const w = new ListWidget();
  w.backgroundColor = new Color("#101418");
  w.setPadding(14, 16, 14, 16);

  // Header: location name
  const header = w.addText(loc.name.toUpperCase());
  header.font = Font.boldSystemFont(12);
  header.textColor = new Color("#8AB4F8");
  w.addSpacer(2);

  const dateText = w.addText(timings.date + (stale ? "  (cached)" : ""));
  dateText.font = Font.systemFont(10);
  dateText.textColor = new Color("#888888");
  w.addSpacer(8);

  const rows = [
    ["Fajr", timings.fajr],
    ["Sunrise", timings.sunrise],
    ["Dhuhr", timings.dhuhr],
    ["Asr", timings.asr],
    ["Maghrib", timings.maghrib],
    ["Isha", timings.isha],
  ];

  for (const [label, time] of rows) {
    const row = w.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();

    const labelText = row.addText(label);
    labelText.font = label === "Sunrise"
      ? Font.italicSystemFont(13)
      : Font.mediumSystemFont(13);
    labelText.textColor = label === "Sunrise"
      ? new Color("#AAAAAA")
      : Color.white();

    row.addSpacer();

    const timeText = row.addText(formatTime(time));
    timeText.font = Font.boldSystemFont(13);
    timeText.textColor = label === "Sunrise"
      ? new Color("#AAAAAA")
      : new Color("#8AB4F8");

    w.addSpacer(4);
  }

  w.addSpacer(2);
  const footer = w.addText("Tap to switch location");
  footer.font = Font.systemFont(9);
  footer.textColor = new Color("#555555");

  return w;
}

async function showLocationPicker() {
  const alert = new Alert();
  alert.title = "Select Location";
  alert.message = "Currently: " + LOCATIONS[getSelectedIndex()].name;
  for (const loc of LOCATIONS) {
    alert.addAction(loc.name);
  }
  alert.addCancelAction("Cancel");
  const choice = await alert.presentSheet();
  if (choice >= 0 && choice < LOCATIONS.length) {
    setSelectedIndex(choice);
  }
}

// Main
if (config.runsInWidget) {
  const idx = getSelectedIndex();
  const widget = await buildWidget(idx);
  Script.setWidget(widget);
  Script.complete();
} else {
  // Running in-app (tapped the widget, or opened Scriptable directly)
  await showLocationPicker();
  const idx = getSelectedIndex();
  const widget = await buildWidget(idx);
  widget.presentMedium();
  Script.complete();
}