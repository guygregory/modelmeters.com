import {
	AmbientLight, CanvasTexture, DirectionalLight, Mesh, MeshPhongMaterial,
	OrbitControls, PerspectiveCamera, Quaternion, Scene, SphereGeometry,
	SRGBColorSpace, Vector3, WebGLRenderer,
	feature, geoArea, geoCentroid, geoEquirectangular, geoGraticule10, geoPath, mesh
} from './vendor/globe.js';
import { markerRadius } from './data.mjs';

function positionAt(latitude, longitude, radius = 1) {
	const latitudeRadians = latitude * Math.PI / 180;
	const longitudeRadians = longitude * Math.PI / 180;
	return new Vector3(
		radius * Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
		radius * Math.sin(latitudeRadians),
		-radius * Math.cos(latitudeRadians) * Math.sin(longitudeRadians)
	);
}

export class RegionGlobe {
	constructor(container, topology, onSelect, onUnavailable) {
		this.container = container;
		this.onSelect = onSelect;
		this.topology = topology;
		this.markers = [];
		this.frame = null;
		this.flight = null;
		this.scene = new Scene();
		this.camera = new PerspectiveCamera(38, 1, 0.05, 30);
		this.renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
		this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		this.renderer.setClearColor(0x000000, 0);
		this.canvas = this.renderer.domElement;
		this.canvas.className = 'globe-canvas';
		this.canvas.tabIndex = 0;
		this.canvas.setAttribute('aria-label', 'Interactive Azure region globe');
		this.canvas.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight + - Home');
		this.canvas.addEventListener('webglcontextlost', event => {
			event.preventDefault();
			onUnavailable();
		});
		container.append(this.canvas);
		this.controls = new OrbitControls(this.camera, container);
		this.controls.enablePan = false;
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.1;
		this.controls.minDistance = 1.4;
		this.controls.maxDistance = 7;
		this.controls.minPolarAngle = 0.05;
		this.controls.maxPolarAngle = Math.PI - 0.05;
		this.controls.rotateSpeed = 0.65;
		this.controls.zoomSpeed = 0.85;
		this.controls.addEventListener('change', () => this.scheduleRender());
		this.controls.addEventListener('start', () => { this.flight = null; });
		this.textureCanvas = document.createElement('canvas');
		this.textureCanvas.width = 2048;
		this.textureCanvas.height = 1024;
		this.texture = new CanvasTexture(this.textureCanvas);
		this.texture.colorSpace = SRGBColorSpace;
		this.texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
		this.sphere = new Mesh(new SphereGeometry(1, 96, 64), new MeshPhongMaterial({ map: this.texture, shininess: 8, specular: 0x162524 }));
		this.scene.add(this.sphere, new AmbientLight(0xffffff, 1.5));
		this.light = new DirectionalLight(0xffffff, 1.7);
		this.scene.add(this.light);
		this.countryLayer = document.createElement('div');
		this.countryLayer.className = 'country-layer';
		this.countryLayer.setAttribute('aria-hidden', 'true');
		this.markerLayer = document.createElement('div');
		this.markerLayer.className = 'marker-layer';
		this.markerLayer.addEventListener('pointerdown', event => event.stopPropagation());
		container.append(this.countryLayer, this.markerLayer);
		this.countries = feature(topology, topology.objects.countries).features
			.map(country => ({ name: country.properties.name, area: geoArea(country), center: geoCentroid(country) }))
			.filter(country => country.area > 0.006)
			.sort((first, second) => second.area - first.area)
			.map(country => {
				const label = document.createElement('span');
				label.className = 'country-label';
				label.textContent = country.name;
				this.countryLayer.append(label);
				return { ...country, label, point: positionAt(country.center[1], country.center[0], 1.003) };
			});
		this.canvas.addEventListener('keydown', event => this.handleKey(event));
		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(container);
		this.resize();
		this.reset();
		this.updateTheme();
	}

