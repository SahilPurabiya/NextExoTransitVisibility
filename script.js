// ========================================================
// JD ↔ Date utilities
// ========================================================
const JD_UNIX_EPOCH = 2440587.5;

function dateToJD(date) {
  return date.getTime() / 86400000 + JD_UNIX_EPOCH;
}

function jdToDate(jd) {
  return new Date((jd - JD_UNIX_EPOCH) * 86400000);
}

// ========================================================
// Parse RA: accepts "HH:MM:SS.ss" or decimal hours
// ========================================================
function parseRA(str) {
  str = str.trim();
  // Try HH:MM:SS or HH MM SS
  const hms = str.match(/^(\d+)[:\s]+(\d+)[:\s]+([\d.]+)$/);
  if (hms) {
    return parseFloat(hms[1]) + parseFloat(hms[2]) / 60 + parseFloat(hms[3]) / 3600;
  }
  const val = parseFloat(str);
  if (!isNaN(val)) return val;
  return NaN;
}

// ========================================================
// Parse Dec: accepts "+DD:MM:SS.ss" or decimal degrees
// ========================================================
function parseDec(str) {
  str = str.trim();
  // Try [+-]DD:MM:SS
  const dms = str.match(/^([+-]?)(\d+)[:\s]+(\d+)[:\s]+([\d.]+)$/);
  if (dms) {
    const sign = dms[1] === "-" ? -1 : 1;
    return sign * (parseFloat(dms[2]) + parseFloat(dms[3]) / 60 + parseFloat(dms[4]) / 3600);
  }
  const val = parseFloat(str);
  if (!isNaN(val)) return val;
  return NaN;
}

// ========================================================
// Compute target alt/az at a given Date from observer
// ========================================================
function targetHorizon(date, observer, raHours, decDeg) {
  const hor = Astronomy.Horizon(date, observer, raHours, decDeg, "normal");
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

// ========================================================
// Compute Sun altitude at a given Date from observer
// ========================================================
function sunAltitude(date, observer) {
  const equ = Astronomy.Equator("Sun", date, observer, true, true);
  const hor = Astronomy.Horizon(date, observer, equ.ra, equ.dec, "normal");
  return hor.altitude;
}

// ========================================================
// Compute Hour Angle in hours
// ========================================================
function hourAngle(date, observer, raHours) {
  const lst = Astronomy.SiderealTime(date) + observer.longitude / 15;
  let ha = lst - raHours;
  // Normalize to 0-24 range
  ha = ((ha % 24) + 24) % 24;
  return ha;
}

// ========================================================
// Azimuth to compass direction
// ========================================================
function azToDir(az) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(az / 22.5) % 16];
}

// ========================================================
// Check observability over a JD range
// ALL samples must have sun below limit AND target above min alt
// ========================================================
function checkObservability(startJD, endJD, observer, raH, decD, minAltDeg, sunLimitDeg) {
  const nSamples = 240;
  const spanDays = endJD - startJD;

  let allSunOk = true;
  let allTargetOk = true;
  let maxSunAlt = -90;
  let minTargetAlt = 90;

  for (let i = 0; i < nSamples; i++) {
    const frac = i / (nSamples - 1);
    const sampleJD = startJD + frac * spanDays;
    const sampleDate = jdToDate(sampleJD);

    const tgt = targetHorizon(sampleDate, observer, raH, decD);
    const sunAlt = sunAltitude(sampleDate, observer);

    if (sunAlt > maxSunAlt) maxSunAlt = sunAlt;
    if (tgt.altitude < minTargetAlt) minTargetAlt = tgt.altitude;

    if (sunAlt > sunLimitDeg) allSunOk = false;
    if (tgt.altitude < minAltDeg) allTargetOk = false;
  }

  return {
    observable: allSunOk && allTargetOk,
    allSunOk,
    allTargetOk,
    maxSunAlt,
    minTargetAlt,
    nSamples,
  };
}

