import { exportToCsv } from './utils/csv.js';

// Filterable fields (documented ones)
const FILTER_FIELDS = [
  'armRegionName','Location','meterId','meterName','productId','skuId','productName','skuName','serviceName','serviceId','serviceFamily','priceType','armSkuName'
];
const FUNCTION_OPERATORS = ['contains','startswith','endswith'];
const SIMPLE_OPERATORS = ['eq'];
const COLUMN_ORDER = ['currencyCode','armRegionName','Location','meterName','productName','skuName','serviceName','serviceFamily','priceType','armSkuName','unitOfMeasure','retailPrice','unitPrice','tierMinimumUnits','effectiveStartDate','meterId','productId','skuId','serviceId'];
const STORAGE_KEY = 'meter-explorer-state-v1';

// Elements
const clausesEl = document.getElementById('clauses');
const addClauseBtn = document.getElementById('addClauseBtn');
const clearClausesBtn = document.getElementById('clearClausesBtn');
const runBtn = document.getElementById('runBtn');
const cancelBtn = document.getElementById('cancelBtn');
const exportBtn = document.getElementById('exportBtn');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const rowLimitInput = document.getElementById('rowLimitInput');
const timeoutInput = document.getElementById('timeoutInput');
const apiVersionSelect = document.getElementById('apiVersionSelect');
const currencyCodeInput = document.getElementById('currencyCodeInput');
const primaryRegionToggle = document.getElementById('primaryRegionToggle');
const statusBar = document.getElementById('statusBar');
const examples = document.querySelectorAll('button.ex');
const visibleFilterInput = document.getElementById('visibleFilterInput');
const rowCountEl = document.getElementById('rowCount');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const themeToggle = document.getElementById('themeToggle');
const yearEl = document.getElementById('year');

yearEl.textContent = new Date().getFullYear();

// State
let clauses = [];
let allRows = [];
let nextPageLink = null;
let abortController = null;
let sorting = { key: null, dir: 1 };

function status(msg) { statusBar.textContent = msg; }

function addClause(clause) {
  clauses.push(clause || { field: 'serviceName', op: 'eq', value: '' });
  renderClauses();
  saveState();
}

function removeClause(idx) {
  clauses.splice(idx,1);
  renderClauses();
  saveState();
}

function updateClause(idx, prop, value) {
  clauses[idx][prop] = value;
  saveState();
}

function renderClauses() {
  clausesEl.innerHTML = '';
  clauses.forEach((c,i)=>{
    const row = document.createElement('div');
    row.className = 'clause-row';

    const fieldSel = document.createElement('select');
    for (const f of FILTER_FIELDS) {
      const opt = document.createElement('option'); opt.value=f; opt.textContent=f; if (f===c.field) opt.selected=true; fieldSel.appendChild(opt);
    }
    fieldSel.addEventListener('change', e=>updateClause(i,'field', e.target.value));

    const opSel = document.createElement('select');
    [...SIMPLE_OPERATORS, ...FUNCTION_OPERATORS].forEach(op=>{
      const opt = document.createElement('option'); opt.value=op; opt.textContent=op; if (op===c.op) opt.selected=true; opSel.appendChild(opt);
    });
    opSel.addEventListener('change', e=>updateClause(i,'op', e.target.value));

    const valInput = document.createElement('input');
    valInput.placeholder = 'value';
    valInput.value = c.value;
    valInput.addEventListener('input', e=>updateClause(i,'value', e.target.value));

    const removeBtn = document.createElement('button');
    removeBtn.type='button'; removeBtn.className='btn-tertiary'; removeBtn.textContent='Remove';
    removeBtn.addEventListener('click', ()=>removeClause(i));

    row.append(fieldSel, opSel, valInput, removeBtn);
    clausesEl.appendChild(row);
  });
  if (!clauses.length) {
    const empty = document.createElement('div'); empty.className='mini'; empty.textContent='No clauses'; clausesEl.appendChild(empty);
  }
}

function escapeValue(v) { return v.replace(/'/g, "''"); }

function buildFilterString(includePrimary) {
  const parts = [];
  for (const c of clauses) {
    if (!c.value) continue;
    if (FUNCTION_OPERATORS.includes(c.op)) {
      parts.push(`${c.op}(${c.field},'${escapeValue(c.value)}')`);
    } else {
      parts.push(`${c.field} eq '${escapeValue(c.value)}'`);
    }
  }
  if (includePrimary) parts.push("meterRegion eq 'primary'");
  return parts.join(' and ');
}

function buildApiUrl({ next } = {}) {
  if (next) return next; // already full link including $skip
  const base = 'https://prices.azure.com/api/retail/prices';
  const params = new URLSearchParams();
  const apiVersion = apiVersionSelect.value.trim();
  if (apiVersion) params.set('api-version', apiVersion);
  const currency = currencyCodeInput.value.trim();
  if (currency) params.set('currencyCode', currency.toUpperCase());
  const filterStr = buildFilterString(primaryRegionToggle.checked);
  if (filterStr) params.set('$filter', filterStr);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function fetchWithTimeout(url, timeoutMs, signal) {
  if (!timeoutMs || timeoutMs <= 0 || !Number.isFinite(timeoutMs)) {
    return fetch(url, { signal });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), timeoutMs);
  const anySignal = mergeAbortSignals([signal, ctrl.signal]);
  return fetch(url, { signal: anySignal }).finally(()=>clearTimeout(timer));
}

function mergeAbortSignals(signals) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const s of signals) if (s) {
    if (s.aborted) return AbortSignal.abort();
    s.addEventListener('abort', onAbort, { once:true });
  }
  return controller.signal;
}