	updateTheme() {
		const style = getComputedStyle(document.body);
		const context = this.textureCanvas.getContext('2d');
		const projection = geoEquirectangular().scale(2048 / (2 * Math.PI)).translate([1024, 512]).precision(0.2);
		const path = geoPath(projection, context);
		context.fillStyle = style.getPropertyValue('--map-ocean').trim();
		context.fillRect(0, 0, 2048, 1024);
		context.beginPath();
		path(feature(this.topology, this.topology.objects.land));
		context.fillStyle = style.getPropertyValue('--map-land').trim();
		context.fill();
		context.strokeStyle = style.getPropertyValue('--map-coast').trim();
		context.lineWidth = 0.7;
		context.stroke();
		context.beginPath();
		path(mesh(this.topology, this.topology.objects.countries, (first, second) => first !== second));
		context.stroke();
		context.beginPath();
		path(geoGraticule10());
		context.strokeStyle = style.getPropertyValue('--map-grid').trim();
		context.lineWidth = 0.5;
		context.stroke();
		this.texture.needsUpdate = true;
		this.scheduleRender();
	}

	resize() {
		const width = this.container.clientWidth;
		const height = this.container.clientHeight;
		if (!width || !height) return;
		const previousDistance = this.homeDistance;
		this.camera.aspect = width / height;
		this.homeDistance = Math.max(3.65, 1.1 / Math.sin(Math.atan(Math.tan(19 * Math.PI / 180) * Math.min(1, width / height))));
		if (previousDistance) this.camera.position.multiplyScalar(this.homeDistance / previousDistance);
		this.controls.maxDistance = Math.max(7, this.homeDistance * 1.6);
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
		this.scheduleRender();
	}

	setRegions(regions, maximum, selectedId) {
		this.markerLayer.replaceChildren();
		this.markers = regions.filter(region => region.location).map(region => {
			const button = document.createElement('button');
			button.className = 'region-marker';
			button.dataset.region = region.id;
			button.dataset.count = region.count;
			button.dataset.latitude = region.location.latitude;
			button.dataset.longitude = region.location.longitude;
			button.title = `${region.name} (${region.id}): ${region.count.toLocaleString()} price meters`;
			button.setAttribute('aria-label', button.title);
			button.setAttribute('aria-pressed', String(region.id === selectedId));
			button.style.zIndex = String(100 - Math.round(region.count / maximum * 90));
			const dot = document.createElement('span');
			dot.className = 'marker-dot';
			button.append(dot);
			button.addEventListener('click', () => this.onSelect(region.id, button));
			this.markerLayer.append(button);
			return { region, button, point: positionAt(region.location.latitude, region.location.longitude, 1.008), radius: markerRadius(region.count, maximum) };
		});
		this.scheduleRender();
	}

	select(id) {
		for (const marker of this.markers) marker.button.setAttribute('aria-pressed', String(marker.region.id === id));
	}

	focus(location) {
		const direction = this.camera.position.clone().normalize();
		this.flight = {
			direction,
			rotation: new Quaternion().setFromUnitVectors(direction, positionAt(location.latitude, location.longitude)),
			fromDistance: this.camera.position.length(),
			toDistance: Math.max(2.65, this.homeDistance * 0.73),
			start: performance.now(),
			duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650
		};
		this.scheduleRender();
	}

