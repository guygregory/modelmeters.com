import { exportToCsv } from './utils/csv.js';

// ----- Constants -----
const FILTER_FIELDS = [
  'armRegionName','Location','meterId','meterName','productId','skuId','productName','skuName','serviceName','serviceId','serviceFamily','priceType','armSkuName'
];
const FUNCTION_OPERATORS = ['contains','startswith','endswith'];
const SIMPLE_OPERATORS = ['eq'];
const STORAGE_KEY = 'meterExplorerStateV1';

// ----- State -----
let clauses = [];
let allRows = [];
let nextPageLink = null;
let abortController = null;
let currentRequestMeta = null;
let sorting = { key: null, dir: 'asc' };

// ----- DOM -----
const clausesContainer = document.getElementById('clauses');
const addClauseBtn = document.getElementById('addClauseBtn');
const clearClausesBtn = document.getElementById('clearClausesBtn');
const runSearchBtn = document.getElementById('runSearchBtn');
const cancelBtn = document.getElementById('cancelBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const copyApiUrlBtn = document.getElementById('copyApiUrlBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const statusBar = document.getElementById('statusBar');
const resultCountEl = document.getElementById('resultCount');
const tableQuickFilter = document.getElementById('tableQuickFilter');
const tableContainer = document.getElementById('tableContainer');
const table = document.getElementById('resultsTable');
const quickExamples = document.getElementById('quickExamples');
const currencyCodeInput = document.getElementById('currencyCodeInput');
const apiVersionSelect = document.getElementById('apiVersionSelect');
const primaryMetersOnly = document.getElementById('primaryMetersOnly');
const rowLimitInput = document.getElementById('rowLimitInput');
const timeoutInput = document.getElementById('timeoutInput');
const themeToggle = document.getElementById('themeToggle');
const footerYear = document.getElementById('footerYear');
footerYear.textContent = new Date().getFullYear();

// ----- Theme -----
(function initTheme(){
  const stored = localStorage.getItem('theme');
  if (stored) {
    document.documentElement.classList.toggle('dark', stored==='dark');
  } else {
    document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
})();

themeToggle.addEventListener('click', ()=>{
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark':'light');
});

// ----- Clause Management -----
function addClause(data) {
  const clause = { field: data?.field || 'serviceName', operator: data?.operator || 'eq', value: data?.value || '' };
  clauses.push(clause);
  renderClauses();
}
function removeClause(idx){ clauses.splice(idx,1); renderClauses(); }
function updateClause(idx, patch){ clauses[idx] = { ...clauses[idx], ...patch }; }

function renderClauses(){
  clausesContainer.innerHTML='';
  clauses.forEach((c,i)=>{
    const row = document.createElement('div');
    row.className='clause-row';
    row.innerHTML = `
      <select data-field class="flex-1 min-w-[10ch]">
        ${FILTER_FIELDS.map(f=>`<option value="${f}" ${c.field===f?'selected':''}>${f}</option>`).join('')}
      </select>
      <select data-operator class="w-28">
        ${[...SIMPLE_OPERATORS,...FUNCTION_OPERATORS].map(op=>`<option value="${op}" ${c.operator===op?'selected':''}>${op}</option>`).join('')}
      </select>
      <input data-value class="flex-1 min-w-[12ch]" placeholder="value" value="${c.value.replace(/"/g,'&quot;')}" />
      <button data-remove class="btn-secondary text-[10px]">Remove</button>
    `;
    row.querySelector('[data-field]').addEventListener('change', e=>{updateClause(i,{field:e.target.value}); saveState();});
    row.querySelector('[data-operator]').addEventListener('change', e=>{updateClause(i,{operator:e.target.value}); saveState();});
    row.querySelector('[data-value]').addEventListener('input', e=>{updateClause(i,{value:e.target.value}); });
    row.querySelector('[data-remove]').addEventListener('click', ()=>{removeClause(i); saveState();});
    clausesContainer.appendChild(row);
  });
  if (!clauses.length) clausesContainer.innerHTML = '<p class="text-sm text-slate-500">No clauses. Add one to begin.</p>';
  saveState();
}

addClauseBtn.addEventListener('click', ()=> addClause());
clearClausesBtn.addEventListener('click', ()=>{ clauses=[]; renderClauses(); });

// ----- Filter to Query -----
function escapeValue(v){ return v.replace(/'/g, "''"); }
function buildFilterString(includePrimary){
  const parts = clauses.filter(c=>c.value.trim()).map(c=>{
    if (FUNCTION_OPERATORS.includes(c.operator)) {
      return `${c.operator}(${c.field},'${escapeValue(c.value.trim())}')`;
    }
    return `${c.field} eq '${escapeValue(c.value.trim())}'`;
  });
  if (includePrimary) parts.push("meterRegion eq 'primary'");
  return parts.join(' and ');
}

function buildApiUrl({nextLink}={}){
  if (nextLink) return nextLink;
  const base = 'https://prices.azure.com/api/retail/prices';
  const params = new URLSearchParams();
  const apiVersion = apiVersionSelect.value.trim();
  if (apiVersion) params.append('api-version', apiVersion);
  const cur = currencyCodeInput.value.trim();
  if (cur) params.append('currencyCode', `'${cur}'`);
  const filter = buildFilterString(primaryMetersOnly.checked);
  if (filter) params.append('$filter', filter);
  let url = base;
  const qs = params.toString();
  if (qs) url += '?' + qs;
  return url;
}

// ----- Fetch Logic -----
async function fetchPage(url, timeoutMs){
  const signal = abortController.signal;
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: new AbortSignalAny([signal, controller.signal]) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

// Polyfill for combining abort signals
class AbortSignalAny {
  constructor(signals){
    this.controller = new AbortController();
    this.signal = this.controller.signal;
    signals.forEach(sig=> sig.addEventListener('abort', ()=> this.controller.abort(sig.reason), { once:true }));
  }
}

async function runSearch({append=false}={}){
  if (!append){
    allRows=[]; nextPageLink=null; updateTable();
  }
  const rowLimit = Math.min(Math.max(parseInt(rowLimitInput.value)||1,1), 20000);
  const timeoutMs = (parseInt(timeoutInput.value)||45)*1000;
  const url = buildApiUrl({nextLink: append? nextPageLink: undefined});
  currentRequestMeta = { started: Date.now(), baseUrl: url, rowLimit };
  abortController = new AbortController();
  setLoading(true, append);
  statusBar.textContent = 'Loading...';
  try {
    let pageUrl = url;
    while(pageUrl && allRows.length < rowLimit){
      const data = await fetchWithTimeout(pageUrl, timeoutMs, abortController.signal);
      const items = data.Items || data.items || [];
      allRows.push(...items);
      nextPageLink = data.NextPageLink || data.nextPageLink || null;
      statusBar.textContent = `Fetched ${allRows.length.toLocaleString()} rows`;
      updateTable();
      if (!nextPageLink || allRows.length >= rowLimit) break;
      pageUrl = nextPageLink;
    }
    statusBar.textContent = `Done. ${allRows.length.toLocaleString()} rows.`;
  } catch (e){
    if (abortController.signal.aborted) statusBar.textContent = 'Cancelled.'; else statusBar.textContent = 'Error: '+ e.message;
  } finally {
    setLoading(false);
  }
}

async function fetchWithTimeout(url, timeoutMs, signal){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), timeoutMs);
  const composite = new AbortSignalAny([signal, controller.signal]);
  const res = await fetch(url, { signal: composite.signal });
  clearTimeout(t);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function setLoading(is, appending){
  runSearchBtn.disabled = is;
  cancelBtn.classList.toggle('hidden', !is);
  cancelBtn.disabled = !is;
  loadMoreBtn.classList.toggle('hidden', is || !nextPageLink);
  if (!is && nextPageLink) loadMoreBtn.classList.remove('hidden');
  exportCsvBtn.disabled = is || !allRows.length;
  copyApiUrlBtn.disabled = is || !buildFilterString(false);
  document.body.style.cursor = is? 'progress':'default';
}

cancelBtn.addEventListener('click', ()=>{ if (abortController) abortController.abort(); });
runSearchBtn.addEventListener('click', ()=> runSearch());
loadMoreBtn.addEventListener('click', ()=> runSearch({append:true}));

// ----- Table Rendering -----
const COLUMN_ORDER = ['currencyCode','armRegionName','Location','meterName','productName','skuName','serviceName','serviceFamily','priceType','armSkuName','unitOfMeasure','retailPrice','unitPrice','tierMinimumUnits','effectiveStartDate','meterId','productId','skuId','serviceId'];

function updateTable(){
  // filter in-memory for quick filter
  const q = tableQuickFilter.value.trim().toLowerCase();
  let rows = !q? allRows : allRows.filter(r=> Object.values(r).some(v=> (v+"" ).toLowerCase().includes(q)) );
  // sorting
  if (sorting.key){
    rows = [...rows].sort((a,b)=>{
      const av = a[sorting.key]; const bv = b[sorting.key];
      if (av==null && bv==null) return 0; if (av==null) return 1; if (bv==null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sorting.dir==='asc'? av-bv: bv-av;
      return sorting.dir==='asc'? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }
  // headers
  const thead = table.tHead; const tbody = table.tBodies[0];
  if (!thead.innerHTML){
    thead.innerHTML = '<tr>' + COLUMN_ORDER.map(c=>`<th class="px-2 py-1 text-left font-semibold whitespace-nowrap table-sort" data-col="${c}">${c}<span class="ml-1 opacity-50 text-[10px]"></span></th>`).join('') + '</tr>';
    thead.querySelectorAll('th').forEach(th=> th.addEventListener('click', ()=> toggleSort(th.dataset.col, th)) );
  }
  thead.querySelectorAll('th').forEach(th=>{
    const span = th.querySelector('span');
    if (sorting.key === th.dataset.col) span.textContent = sorting.dir==='asc'? '▲':'▼'; else span.textContent='';
  });
  tbody.innerHTML = rows.map(r=>'<tr>'+ COLUMN_ORDER.map(c=>`<td class="px-2 py-1 align-top whitespace-nowrap">${formatCell(r[c])}</td>`).join('') + '</tr>').join('');
  resultCountEl.textContent = rows.length? `${rows.length.toLocaleString()} shown` : 'No rows';
  exportCsvBtn.disabled = !allRows.length;
  loadMoreBtn.classList.toggle('hidden', !nextPageLink);
}

function formatCell(v){
  if (v==null) return '';
  if (typeof v === 'number') return v.toString();
  return String(v).length>80? `<span title="${escapeHtml(String(v))}">${escapeHtml(String(v).slice(0,80))}…</span>` : escapeHtml(String(v));
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c])); }

function toggleSort(col){
  if (sorting.key === col) sorting.dir = sorting.dir==='asc'? 'desc':'asc'; else { sorting.key = col; sorting.dir='asc'; }
  updateTable();
}

tableQuickFilter.addEventListener('input', ()=> updateTable());

// ----- CSV Export -----
exportCsvBtn.addEventListener('click', ()=>{
  const meta = `Filter: ${buildFilterString(primaryMetersOnly.checked) || '(none)'} | Rows: ${allRows.length}`;
  exportToCsv('azure-retail-prices.csv', allRows, COLUMN_ORDER, meta);
});

// ----- Copy API URL -----
copyApiUrlBtn.addEventListener('click', ()=>{
  const url = buildApiUrl();
  navigator.clipboard.writeText(url).then(()=>{ statusBar.textContent='API URL copied.'; });
});

// ----- Quick Examples -----
const examples = [
  { label: 'serviceName eq "Cognitive Services"', clauses:[{field:'serviceName',operator:'eq',value:'Cognitive Services'}] },
  { label: 'meterName eq "o3 0416 Inp glbl Tokens"', clauses:[{field:'meterName',operator:'eq',value:'o3 0416 Inp glbl Tokens'}] },
  { label: 'meterName eq "o3 0416 Outp glbl Tokens"', clauses:[{field:'meterName',operator:'eq',value:'o3 0416 Outp glbl Tokens'}] },
  { label: 'meterName eq "o3-pro Inp glbl Tokens"', clauses:[{field:'meterName',operator:'eq',value:'o3-pro Inp glbl Tokens'}] },
  { label: 'meterName eq "o3-pro Outp glbl Tokens"', clauses:[{field:'meterName',operator:'eq',value:'o3-pro Outp glbl Tokens'}] },
  { label: "meterName contains 'gpt-oss'", clauses:[{field:'meterName',operator:'contains',value:'gpt-oss'}] },
];
examples.forEach(ex=>{
  const btn = document.createElement('button');
  btn.className='btn-secondary'; btn.textContent=ex.label; btn.title='Load example';
  btn.addEventListener('click', ()=>{ clauses = ex.clauses.map(c=>({...c})); renderClauses(); });
  quickExamples.appendChild(btn);
});

// ----- URL State Sync -----
function saveState(){
  const state = { clauses, cur: currencyCodeInput.value.trim(), apiVersion: apiVersionSelect.value, primary: primaryMetersOnly.checked };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const filter = buildFilterString(primaryMetersOnly.checked);
  const params = new URLSearchParams(window.location.search);
  if (filter) params.set('filter', filter); else params.delete('filter');
  const newUrl = window.location.pathname + (params.toString()? '?'+params.toString(): '');
  history.replaceState(null,'', newUrl);
  copyApiUrlBtn.disabled = !filter;
}
function restoreState(){
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const filterFromUrl = urlParams.get('filter');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if (filterFromUrl){
      // parse only eq joined by and naive
      clauses = parseFilter(filterFromUrl);
    } else if (stored){
      clauses = stored.clauses||[];
      currencyCodeInput.value = stored.cur||'';
      apiVersionSelect.value = stored.apiVersion||'';
      primaryMetersOnly.checked = !!stored.primary;
    } else {
      clauses=[];
    }
  } catch{ clauses=[]; }
  renderClauses();
}
function parseFilter(f){
  // very naive parser: split on ' and ' then detect functions or eq
  return f.split(/\s+and\s+/).map(part=>{
    const fn = FUNCTION_OPERATORS.find(op=> part.startsWith(op+'('));
    if (fn){
      const m = part.match(/^[^(]+\(([^,]+),'(.+)'\)$/); // fn(field,'value')
      if (m) return { field:m[1], operator:fn, value:m[2].replace(/''/g,"'") };
    } else {
      const m = part.match(/^(\w+) eq '(.+)'$/);
      if (m) return { field:m[1], operator:'eq', value:m[2].replace(/''/g,"'") };
    }
    return { field:'serviceName', operator:'eq', value:'' };
  }).filter(c=> FILTER_FIELDS.includes(c.field));
}

// ----- Init -----
restoreState();

// If first load and no clause, seed with one empty row
if (!clauses.length) addClause();

// Keyboard shortcuts
window.addEventListener('keydown', e=>{
  if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) { runSearch(); }
});

// Accessibility improvement: focus status after load
const observer = new MutationObserver(()=>{ statusBar.setAttribute('tabindex','-1'); statusBar.focus({preventScroll:true}); });
observer.observe(statusBar,{ childList:true });