async function runSearch({ append } = {}) {
  if (abortController) abortController.abort();
  abortController = new AbortController();
  const rowLimit = parseInt(rowLimitInput.value,10) || 2000;
  const timeoutMs = timeoutInput.value.trim()==='' ? 15000 : parseInt(timeoutInput.value,10);
  if (!append) { allRows = []; nextPageLink = null; exportBtn.disabled = true; copyUrlBtn.disabled = true; }
  const initialUrl = buildApiUrl();
  let url = append && nextPageLink ? nextPageLink : initialUrl;
  let fetched = 0;
  status('Loading...');
  cancelBtn.classList.remove('hide');
  runBtn.disabled = true; loadMoreBtn.disabled = true;
  try {
    while (url) {
      status(`Fetching ${allRows.length + 1}...`);
      const res = await fetchWithTimeout(url, timeoutMs, abortController.signal);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json.Items)) {
        for (const item of json.Items) {
          allRows.push(item);
          fetched++;
          if (allRows.length >= rowLimit) break;
        }
      }
      nextPageLink = json.NextPageLink || null;
      if (allRows.length >= rowLimit) {
        status(`Reached row limit (${rowLimit}).`);
        break;
      }
      url = nextPageLink;
      if (!url) status('Complete');
      if (fetched >= 1000) { // one page typical size
        updateTable();
        fetched = 0;
        await new Promise(r=>setTimeout(r));
      }
    }
    updateTable();
    exportBtn.disabled = allRows.length === 0;
    copyUrlBtn.disabled = false;
    loadMoreBtn.disabled = !nextPageLink;
  } catch (e) {
    if (e.name === 'AbortError') {
      status('Canceled / timed out');
    } else {
      console.error('Fetch error', e);
      status(`Error: ${e.message}`);
    }
  } finally {
    runBtn.disabled = false;
    cancelBtn.classList.add('hide');
  }
}

function updateTable() {
  const tbody = document.querySelector('#resultsTable tbody');
  const thead = document.querySelector('#resultsTable thead');
  const filterTerm = visibleFilterInput.value.trim().toLowerCase();
  const rows = !filterTerm ? allRows : allRows.filter(r => JSON.stringify(r).toLowerCase().includes(filterTerm));
  rowCountEl.textContent = rows.length ? `${rows.length.toLocaleString()} rows` : 'No rows';
  // Headers once
  if (!thead.dataset.init) {
    const tr = document.createElement('tr');
    COLUMN_ORDER.forEach(col=>{
      const th = document.createElement('th'); th.textContent = col; th.addEventListener('click', ()=>toggleSort(col)); tr.appendChild(th);
    });
    thead.appendChild(tr); thead.dataset.init = '1';
  }
  // Sorting
  if (sorting.key) rows.sort((a,b)=>{
    const av = a[sorting.key]; const bv = b[sorting.key];
    if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av-bv)*sorting.dir;
    return String(av).localeCompare(String(bv))*sorting.dir;
  });
  tbody.innerHTML='';
  const frag = document.createDocumentFragment();
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const col of COLUMN_ORDER) {
      const td = document.createElement('td');
      let v = r[col];
      if (col === 'effectiveStartDate' && v) v = v.slice(0,10);
      if (typeof v === 'number') td.textContent = v.toString(); else td.textContent = v == null ? '' : v;
      tr.appendChild(td);
    }
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
}

function toggleSort(col) {
  if (sorting.key === col) sorting.dir = -sorting.dir; else { sorting.key = col; sorting.dir = 1; }
  updateTable();
}

function saveState() {
  const state = { clauses, currency: currencyCodeInput.value, apiVersion: apiVersionSelect.value, primary: primaryRegionToggle.checked };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return;
    const s = JSON.parse(raw);
    if (Array.isArray(s.clauses)) clauses = s.clauses;
    if (s.currency) currencyCodeInput.value = s.currency;
    if (s.apiVersion) apiVersionSelect.value = s.apiVersion;
    if (s.primary) primaryRegionToggle.checked = true;
  } catch {}
}

// Events
addClauseBtn.addEventListener('click', ()=>addClause());
clearClausesBtn.addEventListener('click', ()=>{ clauses = []; renderClauses(); saveState(); });
runBtn.addEventListener('click', ()=>runSearch());
cancelBtn.addEventListener('click', ()=>abortController && abortController.abort());
loadMoreBtn.addEventListener('click', ()=>{ if (nextPageLink) runSearch({ append:true }); });
exportBtn.addEventListener('click', ()=> exportToCsv('meters.csv', allRows, COLUMN_ORDER));
copyUrlBtn.addEventListener('click', ()=>{ const url = buildApiUrl(); navigator.clipboard.writeText(url).then(()=>{ status('Copied API URL'); setTimeout(()=>status('Ready'),1500); }); });
visibleFilterInput.addEventListener('input', ()=> updateTable());
examples.forEach(btn => btn.addEventListener('click', e=>{ try { clauses = JSON.parse(btn.dataset.example); renderClauses(); saveState(); } catch {} }));
themeToggle.addEventListener('click', ()=>{ document.body.classList.toggle('light'); localStorage.setItem('meter-theme', document.body.classList.contains('light')? 'light':'dark'); });

document.addEventListener('keydown', e=>{ if ((e.ctrlKey||e.metaKey) && e.key==='Enter') runSearch(); });

// Theme restore
if (localStorage.getItem('meter-theme')==='light') document.body.classList.add('light');
// Init
restoreState();
if (!clauses.length) addClause(); else renderClauses();
status('Ready');


