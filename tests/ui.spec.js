const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const baseURL = process.env.MODELMETERS_URL || 'http://127.0.0.1:8000';
test.use({ launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

test('archive generation retains the shared layout and rendered content', async ({ page }) => {
	const generated = execFileSync('python', ['-c', 'import runpy; module = runpy.run_path("consolidate-ai-summaries.py"); print(module["build_html"]([("2026-09-01", "# 1 September 2026\\n\\nSeptember fixture"), ("2026-08-01", "# 1 August 2026\\n\\nAugust fixture")]))'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.route('**/monthly/generated.html', interception => interception.fulfill({ contentType: 'text/html', body: generated }));
	await page.goto(new URL('/monthly/generated.html', baseURL).href);
	await expect(page.locator('h1').first()).toHaveText('Monthly summary archive');
	await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', '../site.css');
	await expect(page.getByRole('link', { name: 'Regions', exact: true })).toHaveAttribute('href', '../regions/index.html');
	await expect(page.locator('.article')).toHaveCount(2);
	await expect(page.locator('.article').first()).toContainText('September fixture');
	await expect(page.locator('.article').nth(1)).toHaveClass(/collapsed/);
	await page.locator('.month-title').nth(1).press('Enter');
	await expect(page.locator('.article').nth(1)).not.toHaveClass(/collapsed/);
	await page.locator('#btn-theme').click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect(errors).toEqual([]);
});

for (const route of ['/', '/github/']) {
test(`${route} fits 20 desktop rows without shrinking text`, async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(new URL(route, baseURL).href);
	await expect(page.locator('#tbody tr')).toHaveCount(20);
	await expect(page.locator('#tbody td[data-column="productName"]').first()).toHaveCSS('font-size', '13px');
	const tableViewport = await page.locator('.table-wrap').evaluate(element => {
		const bounds = element.getBoundingClientRect();
		return { top: bounds.top, bottom: bounds.top + element.clientHeight };
	});
	const firstRow = await page.locator('#tbody tr').first().boundingBox();
	const lastRow = await page.locator('#tbody tr').last().boundingBox();
	expect(firstRow.y).toBeGreaterThanOrEqual(tableViewport.top);
	expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(tableViewport.bottom);
	await page.screenshot({ path: testInfo.outputPath('compact-desktop.png') });
});

test(`${route} mobile footer information toggles without changing desktop`, async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(new URL(route, baseURL).href);
	await expect(page.locator('#tbody tr')).toHaveCount(20);
	const footer = page.locator('.table-footer');
	const toggle = page.getByRole('button', { name: 'Pricing information', exact: true });
	const desktopHeight = (await footer.boundingBox()).height;
	await expect(toggle).toBeHidden();
	await expect(page.locator('#meter-info')).toBeVisible();
	await expect(page.locator('#info-container')).toBeVisible();
	for (const width of [390, 320]) {
		await page.setViewportSize({ width, height: 844 });
		await expect(toggle).toBeVisible();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(page.locator('#meter-info')).toBeHidden();
		await expect(page.locator('#info-container')).toBeHidden();
		const collapsedHeight = (await footer.boundingBox()).height;
		expect(collapsedHeight).toBeLessThanOrEqual(54);
		const buttonBox = await toggle.boundingBox();
		const paginationBox = await page.locator('#pagination').boundingBox();
		expect(buttonBox.y).toBe(paginationBox.y);
		expect(buttonBox.x + buttonBox.width).toBeLessThan(paginationBox.x);
		expect(paginationBox.x + paginationBox.width).toBeLessThanOrEqual(width);
		await page.screenshot({ path: testInfo.outputPath(`footer-${width}-collapsed.png`) });
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(page.locator('#row-count')).toBeVisible();
		await expect(page.locator('#last-updated')).toBeVisible();
		await expect(page.locator('.attribution')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Disclaimer' })).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath(`footer-${width}-expanded.png`) });
		await toggle.press('Space');
		await expect(page.locator('#info-container')).toBeHidden();
		expect((await footer.boundingBox()).height).toBe(collapsedHeight);
		await page.locator('#btn-next').click();
		await expect(page.locator('#page-info')).toContainText('Page 2 /');
		await page.locator('#btn-first').click();
	}
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(toggle).toBeHidden();
	await expect(page.locator('#info-container')).toBeVisible();
	await expect(page.locator('#meter-info')).toBeVisible();
	expect((await footer.boundingBox()).height).toBe(desktopHeight);
});

test(`${route} preserves interactions and fits desktop/mobile`, async ({ page }, testInfo) => {
	const errors = [];
	const failedAssets = [];
	page.on('pageerror', error => errors.push(error.message));
	page.on('response', response => { if (response.status() >= 400) failedAssets.push(response.url()); });
	await page.setViewportSize({ width: 1440, height: 960 });
	await page.goto(new URL(route, baseURL).href);
	await expect(page.locator('#tbody tr')).toHaveCount(20, { timeout: 30000 });
	await expect(page.locator('#last-updated')).not.toHaveText(/Never|Unknown/);
	await expect(page.locator('.workspace-heading')).toHaveCount(0);
	await expect(page.locator('.card-hd .toolbar > button[title]:not([title=""])')).toHaveCount(6);
	expect(await page.locator('.card-hd .toolbar > button').evaluateAll(buttons => buttons.map(button => button.id))).toEqual(['btn-favorites', 'btn-export-csv', 'btn-share-url', 'btn-columns', 'btn-discount', 'btn-theme']);
	await expect(page.locator('.table-footer #last-updated')).toBeVisible();
	await expect(page.locator('.table-footer .attribution')).toContainText('Created by Guy Gregory + GitHub Copilot');
	await expect(page.locator('.table-footer a').filter({ hasText: 'Disclaimer' })).toBeVisible();
	expect((await page.locator('.card-hd').boundingBox()).height).toBeLessThanOrEqual(60);
	expect((await page.locator('.table-wrap').boundingBox()).y).toBeLessThanOrEqual(60);
	const expectedSort = route === '/' ? 'effectiveStartDate' : 'unitPrice';
	await expect(page.locator(`th[data-column="${expectedSort}"]`)).toHaveAttribute('aria-sort', 'descending');
	await page.locator('#btn-next').click();
	await expect(page.locator('#page-info')).toContainText('Page 2 /');
	await page.locator('#btn-prev').click();
	await expect(page.locator('#page-info')).toContainText('Page 1 /');
	await page.locator('#btn-last').click();
	expect(await page.evaluate(() => state.page)).toEqual(await page.evaluate(() => Math.ceil(data.length / state.pageSize)));
	await page.locator('#btn-first').click();
	await page.locator('#page-size').selectOption('15');
	await expect(page.locator('#tbody tr')).toHaveCount(15);
	await page.locator('#page-size').selectOption('20');
	await page.getByTitle('Sort Product', { exact: true }).click();
	await expect(page.locator('th[data-column="productName"]')).toHaveAttribute('aria-sort', 'ascending');
	await page.getByTitle('Filter Product', { exact: true }).click();
	await page.locator('#op-value').fill('no-such-model-xyz');
	await expect(page.locator('#tbody')).toContainText('No rows match filters');
	await page.locator('#btn-clear-filter').click();
	await expect(page.locator('#tbody tr')).toHaveCount(20);
	await page.keyboard.press('Escape');
	await page.getByTitle('Sort Start Date', { exact: true }).click();
	await page.getByTitle('Sort Start Date', { exact: true }).click();
	await page.locator('.table-wrap').evaluate(element => { element.scrollLeft = 0; });
	await page.mouse.move(0, 0);
	await page.screenshot({ path: testInfo.outputPath('desktop.png') });
	for (const [width, height] of [[1920, 1080], [1024, 768], [768, 1024], [390, 844], [320, 568], [667, 375]]) {
		await page.setViewportSize({ width, height });
		await expect(page.locator('#btn-columns')).toBeInViewport();
		await page.locator('#pagination').scrollIntoViewIfNeeded();
		await expect(page.locator('#pagination')).toBeInViewport();
		await page.locator('#btn-columns').scrollIntoViewIfNeeded();
		await page.locator('#btn-columns').click();
		const box = await page.locator('#menu-columns').boundingBox();
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(width);
		expect(box.y + box.height).toBeLessThanOrEqual(height);
		await page.keyboard.press('Escape');
		await expect(page.locator('.table-wrap')).not.toHaveJSProperty('clientHeight', 0);
		expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
	}
	await page.setViewportSize({ width: 390, height: 844 });
	await page.evaluate(() => scrollTo(0, 0));
	await page.screenshot({ path: testInfo.outputPath('mobile.png') });
	await page.locator('#btn-theme').click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.locator('#tbody tr')).toHaveCount(20);
	await page.screenshot({ path: testInfo.outputPath('mobile-dark.png') });
	await page.setViewportSize({ width: 1440, height: 960 });
	await page.screenshot({ path: testInfo.outputPath('desktop-dark.png') });
	expect(await page.evaluate(() => document.fonts.check('14px "IBM Plex Sans"'))).toBe(true);
	await expect(page.locator('.brand')).toHaveText('Model Meters');
	await expect(page.locator('.brand img')).toHaveCount(0);
	await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /img\/favicon\.png$/);
	await expect(page.locator('#btn-ai-summaries .icon-sparkles')).toBeVisible();
	expect(errors).toEqual([]);
	expect(failedAssets).toEqual([]);
});

test(`${route} retains columns, value selection, favorites, discount, CSV and sharing`, async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto(new URL(route, baseURL).href);
	await expect(page.locator('#tbody tr')).toHaveCount(20);
	await page.locator('#btn-favorites').click();
	await expect(page.locator('#shortcuts-list a').first()).toHaveAttribute('href', /^https?:/);
	await page.locator('#btn-favorites').click();
	await expect(page.locator('#menu-shortcuts')).not.toBeVisible();
	await page.locator('#btn-columns').click();
	await page.locator('#col-search').fill('Currency');
	await page.locator('#col-list input').uncheck();
	await expect(page.locator('th[data-column="currencyCode"]')).toHaveCount(0);
	await page.locator('#col-list input').check();
	await page.locator('#btn-show-all').click();
	await expect(page.locator('#thead th')).toHaveCount(20);
	await page.locator('#btn-hide-all').click();
	await expect(page.locator('#thead th')).toHaveCount(0);
	await page.locator('#btn-show-all').click();
	await page.keyboard.press('Escape');
	await page.reload();
	await expect(page.locator('#tbody tr')).toHaveCount(20);
	await page.getByTitle('Filter Currency', { exact: true }).click();
	await page.locator('#value-search').fill('USD');
	await expect(page.locator('#value-list label')).toHaveCount(1);
	await page.locator('#btn-value-hide-all').click();
	await expect(page.locator('#tbody')).toContainText('No rows match filters');
	await page.locator('#btn-value-show-all').click();
	await expect(page.locator('#tbody tr')).toHaveCount(20);
	await page.locator('#value-list input').uncheck();
	await expect(page.locator('#tbody')).toContainText('No rows match filters');
	await page.locator('#value-list input').check();
	await page.keyboard.press('Escape');
	const sample = await page.evaluate(() => data.find(row => row.unitPrice > 0));
	await page.getByTitle('Filter Meter Id', { exact: true }).click();
	await page.locator('#op-select').selectOption('equals');
	await page.locator('#op-value').fill(sample.meterId);
	await page.locator('#btn-apply-filter').click();
	await expect.poll(() => page.evaluate(() => state.filteredRows.every(row => row.meterId === state.filters.meterId.value))).toBe(true);
	await page.keyboard.press('Escape');
	const filteredCount = await page.evaluate(() => state.filteredRows.length);
	expect(filteredCount).toBeGreaterThan(0);
	await page.locator('#page-size').selectOption('100000');
	await expect(page.locator('#tbody tr')).toHaveCount(filteredCount);
	await page.locator('#page-size').selectOption('15');
	await page.locator('#btn-discount').click();
	await page.locator('#discount-value').fill('25');
	await page.locator('#discount-value').press('Enter');
	await expect(page.locator('#discount-indicator')).toContainText('25% discount');
	const expectedPrice = await page.evaluate(() => (state.filteredRows[0].unitPrice * .75).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }));
	await expect(page.locator('td[data-column="unitPrice"]').first()).toHaveText(expectedPrice);
	const downloadPromise = page.waitForEvent('download');
	await page.locator('#btn-export-csv').click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(route === '/' ? /^azure-prices-/ : /^github-prices-/);
	const stream = await download.createReadStream();
	const chunks = [];
	for await (const chunk of stream) chunks.push(chunk);
	const csv = Buffer.concat(chunks).toString();
	expect(csv.split('\n')).toHaveLength(filteredCount + 1);
	expect(csv.split('\n')[0]).toContain('productName,meterName,unitPrice,currencyCode');
	expect(csv).toContain(expectedPrice);
	await page.locator('#btn-share-url').click();
	await expect(page.locator('.notification')).toContainText('copied to clipboard');
	const shared = await page.evaluate(() => navigator.clipboard.readText());
	const sharedURL = new URL(shared);
	expect(sharedURL.searchParams.get('discount')).toBe('25');
	expect(sharedURL.searchParams.get('f_meterId')).toBe(`equals:${sample.meterId}`);
	expect(sharedURL.searchParams.get('pageSize')).toBe('15');
	await page.goto(shared);
	await expect(page.locator('#discount-indicator')).toContainText('25% discount');
	await expect(page.locator('td[data-column="unitPrice"]').first()).toHaveText(expectedPrice);
	await page.locator('#discount-reset-link').click();
	await expect(page.locator('#discount-indicator')).not.toBeVisible();
	await page.locator('#btn-theme').click();
	await page.locator('#btn-ai-summaries').click();
	await expect(page).toHaveURL(/\/agent\/\?theme=dark$/);
});

