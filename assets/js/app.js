/* Azure Retail Prices Explorer - Client-side app */
(() => {
  const API_BASE = 'https://prices.azure.com/api/retail/prices';
  const dom = {
    logic: document.getElementById('logic'),
    currency: document.getElementById('currency'),
    apiVersion: document.getElementById('apiVersion'),
    primaryOnly: document.getElementById('primaryOnly'),
    conditions: document.getElementById('conditions'),
    conditionRowTemplate: document.getElementById('conditionRowTemplate'),
    rawFilter: document.getElementById('rawFilter'),
    advancedToggle: document.getElementById('advancedToggle'),
    advancedArea: document.getElementById('advancedArea'),
    searchForm: document.getElementById('searchForm'),
    runSearchBtn: document.getElementById('runSearchBtn'),
    resetBtn: document.getElementById('resetBtn'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    urlPreview: document.getElementById('urlPreview'),
    status: document.getElementById('status'),
    tableWrap: document.getElementById('tableWrap'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    exportAllCsvBtn: document.getElementById('exportAllCsvBtn'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    countBadge: document.getElementById('countBadge'),
    timing: document.getElementById('timing'),
    examples: document.querySelectorAll('.example'),
    aboutBtn: document.getElementById('aboutBtn'),
    aboutCard: document.getElementById('aboutCard'),
    repoLink: document.getElementById('repoLink'),
    addConditionBtn: document.getElementById('addConditionBtn'),
    searchTitle: document.getElementById('searchTitle')
  };

  const state = {
    items: [],
    nextPageLink: null,
    prevLinks: [],
    lastQueryUrl: null,
    sort: { key: null, direction: 'asc' }
  };

  const FILTERABLE_FIELDS = [
    'armRegionName', 'location', 'meterId', 'meterName', 'productId',
    'skuId', 'productName', 'skuName', 'serviceName', 'serviceId',
    'serviceFamily', 'priceType', 'armSkuName'
  ];

  function createConditionRow(field = 'serviceName', operator = 'eq', value = '') {
    const tpl = dom.conditionRowTemplate.content.firstElementChild.cloneNode(true);
    const fieldSel = tpl.querySelector('[data-field]');
    const opSel = tpl.querySelector('[data-operator]');
    const valInp = tpl.querySelector('[data-value]');

    // Populate field list from FILTERABLE_FIELDS (ensure template selection is in sync)
    fieldSel.innerHTML = FILTERABLE_FIELDS.map(f => `<option value="${f}">${f}</option>`).join('');
    fieldSel.value = field;
    opSel.value = operator;
    valInp.value = value;

    tpl.querySelector('[data-remove]').addEventListener('click', () => {
      tpl.remove();
      syncUrlPreview();
    });

    [fieldSel, opSel, valInp].forEach(el => el.addEventListener('input', syncUrlPreview));

    return tpl;
  }

  function addCondition(field, operator, value) {
    const row = createConditionRow(field, operator, value);
    dom.conditions.appendChild(row);
    syncUrlPreview();
  }

  function clearConditions() {
    dom.conditions.innerHTML = '';
  }

  function escapeODataString(str) {
    return String(str).replace(/'/g, "''");
  }

  function buildFilterFromConditions() {
    const logic = dom.logic.value || 'and';
    const rowEls = [...dom.conditions.querySelectorAll('[data-row]')];
    const parts = rowEls.map(row => {
      const field = row.querySelector('[data-field]').value;
      const operator = row.querySelector('[data-operator]').value;
      const value = row.querySelector('[data-value]').value.trim();
      if (!value) return null;
      if (operator === 'eq') {
        // All filterable fields are strings per docs -> quote string values
        return `${field} eq '${escapeODataString(value)}'`;
      }
      // OData string functions
      return `${operator}(${field},'${escapeODataString(value)}')`;
    }).filter(Boolean);
    return parts.join(` ${logic} `);
  }

  function buildQueryUrl(useRaw = false, pageUrl = null) {
    let url = new URL(API_BASE);
    const params = url.searchParams;
    const apiVersion = dom.apiVersion.value;
    const currency = dom.currency.value;
    const primaryOnly = dom.primaryOnly.checked;

    if (apiVersion) params.set('api-version', apiVersion);
    if (currency) params.set('currencyCode', `'${currency}'`);

    let filter = '';
    if (useRaw) {
      filter = dom.rawFilter.value.trim();
    } else {
      filter = buildFilterFromConditions();
    }
    if (filter) params.set('$filter', filter);
    if (primaryOnly) params.set('meterRegion', 'primary');

    return url.toString();
  }

  function syncUrlPreview() {
    const usingRaw = dom.advancedToggle.checked;
    const url = buildQueryUrl(usingRaw);
    dom.urlPreview.textContent = url;
    dom.runSearchBtn.disabled = false;
    dom.copyLinkBtn.disabled = !url;
    dom.status.textContent = 'Ready to search';
  }

  async function fetchPrices(url) {
    const started = performance.now();
    dom.status.textContent = 'Querying Retail Prices API…';
    dom.runSearchBtn.disabled = true;
    dom.exportCsvBtn.disabled = true;
    dom.exportAllCsvBtn.disabled = true;
    dom.nextPageBtn.disabled = true;
    dom.prevPageBtn.disabled = state.prevLinks.length === 0;
    dom.tableWrap.innerHTML = `<div class="muted">Loading…</div>`;

    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      state.items = data.Items || [];
      state.nextPageLink = data.NextPageLink || null;
      state.lastQueryUrl = url;

      renderTable(state.items);
      dom.countBadge.textContent = `${state.items.length.toLocaleString()} rows`;
      dom.nextPageBtn.disabled = !state.nextPageLink;
      dom.prevPageBtn.disabled = state.prevLinks.length === 0;
      dom.exportCsvBtn.disabled = state.items.length === 0;
      dom.exportAllCsvBtn.disabled = !data.NextPageLink && state.items.length === 0;

      const ms = Math.round(performance.now() - started);
      dom.timing.textContent = `Fetched in ${ms} ms`;
      dom.status.textContent = state.nextPageLink ? 'Page 1 of many (use Next →)' : 'Done';
    } catch (err) {
      console.error(err);
      dom.tableWrap.innerHTML = '';
      dom.status.innerHTML = `<span style="color: var(--danger)">Error</span>: ${err.message}`;
      dom.countBadge.textContent = '0';
      dom.timing.textContent = '';
    } finally {
      dom.runSearchBtn.disabled = false;
    }
  }

  function renderTable(items) {
    if (!items || items.length === 0) {
      dom.tableWrap.innerHTML = `<div class="muted">No results</div>`;
      return;
    }

    // Select a curated set of columns; include savings plan summary if present
    const columns = [
      'currencyCode','retailPrice','unitPrice','unitOfMeasure',
      'armRegionName','location','effectiveStartDate',
      'serviceFamily','serviceName','productName','skuName',
      'meterName','priceType','isPrimaryMeterRegion','armSkuName'
    ];

    const header = `<thead><tr>${columns.map(c => `<th class="sortable" data-key="${c}" tabindex="0" aria-sort="none">${c}</th>`).join('')}</tr></thead>`;
    const rows = items.map(item => {
      const values = columns.map(c => {
        if (c === 'effectiveStartDate' && item[c]) {
          return new Date(item[c]).toISOString().slice(0,10);
        }
        return item[c] != null ? String(item[c]) : '';
      });
      return `<tr>${values.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`;
    }).join('');

    const table = document.createElement('table');
    table.innerHTML = header + `<tbody>${rows}</tbody>`;
    dom.tableWrap.innerHTML = '';
    dom.tableWrap.appendChild(table);

    // sortable headers
    table.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => onSort(th.dataset.key));
      th.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSort(th.dataset.key);
        }
      });
    });
  }

  function onSort(key) {
    if (state.sort.key === key) {
      state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      state.sort.key = key;
      state.sort.direction = 'asc';
    }
    // Update header aria-sort
    const ths = dom.tableWrap.querySelectorAll('th.sortable');
    ths.forEach(th => {
      th.setAttribute('aria-sort', th.dataset.key === key ? (state.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    });
    // Sort items (non-destructive copy)
    const sorted = [...state.items].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return state.sort.direction === 'asc' ? av - bv : bv - av;
      }
      return state.sort.direction === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    renderTable(sorted);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function toCsv(items) {
    // Flatten items and include savings plan summary if present
    const columns = [
      'currencyCode','retailPrice','unitPrice','unitOfMeasure',
      'armRegionName','location','effectiveStartDate',
      'serviceFamily','serviceName','productName','skuName',
      'meterName','priceType','isPrimaryMeterRegion','armSkuName'
    ];
    const header = columns.join(',');
    const lines = [header];
    for (const it of items) {
      const row = columns.map(c => {
        let v = it[c];
        if (c === 'effectiveStartDate' && v) {
          v = new Date(v).toISOString();
        }
        if (v == null) v = '';
        const s = String(v).replace(/"/g, '""');
        return /[,"\n]/.test(s) ? `"${s}"` : s;
      }).join(',');
      lines.push(row);
    }
    return lines.join('\n');
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function fetchAllPagesAndExport() {
    if (!state.lastQueryUrl) return;
    dom.status.textContent = 'Fetching all pages…';
    const all = [];
    let url = state.lastQueryUrl;
    const start = performance.now();
    try {
      // Fetch first page again to simplify logic
      let res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = await res.json();
      all.push(...(data.Items || []));
      let next = data.NextPageLink;
      let pages = 1;
      // Hard cap to avoid runaway fetches
      const MAX_PAGES = 50; // ~50k rows
      while (next && pages < MAX_PAGES) {
        res = await fetch(next, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        all.push(...(data.Items || []));
        next = data.NextPageLink;
        pages++;
      }
      const csv = toCsv(all);
      download('azure-retail-prices.csv', csv);
      dom.status.textContent = `Exported ${all.length.toLocaleString()} rows`;
      const ms = Math.round(performance.now() - start);
      dom.timing.textContent = `Fetched + exported in ${ms} ms`;
    } catch (err) {
      dom.status.innerHTML = `<span style="color: var(--danger)">Error</span>: ${err.message}`;
    }
  }

  function copyLink() {
    const url = buildQueryUrl(dom.advancedToggle.checked);
    // Put query params in the location hash for shareability
    const share = new URL(location.href);
    const params = share.searchParams;
    params.set('api', dom.apiVersion.value);
    params.set('cur', dom.currency.value);
    params.set('primary', dom.primaryOnly.checked ? '1' : '0');
    params.set('mode', dom.advancedToggle.checked ? 'raw' : 'builder');
    if (dom.advancedToggle.checked) {
      params.set('filter', dom.rawFilter.value.trim());
    } else {
      // Serialize conditions
      const rows = [...dom.conditions.querySelectorAll('[data-row]')].map(row => ({
        f: row.querySelector('[data-field]').value,
        o: row.querySelector('[data-operator]').value,
        v: row.querySelector('[data-value]').value
      }));
      params.set('logic', dom.logic.value);
      params.set('conds', btoa(unescape(encodeURIComponent(JSON.stringify(rows)))));
    }
    share.search = params.toString();
    navigator.clipboard.writeText(share.toString()).then(() => {
      dom.status.textContent = 'Link copied to clipboard';
    }).catch(() => {
      dom.status.textContent = 'Unable to copy link';
    });
  }

  function restoreFromUrl() {
    const p = new URL(location.href).searchParams;
    const api = p.get('api') || '2023-01-01-preview';
    const cur = p.get('cur') || '';
    const primary = p.get('primary') === '1';
    const mode = p.get('mode') || 'builder';
    dom.apiVersion.value = api;
    dom.currency.value = cur;
    dom.primaryOnly.checked = primary;
    dom.advancedToggle.checked = mode === 'raw';
    toggleAdvanced(dom.advancedToggle.checked);
    if (mode === 'raw') {
      dom.rawFilter.value = p.get('filter') || '';
    } else {
      clearConditions();
      const logic = p.get('logic') || 'and';
      dom.logic.value = logic;
      const s = p.get('conds');
      if (s) {
        try {
          const rows = JSON.parse(decodeURIComponent(escape(atob(s))));
          rows.forEach(r => addCondition(r.f, r.o, r.v));
        } catch {}
      }
      if (dom.conditions.childElementCount === 0) {
        addCondition('serviceName', 'eq', '');
      }
    }
    syncUrlPreview();
  }

  function toggleAdvanced(on) {
    dom.advancedArea.classList.toggle('hidden', !on);
    dom.conditions.classList.toggle('hidden', on);
    dom.searchTitle.textContent = on ? 'Advanced: raw $filter' : 'Build a query';
  }

  // Event wiring
  dom.advancedToggle.addEventListener('change', e => {
    toggleAdvanced(e.target.checked);
    syncUrlPreview();
  });
  dom.addConditionBtn.addEventListener('click', () => addCondition('serviceName', 'eq', ''));
  dom.resetBtn.addEventListener('click', () => {
    dom.apiVersion.value = '2023-01-01-preview';
    dom.currency.value = '';
    dom.primaryOnly.checked = false;
    dom.logic.value = 'and';
    dom.advancedToggle.checked = false;
    toggleAdvanced(false);
    clearConditions();
    addCondition('serviceName', 'eq', '');
    dom.rawFilter.value = '';
    dom.tableWrap.innerHTML = '';
    dom.status.textContent = 'Reset';
    dom.countBadge.textContent = '0';
    dom.timing.textContent = '';
    dom.urlPreview.textContent = '';
  });

  dom.copyLinkBtn.addEventListener('click', copyLink);

  dom.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.prevLinks = [];
    const url = buildQueryUrl(dom.advancedToggle.checked);
    syncUrlPreview();
    fetchPrices(url);
  });

  dom.prevPageBtn.addEventListener('click', () => {
    const prev = state.prevLinks.pop();
    if (prev) fetchPrices(prev);
  });
  dom.nextPageBtn.addEventListener('click', () => {
    if (!state.nextPageLink) return;
    state.prevLinks.push(state.lastQueryUrl);
    fetchPrices(state.nextPageLink);
  });

  dom.exportCsvBtn.addEventListener('click', () => {
    if (state.items.length) {
      const csv = toCsv(state.items);
      download('azure-retail-prices-page.csv', csv);
    }
  });
  dom.exportAllCsvBtn.addEventListener('click', fetchAllPagesAndExport);

  dom.examples.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.advancedToggle.checked = true;
      toggleAdvanced(true);
      dom.rawFilter.value = btn.dataset.filter;
      dom.currency.value = '';
      syncUrlPreview();
    });
  });

  dom.aboutBtn.addEventListener('click', () => {
    dom.aboutCard.hidden = !dom.aboutCard.hidden;
  });

  // Docs link
  dom.repoLink.href = 'https://learn.microsoft.com/rest/api/cost-management/retail-prices/azure-retail-prices';

  // Initialize
  if (new URL(location.href).search) {
    restoreFromUrl();
  } else {
    addCondition('serviceName', 'eq', '');
    syncUrlPreview();
  }
})();