// Azan Times - Scriptable widget
// Shows Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha for a saved location.
// Tap the widget to switch between your saved locations.
// Data source: Aladhan API (https://aladhan.com) - Method: University of Islamic Sciences, Karachi (ID 1)

const LOCATIONS = [
  { name: "New York", lat: 40.7128, lon: -74.0060 },
  { name: "London", lat: 51.5074, lon: -0.1278 },
  { name: "Tokyo", lat: 35.6895, lon: 139.6917 },
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
  // Convert "HH:MM" 24hr to clean 12hr format (without am/pm to avoid column clipping)
  const [h, m] = t.split(":").map(Number);
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${String(m).padStart(2, "0")}`;
}

function getNextMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return next;
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
      w.backgroundColor = new Color("#111113");
      const errText = w.addText("Couldn't load prayer times. Open app to retry.");
      errText.textColor = Color.white();
      return w;
    }
  }

  // Visual Theme
  const THEME = {
    bg: new Color("#111113"),
    headerText: new Color("#FFFFFF"),
    dateText: new Color("#8E8E93"),
    timeText: new Color("#FF453A"),        // Tall bold red digits
    labelText: new Color("#98989D"),       // Clean muted gray labels
    footerText: new Color("#48484A"),
  };

  const FONTS = {
    city: Font.semiboldSystemFont(13),
    date: Font.regularSystemFont(11),
    time: new Font("DINCondensed-Bold", 28), // CHANGED: Increased font size from 22 to 28
    label: Font.mediumSystemFont(10),
    footer: Font.systemFont(8.5),
  };

  const w = new ListWidget();
  w.backgroundColor = THEME.bg;
  w.setPadding(12, 10, 10, 10);

  // --- Top Breathing Room ---
  w.addSpacer(2);

  // --- Header Stack: City & Formatted Date ---
  const headerStack = w.addStack();
  headerStack.layoutHorizontally();
  headerStack.centerAlignContent();
  headerStack.setPadding(0, 4, 0, 4);

  const cityText = headerStack.addText(loc.name);
  cityText.font = FONTS.city;
  cityText.textColor = THEME.headerText;

  headerStack.addSpacer();

  const dateText = headerStack.addText(timings.date + (stale ? " (cached)" : ""));
  dateText.font = FONTS.date;
  dateText.textColor = THEME.dateText;

  // --- Center Vertical Spacing ---
  w.addSpacer();

  // --- 6-Column Prayer Grid ---
  const prayers = [
    { label: "Fajr", time: formatTime(timings.fajr) },
    { label: "Sunrise", time: formatTime(timings.sunrise) },
    { label: "Dhuhr", time: formatTime(timings.dhuhr) },
    { label: "Asr", time: formatTime(timings.asr) },
    { label: "Maghrib", time: formatTime(timings.maghrib) },
    { label: "Isha", time: formatTime(timings.isha) },
  ];

  const gridStack = w.addStack();
  gridStack.layoutHorizontally();
  gridStack.centerAlignContent();

  for (let i = 0; i < prayers.length; i++) {
    const item = prayers[i];

    const colStack = gridStack.addStack();
    colStack.layoutVertically();
    colStack.centerAlignContent();

    // 1. Time (Tall Red Condensed Font)
    const timeElem = colStack.addText(item.time);
    timeElem.font = FONTS.time;
    timeElem.textColor = THEME.timeText;
    timeElem.centerAlignText();
    timeElem.lineLimit = 1;
    timeElem.minimumScaleFactor = 0.6;

    colStack.addSpacer(2);

    // 2. Label (Neutral Gray)
    const labelElem = colStack.addText(item.label);
    labelElem.font = FONTS.label;
    labelElem.textColor = THEME.labelText;
    labelElem.centerAlignText();
    labelElem.lineLimit = 1;
    labelElem.minimumScaleFactor = 0.7;

    if (i < prayers.length - 1) {
      gridStack.addSpacer();
    }
  }

  // --- Bottom Spacing & Subtle Footer ---
  w.addSpacer();

  // const footer = w.addText("Tap to switch location");
  // footer.font = FONTS.footer;
  // footer.textColor = THEME.footerText;
  // footer.centerAlignText();

  // Hint to iOS: don't bother refreshing until the day changes -
  // prayer times are fixed for the whole day, so there's no need for
  // multiple refreshes. iOS may still refresh earlier at its own discretion,
  // but this discourages unnecessary ones.
  w.refreshAfterDate = getNextMidnight();

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