	zoom(factor) {
		this.flight = null;
		const distance = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, this.camera.position.length() * factor));
		this.camera.position.setLength(distance);
		this.controls.update();
		this.scheduleRender();
	}

	reset() {
		this.flight = null;
		this.camera.position.copy(positionAt(22, -25, this.homeDistance));
		this.controls.target.set(0, 0, 0);
		this.controls.update();
		this.scheduleRender();
	}

	handleKey(event) {
		if (event.key === '+' || event.key === '=') this.zoom(0.85);
		else if (event.key === '-') this.zoom(1.18);
		else if (event.key === 'Home') this.reset();
		else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
			this.flight = null;
			const distance = this.camera.position.length();
			let latitude = Math.asin(this.camera.position.y / distance) * 180 / Math.PI;
			let longitude = Math.atan2(-this.camera.position.z, this.camera.position.x) * 180 / Math.PI;
			if (event.key === 'ArrowUp') latitude += 10;
			if (event.key === 'ArrowDown') latitude -= 10;
			if (event.key === 'ArrowLeft') longitude -= 10;
			if (event.key === 'ArrowRight') longitude += 10;
			this.camera.position.copy(positionAt(Math.max(-85, Math.min(85, latitude)), longitude, distance));
			this.controls.update();
			this.scheduleRender();
		} else return;
		event.preventDefault();
	}

	project(point) {
		const projected = point.clone().project(this.camera);
		return {
			x: (projected.x + 1) * this.container.clientWidth / 2,
			y: (1 - projected.y) * this.container.clientHeight / 2,
			visible: point.dot(this.camera.position) > 1.03 && projected.z > -1 && projected.z < 1
		};
	}

	positionLabels() {
		const width = this.container.clientWidth;
		const height = this.container.clientHeight;
		const focalLength = height / (2 * Math.tan(19 * Math.PI / 180));
		const occupied = [];
		for (const marker of this.markers) {
			const projected = this.project(marker.point);
			const visible = projected.visible && projected.x > 12 && projected.x < width - 12 && projected.y > 12 && projected.y < height - 12;
			marker.button.hidden = !visible;
			if (!visible) continue;
			const depth = -marker.point.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
			const diameter = Math.max(7, Math.min(48, 2 * marker.radius * focalLength / depth));
			marker.button.style.left = `${projected.x}px`;
			marker.button.style.top = `${projected.y}px`;
			marker.button.style.setProperty('--dot-size', `${diameter}px`);
			marker.button.style.setProperty('--hit-size', `${Math.max(22, diameter + 4)}px`);
			occupied.push({ x: projected.x, y: projected.y, halfWidth: diameter / 2 + 5, halfHeight: diameter / 2 + 5 });
		}
		for (const country of this.countries) {
			const projected = this.project(country.point);
			const halfWidth = country.name.length * 2.7 + 5;
			const crowded = occupied.some(bounds => Math.abs(bounds.x - projected.x) < bounds.halfWidth + halfWidth && Math.abs(bounds.y - projected.y) < bounds.halfHeight + 7);
			country.label.hidden = !projected.visible || crowded || projected.x < halfWidth + 15 || projected.x > width - halfWidth - 15 || projected.y < 65 || projected.y > height - 85 || (width < 700 && this.camera.position.length() > this.homeDistance * 0.85);
			if (country.label.hidden) continue;
			country.label.style.left = `${projected.x}px`;
			country.label.style.top = `${projected.y}px`;
			occupied.push({ x: projected.x, y: projected.y, halfWidth, halfHeight: 9 });
		}
	}

	scheduleRender() {
		if (this.frame !== null) return;
		this.frame = requestAnimationFrame(now => {
			this.frame = null;
			if (this.flight) {
				const progress = this.flight.duration ? Math.min(1, (now - this.flight.start) / this.flight.duration) : 1;
				const eased = progress * progress * (3 - 2 * progress);
				const rotation = new Quaternion().slerp(this.flight.rotation, eased);
				this.camera.position.copy(this.flight.direction).applyQuaternion(rotation).multiplyScalar(this.flight.fromDistance + (this.flight.toDistance - this.flight.fromDistance) * eased);
				if (progress === 1) this.flight = null;
			}
			const changed = this.controls.update();
			this.light.position.copy(this.camera.position).add(new Vector3(-2, 3, 1));
			this.renderer.render(this.scene, this.camera);
			this.positionLabels();
			this.canvas.dataset.ready = 'true';
			this.canvas.dataset.distance = this.camera.position.length().toFixed(4);
			if (changed || this.flight) this.scheduleRender();
		});
	}

	destroy() {
		cancelAnimationFrame(this.frame);
		this.resizeObserver.disconnect();
		this.controls.dispose();
		this.sphere.geometry.dispose();
		this.sphere.material.dispose();
		this.texture.dispose();
		this.renderer.dispose();
		this.container.replaceChildren();
	}
}