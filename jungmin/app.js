// Password check: salted PBKDF2 (slow on purpose), so the password can't be looked up from this file.
const PW_SALT = "866fb06c7016bbb9844e06496b97ac3e";
const PW_HASH = "828df37eccea570d467e81ba2b6863d1af24ee4eaaa6b8b83a59599efd27a7fa";
const PW_ITER = 200000;
const SIGNIN_DAYS = 30;          // ask for the password again after this many days
const MAX_TRIES = 5;             // wrong passwords before a pause
const LOCK_SECONDS = 60;

// Limits that keep her phone responsive and stop oversized or hostile files.
const MAX_PER_UPLOAD = 10;
const MAX_TOTAL = 60;
const MAX_MB = 10;               // real reports are about 50 KB
const MAX_PAGES = 40;            // real reports are 2–9 pages
const READ_TIMEOUT_MS = 20000;

// pdf.js is served from this site (vendor/), not a CDN, so nothing outside the repo runs.
pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";

/* ---------- Report definitions ---------- */

// Volante "Sales Report Summary" lunch items.
const ITEMS = [
  ["KoreanLunch", "Korean Lunch", "한식 점심"],
  ["KoreanMainDish", "Korean Main Dish", "한식 메인"],
  ["InternationalLunch", "International Lunch", "인터내셔널 점심"],
  ["InternationalMainDish", "International Main Dish", "인터내셔널 메인"],
  ["VegetarianLunch", "Vegetarian Lunch", "채식 점심"],
  ["BoxedLunch", "Boxed Lunch", "도시락"],
];
const LABEL = Object.fromEntries(ITEMS.map(([k, en, ko]) => [k, { en, ko }]));
// Night report (1:01 PM – 11:00 PM): every item on its own line.
const EVENING_ROWS = ITEMS.map(([k, en, ko]) => ({ keys: [k], en, ko }));
// Morning report (11:00 PM – 1:00 PM next day): Korean and International combined.
const MORNING_ROWS = [
  { keys: ["KoreanLunch", "KoreanMainDish"], en: "Korean", ko: "한식" },
  { keys: ["InternationalLunch", "InternationalMainDish"], en: "International", ko: "인터내셔널" },
  { keys: ["VegetarianLunch"], en: "Vegetarian", ko: "채식" },
  { keys: ["BoxedLunch"], en: "Boxed", ko: "도시락" },
];

// Orbit "Close Day Report": label + amount rows. Each label is read from its first
// appearance, which is the whole-store summary (later pages repeat it per register).
const ORBIT = [
  { sect: ["Register", "레지스터"], rows: [
    ["zCounter", "Z Counter", "Z 카운터", "ZCounter", "int"],
    ["current", "Current Reading", "현재 판독값", "CurrentReading(ZTotal)", "money"],
    ["previous", "Previous Reading", "이전 판독값", "PreviousReading", "money"],
    ["txCount", "Transaction Count", "거래 건수", "TransactionCount", "int"],
  ] },
  { sect: ["Sales", "매출"], rows: [
    ["netSales", "Net Sales", "순매출", "NetSales", "money"],
    ["voids", "Cashier Voids + Removes", "캐셔 취소 + 삭제", "CashierVoids+Removes", "money"],
  ] },
  { sect: ["Payments", "결제 수단"], rows: [
    ["cash", "Cash", "현금", "Cash", "money"],
    ["amex", "Amex", "아멕스", "AMEX", "money"],
    ["visa", "VISA", "비자", "VISA", "money"],
    ["debit", "Debit", "직불카드", "Debit", "money"],
    ["master", "Mastercard", "마스터카드", "MASTER", "money"],
    ["zipthru", "Zipthru Redemption", "Zipthru 사용", "ZipthruRedemption", "money"],
  ] },
  { sect: ["Taxes (net)", "세금 (순)"], rows: [
    ["gst", "GST", "GST", "GST", "money"],
    ["hstC", "HST 8% C (ON)", "HST 8% C (ON)", "HST8%C(ON)", "money"],
    ["hstF", "HST 8% F (ON)", "HST 8% F (ON)", "HST8%F(ON)", "money"],
  ] },
];

/* ---------- Small helpers ---------- */

