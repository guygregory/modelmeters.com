import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(directory, '../regions/vendor');
await mkdir(path.join(output, 'icons'), { recursive: true });
await build({
	stdin: {
		contents: `
			export { AmbientLight, CanvasTexture, DirectionalLight, Mesh, MeshPhongMaterial, PerspectiveCamera, Quaternion, Scene, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
			export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
			export { geoArea, geoCentroid, geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo';
			export { feature, mesh } from 'topojson-client';
		`,
		resolveDir: directory,
		sourcefile: 'regions-vendor.mjs'
	},
	outfile: path.join(output, 'globe.js'),
	bundle: true,
	minify: true,
	format: 'esm',
	target: ['es2022'],
	legalComments: 'inline'
});
await copyFile(path.join(directory, 'node_modules/world-atlas/countries-110m.json'), path.join(output, 'countries-110m.json'));
for (const icon of ['plus', 'minus', 'rotate-ccw', 'x', 'list', 'map-pin']) {
	await copyFile(path.join(directory, `node_modules/lucide-static/icons/${icon}.svg`), path.join(output, `icons/${icon}.svg`));
}
const licenses = [];
for (const dependency of ['three', 'd3-geo', 'd3-array', 'internmap', 'topojson-client', 'world-atlas', 'lucide-static']) {
	const manifest = JSON.parse(await readFile(path.join(directory, `node_modules/${dependency}/package.json`), 'utf8'));
	const license = await readFile(path.join(directory, `node_modules/${dependency}/LICENSE`), 'utf8');
	licenses.push(`${dependency} ${manifest.version}\n${'='.repeat(60)}\n${license}`);
}
await writeFile(path.join(output, 'LICENSES.txt'), licenses.join('\n\n'));
console.log('Built local globe library, Natural Earth geography, icons, and license notices.');