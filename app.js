import { exportToCsv } from './utils/csv.js';

// ----- Config -----
const FILTER_FIELDS = [
  'serviceName','serviceFamily','productName','skuName','meterName','productId','skuId','armRegionName','location','publisherName','currencyCode','reservationTerm','priceType','type'
];
const FUNCTION_OPERATORS = ['contains','startswith','endswith'];
const SIMPLE_OPERATORS = ['eq'];
const COLUMN_ORDER = ['serviceName','serviceFamily','productName','skuName','meterName','armRegionName','location','unitOfMeasure','retailPrice','unitPrice','currencyCode','effectiveStartDate','type'];
const STORAGE_KEY = 'meter-explorer-state-v1';

// ----- State -----
let clauses = [];
let allRows = [];
let nextPageLink = null;
let abortController = null;
let sorting = { key:null, dir:null };

// ----- DOM -----
const clausesEl = document.getElementById('clauses');
const addClauseBtn = document.getElementById('addClauseBtn');
const clearClausesBtn = document.getElementById('clearClausesBtn');
const runBtn = document.getElementById('runSearchBtn');
const cancelBtn = document.getElementById('cancelBtn');
const exportBtn = document.getElementById('exportCsvBtn');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const statusBar = document.getElementById('statusBar');
const tableEl = document.getElementById('resultsTable');
const quickFilterInput = document.getElementById('quickFilterInput');
const currencyInput = document.getElementById('currencyInput');
const apiVersionInput = document.getElementById('apiVersionInput');
const rowLimitInput = document.getElementById('rowLimitInput');
const timeoutInput = document.getElementById('timeoutInput');
const primaryRegionOnlyChk = document.getElementById('primaryRegionOnlyChk');
const themeToggle = document.getElementById('themeToggle');
const examplesEl = document.getElementById('examples');

// ----- Clause UI -----
function addClause(data={ field:'serviceName', op:'eq', value:'' }) {
  const id = crypto.randomUUID();
  const clause = { id, ...data };
  clauses.push(clause);
  renderClauses();
}
function removeClause(id){ clauses = clauses.filter(c=>c.id!==id); renderClauses(); }
function renderClauses(){
  clausesEl.innerHTML='';
  if(!clauses.length){ clausesEl.innerHTML='<div class="empty">No clauses. Add one.</div>'; return; }
  for(const c of clauses){
    const row=document.createElement('div'); row.className='clause-row';
    row.innerHTML=`<select data-part="field">${FILTER_FIELDS.map(f=>`<option ${f===c.field?'selected':''}>${f}</option>`).join('')}</select>
      <select data-part="op">${[...SIMPLE_OPERATORS,...FUNCTION_OPERATORS].map(o=>`<option ${o===c.op?'selected':''}>${o}</option>`).join('')}</select>
      <input data-part="value" placeholder="value" value="${c.value.replace(/"/g,'&quot;')}" />
      <button class="btn remove-clause" data-remove="${c.id}" title="Remove">✕</button>`;
    row.querySelector('[data-part="field"]').addEventListener('change',e=>{ c.field=e.target.value; saveState(); });
    row.querySelector('[data-part="op"]').addEventListener('change',e=>{ c.op=e.target.value; saveState(); });
    row.querySelector('[data-part="value"]').addEventListener('input',e=>{ c.value=e.target.value; saveState(); });
    row.querySelector('[data-remove]').addEventListener('click',()=>removeClause(c.id));
    clausesEl.appendChild(row);
  }
  saveState();
}

