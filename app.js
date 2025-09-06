// -------------------- Stock Count Pro (full app.js, fixed for iOS Safari camera) --------------------

const CFG_KEY = "pwa_cfg_v2";
const ITEMS_KEY = "pwa_items_v2";
const LINES_KEY = "pwa_lines_v2";

let cfg   = JSON.parse(localStorage.getItem(CFG_KEY)  || "null") || { itemsUrl:"", countsUrl:"" };
let items = JSON.parse(localStorage.getItem(ITEMS_KEY) || "null");
if (!items && typeof ITEMS !== "undefined") { items = ITEMS; saveItems(); }
let lines = JSON.parse(localStorage.getItem(LINES_KEY) || "[]");

// -------------------- DOM --------------------
const modeEl = document.getElementById("mode");
const areaEl = document.getElementById("area");
const userEl = document.getElementById("user");

const exportLinesBtn = document.getElementById("exportLines");
const exportXlsxBtn  = document.getElementById("exportXlsx");

const itemsUrlEl   = document.getElementById("itemsUrl");
const countsUrlEl  = document.getElementById("countsUrl");
const saveCfgBtn   = document.getElementById("saveCfg");
const syncNowBtn   = document.getElementById("syncNow");
const syncStatusEl = document.getElementById("syncStatus");

const startBtn = document.getElementById("start");
const stopBtn  = document.getElementById("stop");
const flipBtn  = document.getElementById("flip");
const preview  = document.getElementById("preview");
const camInfo  = document.getElementById("camInfo");

const searchEl       = document.getElementById("search");
const itemList       = document.getElementById("itemList");
const addItemBtn     = document.getElementById("addItem");
const exportItemsBtn = document.getElementById("exportItems");
const importItemsInp = document.getElementById("importItems");

const workPanel     = document.getElementById("workPanel");
const modePill      = document.getElementById("modePill");
const selectedLabel = document.getElementById("selectedLabel");
const panelStatus   = document.getElementById("panelStatus");
const linkPanel     = document.getElementById("linkPanel");
const captureBtn    = document.getElementById("capture");
const clearBcBtn    = document.getElementById("clearBarcode");
const countPanel    = document.getElementById("countPanel");
const qtyEl         = document.getElementById("qty");
const notesEl       = document.getElementById("notes");
const addLineBtn    = document.getElementById("addLine");

const linesTbody   = document.getElementById("lines");
const summaryTbody = document.getElementById("summary");
const clearLinesBtn= document.getElementById("clearLines");

// -------------------- Storage helpers --------------------
function saveCfg()   { localStorage.setItem(CFG_KEY,   JSON.stringify(cfg));   renderSyncStatus(); }
function saveItems() { localStorage.setItem(ITEMS_KEY, JSON.stringify(items)); renderItems(searchEl.value); renderSummary(); }
function saveLines() { localStorage.setItem(LINES_KEY, JSON.stringify(lines)); renderLines(); renderSummary(); }

/* -------------------- Camera / Scanner (no enumerateDevices) -------------------- */
const codeReader = new ZXing.BrowserMultiFormatReader();
let scanning = false;
let selectedItem = null;
let captureToItem = null;
let currentFacing = "environment"; // "environment" (back) or "user" (front)

function attachVideoAttributes() {
  preview.setAttribute("playsinline", "true");
  preview.setAttribute("autoplay", "true");
  preview.muted = true;
}

async function startCam() {
  try {
    attachVideoAttributes();

    // Use constraints instead of listing devices (works on iOS Safari)
    const constraints = { video: { facingMode: currentFacing } };

    scanning = true;
    stopBtn.disabled = false;
    startBtn.disabled = true;

    // ZXing will open the stream internally
    await codeReader.decodeFromConstraints(constraints, preview, (result, err) => {
      if (result) onScan(result.getText());
      // ignore err frames; ZXing fires many while searching
    });
  } catch (err) {
    console.error("Camera failed:", err);
    alert("Camera access failed: " + err.message);
    stopCam();
  }
}