test(`${route} keeps loading and failure states usable`, async ({ page }) => {
	let release;
	const gate = new Promise(resolve => { release = resolve; });
	await page.route('**/prices*.ndjson', async interception => {
		await gate;
		await interception.fulfill({ status: 503, body: 'Unavailable' });
	});
	await page.goto(new URL(route, baseURL).href);
	await expect(page.locator('#loading')).toBeVisible();
	await expect(page.locator('#tbody')).toContainText('Loading price data');
	release();
	await expect(page.locator('#tbody')).toContainText('Error loading NDJSON');
	await expect(page.locator('#loading')).not.toBeVisible();
	await page.locator('#btn-theme').click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
}

for (const route of ['/agent/', '/monthly/']) {
test(`${route} centers desktop disclaimer and preserves mobile alignment`, async ({ page }) => {
	test.skip(route !== '/agent/', 'Disclaimer is specific to AI Summaries');
	await page.goto(new URL(route, baseURL).href);
	await expect(page.locator('.markdown-body').first()).toBeVisible({ timeout: 30000 });
	for (const width of [1440, 1024, 390, 320]) {
		await page.setViewportSize({ width, height: 960 });
		const textBounds = await page.locator('.summary-disclaimer > span').evaluate(element => {
			const range = document.createRange();
			range.selectNodeContents(element);
			const bounds = range.getBoundingClientRect();
			return { left: bounds.left, right: bounds.right };
		});
		if (width > 700) {
			expect((textBounds.left + textBounds.right) / 2).toBeCloseTo(width / 2, 0);
		} else {
			await expect(page.locator('.summary-disclaimer')).toHaveCSS('text-align', 'left');
			expect(textBounds.left).toBeCloseTo((await page.locator('.markdown-body').first().boundingBox()).x, 0);
		}
	}
});

test(`${route} retains summaries, deep links and responsive reading`, async ({ page }, testInfo) => {
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.setViewportSize({ width: 1440, height: 960 });
	await page.goto(new URL(route, baseURL).href);
	await expect(page.locator('.month-title').first()).toBeVisible({ timeout: 30000 });
	const article = page.locator('.article').first();
	const heading = article.locator('.month-title');
	if (route === '/agent/') {
		await expect(page.locator('.workspace-heading')).toHaveCount(0);
		await expect(page.locator('.card-hd .toolbar button')).toHaveCount(3);
		await expect(page.locator('.card-hd > .title')).toBeVisible();
		expect((await page.locator('.card-hd').boundingBox()).height).toBeLessThanOrEqual(60);
		await expect(heading).toHaveCSS('justify-content', 'flex-start');
		await expect(heading).toHaveCSS('text-align', 'left');
		await expect(article.locator('.markdown-body')).toHaveCSS('text-align', 'left');
		await expect(article.locator('.markdown-body > :first-child')).toHaveCSS('margin-top', '0px');
		const monthText = await heading.locator('h2').boundingBox();
		const summaryStart = await article.locator('.markdown-body > :first-child').boundingBox();
		expect(summaryStart.y - (monthText.y + monthText.height)).toBeLessThanOrEqual(24);
		const disclaimer = page.locator('.summary-disclaimer');
		await expect(disclaimer).toHaveText('AI-generated content may be incorrect. Always check live pricing.');
		await expect(disclaimer.locator('a')).toHaveAttribute('href', 'https://learn.microsoft.com/rest/api/cost-management/retail-prices/azure-retail-prices');
		await expect(disclaimer.locator('a')).toHaveAttribute('target', '_blank');
		await expect(disclaimer.locator('a')).toHaveAttribute('rel', 'noopener noreferrer');
		expect((await disclaimer.boundingBox()).height).toBeLessThanOrEqual(32);
		await page.evaluate(() => scrollTo(0, 600));
		await expect(disclaimer).toBeInViewport({ ratio: 1 });
		const topbar = await page.locator('.card-hd').boundingBox();
		expect(topbar.y).toBe(0);
		expect((await disclaimer.boundingBox()).y).toBe(topbar.y + topbar.height);
		await page.evaluate(() => scrollTo(0, 0));
	}
	await heading.click();
	await expect(article).toHaveClass(/collapsed/);
	await heading.press('Enter');
	await expect(article).not.toHaveClass(/collapsed/);
	await expect(article.locator('.markdown-body a').first()).toHaveAttribute('href', /^https?:/);
	await page.screenshot({ path: testInfo.outputPath('desktop.png') });
	const secondId = await page.locator('.article').nth(1).getAttribute('id');
	await page.goto(new URL(`${route}?theme=dark#${secondId}`, baseURL).href);
	await expect(page.locator(`article[id="${secondId}"] .month-title`)).toHaveAttribute('aria-expanded', 'true');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	for (const width of [390, 320]) {
		await page.setViewportSize({ width, height: 844 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
		if (route === '/agent/') {
			await page.evaluate(() => scrollTo(0, 0));
			await expect(page.locator('.card-hd > .title')).toBeHidden();
			for (const id of ['btn-rss', 'btn-back', 'btn-theme']) {
				await expect(page.locator(`.card-hd #${id}`)).toBeInViewport();
			}
			await expect(article.locator('.markdown-body')).toHaveCSS('text-align', 'left');
			await page.evaluate(() => scrollTo(0, 600));
			await expect(page.locator('.summary-disclaimer')).toBeInViewport({ ratio: 1 });
		}
	}
	await page.evaluate(() => scrollTo(0, 0));
	await page.screenshot({ path: testInfo.outputPath('mobile-dark.png') });
	await page.locator('#btn-theme').click();
	await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
	if (route === '/agent/') {
		const rss = await page.request.get(new URL('/agent/rss.xml', baseURL).href);
		expect(rss.ok()).toBe(true);
		await page.locator('#btn-rss').click();
		await expect(page).toHaveURL(/\/agent\/rss.xml$/);
		await page.goBack();
	}
	await page.locator('#btn-back').click();
	await expect(page.locator('#grid')).toBeVisible();
	expect(errors).toEqual([]);
});
}

test.describe('Regions', () => {
	test.describe.configure({ timeout: 60000 });

	const liveRows = readFileSync(path.resolve(__dirname, '../prices.ndjson'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
	const locations = JSON.parse(readFileSync(path.resolve(__dirname, '../regions/locations.json'), 'utf8'));
	const fixture = [
		{ armRegionName: 'eastus', meterName: 'Model input', productName: 'Product A', meterId: 'one' },
		{ armRegionName: 'EASTUS', meterName: 'Model input', productName: 'Product A', meterId: 'one' },
		{ armRegionName: 'eastus', meterName: 'Model input extended', productName: 'Product B', meterId: 'two' },
		{ armRegionName: 'westus', meterName: 'Model input', productName: 'Product A', meterId: 'one' },
		{ armRegionName: 'Global', meterName: 'Other output', productName: 'Product C', meterId: 'three' },
		{ armRegionName: '', meterName: 'Other output', productName: 'Product C', meterId: 'four' },
		{ armRegionName: 'newregion', meterName: 'Other output', productName: '<img src=x onerror=alert(1)>', meterId: 'five' }
	];
	const fixtureText = fixture.map(row => JSON.stringify(row)).join('\n');

	async function canvasPixels(page) {
		return page.locator('.globe-canvas').evaluate(canvas => {
			const context = canvas.getContext('webgl2');
			const pixels = new Uint8Array(canvas.width * canvas.height * 4);
			context.readPixels(0, 0, canvas.width, canvas.height, context.RGBA, context.UNSIGNED_BYTE, pixels);
			let filled = 0;
			let left = canvas.width;
			let right = 0;
			let top = canvas.height;
			let bottom = 0;
			let signature = 0;
			const colors = new Set();
			for (let row = 0; row < canvas.height; row += 4) {
				for (let column = 0; column < canvas.width; column += 4) {
					const offset = (row * canvas.width + column) * 4;
					if (pixels[offset + 3] < 100) continue;
					filled++;
					left = Math.min(left, column);
					right = Math.max(right, column);
					top = Math.min(top, row);
					bottom = Math.max(bottom, row);
					signature = (signature * 31 + pixels[offset] + pixels[offset + 1] * 257 + pixels[offset + 2] * 65537) >>> 0;
					colors.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`);
				}
			}
			return { filled, colors: colors.size, signature, left, right, top, bottom, width: canvas.width, height: canvas.height };
		});
	}

	test('counts distinct meters, filters names, and covers geographic ARM regions', async () => {
		const { parsePrices, summarizeRegions, markerRadius } = await import('../regions/data.mjs');
		const summary = summarizeRegions(parsePrices(fixtureText), locations);
		expect(summary.find(region => region.id === 'eastus').count).toBe(2);
		expect(summary.find(region => region.id === 'eastus').products).toEqual([{ name: 'Product A', count: 1 }, { name: 'Product B', count: 1 }]);
		expect(summary.find(region => region.id === 'westus').count).toBe(1);
		expect(summary.filter(region => !region.location).map(region => region.id).sort()).toEqual(['', 'global', 'newregion']);
		expect(summarizeRegions(fixture, locations, ' MODEL INPUT ', 'exact').find(region => region.id === 'eastus').count).toBe(1);
		expect(summarizeRegions(fixture, locations, 'input').find(region => region.id === 'eastus').count).toBe(2);
		expect(summarizeRegions(fixture, locations, 'no-such-meter')).toEqual([]);
		expect(markerRadius(100, 100)).toBeGreaterThan(markerRadius(1, 100));
		expect(markerRadius(0, 0)).toBeGreaterThan(0);
		expect(() => parsePrices('{broken}')).toThrow();
		expect(() => parsePrices('{}')).toThrow();
		const unknown = [...new Set(liveRows.map(row => (row.armRegionName || '').toLowerCase()))].filter(id => !locations[id] && !['', 'global', 'us gov'].includes(id));
		expect(unknown).toEqual([]);
		for (const location of Object.values(locations)) {
			expect(location.latitude).toBeGreaterThanOrEqual(-90);
			expect(location.latitude).toBeLessThanOrEqual(90);
			expect(location.longitude).toBeGreaterThanOrEqual(-180);
			expect(location.longitude).toBeLessThanOrEqual(180);
		}
	});

	test('preserves the requested Regions navigation order on each page', async ({ page }) => {
		for (const route of ['/', '/github/', '/agent/', '/monthly/', '/regions/']) {
			await page.goto(new URL(route, baseURL).href);
			const link = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Regions', exact: true });
			await expect(link).toBeVisible();
			expect(await link.evaluate((element, isMainPage) => (isMainPage ? element.nextElementSibling : element.previousElementSibling).textContent.trim(), route === '/')).toBe('AI Summaries');
			expect(new URL(await link.getAttribute('href'), page.url()).pathname).toBe('/regions/index.html');
		}
		await expect(page.getByRole('link', { name: 'Regions', exact: true })).toHaveAttribute('aria-current', 'page');
	});

	test('renders accurate local geography, marker selection, and Product counts', async ({ page }, testInfo) => {
		const errors = [];
		const failures = [];
		const externalRequests = [];
		page.on('pageerror', error => errors.push(error.message));
		page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
		page.on('request', request => { if (new URL(request.url()).origin !== new URL(baseURL).origin) externalRequests.push(request.url()); });
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(new URL('/regions/', baseURL).href);
		await expect(page.locator('.globe-canvas')).toHaveAttribute('data-ready', 'true');
		const geographicIds = [...new Set(liveRows.map(row => row.armRegionName.toLowerCase()))].filter(id => locations[id]);
		await expect(page.locator('.region-marker')).toHaveCount(geographicIds.length);
		await expect(page.locator('#region-list .region-row')).toHaveCount(geographicIds.length);
		for (const id of geographicIds) {
			const marker = page.locator(`.region-marker[data-region="${id}"]`);
			await expect(marker).toHaveAttribute('data-latitude', String(locations[id].latitude));
			await expect(marker).toHaveAttribute('data-longitude', String(locations[id].longitude));
		}
		await expect(page.locator('#unmapped-list .region-row')).toHaveCount(3);
		await page.screenshot({ path: testInfo.outputPath('regions-desktop.png') });
		await page.locator('.region-marker[data-region="brazilsouth"]').click();
		await expect(page.locator('#region-title')).toHaveText('Brazil South');
		const brazilRows = liveRows.filter(row => row.armRegionName === 'brazilsouth');
		await expect(page.locator('#region-meter-count')).toHaveText(new Set(brazilRows.map(row => row.meterId)).size.toLocaleString());
		const actualProducts = await page.locator('#product-counts tr').evaluateAll(elements => Object.fromEntries(elements.map(row => [row.cells[0].textContent, Number(row.cells[1].textContent.replaceAll(',', ''))])));
		const expectedProducts = Object.fromEntries([...new Set(brazilRows.map(row => row.productName))].map(name => [name, new Set(brazilRows.filter(row => row.productName === name).map(row => row.meterId)).size]));
		expect(actualProducts).toEqual(expectedProducts);
		await expect(page).toHaveURL(/region=brazilsouth/);
		await page.screenshot({ path: testInfo.outputPath('regions-flyout.png') });
		await page.keyboard.press('Escape');
		await expect(page.locator('#region-flyout')).toBeHidden();
		await page.locator('#reset-view').click();
		await expect(page.locator('.region-marker[data-region="eastus"]')).toBeVisible();
		await expect(page.locator('.region-marker[data-region="usgovvirginia"]')).toBeVisible();
		const large = await page.locator('.region-marker[data-region="eastus"] .marker-dot').boundingBox();
		const small = await page.locator('.region-marker[data-region="usgovvirginia"] .marker-dot').boundingBox();
		expect(large.width).toBeGreaterThan(small.width);
		const canvas = page.locator('.globe-canvas');
		const distance = Number(await canvas.getAttribute('data-distance'));
		await page.locator('#zoom-in').click();
		await expect.poll(async () => Number(await canvas.getAttribute('data-distance'))).toBeLessThan(distance);
		await page.locator('#zoom-out').click();
		await expect.poll(async () => Number(await canvas.getAttribute('data-distance'))).toBeCloseTo(distance, 2);
		const bounds = await canvas.boundingBox();
		await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
		await page.mouse.wheel(0, -200);
		await expect.poll(async () => Number(await canvas.getAttribute('data-distance'))).toBeLessThan(distance);
		await page.locator('#reset-view').click();
		const beforeDrag = (await canvasPixels(page)).signature;
		await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
		await page.mouse.down();
		await page.mouse.move(bounds.x + bounds.width / 2 + 180, bounds.y + bounds.height / 2 + 25, { steps: 12 });
		await page.mouse.up();
		await expect.poll(async () => (await canvasPixels(page)).signature).not.toBe(beforeDrag);
		await canvas.focus();
		await page.keyboard.press('Home');
		await page.keyboard.press('+');
		await expect.poll(async () => Number(await canvas.getAttribute('data-distance'))).toBeLessThan(distance);
		await expect(page.locator('.regions-footer')).toContainText('Price meters do not imply model availability or capacity.');
		await expect(page.getByRole('link', { name: "Microsoft's model availability by region" })).toHaveAttribute('href', 'https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability');
		await expect(page.locator('#last-updated')).not.toHaveText(/Loading|Unknown/);
		expect(errors).toEqual([]);
		expect(failures).toEqual([]);
		expect(externalRequests).toEqual([]);
	});

	test('keeps wheel zoom responsive over the canvas and region markers in both directions', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(new URL('/regions/', baseURL).href);
		const canvas = page.locator('.globe-canvas');
		await expect(canvas).toHaveAttribute('data-ready', 'true');
		for (const target of [canvas, page.locator('.region-marker[data-region="brazilsouth"]')]) {
			for (const delta of [-60, -60, -60, 60, 60, 60, -1, 1]) {
				await target.hover();
				const distance = Number(await canvas.getAttribute('data-distance'));
				await page.mouse.wheel(0, delta);
				if (delta < 0) await expect.poll(async () => Number(await canvas.getAttribute('data-distance'))).toBeLessThan(distance);
				else await expect.poll(async () => Number(await canvas.getAttribute('data-distance'))).toBeGreaterThan(distance);
			}
		}
		await canvas.hover();
		await page.mouse.wheel(0, -100000);
		await expect.poll(async () => Number(await canvas.getAttribute('data-distance'))).toBeCloseTo(1.4, 3);
		await page.mouse.wheel(0, 60);
		await expect.poll(async () => Number(await canvas.getAttribute('data-distance'))).toBeGreaterThan(1.4);
		await page.mouse.wheel(0, 100000);
		await expect.poll(async () => Number(await canvas.getAttribute('data-distance'))).toBeCloseTo(7, 3);
		await page.mouse.wheel(0, -60);
		await expect.poll(async () => Number(await canvas.getAttribute('data-distance'))).toBeLessThan(7);
		await expect(page.locator('#region-flyout')).toBeHidden();
	});

	test('filters exact or partial meter names and keeps unlocated entries accessible', async ({ page }) => {
		await page.route('**/prices.ndjson', route => route.fulfill({ body: fixtureText }));
		await page.goto(new URL('/regions/', baseURL).href);
		await expect(page.locator('.globe-canvas')).toHaveAttribute('data-ready', 'true');
		await page.locator('.region-row[data-region="eastus"]').click();
		await expect(page.locator('#region-meter-count')).toHaveText('2');
		await page.locator('#meter-search').fill('MODEL INPUT');
		await expect(page.locator('#region-list .region-row')).toHaveCount(2);
		await expect(page.locator('#unmapped-section')).toBeHidden();
		await page.locator('#meter-match').selectOption('exact');
		await expect(page.locator('#region-meter-count')).toHaveText('1');
		await expect(page.locator('#product-counts tr')).toHaveCount(1);
		await expect(page.locator('#meter-count')).toHaveText('2');
		await page.reload();
		await expect(page.locator('#meter-search')).toHaveValue('MODEL INPUT');
		await expect(page.locator('#meter-match')).toHaveValue('exact');
		await expect(page.locator('#region-title')).toHaveText('East US');
		await page.locator('#meter-search').fill('no-such-meter');
		await expect(page.locator('.region-marker')).toHaveCount(0);
		await expect(page.locator('#directory-status')).toHaveText('No matching price meters.');
		await expect(page.locator('#region-flyout')).toBeHidden();
		await page.locator('#clear-search').click();
		await expect(page.locator('#unmapped-list .region-row')).toHaveCount(3);
		await page.locator('.region-row[data-region="newregion"]').click();
		await expect(page.locator('#region-place')).toContainText('No geographic coordinates');
		await expect(page.locator('#product-counts')).toContainText('<img src=x onerror=alert(1)>');
		await expect(page.locator('#product-counts img')).toHaveCount(0);
		await page.locator('#close-region').click();
		await expect(page.locator('.region-row[data-region="newregion"]')).toBeFocused();
	});

	test('fits desktop and mobile with a nonblank framed globe and persistent theme', async ({ page }, testInfo) => {
		await page.goto(new URL('/regions/', baseURL).href);
		await expect(page.locator('.globe-canvas')).toHaveAttribute('data-ready', 'true');
		for (const [width, height] of [[1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 568], [667, 375]]) {
			await page.setViewportSize({ width, height });
			await page.locator('#reset-view').click();
			await expect(page.locator('#meter-search')).toBeVisible();
			await expect.poll(async () => (await canvasPixels(page)).filled).toBeGreaterThan(1000);
			const pixels = await canvasPixels(page);
			expect(pixels.colors).toBeGreaterThan(100);
			expect(pixels.left).toBeGreaterThan(0);
			expect(pixels.right).toBeLessThan(pixels.width - 1);
			expect(pixels.top).toBeGreaterThan(0);
			expect(pixels.bottom).toBeLessThan(pixels.height - 1);
			expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
			await page.screenshot({ path: testInfo.outputPath(`regions-${width}.png`), fullPage: true });
			if (width <= 390) {
				await page.locator('.region-row[data-region="eastus"]').click();
				const panel = await page.locator('#region-flyout').boundingBox();
				expect(panel.x).toBeGreaterThanOrEqual(0);
				expect(panel.x + panel.width).toBeLessThanOrEqual(width);
				expect(panel.y + panel.height).toBeLessThanOrEqual(height);
				await expect(page.locator('#close-region')).toBeInViewport();
				await page.screenshot({ path: testInfo.outputPath(`regions-flyout-${width}.png`) });
				await page.locator('#close-region').click();
			}
		}
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.locator('#btn-theme').click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.locator('.globe-canvas')).toHaveAttribute('data-ready', 'true');
		await page.screenshot({ path: testInfo.outputPath('regions-desktop-dark.png') });
		await page.setViewportSize({ width: 390, height: 844 });
		await page.locator('#reset-view').click();
		await page.screenshot({ path: testInfo.outputPath('regions-mobile-dark.png'), fullPage: true });
	});

	test('shows loading, retry, empty data, and a usable non-WebGL fallback', async ({ page }) => {
		let release;
		const gate = new Promise(resolve => { release = resolve; });
		await page.route('**/prices.ndjson', async route => {
			await gate;
			await route.fulfill({ status: 503, body: 'Unavailable' });
		});
		await page.goto(new URL('/regions/', baseURL).href);
		await expect(page.locator('#map-status')).toBeVisible();
		await expect(page.locator('#meter-search')).toBeDisabled();
		release();
		await expect(page.locator('#map-status')).toContainText('Price meters could not be loaded.');
		await page.unroute('**/prices.ndjson');
		await page.route('**/prices.ndjson', route => route.fulfill({ body: '' }));
		await page.locator('#retry').click();
		await expect(page.locator('#map-empty')).toBeVisible();
		await expect(page.locator('#meter-count')).toHaveText('0');
		await page.unroute('**/prices.ndjson');
		await page.route('**/prices.ndjson', route => route.fulfill({ body: fixtureText }));
		await page.addInitScript(() => {
			const original = HTMLCanvasElement.prototype.getContext;
			HTMLCanvasElement.prototype.getContext = function(type, ...args) {
				return type.startsWith('webgl') ? null : original.call(this, type, ...args);
			};
		});
		await page.reload();
		await expect(page.locator('#map-status')).toContainText('3D map unavailable');
		await expect(page.locator('#zoom-in')).toBeDisabled();
		await page.locator('.region-row[data-region="eastus"]').click();
		await expect(page.locator('#region-meter-count')).toHaveText('2');
		await page.locator('#close-region').click();
		await page.locator('#meter-search').fill('no-such-meter');
		await expect(page.locator('#directory-status')).toHaveText('No matching price meters.');
		await page.locator('#btn-theme').click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	});
});