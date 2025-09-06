// Stock Count Pro — app.js (with iOS camera-permission fix + items.js auto-loader)

/* -------------------- Keys & initial state -------------------- */
const CFG_KEY = "pwa_cfg_v2";
const ITEMS_KEY = "pwa_items_v2";
const LINES_KEY = "pwa_lines_v2";

let cfg   = JSON.parse(localStorage.getItem(CFG_KEY)  || "null") || { itemsUrl:"", countsUrl:"" };
let items = JSON.parse(localStorage.getItem(ITEMS_KEY) || "null");
// First-run: pull ITEMS from items.js if present
if (!items && typeof ITEMS !== "undefined") { items = ITEMS; saveItems(); }
let lines = JSON.parse(localStorage.getItem(LINES_KEY) || "[]");

/* -------------------- DOM refs -------------------- */
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

/* -------------------- Persist helpers -------------------- */
function saveCfg()   { localStorage.setItem(CFG_KEY,   JSON.stringify(cfg));   renderSyncStatus(); }
function saveItems() { localStorage.setItem(ITEMS_KEY, JSON.stringify(items)); renderItems(searchEl.value); renderSummary(); }
function saveLines() { localStorage.setItem(LINES_KEY, JSON.stringify(lines)); renderLines(); renderSummary(); }

/* -------------------- Camera / Scanner -------------------- */
const codeReader = new ZXing.BrowserMultiFormatReader();
let devices = [];
let currentDeviceId = null;
let scanning = false;
let captureToItem = null;   // when in LINK mode and waiting to capture a barcode
let selectedItem  = null;

// Force iOS to actually ask for permission & prime the video element
async function ensureCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  // Request a quick, muted, inline stream to trigger permission sheet on iOS
  const testStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: "environment" }
  });

  // Attach briefly so iOS paints instead of staying black
  preview.setAttribute("playsinline", "true");
  preview.setAttribute("autoplay", "true");
  preview.muted = true;
  preview.srcObject = testStream;

  // Small delay lets the pipeline settle, then stop — ZXing will take over
  await new Promise(r => setTimeout(r, 150));
  testStream.getTracks().forEach(t => t.stop());
}

async function listCameras() {
  try {
    devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
    camInfo.textContent = devices.length ? `${devices.length} camera(s)` : "No camera found";
    if (!currentDeviceId && devices.length) currentDeviceId = devices[0].deviceId;
  } catch (e) {
    camInfo.textContent = "Camera list failed";
  }
}

aasync function startCam(){
  try {
    await listCameras();
    if (!currentDeviceId) return alert("No camera found on this device");

    scanning = true;
    stopBtn.disabled = false;
    startBtn.disabled = true;

    // Get raw stream manually
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: currentDeviceId } }
    });

    // Attach to <video>
    preview.setAttribute("playsinline", "true");
    preview.setAttribute("autoplay", "true");
    preview.muted = true;
    preview.srcObject = stream;
    await preview.play();

    // Then let ZXing decode from that same device
    codeReader.decodeFromVideoDevice(currentDeviceId, preview, (result, err) => {
      if (result) onScan(result.getText());
    });
  } catch (err) {
    console.error(err);
    alert("Camera access failed: " + err.message);
  }
}


function stopCam(){
  scanning = false;
  stopBtn.disabled = true;
  startBtn.disabled = false;
  try { codeReader.reset(); } catch {}
}

function flipCam(){
  if (!devices.length) return;
  const i = devices.findIndex(d => d.deviceId === currentDeviceId);
  currentDeviceId = devices[(i + 1) % devices.length].deviceId;
  if (scanning) { stopCam(); startCam(); }
}

// Buttons
startBtn.addEventListener("click", startCam);
stopBtn .addEventListener("click", stopCam);
flipBtn .addEventListener("click", flipCam);

/* -------------------- Items UI -------------------- */
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

/* -------------------- Link / Count actions -------------------- */
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
  // Linking flow
  if (captureToItem){
    // ensure uniqueness
    items.forEach(it => { if (it.barcode === barcode) it.barcode = ""; });
    captureToItem.barcode = barcode;
    saveItems();
    panelStatus.textContent = "✔ Linked";
    captureToItem = null;
    return;
  }

  // Normal scan → select item by barcode
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

/* -------------------- Lines & Summary -------------------- */
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

/* -------------------- CSV / XLSX export + import -------------------- */
function toCsv(rows){
  const headers = ["Timestamp","Area","Barcode","SKU","Item","Qty","User","Notes"];
  const esc = s => `"${String(s ?? "").replaceAll('"','""')}"`;
  const body = rows.map(r => [r.ts,r.area,r.barcode,r.sku,r.name,r.qty,r.user,r.notes].map(esc).join(",")).join("\n");
  return headers.join(",") + "\n" + body;
}