const $ = id => document.getElementById(id);
const T = (en, ko) => `<span class="en">${en}</span><span class="ko">${ko}</span>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = n => "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHEV = { up: "M6 15l6-6 6 6", down: "M6 9l6 6 6-6", left: "M15 6l-6 6 6 6", right: "M9 6l6 6-6 6" };
// Rounded chevron in a soft circle (used instead of text arrows).
const chev = dir => `<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="${CHEV[dir]}"/></svg></span>`;
// Report-type icons (drawn, so they look the same on every phone).
const ICON_PATHS = {
  morning: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  evening: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  orbit:   '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  error:   '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  file:    '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/>',
};
const icon = kind => `<span class="ic ${kind}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[kind]}</svg></span>`;

// Bare chevron for use inside button text.
const ichev = dir => `<svg class="ichev" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${CHEV[dir]}"/></svg>`;
const say = (en, ko) => { $("status").textContent = document.documentElement.dataset.lang === "ko" ? ko : en; };

// Language: remembered on this device; first visit follows the phone's language.
function setLang(l) {
  document.documentElement.dataset.lang = l;
  document.documentElement.lang = l;
  document.querySelectorAll(".lang button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === l));
  try { localStorage.setItem("jm-lang", l); } catch (e) {}
}
setLang(document.documentElement.dataset.lang);
document.querySelectorAll(".lang button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));

/* ---------- Reading PDFs ---------- */

// Rebuild table rows from positioned text items.
async function readRows(buf) {
  // isEvalSupported:false closes the font-handling hole in this pdf.js version (CVE-2024-4367).
  const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
  try {
    if (pdf.numPages > MAX_PAGES) throw new Error("pages");
    const rows = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const { items } = await (await pdf.getPage(p)).getTextContent();
      const lines = [];
      for (const it of items) {
        if (!it.str.trim()) continue;
        const y = it.transform[5], x = it.transform[4];
        let line = lines.find(l => Math.abs(l.y - y) < 3);
        if (!line) lines.push(line = { y, parts: [] });
        line.parts.push({ x, s: it.str });
      }
      lines.sort((a, b) => b.y - a.y);
      for (const l of lines) rows.push(l.parts.sort((a, b) => a.x - b.x).map(t => t.s).join(" "));
    }
    return rows;
  } finally {
    pdf.destroy();
  }
}

function extract(rows) {
  const out = {};
  let range = "";
  for (const row of rows) {
    const compact = row.replace(/\s+/g, "");
    if (!range && /(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*\d{4}/.test(compact)) range = compact.replace(/,/g, ", ").replace(/([A-Za-z]{3})(\d)/g, "$1 $2").replace(/(\d)(AM|PM)/g, "$1 $2").replace(/-{2,}/, " – ");
    for (const [key] of ITEMS) {
      if (!new RegExp(key + "(?=[\\d-])", "i").test(compact)) continue;
      const nums = row.match(/-?\d[\d,]*\.\d{2}/g) || [];
      if (nums.length >= 2) out[key] = (out[key] || 0) + parseFloat(nums[nums.length - 2].replace(/,/g, ""));
    }
  }
  // Start time decides the shift: 11 PM start (or 1:00 PM end) = morning report.
  const times = range.replace(/\s+/g, "").match(/\d{1,2}:\d{2}(AM|PM)/gi) || [];
  const morning = /^11:\d{2}PM$/i.test(times[0] || "") || /^1:00PM$/i.test(times[1] || "");
  return { out, range, morning };
}

function extractOrbit(rows) {
  const out = {};
  const want = new Map(ORBIT.flatMap(g => g.rows).map(r => [r[3].toLowerCase(), r[0]]));
  for (const row of rows) {
    const tokens = row.trim().split(/\s+/);
    const nums = [];
    while (tokens.length > 1 && /^-?[\d,]*\.?\d+$/.test(tokens[tokens.length - 1])) nums.unshift(tokens.pop());
    if (!nums.length) continue;
    const key = want.get(tokens.join("").toLowerCase());
    // Summary lines have one amount; GST/HST lines are "count amount". Take the last number.
    if (key && !(key in out)) out[key] = parseFloat(nums[nums.length - 1].replace(/,/g, ""));
  }
  return out;
}

const MONTHS = "JanFebMarAprMayJunJulAugSepOctNovDec";
// "Tue, Sep 29, 2026, 1:01 PM" -> sortable number and a short "Tue, Sep 29" label.
function when(range) {
  const m = range.match(/([A-Za-z]{3}),\s*([A-Za-z]{3})\s*(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return { sort: Infinity, label: "", labelKo: "" };
  const h = (+m[5] % 12) + (/pm/i.test(m[7]) ? 12 : 0);
  return { sort: new Date(+m[4], MONTHS.indexOf(m[2]) / 3, +m[3], h, +m[6]).getTime(), day: new Date(+m[4], MONTHS.indexOf(m[2]) / 3, +m[3]).getTime(), label: `${m[1]}, ${m[2]} ${m[3]}`,
    labelKo: `${MONTHS.indexOf(m[2]) / 3 + 1}월 ${+m[3]}일 (${"일월화수목금토"["SunMonTueWedThuFriSat".indexOf(m[1]) / 3]})` };
}

async function parse(file) {
  const base = { name: file.name, key: [file.name, file.size, file.lastModified].join("|") };
  try {
    if (file.size > MAX_MB * 1024 * 1024) throw new Error("size");
    const buf = await file.arrayBuffer();
    // A real PDF starts with "%PDF-" — renamed photos or documents are turned away before reading.
    if (new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(1024, buf.byteLength))).indexOf("%PDF-") === -1) throw new Error("type");
    const rows = await Promise.race([readRows(buf), new Promise((_, no) => setTimeout(() => no(new Error("slow")), READ_TIMEOUT_MS))]);
    const r = extract(rows);
    if (rows.some(x => /CloseDayReport/i.test(x.replace(/\s+/g, "")))) {
      const orbit = extractOrbit(rows);
      if (!Object.keys(orbit).length) throw new Error("none");
      // The business day is the day the report ends (11 PM the night before → 10:59 PM).
      const end = when(r.range.split(/\s[–-]\s/).pop());
      return { ...base, type: "orbit", range: r.range, orbit, sort: when(r.range).sort, label: end.label, labelKo: end.labelKo, day: end.day };
    }
    if (!Object.keys(r.out).length) throw new Error("none");
    // A morning report (11 PM → 1 PM) belongs to the day it ends; a night report starts and ends the same day.
    const day = r.morning ? when(r.range.split(/\s[–-]\s/).pop()) : when(r.range);
    return { ...base, type: r.morning ? "morning" : "night", ...r, sort: when(r.range).sort, label: day.label, labelKo: day.labelKo, day: day.day };
  } catch (e) {
    return { ...base, type: "error", why: WHY[e.message] ? e.message : "none", sort: Infinity };
  }
}

/* ---------- What each report looks like ---------- */

const KIND = {
  morning: { cls: "morning", name: T("Morning report", "오전 보고서"), hours: "11:00 PM – 1:00 PM" },
  night:   { cls: "evening", name: T("Night report", "야간 보고서"), hours: "1:01 PM – 11:00 PM" },
  orbit:   { cls: "orbit",   name: T("Orbit close-day report", "Orbit 마감 보고서"), short: T("Orbit report", "Orbit 보고서"), hours: "11:00 PM – 10:59 PM" },
  error:   { cls: "error",   name: T("Could not read this file", "이 파일을 읽을 수 없음") },
};
// Why a file could not be opened, in plain words.
const WHY = {
  size:  T(`This file is too big (over ${MAX_MB} MB). Sales reports are much smaller.`, `파일이 너무 큽니다 (${MAX_MB}MB 초과). 매출 보고서는 훨씬 작습니다.`),
  type:  T("This is not a PDF file.", "PDF 파일이 아닙니다."),
  pages: T(`This PDF has too many pages (over ${MAX_PAGES}). It is not a sales report.`, `PDF 쪽수가 너무 많습니다 (${MAX_PAGES}쪽 초과). 매출 보고서가 아닙니다.`),
  slow:  T("This file took too long to read.", "파일을 읽는 데 너무 오래 걸렸습니다."),
  none:  T("No report numbers were found. Please make sure it is a sales report or Orbit report PDF.", "보고서 숫자를 찾지 못했습니다. 매출 보고서 또는 Orbit 보고서 PDF인지 확인해 주세요."),
};
// Short reasons for the list.
const WHY_SHORT = {
  size: T("Too big", "너무 큼"), type: T("Not a PDF", "PDF 아님"), pages: T("Too many pages", "쪽수 너무 많음"),
  slow: T("Took too long", "너무 오래 걸림"), none: T("No report numbers found", "보고서 숫자 없음"),
};
// "Today" / "Yesterday" for recent reports, so the newest ones are easy to spot.
function relDay(r) {
  if (!r.day) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = Math.round((today - r.day) / 864e5);
  return d === 0 ? T("Today", "오늘") : d === 1 ? T("Yesterday", "어제") : "";
}
const dateOf = r => r.label ? T(esc(r.label), esc(r.labelKo)) : esc(r.name);

function lunchRows(r) {
  return `<div class="rows">` + (r.type === "morning" ? MORNING_ROWS : EVENING_ROWS).map(row => {
    const n = row.keys.reduce((t, k) => t + (r.out[k] || 0), 0);
    const parts = row.keys.length > 1 ? `<span class="parts">${row.keys.map(k => `${T(LABEL[k].en, LABEL[k].ko)} ${r.out[k] || 0}`).join(" + ")}</span>` : "";
    return `<div class="row"><div class="name">${T(row.en, row.ko)}${parts}</div><div class="num${n ? "" : " zero"}">${n}</div></div>`;
  }).join("") + `</div><div class="note">${T("Numbers are net quantity sold.", "순 판매 수량입니다.")}</div>`;
}

function orbitRows(r) {
  return ORBIT.map(g => `<div class="sect">${T(g.sect[0], g.sect[1])}</div><div class="rows" style="margin-top:0">` +
    g.rows.map(([k, en, ko, , kind]) => {
      const v = r.orbit[k];
      const txt = v == null ? T("Not found", "없음") : kind === "money" ? money(v) : v.toLocaleString("en-CA");
      return `<div class="row money${String(txt).length > 11 ? " stack" : ""}${v == null ? " missing" : ""}"><div class="name">${T(en, ko)}</div><div class="num">${txt}</div></div>`;
    }).join("") + `</div>`).join("");
}

function reportHTML(r, i, total) {
  const k = KIND[r.type];
  if (r.type === "error") return `<div class="card"><div class="hero" style="border-bottom:0;padding-bottom:0">${icon("error")}<div class="when" style="font-size:22px">${esc(r.name)}</div></div>
    <div class="msg err" role="alert">${WHY[r.why]}</div></div>`;
  return `<div class="card"><div class="hero ${k.cls}">${icon(k.cls)}<div><div class="when">${dateOf(r)}</div>` +
    `<span class="badge ${k.cls}">${k.name}</span>${relDay(r) ? ` <span class="badge rel">${relDay(r)}</span>` : ""}<span class="hours">${k.hours}</span></div></div>` +
    (r.type === "orbit" ? orbitRows(r) : lunchRows(r)) +
    `<div class="src">📄 ${esc(r.name)}${r.range ? `<br>${esc(r.range)}` : ""}</div></div>`;
}

/* ---------- Greeting ---------- */

const NAME_EN = "Jungmin", NAME_KO = "정민";
function greet() {
  const h = new Date().getHours();
  const [en, ko] = h < 12 ? ["Good morning", "좋은 아침이에요"] : h < 18 ? ["Good afternoon", "좋은 오후예요"] : ["Good evening", "좋은 저녁이에요"];
  $("hello").innerHTML = T(`${en}, ${NAME_EN}`, `${NAME_KO}님, ${ko}`);
  const now = new Date();
  $("today").innerHTML = T(now.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" }),
                           now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" }));
}

/* ---------- Screens and the phone's back button ---------- */

let reports = [];
let state = {};
const SCREENS = ["gate", "pick", "loading", "list", "detail"];

function render(st) {
  // Without the password, only the demo's sample reports can be viewed.
  if (!signedIn && (st.v === "pick" || reports.some(r => !r.demo))) { reports = reports.filter(r => r.demo); if (st.v === "pick" || !reports.length) st = { v: "gate" }; }
  if (["list", "detail"].includes(st.v) && !reports.length) st = { v: signedIn ? "pick" : "gate" };
  if (st.v === "list" && reports.length === 1 && $("dupNote").hidden) st = { v: "detail", i: 0 };
  if (st.v === "detail" && !reports[st.i]) st = { v: "list" };
  // Reports are only thrown away by "Start over", never by pressing back once too often.
  if (st.v === "pick") {
    $("resumeBtn").hidden = !reports.length;
    $("resumeBtn").innerHTML = `${T(`Back to my ${reports.length} reports`, `내 보고서 ${reports.length}개로 돌아가기`)}`;
  }
  state = st;
  SCREENS.forEach(s => $(s).hidden = s !== st.v);
  const demo = reports.some(r => r.demo);
  document.querySelectorAll("[data-demobanner]").forEach(b => b.hidden = !demo);
  // In the demo, "Exit demo" replaces "Start over"; without the password there is nothing to add.
  document.querySelector("#list [data-clear]").hidden = demo;
  document.querySelector("#list .dock").hidden = !signedIn;
  $("gateDemo").hidden = st.v !== "gate";
  if (st.v === "pick") greet();
  if (st.v === "list") renderList();
  if (st.v === "detail") renderDetail(st);
  window.scrollTo(0, 0);
}
function go(st, push) {
  push ? history.pushState(st, "") : history.replaceState(st, "");
  render(st);
}
window.addEventListener("popstate", e => render(e.state || { v: signedIn ? "pick" : "gate" }));

function renderList() {
  const n = reports.length;
  $("listTitle").innerHTML = T(`Your ${n} report${n === 1 ? "" : "s"}`, `${NAME_KO}님의 보고서 ${n}개`);
  $("listItems").innerHTML = reports.map((r, i) => {
    const k = KIND[r.type];
    return `<button type="button" class="listbtn ${r.type === "error" ? "bad" : k.cls}" data-open="${i}">
      ${icon(k.cls)}
      <span>${r.type === "error" ? esc(r.name) : dateOf(r)}${r.type === "error" ? `<span class="sub err">${WHY_SHORT[r.why]}</span>` : `<br><span class="badge ${k.cls}">${k.short || k.name}</span>${relDay(r) ? ` <span class="badge rel">${relDay(r)}</span>` : ""}`}</span>
      ${chev("right")}</button>`;
  }).join("");
}

function renderDetail(st) {
  const n = reports.length, i = st.i;
  $("detailCard").innerHTML = reportHTML(reports[i], i, n);
  $("backBtn").parentNode.hidden = n < 2;
  $("pos").innerHTML = n > 1 ? T(`${i + 1} of ${n}`, `${i + 1} / ${n}`) : "";
  $("backBtn").innerHTML = `${chev("left")}${T(`All reports (${n})`, `전체 보고서 (${n})`)}`;
  $("detailClear").hidden = n > 1 || reports.some(r => r.demo);
  const short = r => r ? (r.type === "error" ? esc(r.name) : dateOf(r)) : "&nbsp;";
  const prev = i === 0
    ? `<button type="button" class="btn secondary" disabled><span>${ichev("left")}${T("Previous", "이전")}</span><small>${T("This is the first", "첫 보고서입니다")}</small></button>`
    : `<button type="button" class="btn secondary" data-step="-1"><span>${ichev("left")}${T("Previous", "이전")}</span><small>${short(reports[i - 1])}</small></button>`;
  // On the last report, the right-hand button leads somewhere useful instead of going dead.
  const next = i === n - 1
    ? `<button type="button" class="btn" data-tolist><span>${T("All done", "다 봤어요")}</span><small>${T(`Back to all ${n}`, `전체 ${n}개로`)}</small></button>`
    : `<button type="button" class="btn secondary" data-step="1"><span>${T("Next", "다음")}${ichev("right")}</span><small>${short(reports[i + 1])}</small></button>`;
  $("detailDock").innerHTML = n > 1
    ? `<div class="navrow">${prev}${next}</div>`
    : `<button type="button" class="btn" data-add><span class="plus" aria-hidden="true">+</span> ${T("Add more reports", "보고서 더 추가")}</button>`;
}

/* ---------- Adding files ---------- */

function showNotes(notes) {
  $("dupNote").hidden = !notes.length;
  $("dupNote").innerHTML = notes.join("<br><br>");
}

async function addFiles(files, demo) {
  files = files.filter(Boolean);
  if (!files.length) return;
  const from = state;
  const notes = [];
  const chosen = files.length;
  const room = MAX_TOTAL - reports.length;
  if (room <= 0) {
    showNotes([T(`The list is full (${MAX_TOTAL} reports). Press “Start over” to open new ones.`, `목록이 가득 찼습니다 (보고서 ${MAX_TOTAL}개). 새로 열려면 “처음부터 다시”를 누르세요.`)]);
    return go({ v: "list" }, from.v !== "list");
  }
  files = files.slice(0, Math.min(MAX_PER_UPLOAD, room));
  if (chosen > files.length) notes.push(files.length === MAX_PER_UPLOAD
    ? T(`You chose ${chosen} files. Up to ${MAX_PER_UPLOAD} open at a time, so the first ${MAX_PER_UPLOAD} are open. Press “Add more reports” for the rest.`,
        `파일 ${chosen}개를 고르셨습니다. 한 번에 ${MAX_PER_UPLOAD}개까지 열 수 있어 처음 ${MAX_PER_UPLOAD}개를 열었습니다. 나머지는 “보고서 더 추가”를 누르세요.`)
    : T(`The list can hold ${MAX_TOTAL} reports, so only ${files.length} more were opened.`, `목록에는 보고서 ${MAX_TOTAL}개까지 담을 수 있어 ${files.length}개만 더 열었습니다.`));
  const known = new Set(reports.map(r => r.key));
  const fresh = files.filter(f => !known.has([f.name, f.size, f.lastModified].join("|")));
  SCREENS.forEach(s => $(s).hidden = s !== "loading");
  window.scrollTo(0, 0);
  // The same report downloaded twice ("Monday (1).pdf") is recognised by its contents and skipped.
  const sig = r => r.type === "error" ? r.key : r.type + "|" + r.range;
  const have = new Set(reports.map(sig));
  let dups = files.length - fresh.length;
  // One file at a time keeps older phones responsive and lets us show progress.
  for (let i = 0; i < fresh.length; i++) {
    $("loadText").innerHTML = T(fresh.length > 1 ? `Reading your reports… ${i + 1} of ${fresh.length}` : "Reading your report…",
                                fresh.length > 1 ? `보고서를 읽고 있어요… ${i + 1} / ${fresh.length}` : "보고서를 읽고 있어요…");
    $("loadBar").style.width = (i / fresh.length * 100) + "%";
    const r = await parse(fresh[i]);
    if (demo) r.demo = true;
    if (have.has(sig(r))) { dups++; continue; }
    have.add(sig(r));
    reports.push(r);
  }
  if (dups) notes.push(T(`${dups} report${dups === 1 ? " was" : "s were"} already in the list, so ${dups === 1 ? "it was" : "they were"} skipped.`,
                         `이미 있는 보고서 ${dups}개는 건너뛰었습니다.`));
  showNotes(notes);
  // Oldest first, so the list reads like a calendar; unreadable files go last.
  reports.sort((a, b) => a.sort - b.sort);
  say(`${reports.length} reports ready.`, `보고서 ${reports.length}개 준비됨.`);

  if (reports.length === 1 && !notes.length) return go({ v: "detail", i: 0 }, true);
  if (from.v === "pick" || from.v === "gate") return go({ v: "list" }, true);
  // Coming from a report opened from the list: step back to that list instead of stacking another.
  if (from.v === "detail" && from.fromList) return history.back();
  go({ v: "list" }, false);
}

document.addEventListener("click", e => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.hasAttribute("data-add")) {
    if (!signedIn) return go({ v: "gate" }, false);   // demo visitors can't open their own files
    $("file").value = ""; $("file").click();
  }
  if (t.hasAttribute("data-demo")) startDemo();
  if (t.hasAttribute("data-exitdemo")) exitDemo();
  if (t.dataset.open) go({ v: "detail", i: +t.dataset.open, fromList: true }, true);
  if (t.hasAttribute("data-tolist")) $("backBtn").click();
  if (t.dataset.step) go({ ...state, i: state.i + +t.dataset.step }, false);
  if (t.hasAttribute("data-clear") && reports.some(r => r.demo)) return exitDemo();
  if (t.hasAttribute("data-clear")) {
    if (reports.length > 1 && !confirm(document.documentElement.dataset.lang === "ko" ? `보고서 ${reports.length}개를 모두 지우고 처음부터 시작할까요?` : `Remove all ${reports.length} reports and start over?`)) return;
    reports = []; showNotes([]); go({ v: "pick" }, false); }
});
$("resumeBtn").addEventListener("click", () => go({ v: "list" }, true));
$("backBtn").addEventListener("click", () => state.fromList ? history.back() : go({ v: "list" }, false));
$("file").addEventListener("change", () => addFiles([...$("file").files]));
// Dropping files anywhere also works on a computer.
document.addEventListener("dragover", e => e.preventDefault());
document.addEventListener("drop", e => { e.preventDefault(); if (signedIn) addFiles([...e.dataTransfer.files]); });

/* ---------- Demo mode ---------- */

// Made-up sample reports (demo.js) run through the same reader as real files.
function startDemo() {
  const files = DEMO_PDFS.map(([name, b64]) => new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], name, { type: "application/pdf" }));
  reports = reports.filter(r => !r.demo);
  if (reports.length && !confirm(document.documentElement.dataset.lang === "ko" ? "데모를 시작하면 지금 열린 보고서가 닫힙니다. 계속할까요?" : "Starting the demo will close the reports you have open. Continue?")) return;
  reports = [];
  showNotes([]);
  addFiles(files, true);
}
function exitDemo() {
  reports = [];
  showNotes([]);
  go({ v: signedIn ? "pick" : "gate" }, false);
}