// ========================================================
// Diagnose why a transit was skipped
// ========================================================
function diagnoseSkip(result) {
  if (!result.allTargetOk && !result.allSunOk) {
    return `Target min alt = ${result.minTargetAlt.toFixed(1)}° (< min) & Sun max alt = ${result.maxSunAlt.toFixed(1)}° (> limit)`;
  }
  if (!result.allTargetOk) {
    return `Target min alt = ${result.minTargetAlt.toFixed(1)}° (drops below minimum)`;
  }
  if (!result.allSunOk) {
    return `Sun max alt = ${result.maxSunAlt.toFixed(1)}° during window (must be < limit)`;
  }
  return "Unknown";
}

// ========================================================
// Moon illumination fraction and phase angle
// ========================================================
function moonIllumination(date) {
  const info = Astronomy.Illumination("Moon", date);
  const phaseAngle = Astronomy.MoonPhase(date); // 0-360 ecliptic longitude diff for phase name
  return { illum: info.phase_fraction, phaseAngle };
}

// ========================================================
// Moon phase name from phase angle
// ========================================================
function moonPhaseName(phaseAngle) {
  if (phaseAngle < 22.5)  return "New Moon";
  if (phaseAngle < 67.5)  return "Waxing Crescent";
  if (phaseAngle < 112.5) return "First Quarter";
  if (phaseAngle < 157.5) return "Waxing Gibbous";
  if (phaseAngle < 202.5) return "Full Moon";
  if (phaseAngle < 247.5) return "Waning Gibbous";
  if (phaseAngle < 292.5) return "Third Quarter";
  if (phaseAngle < 337.5) return "Waning Crescent";
  return "New Moon";
}

// ========================================================
// Angular separation between target and Moon (degrees)
// ========================================================
function moonSeparation(date, observer, raH, decD) {
  // Use ofdate=false for J2000 coords to match target J2000 RA/Dec
  const moonEqu = Astronomy.Equator("Moon", date, observer, false, true);
  const moonRaRad = moonEqu.ra * 15 * Math.PI / 180;  // hours → degrees → radians
  const moonDecRad = moonEqu.dec * Math.PI / 180;
  const targetRaRad = raH * 15 * Math.PI / 180;
  const targetDecRad = decD * Math.PI / 180;

  const cosD = Math.sin(moonDecRad) * Math.sin(targetDecRad) +
               Math.cos(moonDecRad) * Math.cos(targetDecRad) *
               Math.cos(moonRaRad - targetRaRad);
  return Math.acos(Math.max(-1, Math.min(1, cosD))) * 180 / Math.PI;
}

// ========================================================
// Convert BJD_TDB → JD_UTC (barycentric + timescale correction)
// ========================================================
function bjdTdbToJdUtc(bjdTdb, raH, decD) {
  // TDB-UTC offset: TT-TAI=32.184s + TAI-UTC=37s (since Jan 2017)
  const TDB_UTC_DAYS = 69.184 / 86400;
  const AU_LIGHT_SEC = 499.004783806;

  // Target unit vector (J2000 equatorial)
  const raRad = raH * 15 * Math.PI / 180;
  const decRad = decD * Math.PI / 180;
  const sx = Math.cos(raRad) * Math.cos(decRad);
  const sy = Math.sin(raRad) * Math.cos(decRad);
  const sz = Math.sin(decRad);

  // Iterate once for accuracy
  let jdUtc = bjdTdb;
  for (let iter = 0; iter < 2; iter++) {
    const date = jdToDate(jdUtc);
    const earth = Astronomy.HelioVector("Earth", date);
    const dotAU = earth.x * sx + earth.y * sy + earth.z * sz;
    const roemerDays = dotAU * AU_LIGHT_SEC / 86400;
    jdUtc = bjdTdb - roemerDays - TDB_UTC_DAYS;
  }
  return jdUtc;
}