exportLinesBtn.addEventListener("click", () => {
  const csv = toCsv(lines);
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `counts_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
  a.click(); URL.revokeObjectURL(url);
});

exportXlsxBtn.addEventListener("click", async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Stock Count Pro";
  wb.created = new Date();

  const ws = wb.addWorksheet("Counts");
  ws.columns = [
    { header:"Timestamp", key:"ts", width:22 },
    { header:"Area",      key:"area", width:8 },
    { header:"Barcode",   key:"barcode", width:18 },
    { header:"SKU",       key:"sku", width:16 },
    { header:"Item",      key:"name", width:32 },
    { header:"Qty",       key:"qty", width:8 },
    { header:"User",      key:"user", width:16 },
    { header:"Notes",     key:"notes", width:24 },
  ];
  ws.addRows(lines);
  ws.getRow(1).font = { bold:true };
  ws.views = [{ state:"frozen", ySplit:1 }];

  const ws2 = wb.addWorksheet("Summary");
  ws2.columns = [
    { header:"SKU", key:"sku", width:16 },
    { header:"Item", key:"name", width:32 },
    { header:"Total", key:"total", width:10 },
    { header:"Par", key:"par", width:8 },
    { header:"Variance", key:"var", width:10 },
  ];

  const totals = new Map();
  lines.forEach(r => {
    const cur = totals.get(r.sku) || { name:r.name, total:0 };
    cur.total += Number(r.qty)||0;
    totals.set(r.sku, cur);
  });

  const rows = items.map(it => {
    const tot = totals.get(it.sku)?.total || 0;
    const par = Number(it.par || 0);
    return { sku:it.sku, name:it.name, total:tot, par, var:(tot - par) };
  });
  ws2.addRows(rows);
  ws2.getRow(1).font = { bold:true };
  ws2.views = [{ state:"frozen", ySplit:1 }];
  for (let r=2; r<=ws2.rowCount; r++){
    const tot = ws2.getCell(r,3).value || 0;
    const par = ws2.getCell(r,4).value || 0;
    if (par && tot < par){
      ws2.getRow(r).fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFFEEEE" } };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `stock_counts_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click(); URL.revokeObjectURL(url);
});

function itemsToCsv(list){
  const headers = ["SKU","Name","Barcode","Par"];
  const esc = s => `"${String(s ?? "").replaceAll('"','""')}"`;
  const body = list.map(i => [i.sku,i.name,i.barcode,i.par||0].map(esc).join(",")).join("\n");
  return headers.join(",") + "\n" + body;
}

exportItemsBtn.addEventListener("click", () => {
  const csv = itemsToCsv(items);
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `items_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
  a.click(); URL.revokeObjectURL(url);
});

function parseCsv(text){
  const lines = text.trim().split(/\r?\n/);
  const out = [];
  const parseLine = ln => {
    const cells = []; let cur = "", q = false;
    for (let i=0;i<ln.length;i++){
      const ch = ln[i];
      if (q){
        if (ch=='"' && ln[i+1]=='"'){ cur+='"'; i++; }
        else if (ch=='"'){ q=false; }
        else { cur+=ch; }
      } else {
        if (ch=='"'){ q=true; }
        else if (ch==","){ cells.push(cur); cur=""; }
        else { cur+=ch; }
      }
    }
    cells.push(cur); return cells;
  };
  const header = parseLine(lines[0]).map(s => s.trim().toLowerCase());
  for (let r=1;r<lines.length;r++){
    const vals = parseLine(lines[r]); const row = {};
    header.forEach((h,i)=> row[h] = vals[i]);
    out.push(row);
  }
  return out;
}

importItemsInp.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text();
  const rows = parseCsv(text);
  const next = [];
  rows.forEach(r => {
    if (!r.sku || !r.name) return;
    next.push({ sku:String(r.sku), name:String(r.name), barcode:String(r.barcode||""), par:Number(r.par||0) });
  });
  if (!next.length) return alert("No valid rows found. Need at least SKU and Name.");
  items = next; saveItems(); alert(`Imported ${items.length} items.`);
  importItemsInp.value = "";
});

/* -------------------- Optional Google Sheets sync -------------------- */
function renderSyncStatus(){
  const online = !!(cfg.itemsUrl || cfg.countsUrl);
  syncStatusEl.textContent = online ? "Online (Sheets sync configured)" : "Offline (local)";
  itemsUrlEl.value  = cfg.itemsUrl;
  countsUrlEl.value = cfg.countsUrl;
}
saveCfgBtn.addEventListener("click", ()=>{ cfg.itemsUrl = itemsUrlEl.value.trim(); cfg.countsUrl = countsUrlEl.value.trim(); saveCfg(); });
syncNowBtn.addEventListener("click", syncAll);

async function fetchItems(){
  if (!cfg.itemsUrl) return;
  const res = await fetch(cfg.itemsUrl, { method:"GET" });
  if (!res.ok) throw new Error("Items GET failed");
  const data = await res.json();
  if (Array.isArray(data) && data.length){ items = data; saveItems(); }
}
async function postItems(list){
  if (!cfg.itemsUrl) return;
  await fetch(cfg.itemsUrl, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(list) });
}
async function postCount(rows){
  if (!cfg.countsUrl) return;
  const payload = Array.isArray(rows) ? rows : [rows];
  await fetch(cfg.countsUrl, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
}
async function syncAll(){
  try{
    await fetchItems();
    await postItems(items);
    if (lines.length) await postCount(lines);
    panelStatus.textContent = "Synced";
  } catch(e){
    panelStatus.textContent = "Sync failed";
  }
}

/* -------------------- Lines clear -------------------- */
clearLinesBtn.addEventListener("click", () => {
  if (!confirm("Clear all logged lines?")) return;
  lines = []; saveLines();
});

/* -------------------- Init -------------------- */
function init(){
  renderSyncStatus();
  renderItems();
  renderLines();
  renderSummary();
  setPanels();
}
init();
(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    console.log("✅ Camera stream opened", stream);
    document.getElementById("preview").srcObject = stream;
  } catch (err) {
    console.error("❌ Camera failed", err);
    alert("Camera access failed: " + err.message);
  }
})();
