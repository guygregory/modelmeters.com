import { markerRadius, parsePrices, summarizeRegions } from './data.mjs';

const byId = id => document.getElementById(id);
const search = byId('meter-search');
const match = byId('meter-match');
const flyout = byId('region-flyout');
const params = new URLSearchParams(location.search);
let rows = [];
let locations = {};
let summaries = [];
let names = [];
let maximum = 1;
let selectedId = null;
let selectionOrigin = null;
let globe = null;
let filterTimer;

function applyTheme(mode) {
	if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
	else document.documentElement.removeAttribute('data-theme');
	const label = `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`;
	const button = byId('btn-theme');
	button.title = label;
	button.setAttribute('aria-label', label);
	button.setAttribute('aria-pressed', String(mode === 'dark'));
	button.firstElementChild.className = `ui-icon icon-${mode === 'dark' ? 'sun' : 'moon'}`;
	try { localStorage.setItem('priceExplorerTheme', mode); } catch {}
	globe?.updateTheme();
}

let savedTheme = 'light';
try { savedTheme = localStorage.getItem('priceExplorerTheme') || 'light'; } catch {}
applyTheme(params.get('theme') || savedTheme);
byId('btn-theme').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
search.value = params.get('meter') || '';
match.value = params.get('match') === 'exact' ? 'exact' : 'contains';

function updateURL() {
	const url = new URL(location.href);
	if (search.value.trim()) {
		url.searchParams.set('meter', search.value.trim());
		url.searchParams.set('match', match.value);
	} else {
		url.searchParams.delete('meter');
		url.searchParams.delete('match');
	}
	if (selectedId !== null) url.searchParams.set('region', selectedId);
	else url.searchParams.delete('region');
	history.replaceState(null, '', url);
}

function updateSuggestions() {
	const needle = search.value.toLowerCase();
	byId('meter-names').replaceChildren(...names.filter(name => name.toLowerCase().includes(needle)).slice(0, 100).map(name => {
		const option = document.createElement('option');
		option.value = name;
		return option;
	}));
}

function renderDirectory(list, regions) {
	list.replaceChildren(...regions.map(region => {
		const item = document.createElement('li');
		const button = document.createElement('button');
		button.className = 'region-row';
		button.dataset.region = region.id;
		button.setAttribute('aria-pressed', String(selectedId === region.id));
		button.setAttribute('aria-label', `${region.name}: ${region.count.toLocaleString()} price meters`);
		const label = document.createElement('span');
		label.className = 'region-row-name';
		label.textContent = region.name;
		const code = document.createElement('small');
		code.textContent = region.id || '(blank ARM region)';
		label.append(code);
		const count = document.createElement('span');
		count.className = 'region-row-count';
		count.textContent = region.count.toLocaleString();
		button.append(label, count);
		button.addEventListener('click', () => openRegion(region.id, button));
		item.append(button);
		return item;
	}));
}

function updateFilters() {
	summaries = summarizeRegions(rows, locations, search.value, match.value);
	const mapped = summaries.filter(region => region.location);
	const unmapped = summaries.filter(region => !region.location);
	byId('mapped-count').textContent = mapped.length.toLocaleString();
	byId('meter-count').textContent = summaries.reduce((total, region) => total + region.count, 0).toLocaleString();
	byId('unmapped-count').textContent = String(unmapped.length);
	byId('unmapped-section').hidden = !unmapped.length;
	byId('directory-status').hidden = !!summaries.length;
	byId('directory-status').textContent = 'No matching price meters.';
	byId('map-empty').hidden = !!mapped.length || !globe;
	byId('clear-search').disabled = !search.value;
	if (selectedId !== null && !summaries.some(region => region.id === selectedId)) closeRegion(false);
	renderDirectory(byId('region-list'), mapped);
	renderDirectory(byId('unmapped-list'), unmapped);
	globe?.setRegions(summaries, maximum, selectedId);
	if (selectedId !== null) renderSummary();
	updateSuggestions();
	updateURL();
}

function renderSummary() {
	const region = summaries.find(entry => entry.id === selectedId);
	if (!region) return;
	byId('region-title').textContent = region.name;
	byId('region-code').textContent = region.id || '(blank ARM region)';
	byId('region-place').textContent = region.location ? `${region.location.place} (approximate)` : 'No geographic coordinates; not plotted on the globe.';
	byId('region-meter-count').textContent = region.count.toLocaleString();
	byId('region-product-count').textContent = region.products.length.toLocaleString();
	byId('region-filter').hidden = !search.value.trim();
	byId('region-filter').textContent = `Meter ${match.value === 'exact' ? 'name' : 'contains'}: ${search.value.trim()}`;
	const largestProduct = region.products[0]?.count || 1;
	byId('product-counts').replaceChildren(...region.products.map(product => {
		const row = document.createElement('tr');
		const label = document.createElement('td');
		label.textContent = product.name;
		const bar = document.createElement('span');
		bar.className = 'product-bar';
		bar.style.setProperty('--share', `${product.count / largestProduct * 100}%`);
		bar.setAttribute('aria-hidden', 'true');
		label.append(bar);
		const count = document.createElement('td');
		count.textContent = product.count.toLocaleString();
		row.append(label, count);
		return row;
	}));
}