// ========================================================
// Format date in a given timezone
// ========================================================
function formatDate(date, tz) {
  return date.toLocaleString("en-GB", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

function formatTime(date, tz) {
  return date.toLocaleString("en-GB", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });
}

function formatTZName(tz) {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date());
    const tzPart = parts.find(p => p.type === "timeZoneName");
    return tzPart ? tzPart.value : tz;
  } catch { return tz; }
}

// ========================================================
// Geolocation
// ========================================================
function detectLocation() {
  if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById("lat").value = pos.coords.latitude.toFixed(4);
      document.getElementById("lon").value = pos.coords.longitude.toFixed(4);
      if (pos.coords.altitude != null) {
        document.getElementById("elev").value = Math.round(pos.coords.altitude);
      }
      const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const sel = document.getElementById("tz");
      for (const opt of sel.options) {
        if (opt.value === localTZ) { sel.value = localTZ; break; }
      }
    },
    (err) => alert("Location access denied: " + err.message)
  );
}

// ========================================================
// Main calculation
// ========================================================
function calculate() {
  const resultDiv = document.getElementById("result");
  resultDiv.className = "visible";
  resultDiv.innerHTML = '<p class="loading">Calculating…</p>';

  setTimeout(() => {
    try {
      runCalculation();
    } catch (e) {
      resultDiv.innerHTML = `<p class="error">Error: ${e.message}</p>`;
    }
  }, 50);
}

