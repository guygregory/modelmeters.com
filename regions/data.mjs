export function parsePrices(text) {
	return text.split(/\r?\n/).filter(line => line.trim()).map(line => {
		const row = JSON.parse(line);
		if (typeof row.meterName !== 'string' || typeof row.productName !== 'string') {
			throw new Error('Invalid price meter record');
		}
		return row;
	});
}

export function summarizeRegions(rows, locations, query = '', match = 'contains') {
	const needle = query.trim().toLowerCase();
	const regions = new Map();
	for (const row of rows) {
		const meterName = row.meterName.toLowerCase();
		if (needle && !(match === 'exact' ? meterName === needle : meterName.includes(needle))) continue;
		const id = (row.armRegionName || '').trim().toLowerCase();
		if (!regions.has(id)) {
			const location = locations[id];
			regions.set(id, {
				id,
				name: location?.name || row.armRegionName || 'Unspecified region',
				location: location || null,
				meters: new Set(),
				products: new Map()
			});
		}
		const region = regions.get(id);
		const meterId = row.meterId || JSON.stringify([row.productName, row.meterName, row.skuId, row.unitOfMeasure]);
		region.meters.add(meterId);
		if (!region.products.has(row.productName)) region.products.set(row.productName, new Set());
		region.products.get(row.productName).add(meterId);
	}
	return [...regions.values()].map(region => ({
		id: region.id,
		name: region.name,
		location: region.location,
		count: region.meters.size,
		products: [...region.products].map(([name, meters]) => ({ name, count: meters.size }))
			.sort((first, second) => second.count - first.count || first.name.localeCompare(second.name))
	})).sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
}

export function markerRadius(count, maximum) {
	return 0.009 + 0.035 * Math.sqrt(Math.max(0, count) / Math.max(1, maximum));
}