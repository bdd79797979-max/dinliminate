#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";

const { values: v } = parseArgs({
  options: {
    base: { type: "string" },
    count: { type: "string", default: "200" },
    radius: { type: "string", default: "10" },
    lat: { type: "string", default: "36.5298" },
    lon: { type: "string", default: "-87.3595" },
    out: { type: "string", default: "artifacts/restaurant-photo-baseline" },
    concurrency: { type: "string", default: "2" },
    "allow-google": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: true,
});
if (v.help) {
  console.log("Usage: node scripts/benchmark-restaurant-photos.mjs --base URL [--count 200] [--radius 10] [--lat 36.5298] [--lon -87.3595] [--out DIR] [--allow-google]");
  process.exit(0);
}
if (!v.base?.trim()) {
  console.error("Missing required --base URL (no default is used).");
  process.exit(2);
}
const base = new URL(v.base).origin.replace(/\/+$/, "");
const count = Math.max(1, Math.min(500, Number(v.count) || 200));
const radius = Math.max(1, Math.min(100, Number(v.radius) || 10));
const lat = Number(v.lat), lon = Number(v.lon);
const concurrency = Math.max(1, Math.min(4, Number(v.concurrency) || 2));
const out = path.resolve(v.out), assets = path.join(out, "assets");
const timeout = 18000;
const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const norm = (x) => String(x || "").normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const webInfo = (r) => {
  const url = String(r.website || "").trim();
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  return { known: !!url, url, where: url ? ((r.websiteSource || "source unspecified") + " · " + host) : (r.websiteSource || "not supplied by search endpoint") };
};
async function fetchTimed(url, options = {}) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout), start = performance.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers: { "User-Agent": "Dinliminate-Restaurant-Photo-Benchmark/1.1", Accept: "application/json, image/avif, image/webp, image/jpeg, image/png;q=0.9, */*;q=0.1", ...(options.headers || {}) } });
    return { response, msToHeaders: performance.now() - start };
  } finally { clearTimeout(timer); }
}
function photoUrl(r) {
  const q = new URLSearchParams();
  for (const [k, x] of Object.entries({ name: r.name, address: r.address, phone: r.phone, website: r.website, officialWebsite: r.website, officialLocationPage: r.officialLocationPage, placeId: r.googlePlaceId || r.placeId, lat: r.lat, lon: r.lon, osmImage: r.photo, osmExact: String(r.source || "").startsWith("OpenStreetMap") && r.photo ? "1" : "" })) {
    if (x != null && String(x).trim()) q.set(k, String(x).trim());
  }
  return base + "/api/restaurant-photo?" + q;
}
async function measure(r, i, prefetched = null) {
  const start = performance.now(), web = webInfo(r);
  try {
    const { response, msToHeaders } = prefetched || await fetchTimed(photoUrl(r));
    const type = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!response.ok || !type.startsWith("image/")) {
      const raw = (await response.text()).slice(0, 350);
      let body = raw;
      try { const j = JSON.parse(raw); body = j.error || j.message || raw; } catch {}
      return { ...r, web, status: "miss", sourceWon: "", sourcePageUrl: "", type: "", width: 0, height: 0, bytes: 0, photoMs: Math.round(performance.now() - start), msToHeaders: Math.round(msToHeaders), missReason: "HTTP " + response.status + ": " + (body || "non-image response"), asset: "", thumbnail: "" };
    }
    const source = response.headers.get("X-Restaurant-Photo-Source") || "";
    const sourcePageUrl = response.headers.get("X-Restaurant-Photo-Source-URL") || "";
    const buf = Buffer.from(await response.arrayBuffer());
    let meta = { width: 0, height: 0 };
    try { meta = await sharp(buf).metadata(); } catch {}
    const common = { ...r, web, sourceWon: source, sourcePageUrl, type, width: meta.width || 0, height: meta.height || 0, bytes: buf.length, photoMs: Math.round(performance.now() - start), msToHeaders: Math.round(msToHeaders), missReason: "", asset: "", thumbnail: "" };
    if (!source) return { ...common, status: "unverifiable", missReason: "Image returned without X-Restaurant-Photo-Source; bytes not saved" };
    if (source.toLowerCase() === "google-places") return { ...common, status: "google-not-embedded", missReason: "Google image intentionally not copied to report" };
    const ext = type.includes("webp") ? ".webp" : type.includes("png") ? ".png" : type.includes("gif") ? ".gif" : type.includes("avif") ? ".avif" : ".jpg";
    const stem = String(i + 1).padStart(3, "0") + "-" + norm(r.name).replace(/\s/g, "-").slice(0, 42);
    const file = stem + ext, thumb = stem + "-thumb.jpg";
    await fs.writeFile(path.join(assets, file), buf);
    await sharp(buf).resize({ width: 120, height: 120, fit: "inside" }).jpeg({ quality: 72 }).toFile(path.join(assets, thumb));
    return { ...common, status: "success", asset: "assets/" + file, thumbnail: "assets/" + thumb };
  } catch (e) {
    return { ...r, web, status: "error", sourceWon: "", sourcePageUrl: "", type: "", width: 0, height: 0, bytes: 0, photoMs: Math.round(performance.now() - start), msToHeaders: 0, missReason: String(e.message || e).slice(0, 240), asset: "", thumbnail: "" };
  }
}
const cell = (x) => { const s = String(x ?? ""); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function percentile(a, p) { if (!a.length) return null; return a[Math.min(a.length - 1, Math.ceil(a.length * p) - 1)]; }
function stats(rows, notes, searchMs) {
  const sources = {}, misses = {};
  for (const r of rows) { const s = r.sourceWon || "(none)"; sources[s] = (sources[s] || 0) + 1; if (r.status !== "success") { const m = r.missReason || r.status; misses[m] = (misses[m] || 0) + 1; } }
  const known = rows.filter((r) => r.web?.known).length, ok = rows.filter((r) => r.status === "success").length;
  const times = rows.map((r) => r.photoMs).filter((x) => x > 0).sort((a, b) => a - b);
  return { generated: new Date().toISOString(), base, search: { lat, lon, radiusMiles: radius, ms: Math.round(searchMs) }, requested: count, sampled: rows.length, tested: rows.filter((r) => r.photoMs > 0).length, websiteKnown: known, websiteKnownPct: rows.length ? +(100 * known / rows.length).toFixed(1) : 0, photoSuccess: ok, photoSuccessPct: rows.length ? +(100 * ok / rows.length).toFixed(1) : 0, photoMs: { p50: percentile(times, .5), p90: percentile(times, .9), max: times.at(-1) || null }, sources, misses, notes };
}
function sheet(rows, s) {
  const cards = rows.map((r, i) => {
    const link = (url, label) => { try { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label || new URL(url).hostname) + "</a>" : "none"; } catch { return "none"; } };
    const main = r.asset ? '<img class="card-photo" src="' + esc(r.asset) + '" alt="' + esc(r.name) + '">' : '<div class="none">' + esc(r.missReason || r.status) + "</div>";
    const thumb = r.thumbnail ? '<img class="thumb" src="' + esc(r.thumbnail) + '" alt="Full image thumbnail">' : "";
    return '<article data-key="' + esc(r.name + "|" + r.address) + '"><div class="phone-frame">' + main + '</div><div class="meta"><b>' + (i + 1) + ". " + esc(r.name) + '</b><p>' + esc(r.address || "Address unavailable") + '</p><p><strong>Website:</strong> ' + (r.web?.known ? link(r.web.url, r.web.where) : "No · " + esc(r.web?.where)) + '</p><p><strong>Winner:</strong> ' + esc(r.sourceWon || "none") + '</p><p><strong>Image:</strong> ' + (r.width || "?") + " × " + (r.height || "?") + " · " + (r.bytes ? Math.round(r.bytes / 1024) + " KB" : "none") + '</p><p><strong>Time:</strong> ' + (r.photoMs || "not measured") + ' ms · <strong>Source page:</strong> ' + link(r.sourcePageUrl) + '</p><div class="thumbrow">' + thumb + '<span>Full image thumbnail</span></div><div class="votes"><button data-vote="Correct">Correct</button><button data-vote="Wrong">Wrong</button><button data-vote="Unsure">Unsure</button><span class="vote-status">Unreviewed</span></div></div></article>';
  }).join("");
  const table = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => "<tr><td>" + esc(k) + "</td><td>" + n + "</td></tr>").join("") || "<tr><td>none</td><td>0</td></tr>";
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dinliminate photo baseline</title><style>body{margin:0;padding:20px;background:#101010;color:#f5f1e8;font:14px/1.45 system-ui}h1,h2{line-height:1.15}.muted{color:#aaa}.stats,.toolbar{display:flex;gap:10px;flex-wrap:wrap}.stat,article{border:1px solid #514a3d;border-radius:12px;overflow:hidden;background:#1b1a18}.stat{padding:12px}.stat strong{display:block;font-size:1.5rem;color:#d6b16c}.tables{display:flex;gap:26px;flex-wrap:wrap}table{border-collapse:collapse}td,th{padding:6px 10px;border-bottom:1px solid #444;text-align:left}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}.phone-frame{width:min(100%,390px);height:620px;margin:auto;background:#090909;display:flex;align-items:center;justify-content:center}.card-photo{width:100%;height:100%;object-fit:cover}.none{padding:14px;text-align:center;color:#e0bb7d;overflow-wrap:anywhere}.meta{padding:12px}.meta p{margin:5px 0;font-size:12px;overflow-wrap:anywhere}.meta a{color:#e2bf7a}.thumbrow{display:flex;align-items:center;gap:8px;margin:8px 0}.thumb{width:60px;height:60px;object-fit:contain;background:#090909;border:1px solid #555}.votes{display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:10px}.votes button,.toolbar button{background:#24221e;color:#f5f1e8;border:1px solid #b99b61;border-radius:7px;padding:7px 10px;cursor:pointer}.votes button[aria-pressed=true]{background:#b99b61;color:#111}.vote-status{font-size:12px;color:#d6b16c}</style></head><body><h1>Dinliminate restaurant photo baseline</h1><p class="muted">' + esc(s.generated) + " · " + esc(base) + " · " + lat + ", " + lon + " / " + radius + " mi</p><div class=\"stats\">" + [["sampled", s.sampled + "/" + s.requested], ["website known", s.websiteKnown + " (" + s.websiteKnownPct + "%)"], ["photos found", s.photoSuccess + " (" + s.photoSuccessPct + "%)"], ["p50", s.photoMs.p50 ?? "—"], ["p90", s.photoMs.p90 ?? "—"]].map(([k, n]) => '<div class="stat"><strong>' + n + "</strong>" + k + "</div>").join("") + '</div><div class="toolbar"><button id="export">Export reviews JSON</button><button id="clear">Clear saved reviews</button><span id="saved-count"></span></div>' + (s.notes.length ? '<div class="stat"><b>Notes</b><ul>' + s.notes.map((n) => "<li>" + esc(n) + "</li>").join("") + "</ul></div>" : "") + '<div class="tables"><div><h2>Winning source</h2><table><tr><th>Source</th><th>Count</th></tr>' + table(s.sources) + '</table></div><div><h2>Miss reason</h2><table><tr><th>Reason</th><th>Count</th></tr>' + table(s.misses) + '</table></div></div><h2>Contact sheet</h2><div class="grid">' + cards + '</div><script>const key="dinliminate-photo-review-v1";let reviews={};try{reviews=JSON.parse(localStorage.getItem(key)||"{}")}catch{}const cards=[...document.querySelectorAll("article[data-key]")];function paint(){for(const c of cards){const v=reviews[c.dataset.key];c.querySelectorAll("[data-vote]").forEach(b=>b.setAttribute("aria-pressed",String(!!v&&v.vote===b.dataset.vote)));c.querySelector(".vote-status").textContent=v?v.vote+" · saved":"Unreviewed"}document.querySelector("#saved-count").textContent=Object.keys(reviews).length+" saved reviews"}function save(){localStorage.setItem(key,JSON.stringify(reviews));paint()}cards.forEach(c=>c.querySelectorAll("[data-vote]").forEach(b=>b.addEventListener("click",()=>{reviews[c.dataset.key]={restaurant:c.querySelector("b").textContent.replace(/^\\d+\\. /,""),address:c.querySelector(".meta p").textContent,vote:b.dataset.vote,reviewedAt:new Date().toISOString()};save()})));document.querySelector("#export").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),reviews},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="restaurant-photo-reviews.json";a.click();URL.revokeObjectURL(a.href)});document.querySelector("#clear").addEventListener("click",()=>{if(confirm("Clear all saved photo reviews?")){reviews={};save()}});paint();</script></body></html>';
}
async function report(rows, s) {
  await fs.mkdir(assets, { recursive: true });
  await fs.writeFile(path.join(out, "results.json"), JSON.stringify({ summary: s, rows }, null, 2));
  const cols = ["name", "address", "websiteKnown", "websiteWhere", "website", "sourceWon", "sourcePageUrl", "type", "width", "height", "bytes", "photoMs", "status", "missReason", "source"];
  await fs.writeFile(path.join(out, "results.csv"), [cols.join(","), ...rows.map((r) => { const o = { ...r, websiteKnown: r.web?.known ? "yes" : "no", websiteWhere: r.web?.where }; return cols.map((k) => cell(o[k])).join(","); })].join("\n"));
  await fs.writeFile(path.join(out, "contact-sheet.html"), sheet(rows, s));
  await fs.writeFile(path.join(out, "summary.md"), ["# Restaurant photo baseline", "", "- Target: " + base, "- Search: " + lat + ", " + lon + "; " + radius + " miles", "- Sample: " + s.sampled + "/" + s.requested, "- Website known: " + s.websiteKnown + " (" + s.websiteKnownPct + "%)", "- Photos found: " + s.photoSuccess + " (" + s.photoSuccessPct + "%)", "- Time p50/p90/max: " + [s.photoMs.p50, s.photoMs.p90, s.photoMs.max].map((x) => x ?? "n/a").join(" / ") + " ms", "", "## Winning source", "", "| Source | Count |", "|---|---:|", ...Object.entries(s.sources).map(([k, n]) => "| " + k + " | " + n + " |"), "", "## Miss reasons", "", "| Reason | Count |", ...Object.entries(s.misses).map(([k, n]) => "| " + k.replace(/\|/g, "\\|") + " | " + n + " |"), "", "## Notes", "", ...(s.notes.length ? s.notes.map((n) => "- " + n) : ["- None"]), "", "See contact-sheet.html, results.csv, results.json.", ""].join("\n"));
}
async function main() {
  await fs.mkdir(assets, { recursive: true });
  const notes = [];
  const u = new URL("/api/restaurants", base);
  u.search = new URLSearchParams({ mode: "search", lat: String(lat), lon: String(lon), radius: String(radius) }).toString();
  const t = performance.now();
  let payload;
  try {
    const { response } = await fetchTimed(u);
    if (!response.ok) throw Error("Search API HTTP " + response.status + ": " + (await response.text()).slice(0, 250));
    payload = await response.json();
  } catch (e) {
    notes.push("Search failed: " + e.message);
    const s = stats([], notes, performance.now() - t); await report([], s); console.log(JSON.stringify(s, null, 2)); process.exitCode = 1; return;
  }
  const searchMs = performance.now() - t;
  if (!Array.isArray(payload.results)) {
    notes.push("Search response has no results array.");
    const s = stats([], notes, searchMs); await report([], s); console.log(JSON.stringify(s, null, 2)); process.exitCode = 1; return;
  }
  const unique = [], seen = new Set();
  for (const r of payload.results) { const k = norm(r.name) + "|" + norm(r.address); if (!r.name || seen.has(k)) continue; seen.add(k); unique.push(r); if (unique.length >= count) break; }
  if (!unique.length) notes.push("Search returned no unique restaurants.");
  const probe = unique[0];
  if (!probe) { const s = stats([], notes, searchMs); await report([], s); console.log(JSON.stringify(s, null, 2)); process.exitCode = 1; return; }
  const probeUrl = photoUrl(probe);
  const probeResult = await fetchTimed(probeUrl);
  const probeResponse = probeResult.response;
  const googleHeader = String(probeResponse.headers.get("X-Restaurant-Photo-Google") || "").toLowerCase();
  if (googleHeader !== "disabled" && !v["allow-google"]) {
    notes.push("Stopped before sampling: probe did not return X-Restaurant-Photo-Google: disabled (got " + (googleHeader || "missing") + "). Use --allow-google only if Google photo calls are explicitly approved.");
    const s = stats([], notes, searchMs); s.googleHeader = googleHeader || null; await report([], s); console.log(JSON.stringify(s, null, 2)); process.exitCode = 2; return;
  }
  const probeType = (probeResponse.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (probeResponse.status !== 404 && (!probeResponse.ok || !probeType.startsWith("image/"))) {
    const raw = (await probeResponse.text()).slice(0, 250);
    notes.push("Photo endpoint probe failed (" + probeResponse.status + "): " + raw);
    const s = stats([], notes, searchMs); s.probeStatus = probeResponse.status; await report([], s); console.log(JSON.stringify(s, null, 2)); process.exitCode = 1; return;
  }
  if (probeResponse.status === 404) notes.push("Probe restaurant had no verified photo (HTTP 404); recorded as a normal sample miss.");
  // The probe is also sample 1, avoiding a duplicate source-discovery request.
  const rows = new Array(unique.length);
  rows[0] = await measure(unique[0], 0, probeResult);
  let next = 1;
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(0, unique.length - 1)) }, async () => {
    while (true) { const i = next++; if (i >= unique.length) return; rows[i] = await measure(unique[i], i); }
  }));
  const s = stats(rows, notes, searchMs);
  s.googleHeader = googleHeader;
  s.searchReturned = payload.results.length;
  await report(rows, s);
  console.log(JSON.stringify(s, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