function runCalculation() {
  const T0 = parseFloat(document.getElementById("t0").value);
  const P = parseFloat(document.getElementById("period").value);
  const transitDurH = parseFloat(document.getElementById("duration").value);
  const raH = parseRA(document.getElementById("ra").value);
  const decD = parseDec(document.getElementById("dec").value);
  const lat = parseFloat(document.getElementById("lat").value);
  const lon = parseFloat(document.getElementById("lon").value);
  const elev = parseFloat(document.getElementById("elev").value);
  const minAltDeg = parseFloat(document.getElementById("minAlt").value);
  const sunLimitDeg = parseFloat(document.getElementById("sunAlt").value);
  const baselineMin = parseFloat(document.getElementById("baseline").value);
  const nEpochs = parseInt(document.getElementById("nEpochs").value, 10);
  const tz = document.getElementById("tz").value;

  if ([T0, P, transitDurH, raH, decD, lat, lon, elev, minAltDeg, sunLimitDeg, baselineMin, nEpochs].some(isNaN)) {
    throw new Error("Please fill in all fields with valid numbers.");
  }

  const observer = new Astronomy.Observer(lat, lon, elev);
  const halfDurDays = transitDurH / 2 / 24;
  const baselineDays = baselineMin / 60 / 24;
  const maxResults = 3;

  // Current time as JD (UTC)
  const nowJD = dateToJD(new Date());

  // First future epoch
  const n0 = Math.ceil((nowJD - T0) / P);

  // Search for observable transits — collect up to maxResults
  const foundList = [];
  const skipped = [];

  for (let i = 0; i < nEpochs; i++) {
    const epoch = n0 + i;
    const midBJD = T0 + epoch * P; // BJD_TDB
    const midJdUtc = bjdTdbToJdUtc(midBJD, raH, decD);
    const ingressJD = midJdUtc - halfDurDays;
    const egressJD = midJdUtc + halfDurDays;
    const obsStartJD = ingressJD - baselineDays;
    const obsEndJD = egressJD + baselineDays;

    // Check observability during transit only (ingress to egress), not baseline
    const result = checkObservability(ingressJD, egressJD, observer, raH, decD, minAltDeg, sunLimitDeg);

    if (result.observable) {
      foundList.push({ epoch, midBJD, midTransitJD: midJdUtc, ingressJD, egressJD, obsStartJD, obsEndJD, ...result });
      if (foundList.length >= maxResults) break;
    } else {
      // Only track skipped before first found
      if (foundList.length === 0) {
        skipped.push({ epoch, midTransitJD: midJdUtc, result });
      }
    }
  }

  // Render results
  const resultDiv = document.getElementById("result");
  const tzName = formatTZName(tz);

  if (foundList.length === 0) {
    resultDiv.innerHTML = `<p class="error">No observable transit found in next ${nEpochs} epochs. Try increasing the epoch count.</p>`;
    return;
  }

  let html = `<h2 class="success">${foundList.length} Observable Transit(s) Found</h2>`;

  foundList.forEach((found, idx) => {
    // Compute alt/az/HA at key transit phases
    const phases = [
      { label: "Obs. Start", jd: found.obsStartJD },
      { label: "Ingress (T1)", jd: found.ingressJD },
      { label: "Mid-Transit", jd: found.midTransitJD },
      { label: "Egress (T4)", jd: found.egressJD },
      { label: "Obs. End", jd: found.obsEndJD },
    ];

    for (const ph of phases) {
      const d = jdToDate(ph.jd);
      const hor = targetHorizon(d, observer, raH, decD);
      const ha = hourAngle(d, observer, raH);
      const sunAlt = sunAltitude(d, observer);
      ph.date = d;
      ph.alt = hor.altitude;
      ph.az = hor.azimuth;
      ph.dir = azToDir(hor.azimuth);
      ph.ha = ha;
      ph.sunAlt = sunAlt;
    }

    // Moon info at mid-transit
    const midDate = jdToDate(found.midTransitJD);
    const moon = moonIllumination(midDate);
    const moonSep = moonSeparation(midDate, observer, raH, decD);
    const moonPh = moonPhaseName(moon.phaseAngle);

    html += `<h3>Transit #${idx + 1} — ${formatTime(midDate, tz)} ${tzName}</h3>`;
    html += `<div class="card">`;
    html += row("Mid-transit (BJD_TDB)", found.midBJD.toFixed(6));
    html += row("Mid-transit (UTC)", formatDate(midDate, "UTC") + " UTC");
    html += row(`Mid-transit (${tzName})`, formatDate(midDate, tz) + " " + tzName);
    html += row("Transit duration", `${transitDurH} hours`);
    html += row("Epoch number", found.epoch);

    // Moon info
    html += row("Moon phase", `${moonPh} (${(moon.illum * 100).toFixed(1)}% illuminated)`);
    html += row("Moon separation", `${moonSep.toFixed(1)}°`);

    // Phase table
    html += `<table class="phase-table"><tr><th>Phase</th><th>Time (${tzName})</th><th>Alt</th><th>Az</th><th>HA</th><th>Sun</th></tr>`;
    for (const ph of phases) {
      const cls = ph.label === "Mid-Transit" ? ' class="highlight"' : "";
      html += `<tr>`;
      html += `<td${cls}>${ph.label}</td>`;
      html += `<td${cls}>${formatTime(ph.date, tz)}</td>`;
      html += `<td${cls}>${ph.alt.toFixed(1)}°</td>`;
      html += `<td${cls}>${ph.az.toFixed(0)}° (${ph.dir})</td>`;
      html += `<td${cls}>${ph.ha.toFixed(2)}h</td>`;
      html += `<td>${ph.sunAlt.toFixed(1)}°</td>`;
      html += `</tr>`;
    }
    html += `</table>`;
    html += `</div>`;
  });

  if (skipped.length > 0) {
    html += `<details class="skipped"><summary>${skipped.length} earlier transit(s) skipped before first result — click to see why</summary>`;
    for (const s of skipped) {
      const d = jdToDate(s.midTransitJD);
      const dStr = formatTime(d, tz);
      const reason = diagnoseSkip(s.result);
      html += `<div class="skipped-item">Epoch ${s.epoch} | ${dStr} ${tzName} | ${reason}</div>`;
    }
    html += `</details>`;
  }

  resultDiv.innerHTML = html;
}

function row(label, value) {
  return `<div class="result-row"><span class="result-label">${label}</span><span class="result-value">${value}</span></div>`;
}
