const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const baseURL = process.env.MODELMETERS_URL || 'http://127.0.0.1:8000';

test('archive generation retains the shared layout and rendered content', async ({ page }) => {
	const generated = execFileSync('python', ['-c', 'import runpy; module = runpy.run_path("consolidate-ai-summaries.py"); print(module["build_html"]([("2026-09-01", "# 1 September 2026\\n\\nSeptember fixture"), ("2026-08-01", "# 1 August 2026\\n\\nAugust fixture")]))'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.route('**/monthly/generated.html', interception => interception.fulfill({ contentType: 'text/html', body: generated }));
	await page.goto(new URL('/monthly/generated.html', baseURL).href);
	await expect(page.locator('h1').first()).toHaveText('Monthly summary archive');
	await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', '../site.css');
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