/* ---------- Sign in ---------- */

async function pwHash(pw) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(PW_SALT.match(/../g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PW_ITER }, key, 256);
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

// Stay signed in on this device for SIGNIN_DAYS so she isn't asked every time.
const session = store.get("jm-session");
let signedIn = !!(session && session.h === PW_HASH && session.exp > Date.now());
try { localStorage.removeItem("jm-ok"); } catch (e) {}   // old sign-in format
go({ v: signedIn ? "pick" : "gate" }, false);
if (!signedIn) $("pw").focus();

function signOut() {
  store.set("jm-session", null);
  signedIn = false;
  reports = [];
  showNotes([]);
  $("pw").value = "";
  go({ v: "gate" }, false);
}
$("signOut").addEventListener("click", signOut);

// After MAX_TRIES wrong passwords, pause sign-in for LOCK_SECONDS (kept across reloads).
let lockTimer = null;
function lockedFor() {
  const l = store.get("jm-lock");
  return l && l.until > Date.now() ? Math.ceil((l.until - Date.now()) / 1000) : 0;
}
function showLock() {
  clearInterval(lockTimer);
  const tick = () => {
    const sec = lockedFor();
    $("gate").querySelector("[type=submit]").disabled = sec > 0;
    if (!sec) { clearInterval(lockTimer); $("gateErr").hidden = true; return; }
    $("gateErr").innerHTML = T(`Too many tries. Please wait ${sec} seconds and try again.`, `너무 많이 시도했습니다. ${sec}초 후에 다시 시도해 주세요.`);
    $("gateErr").hidden = false;
  };
  tick();
  lockTimer = setInterval(tick, 1000);
}
if (!signedIn && lockedFor()) showLock();