// ----- Filter Assembly -----
function escapeValue(v){ return v.replace(/'/g,"''"); }
function buildFilterString(includePrimary){
  const parts=[];
  for(const c of clauses){
    if(!c.value.trim()) continue;
    if(FUNCTION_OPERATORS.includes(c.op)) parts.push(`${c.op}(${c.field},'${escapeValue(c.value.trim())}')`);
    else parts.push(`${c.field} eq '${escapeValue(c.value.trim())}'`);
  }
  if(includePrimary) parts.push(`meterRegion eq 'primary'`);
  return parts.join(' and ');
}

function buildApiUrl({ next=false }={}){
  if(next && nextPageLink) return nextPageLink;
  const base='https://prices.azure.com/api/retail/prices';
  const params=new URLSearchParams();
  const apiVer=apiVersionInput.value.trim();
  if(apiVer) params.set('api-version', apiVer);
  const cur=currencyInput.value.trim();
  if(cur) params.set('currencyCode', cur);
  const f=buildFilterString(primaryRegionOnlyChk.checked);
  if(f) params.set('$filter', f);
  return `${base}?${params.toString()}`;
}

// ----- Fetch Logic -----
function mergeAbortSignals(signals){
  const controller=new AbortController();
  for(const s of signals) s && s.addEventListener('abort',()=>controller.abort(s.reason),{ once:true });
  return controller;
}
async function fetchWithTimeout(url, ms, signal){
  const timeoutCtrl=new AbortController();
  const tid=setTimeout(()=>timeoutCtrl.abort('timeout'), ms);
  const combo=mergeAbortSignals([signal, timeoutCtrl.signal]);
  try{ return await fetch(url,{ signal: combo.signal }); }
  finally{ clearTimeout(tid); }
}

async function runSearch({ append=false }={}){
  if(!append){ allRows=[]; nextPageLink=null; }
  setBusy(true);
  const limit=parseInt(rowLimitInput.value)||2000;
  const timeoutMs=(parseInt(timeoutInput.value)||30)*1000;
  abortController?.abort();
  abortController=new AbortController();
  try {
    let url=buildApiUrl({ next: append });
    status(`Fetching...`);
    while(true){
      const res=await fetchWithTimeout(url, timeoutMs, abortController.signal);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      allRows.push(...data.Items);
      nextPageLink=data.NextPageLink||null;
      status(`Fetched ${allRows.length}${nextPageLink?' (more...)':''}`);
      if(allRows.length>=limit) break;
      if(!nextPageLink) break;
      url=nextPageLink;
      if(abortController.signal.aborted) break;
    }
    updateTable();
    exportBtn.disabled = !allRows.length;
    copyUrlBtn.disabled = false;
    loadMoreBtn.disabled = !nextPageLink;
  } catch(e){
    if(abortController.signal.aborted) status('Cancelled'); else status('Error: '+e.message);
  } finally {
    setBusy(false);
  }
}

function setBusy(b){
  runBtn.disabled=b; cancelBtn.hidden=!b; addClauseBtn.disabled=b; clearClausesBtn.disabled=b; loadMoreBtn.disabled=b || !nextPageLink; }

// ----- Table Rendering -----
function updateTable(){
  if(!allRows.length){ tableEl.innerHTML=''; return; }
  const headers = COLUMN_ORDER.filter(h=>allRows[0].hasOwnProperty(h));
  const quick=quickFilterInput.value.toLowerCase();
  let rows=allRows.filter(r=>!quick || JSON.stringify(r).toLowerCase().includes(quick));
  if(sorting.key){ rows=[...rows].sort((a,b)=>{ const av=a[sorting.key]; const bv=b[sorting.key]; if(av==null) return -1; if(bv==null) return 1; return String(av).localeCompare(String(bv),undefined,{ numeric:true })*(sorting.dir==='asc'?1:-1); }); }
  const thead = `<thead><tr>${headers.map(h=>`<th data-col="${h}" class="${sorting.key===h?'sort-'+sorting.dir:''}">${h}</th>`).join('')}</tr></thead>`;
  const tbody = '<tbody>'+rows.map(r=>`<tr>${headers.map(h=>`<td>${formatCell(r[h])}</td>`).join('')}</tr>`).join('')+'</tbody>';
  tableEl.innerHTML=thead+tbody;
  tableEl.querySelectorAll('th').forEach(th=> th.addEventListener('click',()=>toggleSort(th.dataset.col)) );
}
function formatCell(v){ if(v==null) return ''; if(typeof v==='number') return v.toString(); if(/\d{4}-\d{2}-\d{2}T/.test(v)) return v.split('T')[0]; return String(v); }
function toggleSort(col){ if(sorting.key===col) sorting.dir= sorting.dir==='asc'?'desc':(sorting.dir==='desc'?null:'asc'); else { sorting.key=col; sorting.dir='asc'; } if(!sorting.dir){ sorting.key=null; } updateTable(); }

// ----- Persistence -----
function saveState(){
  const st={ clauses, currency:currencyInput.value, apiVer:apiVersionInput.value, limit:rowLimitInput.value, timeout:timeoutInput.value, primary:primaryRegionOnlyChk.checked, theme:document.body.classList.contains('dark')?'dark':'light' };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
}
function restoreState(){
  try{ const st=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); if(st.clauses){ clauses=st.clauses; renderClauses(); }
    currencyInput.value=st.currency||''; apiVersionInput.value=st.apiVer||'2023-01-01-preview'; rowLimitInput.value=st.limit||2000; timeoutInput.value=st.timeout||30; primaryRegionOnlyChk.checked=!!st.primary; if(st.theme==='dark') document.body.classList.add('dark'); }catch{} }

// ----- Examples -----
const EXAMPLES=[
  { label:"VM service", clauses:[{field:'serviceName',op:'eq',value:'Virtual Machines'}] },
  { label:"Contains windows", clauses:[{field:'productName',op:'contains',value:'Windows'}] },
  { label:"East US region", clauses:[{field:'armRegionName',op:'eq',value:'eastus'}] }
];
function renderExamples(){
  EXAMPLES.forEach(ex=>{ const b=document.createElement('button'); b.className='btn subtle'; b.textContent=ex.label; b.addEventListener('click',()=>{ clauses=ex.clauses.map(c=>({id:crypto.randomUUID(),...c})); renderClauses(); }); examplesEl.appendChild(b); });
}

// ----- Utility -----
function status(msg){ statusBar.textContent=msg; }

// ----- Event Wiring -----
addClauseBtn.addEventListener('click',()=>addClause());
clearClausesBtn.addEventListener('click',()=>{ clauses=[]; renderClauses(); });
runBtn.addEventListener('click',()=>runSearch());
cancelBtn.addEventListener('click',()=>abortController?.abort('cancelled'));
loadMoreBtn.addEventListener('click',()=>{ if(nextPageLink) runSearch({ append:true }); });
exportBtn.addEventListener('click',()=>exportToCsv('azure-meters.csv', allRows, COLUMN_ORDER));
copyUrlBtn.addEventListener('click', async ()=>{ const url=buildApiUrl(); await navigator.clipboard.writeText(url); status('API URL copied'); });
quickFilterInput.addEventListener('input',()=>updateTable());
themeToggle.addEventListener('click',()=>{ document.body.classList.toggle('dark'); saveState(); });
document.addEventListener('keydown',e=>{ if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){ runSearch(); }});

// ----- Init -----
restoreState();
if(!clauses.length) addClause();
renderExamples();
status('Idle');