function openRegion(id, origin, focus = true) {
	const region = summaries.find(entry => entry.id === id);
	if (!region) return;
	selectedId = id;
	selectionOrigin = origin;
	renderSummary();
	flyout.hidden = false;
	for (const button of document.querySelectorAll('.region-row')) button.setAttribute('aria-pressed', String(button.dataset.region === id));
	globe?.select(id);
	if (region.location && focus) globe?.focus(region.location);
	byId('close-region').focus({ preventScroll: true });
	updateURL();
}

function closeRegion(restoreFocus = true) {
	selectedId = null;
	flyout.hidden = true;
	globe?.select(null);
	for (const button of document.querySelectorAll('.region-row')) button.setAttribute('aria-pressed', 'false');
	if (restoreFocus) (selectionOrigin?.isConnected && !selectionOrigin.hidden ? selectionOrigin : search).focus({ preventScroll: true });
	updateURL();
}

byId('close-region').addEventListener('click', () => closeRegion());
document.addEventListener('keydown', event => {
	if (event.key === 'Escape' && !flyout.hidden) {
		event.preventDefault();
		closeRegion();
	}
});
search.addEventListener('input', () => {
	clearTimeout(filterTimer);
	filterTimer = setTimeout(updateFilters, 100);
});
match.addEventListener('change', () => {
	clearTimeout(filterTimer);
	updateFilters();
});
byId('clear-search').addEventListener('click', () => {
	clearTimeout(filterTimer);
	search.value = '';
	updateFilters();
	search.focus();
});
byId('zoom-in').addEventListener('click', () => globe?.zoom(0.8));
byId('zoom-out').addEventListener('click', () => globe?.zoom(1.25));
byId('reset-view').addEventListener('click', () => globe?.reset());
byId('retry').addEventListener('click', () => location.reload());

async function fetchText(url) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
	return response.text();
}

function mapUnavailable() {
	byId('map-status').hidden = false;
	byId('map-status').classList.add('is-error');
	byId('map-status-text').textContent = '3D map unavailable. Price meters are still accessible in the region list.';
	byId('retry').hidden = false;
	byId('map-empty').hidden = true;
	for (const id of ['zoom-in', 'zoom-out', 'reset-view']) byId(id).disabled = true;
	globe?.destroy();
	globe = null;
}

async function loadMap() {
	try {
		const [{ RegionGlobe }, topologyText] = await Promise.all([
			import('./globe.mjs'), fetchText('vendor/countries-110m.json')
		]);
		globe = new RegionGlobe(byId('globe'), JSON.parse(topologyText), openRegion, mapUnavailable);
		globe.setRegions(summaries, maximum, selectedId);
		const selection = summaries.find(region => region.id === selectedId);
		if (selection?.location) globe.focus(selection.location);
		byId('map-status').hidden = true;
		byId('map-empty').hidden = summaries.some(region => region.location);
		for (const id of ['zoom-in', 'zoom-out', 'reset-view']) byId(id).disabled = false;
	} catch {
		mapUnavailable();
	}
}

function renderScale() {
	byId('marker-scale').replaceChildren(...[Math.max(1, Math.round(maximum / 16)), Math.max(1, Math.round(maximum / 4)), maximum].map(count => {
		const item = document.createElement('span');
		item.className = 'scale-item';
		const dot = document.createElement('span');
		dot.className = 'scale-dot';
		const diameter = markerRadius(count, maximum) * 700;
		dot.style.width = `${diameter}px`;
		dot.style.height = `${diameter}px`;
		item.append(dot, count.toLocaleString());
		return item;
	}));
}

async function load() {
	try {
		const [pricesText, locationsText] = await Promise.all([fetchText('../prices.ndjson'), fetchText('locations.json')]);
		rows = parsePrices(pricesText);
		locations = JSON.parse(locationsText);
		names = [...new Set(rows.map(row => row.meterName))].sort((first, second) => first.localeCompare(second));
		maximum = Math.max(1, ...summarizeRegions(rows, locations).map(region => region.count));
		search.disabled = false;
		match.disabled = false;
		updateFilters();
		renderScale();
		if (params.has('region')) openRegion(params.get('region'), search, false);
		await loadMap();
	} catch {
		byId('map-status').classList.add('is-error');
		byId('map-status-text').textContent = 'Price meters could not be loaded.';
		byId('retry').hidden = false;
		byId('directory-status').textContent = 'Price data unavailable.';
	}
}

fetchText('../metadata.json').then(text => {
	byId('last-updated').textContent = JSON.parse(text).last_updated || 'Unknown';
}).catch(() => { byId('last-updated').textContent = 'Unknown'; });
load();