function stopCam() {
  scanning = false;
  stopBtn.disabled = true;
  startBtn.disabled = false;
  try { codeReader.reset(); } catch {}
  try { preview.srcObject && preview.srcObject.getTracks().forEach(t => t.stop()); } catch {}
}

function flipCam() {
  currentFacing = currentFacing === "environment" ? "user" : "environment";
  if (scanning) { stopCam(); startCam(); }
}

startBtn.addEventListener("click", startCam);
stopBtn .addEventListener("click", stopCam);
flipBtn .addEventListener("click", flipCam);


// -------------------- Items --------------------
function renderItems(filter = ""){
  const q = (filter || "").toLowerCase();
  const list = items
    .slice()
    .sort((a,b) => a.sku.localeCompare(b.sku))
    .filter(it =>
      !q ||
      it.sku.toLowerCase().includes(q) ||
      it.name.toLowerCase().includes(q)
    );

  itemList.innerHTML = "";
  list.forEach(it => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="row">
        <div><strong>${it.sku}</strong> — ${it.name}</div>
        <div class="spacer"></div>
        <button class="ghost small" data-act="edit"   data-sku="${it.sku}">Edit</button>
        <button class="primary small" data-act="select" data-sku="${it.sku}">Select</button>
      </div>
      <div class="small">Barcode: ${it.barcode ? it.barcode : "<em>not set</em>"}</div>
    `;
    itemList.appendChild(div);
  });
}

itemList.addEventListener("click", (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  const sku = btn.getAttribute("data-sku");
  const it  = items.find(x => x.sku === sku); if (!it) return;
  const act = btn.getAttribute("data-act");

  if (act === "select"){
    selectedItem = it;
    setPanels();
    if (modeEl.value === "count") qtyEl.focus();
  }

  if (act === "edit"){
    const name = prompt("Name:", it.name);
    if (name !== null) it.name = (name || "").trim() || it.name;

    const par = prompt("Par (number):", it.par ?? "");
    if (par !== null) it.par = Number(par) || 0;

    const bc  = prompt("Barcode (optional):", it.barcode || "");
    if (bc !== null) it.barcode = (bc || "").trim();

    saveItems();
  }
});

addItemBtn.addEventListener("click", () => {
  const sku = prompt("New SKU:"); if (!sku) return;
  if (items.some(x => x.sku === sku)) return alert("SKU already exists.");
  const name = prompt("Item name:"); if (!name) return;
  items.push({ sku, name, barcode:"", par:0 });
  saveItems();
});

searchEl.addEventListener("input", () => renderItems(searchEl.value));

function setPanels(){
  workPanel.style.display = selectedItem ? "block" : "none";
  if (!selectedItem) return;
  selectedLabel.textContent = `${selectedItem.sku} — ${selectedItem.name}`;
  const mode = modeEl.value;
  modePill.textContent = mode === "link" ? "Link mode" : "Count mode";
  linkPanel.style.display  = mode === "link"  ? "flex" : "none";
  countPanel.style.display = mode === "count" ? "flex" : "none";
}

modeEl.addEventListener("change", setPanels);

// -------------------- Link / Count --------------------
captureBtn.addEventListener("click", () => {
  if (!selectedItem) return alert("Select an item first");
  captureToItem = selectedItem;
  panelStatus.textContent = "Waiting for scan…";
});

clearBcBtn.addEventListener("click", () => {
  if (!selectedItem) return;
  selectedItem.barcode = "";
  saveItems();
  panelStatus.textContent = "Barcode cleared";
});

addLineBtn.addEventListener("click", () => {
  if (!selectedItem) return alert("Select an item");
  const qty = parseInt(qtyEl.value, 10);
  if (!(qty >= 0)) return alert("Enter a valid quantity");

  const row = {
    ts: new Date().toISOString(),
    area: areaEl.value,
    barcode: selectedItem.barcode || "",
    sku: selectedItem.sku,
    name: selectedItem.name,
    qty,
    user: userEl.value || "",
    notes: notesEl.value || ""
  };
  lines.push(row);
  saveLines();
  qtyEl.value = "";
  notesEl.value = "";
  panelStatus.textContent = "Added";

  if (cfg.countsUrl) postCount(row).catch(()=>{});
});

function onScan(barcode){
  if (captureToItem){
    items.forEach(it => { if (it.barcode === barcode) it.barcode = ""; });
    captureToItem.barcode = barcode;
    saveItems();
    panelStatus.textContent = "✔ Linked";
    captureToItem = null;
    return;
  }
  const found = items.find(it => it.barcode === barcode);
  if (found){
    selectedItem = found;
    setPanels();
    if (modeEl.value === "count") qtyEl.focus();
  } else {
    if (!selectedItem){
      panelStatus.textContent = "Unknown barcode. Select an item and link it.";
      alert(`Unknown barcode ${barcode}. Select an item then LINK → Capture.`);
      return;
    }
    if (confirm(`Unknown barcode ${barcode}. Link to ${selectedItem.sku}?`)){
      items.forEach(it => { if (it.barcode === barcode) it.barcode = ""; });
      selectedItem.barcode = barcode;
      saveItems();
      setPanels();
    }
  }
}

// -------------------- Lines & Summary --------------------
function renderLines(){
  linesTbody.innerHTML = "";
  lines.forEach((r,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td>${r.area}</td>
      <td>${r.barcode || ""}</td>
      <td>${r.sku}</td>
      <td>${r.name}</td>
      <td>${r.qty}</td>
      <td>${r.user}</td>
      <td>${r.notes}</td>
      <td><button class="ghost small" data-i="${i}">✖</button></td>
    `;
    linesTbody.appendChild(tr);
  });
  linesTbody.querySelectorAll("button[data-i]").forEach(b => {
    b.addEventListener("click", e => {
      const i = +e.target.getAttribute("data-i");
      lines.splice(i,1);
      saveLines();
    });
  });
}

