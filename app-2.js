// Stock Count Pro — app.js (auto-loader for items.js)

const CFG_KEY = "pwa_cfg_v2";
const ITEMS_KEY = "pwa_items_v2";
const LINES_KEY = "pwa_lines_v2";

let cfg = JSON.parse(localStorage.getItem(CFG_KEY) || "null") || { itemsUrl:"", countsUrl:"" };
let items = JSON.parse(localStorage.getItem(ITEMS_KEY) || "null");

// Auto-load from items.js if not in localStorage yet
if (!items && typeof ITEMS !== "undefined") {
  items = ITEMS;
  saveItems();
}

let lines = JSON.parse(localStorage.getItem(LINES_KEY) || "[]");

function saveCfg(){ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
function saveItems(){ localStorage.setItem(ITEMS_KEY, JSON.stringify(items)); }
function saveLines(){ localStorage.setItem(LINES_KEY, JSON.stringify(lines)); }

// ... rest of your app logic here ...