$("toggle").addEventListener("click", () => {
  const p = $("pw"), hidden = p.type === "password";
  p.type = hidden ? "text" : "password";
  $("toggle").innerHTML = hidden ? T("Hide", "숨기기") : T("Show", "보기");
});

$("gate").addEventListener("submit", async e => {
  e.preventDefault();
  if (lockedFor()) return showLock();
  const btn = $("gate").querySelector("[type=submit]");
  btn.disabled = true;
  const ok = await pwHash($("pw").value.trim()) === PW_HASH;
  btn.disabled = false;
  if (ok) {
    signedIn = true;
    store.set("jm-session", { h: PW_HASH, exp: Date.now() + SIGNIN_DAYS * 864e5 });
    store.set("jm-lock", null);
    $("pw").value = "";
    $("gateErr").hidden = true;
    go({ v: "pick" }, false);
  } else {
    const l = store.get("jm-lock") || { tries: 0 };
    l.tries = (l.tries || 0) + 1;
    if (l.tries >= MAX_TRIES) { store.set("jm-lock", { tries: 0, until: Date.now() + LOCK_SECONDS * 1000 }); return showLock(); }
    store.set("jm-lock", l);
    $("gateErr").innerHTML = T("That password is not right. Please try again.", "비밀번호가 맞지 않습니다. 다시 입력해 주세요.");
    $("gateErr").hidden = false;
  }
});