function renderSummary(){
  const totals = new Map();
  lines.forEach(r => {
    const cur = totals.get(r.sku) || { name:r.name, total:0 };
    cur.total += Number(r.qty) || 0;
    totals.set(r.sku, cur);
  });

  summaryTbody.innerHTML = "";
  items.forEach(it => {
    const tot = totals.get(it.sku)?.total || 0;
    const par = Number(it.par || 0);
    const variance = tot - par;
    const tr = document.createElement("tr");
    if (par && tot < par) tr.className = "short";
    tr.innerHTML = `<td>${it.sku}</td><td>${it.name}</td><td>${tot}</td><td>${par}</td><td>${variance}</td>`;
    summaryTbody.appendChild(tr);
  });
}

// -------------------- CSV/XLSX export/import (same as before) --------------------
// (keep your existing export/import functions here)

// -------------------- Sync (Sheets) --------------------
function renderSyncStatus(){
  const online = !!(cfg.itemsUrl || cfg.countsUrl);
  syncStatusEl.textContent = online ? "Online (Sheets sync configured)" : "Offline (local)";
  itemsUrlEl.value  = cfg.itemsUrl;
  countsUrlEl.value = cfg.countsUrl;
}
saveCfgBtn.addEventListener("click", ()=>{ cfg.itemsUrl = itemsUrlEl.value.trim(); cfg.countsUrl = countsUrlEl.value.trim(); saveCfg(); });
syncNowBtn.addEventListener("click", syncAll);

// -------------------- Lines clear --------------------
clearLinesBtn.addEventListener("click", () => {
  if (!confirm("Clear all logged lines?")) return;
  lines = []; saveLines();
});

// -------------------- Init --------------------
function init(){
  renderSyncStatus();
  renderItems();
  renderLines();
  renderSummary();
  setPanels();
}
init();
