import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import Projection from 'ol/proj/Projection';
import TileGrid from 'ol/tilegrid/TileGrid';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import LineString from 'ol/geom/LineString';
import { Style, Icon, Stroke, Fill } from 'ol/style';
import Overlay from 'ol/Overlay';
import DragPan from 'ol/interaction/DragPan';
import DoubleClickZoom from 'ol/interaction/DoubleClickZoom';

(function () {
	const IS_TIBIAMAPS_IO = location.origin === 'https://tibiamaps.io';
	const URL_PREFIX = 'https://tibiamaps.github.io/tibia-map-data/';
	const IMAGE_URL_PREFIX = IS_TIBIAMAPS_IO
		? '/_img/marker-icons/'
		: '_img/marker-icons/';

	let KNOWN_TILES = null;
	const fetchKnownTiles = function () {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', URL_PREFIX + 'mapper/tiles.json', true);
		xhr.responseType = 'json';
		xhr.onload = function () {
			if (xhr.status === 200) {
				KNOWN_TILES = new Set(xhr.response);
				tileSource.changed();
			}
		};
		xhr.send();
	};
	fetchKnownTiles();

	const isEmbed =
		location.pathname.indexOf('/embed') !== -1 ||
		location.pathname.indexOf('/poi') !== -1;

	const getUrlPosition = function () {
		const position = {
			x: 32368,
			y: 32198,
			floor: 7,
			zoom: 0,
		};
		let parts;
		let hash = window.location.hash.slice(1);
		if (!hash) return position;

		if (hash.includes('%20')) {
			hash = decodeURIComponent(hash);
			parts = hash.replace(/[^0-9,]/g, '').split(',');
			position.x = parseInt(parts[0], 10);
			position.y = parseInt(parts[1], 10);
			position.floor = parseInt(parts[2], 10);
			return position;
		}

		parts = hash.split(':');
		if (parts[0]) {
			const tempPos = parts[0].split(',');
			if (tempPos.length == 3) {
				position.x = parseInt(tempPos[0], 10);
				position.y = parseInt(tempPos[1], 10);
				position.floor = parseInt(tempPos[2], 10);
			}
		}
		if (parts[1]) {
			position.zoom = parseInt(parts[1], 10);
		}
		return position;
	};

	const current = getUrlPosition();
	let currentFloor = current.floor;
	let crosshairX = current.x;
	let crosshairY = current.y;
	let isColorMap = true;
	let exivaEnabled = false;

	const mapContainer = document.querySelector('#map');
	const dataset = mapContainer.dataset;
	let markersEnabled = dataset.markersEnabled === 'true';
	let areasEnabled = dataset.areasEnabled === 'true';
	let panTargetCenter = null;

	// Define OpenLayers projection for Tibia coordinate grid (0 to 65536, Y is inverted).
	const projection = new Projection({
		code: 'tibia-map',
		units: 'pixels',
		extent: [0, -65536, 65536, 0],
	});

	// Tile grid using custom resolutions matching simple scale factors.
	const tileGrid = new TileGrid({
		extent: [0, -65536, 65536, 0],
		resolutions: [1],
		tileSize: [256, 256],
	});

	// Custom XYZ tile source.
	const tileSource = new XYZ({
		projection: projection,
		tileGrid: tileGrid,
		interpolate: false,
		transition: 0,
		tileUrlFunction: function (tileCoord) {
			const extent = tileGrid.getTileCoordExtent(tileCoord);
			const coordX = Math.round(extent[0]);
			const coordY = Math.round(-extent[3]);
			const tileId = coordX + '_' + coordY + '_' + currentFloor;

			if (KNOWN_TILES && !KNOWN_TILES.has(tileId)) {
				return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
			}
			return (
				URL_PREFIX +
				'mapper/Minimap_' +
				(isColorMap ? 'Color' : 'WaypointCost') +
				'_' +
				tileId +
				'.png'
			);
		},
	});

	const tileLayer = new TileLayer({
		source: tileSource,
		zIndex: 0,
	});

	// Define Crosshair geometries and Layer.
	const crosshairSource = new VectorSource();
	const crosshairLayer = new VectorLayer({
		source: crosshairSource,
		style: new Style({
			stroke: new Stroke({
				color: '#333',
				width: 1.5,
			}),
		}),
		zIndex: 3,
	});

	function updateCrosshairGeometries(center) {
		crosshairSource.clear();
		const cx = center[0];
		const cy = center[1];

		// Center 1x1 rectangle
		const centerRect = new Feature(
			new Polygon([
				[
					[cx, cy],
					[cx + 1, cy],
					[cx + 1, cy - 1],
					[cx, cy - 1],
					[cx, cy],
				],
			]),
		);
		crosshairSource.addFeature(centerRect);

		if (exivaEnabled) {
			// Exiva 100 rectangle
			const exiva100 = new Feature(
				new Polygon([
					[
						[cx - 100, cy + 100],
						[cx + 101, cy + 100],
						[cx + 101, cy - 101],
						[cx - 100, cy - 101],
						[cx - 100, cy + 100],
					],
				]),
			);
			crosshairSource.addFeature(exiva100);

			// Exiva 250 rectangle
			const exiva250 = new Feature(
				new Polygon([
					[
						[cx - 250, cy + 250],
						[cx + 251, cy + 250],
						[cx + 251, cy - 251],
						[cx - 250, cy - 251],
						[cx - 250, cy + 250],
					],
				]),
			);
			crosshairSource.addFeature(exiva250);

			// Diagonals
			const DIAGONAL_SIZE = 102360;
			const OTHER_DIAGONAL_SIZE = DIAGONAL_SIZE * 2.42;
			const diagonals = [
				[
					[cx, cy],
					[cx + DIAGONAL_SIZE, cy + OTHER_DIAGONAL_SIZE],
				],
				[
					[cx, cy],
					[cx + OTHER_DIAGONAL_SIZE, cy + DIAGONAL_SIZE],
				],
				[
					[cx, cy],
					[cx + OTHER_DIAGONAL_SIZE, cy - DIAGONAL_SIZE],
				],
				[
					[cx, cy],
					[cx + DIAGONAL_SIZE, cy - OTHER_DIAGONAL_SIZE],
				],
				[
					[cx, cy],
					[cx - DIAGONAL_SIZE, cy - OTHER_DIAGONAL_SIZE],
				],
				[
					[cx, cy],
					[cx - OTHER_DIAGONAL_SIZE, cy - DIAGONAL_SIZE],
				],
				[
					[cx, cy],
					[cx - OTHER_DIAGONAL_SIZE, cy + DIAGONAL_SIZE],
				],
				[
					[cx, cy],
					[cx - DIAGONAL_SIZE, cy + OTHER_DIAGONAL_SIZE],
				],
			];
			diagonals.forEach((coords) => {
				crosshairSource.addFeature(new Feature(new LineString(coords)));
			});
		} else {
			// Normal infinite axis lines
			crosshairSource.addFeature(
				new Feature(
					new LineString([
						[cx, 0],
						[cx, -65536],
					]),
				),
			);
			crosshairSource.addFeature(
				new Feature(
					new LineString([
						[0, cy],
						[65536, cy],
					]),
				),
			);
		}
	}

	// Hover Tile outlines.
	const hoverSource = new VectorSource();
	const hoverLayer = new VectorLayer({
		source: hoverSource,
		style: new Style({
			stroke: new Stroke({
				color: '#009eff',
				width: 1,
			}),
		}),
		zIndex: 4,
	});
	const hoverFeature = new Feature();
	hoverSource.addFeature(hoverFeature);

	// Markers Layer.
	const markerSource = new VectorSource();
	const markerLayer = new VectorLayer({
		source: markerSource,
		zIndex: 5,
	});

	// Areas Layer.
	const areasSource = new VectorSource();
	const areasLayer = new VectorLayer({
		source: areasSource,
		style: function (feature, resolution) {
			const scale = 1 / resolution;
			// Stroke width scales dynamically with zoom level
			let width = 1.5 * Math.sqrt(scale);
			if (feature.get('subareaId') === hoveredSubareaId) {
				width *= 2.0;
			}
			return new Style({
				stroke: new Stroke({
					color: '#ffcc00',
					width: width,
				}),
			});
		},
		zIndex: 2,
	});

	// Dimming Layer (black overlay with cutout holes).
	const dimmingSource = new VectorSource();
	const dimmingLayer = new VectorLayer({
		source: dimmingSource,
		zIndex: 1,
	});

	let allMarkersData = [];

	function updateMarkersForFloor(floor) {
		markerSource.clear();
		if (!markersEnabled) return;

		const floorMarkers = allMarkersData.filter((m) => m.z === floor);
		const features = floorMarkers.map((m) => {
			const feature = new Feature({
				geometry: new Point([m.x + 0.5, -m.y - 0.5]),
				description: m.description,
				icon: m.icon,
			});

			const iconUrl =
				IMAGE_URL_PREFIX +
				m.icon
					.replace('!', 'exclamation')
					.replace('$', 'dollar')
					.replace('?', 'question')
					.replace(' ', '-') +
				'.png';

			feature.setStyle(
				new Style({
					image: new Icon({
						src: iconUrl,
						imgSize: [11, 11],
						scale: 1,
					}),
				}),
			);
			return feature;
		});
		markerSource.addFeatures(features);
	}

	function getMarkersSource() {
		const urlParams = new URLSearchParams(window.location.search);
		try {
			if (urlParams.get('markers'))
				return JSON.parse(atob(urlParams.get('markers')));
			if (urlParams.get('markersUrl')) return urlParams.get('markersUrl');
			if (dataset.markers) return JSON.parse(dataset.markers);
			if (dataset.markersUrl) return dataset.markersUrl;
		} catch (error) {
			console.error(
				'Invalid custom markers data. Falling back to default markers',
			);
		}
		return URL_PREFIX + 'markers.json';
	}

	function loadMarkers() {
		const source = getMarkersSource();
		if (typeof source === 'string') {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', source);
			xhr.responseType = 'json';
			xhr.onload = function () {
				if (xhr.status === 200) {
					allMarkersData = xhr.response;
					updateMarkersForFloor(currentFloor);
				}
			};
			xhr.send();
		} else {
			allMarkersData = source;
			updateMarkersForFloor(currentFloor);
		}
	}
	loadMarkers();

	// View extent limits.
	const bounds = {
		xMin: 124 * 256,
		xMax: 134 * 256,
		yMin: 121 * 256,
		yMax: 129 * 256,
	};
	const xPadding = window.innerWidth / 2;
	const yPadding = window.innerHeight / 2;
	const viewExtent = [
		bounds.xMin - xPadding,
		-bounds.yMax - yPadding,
		bounds.xMax + xPadding,
		-bounds.yMin + yPadding,
	];

	const view = new View({
		projection: projection,
		center: [current.x, -current.y],
		zoom: current.zoom,
		resolutions: [1, 0.5, 256 / 1792, 256 / 5120, 256 / 10240],
		constrainResolution: true,
		extent: viewExtent,
		smoothResolutionConstraint: false,
		smoothExtentConstraint: false,
	});

	const initialLayers = [tileLayer, dimmingLayer];
	if (areasEnabled) {
		initialLayers.push(areasLayer);
	}
	initialLayers.push(crosshairLayer, hoverLayer, markerLayer);

	const map = new Map({
		target: 'map',
		layers: initialLayers,
		view: view,
		controls: [],
		interactions: [
			new DragPan(),
			new DoubleClickZoom({
				duration: 120,
			}),
		],
	});

	// Handle wheel zoom instantly to prevent fractional/blurry zoom animations.
	const viewport = map.getViewport();
	let lastZoomTime = 0;
	const cooldownMs = 150;

	viewport.addEventListener(
		'wheel',
		(event) => {
			event.preventDefault();

			const now = Date.now();
			if (now - lastZoomTime < cooldownMs) {
				return;
			}

			const currentZoom = view.getZoom();
			const currentResolution = view.getResolution();
			const currentCenter = view.getCenter();

			if (
				currentZoom !== undefined &&
				currentResolution !== undefined &&
				currentCenter
			) {
				const delta = event.deltaY > 0 ? -1 : 1;
				const newZoom = Math.max(
					0,
					Math.min(4, Math.round(currentZoom + delta)),
				);

				if (newZoom !== currentZoom) {
					const rect = viewport.getBoundingClientRect();
					const pixelX = event.clientX - rect.left;
					const pixelY = event.clientY - rect.top;
					const anchor = map.getCoordinateFromPixel([pixelX, pixelY]);

					if (anchor) {
						const newResolution = view.getResolutionForZoom(newZoom);
						const newCenterX =
							anchor[0] -
							(newResolution * (anchor[0] - currentCenter[0])) /
								currentResolution;
						const newCenterY =
							anchor[1] -
							(newResolution * (anchor[1] - currentCenter[1])) /
								currentResolution;

						view.animate({
							center: [newCenterX, newCenterY],
							zoom: newZoom,
							duration: 120,
						});
						lastZoomTime = now;
					}
				}
			}
		},
		{ passive: false },
	);

	// Update crosshair to center initially
	updateCrosshairGeometries([current.x, -current.y]);

	// Sync map zoom to URL hash when resolution changes.
	view.on('change:resolution', () => {
		updateUrlHash();
	});

	const getAreasSource = function () {
		const urlParams = new URLSearchParams(window.location.search);
		try {
			if (urlParams.get('areasUrl')) return urlParams.get('areasUrl');
			if (dataset.areasUrl) return dataset.areasUrl;
		} catch (error) {
			console.error('Invalid custom areas url');
		}
		let url = '_json/areas.json';
		const isLocal =
			location.hostname === 'localhost' ||
			location.hostname === '127.0.0.1' ||
			location.protocol === 'file:';
		if (isLocal) {
			url += '?t=' + Date.now();
		}
		return url;
	};

	let allAreasData = [];
	let labelOverlays = [];
	let hoveredSubareaId = null;
	let pseudoFullscreenEnabled = false;

	function loadAreas() {
		const source = getAreasSource();
		const xhr = new XMLHttpRequest();
		xhr.open('GET', source);
		xhr.responseType = 'json';
		xhr.onload = function () {
			if (xhr.status === 200) {
				allAreasData = xhr.response;
				buildAreaLayers(allAreasData);
			}
		};
		xhr.send();
	}

	const worldOuterRing = [
		[-1000000, 1000000],
		[1000000, 1000000],
		[1000000, -1000000],
		[-1000000, -1000000],
		[-1000000, 1000000],
	];

	function buildAreaLayers(areasData) {
		areasSource.clear();
		labelOverlays.forEach((overlay) => map.removeOverlay(overlay));
		labelOverlays = [];

		areasData.forEach((area) => {
			area.subareas.forEach((subarea) => {
				// Create a separate Polygon feature for each island loop to prevent zigzags
				subarea.rings.forEach((ring) => {
					const polygonFeature = new Feature(new Polygon([ring]));
					polygonFeature.set('subareaId', subarea.id);
					areasSource.addFeature(polygonFeature);
				});

				const labelEl = document.createElement('div');
				labelEl.className = 'map-subarea-label';
				labelEl.innerHTML = '<span>' + subarea.subareaName + '</span>';

				const labelOverlay = new Overlay({
					element: labelEl,
					position: subarea.center,
					positioning: 'center-center',
					stopEvent: false,
				});
				labelOverlays.push(labelOverlay);

				labelEl.addEventListener('mouseenter', () => {
					viewport.classList.add('map-dimmed');
					labelEl.classList.add('active');

					hoveredSubareaId = subarea.id;
					areasSource.changed();

					const dimmingPolygon = new Polygon(
						[worldOuterRing].concat(subarea.rings),
					);
					const dimmingFeature = new Feature(dimmingPolygon);
					dimmingFeature.setStyle(
						new Style({
							fill: new Fill({
								color: 'rgba(0, 0, 0, 0.5)',
							}),
						}),
					);
					dimmingSource.clear();
					dimmingSource.addFeature(dimmingFeature);
				});

				labelEl.addEventListener('mouseleave', () => {
					viewport.classList.remove('map-dimmed');
					labelEl.classList.remove('active');

					hoveredSubareaId = null;
					areasSource.changed();

					dimmingSource.clear();
				});

				labelEl.addEventListener('click', (event) => {
					const clickEvent = {
						coordinate: subarea.center,
						pixel: map.getPixelFromCoordinate(subarea.center),
					};
					map.dispatchEvent(Object.assign({ type: 'click' }, clickEvent));
				});
			});
		});
		updateAreasVisibility();
	}

	loadAreas();

	// Click to set coordinate.
	map.on('click', function (event) {
		const coords = event.coordinate;
		const x = Math.round(coords[0]);
		const y = Math.round(-coords[1]);

		// Check if a marker was clicked first
		const feature = map.forEachFeatureAtPixel(event.pixel, function (feat) {
			return feat;
		});

		if (feature && feature.get('description')) {
			popupContentEl.textContent = feature.get('description');
			popupOverlay.setPosition(event.coordinate);
			popupEl.style.display = 'block';
		} else {
			popupEl.style.display = 'none';
			crosshairX = x;
			crosshairY = y;
			updateCrosshairGeometries([x, -y]);
			updateUrlHash();
		}
	});

	// Hover Coordinate updating & outline.
	const coordsLabelX = document.createElement('span');
	const coordsLabelY = document.createElement('span');
	const coordsLabelZ = document.createElement('span');

	map.on('pointermove', function (event) {
		if (event.dragging) return;
		const coords = event.coordinate;
		if (!coords) return;

		const x = Math.floor(coords[0]);
		const y = Math.floor(-coords[1]);

		// Outline 1x1 hover polygon
		const polygon = new Polygon([
			[
				[x, -y],
				[x + 1, -y],
				[x + 1, -y - 1],
				[x, -y - 1],
				[x, -y],
			],
		]);
		hoverFeature.setGeometry(polygon);

		coordsLabelX.innerHTML = '<b>X</b>: ' + x;
		coordsLabelY.innerHTML = '<b>Y</b>: ' + y;
		coordsLabelZ.innerHTML = '<b>Z</b>: ' + currentFloor;
	});

	map.getViewport().addEventListener('mouseout', () => {
		hoverFeature.setGeometry(null);
	});

	// Popup Bubble
	const popupEl = document.createElement('div');
	popupEl.className = 'ol-popup';
	popupEl.style.display = 'none';
	const popupContentEl = document.createElement('div');
	popupEl.appendChild(popupContentEl);
	document.body.appendChild(popupEl);

	const popupOverlay = new Overlay({
		element: popupEl,
		offset: [0, -10],
		positioning: 'bottom-center',
	});
	map.addOverlay(popupOverlay);

	// URL hash syncing.
	function updateUrlHash() {
		const zoom = Math.round(view.getZoom());
		const hash = `#${crosshairX},${crosshairY},${currentFloor}:${zoom}`;
		if (window.location.hash !== hash) {
			window.history.pushState(null, null, hash);
		}
	}

	window.addEventListener('popstate', () => {
		const pos = getUrlPosition();
		crosshairX = pos.x;
		crosshairY = pos.y;
		view.setCenter([pos.x, -pos.y]);
		view.setZoom(pos.zoom);
		setFloor(pos.floor);
		updateCrosshairGeometries([pos.x, -pos.y]);
	});

	// Custom HTML GUI Controls.
	const controlsContainer = document.createElement('div');
	controlsContainer.className = 'map-controls';
	document.body.appendChild(controlsContainer);

	// Zoom Control Group
	const zoomGroup = document.createElement('div');
	zoomGroup.className = 'map-control-group';
	controlsContainer.appendChild(zoomGroup);

	const zoomInBtn = document.createElement('button');
	zoomInBtn.className = 'map-btn';
	zoomInBtn.textContent = '+';
	zoomInBtn.addEventListener('click', () => {
		const currentZoom = view.getZoom();
		if (currentZoom !== undefined) {
			view.animate({
				zoom: Math.min(4, currentZoom + 1),
				duration: 120,
			});
		}
	});
	zoomGroup.appendChild(zoomInBtn);

	const zoomOutBtn = document.createElement('button');
	zoomOutBtn.className = 'map-btn';
	zoomOutBtn.textContent = '-';
	zoomOutBtn.addEventListener('click', () => {
		const currentZoom = view.getZoom();
		if (currentZoom !== undefined) {
			view.animate({
				zoom: Math.max(0, currentZoom - 1),
				duration: 120,
			});
		}
	});
	zoomGroup.appendChild(zoomOutBtn);

	// Floor Level Control Group
	const floorGroup = document.createElement('div');
	floorGroup.className = 'map-control-group';
	controlsContainer.appendChild(floorGroup);

	const floorUpBtn = document.createElement('button');
	floorUpBtn.className = 'map-btn';
	floorUpBtn.textContent = '▲';
	floorUpBtn.addEventListener('click', () => {
		setFloor(currentFloor - 1);
	});
	floorGroup.appendChild(floorUpBtn);

	const floorLabel = document.createElement('div');
	floorLabel.className = 'map-floor-display';
	floorGroup.appendChild(floorLabel);

	const floorDownBtn = document.createElement('button');
	floorDownBtn.className = 'map-btn';
	floorDownBtn.textContent = '▼';
	floorDownBtn.addEventListener('click', () => {
		setFloor(currentFloor + 1);
	});
	floorGroup.appendChild(floorDownBtn);

	function formatFloor(floor) {
		const groundFloor = 7;
		if (floor === groundFloor) return '0';
		if (floor < groundFloor) return '+' + (groundFloor - floor);
		return '-' + (floor - groundFloor);
	}

	function updateAreasVisibility() {
		const isGroundFloor = currentFloor === 7;
		const shouldShow = areasEnabled && isGroundFloor;

		if (shouldShow) {
			if (!map.getLayers().getArray().includes(areasLayer)) {
				map.addLayer(areasLayer);
			}
			labelOverlays.forEach((overlay) => {
				if (!map.getOverlays().getArray().includes(overlay)) {
					map.addOverlay(overlay);
				}
			});
		} else {
			map.removeLayer(areasLayer);
			dimmingSource.clear();
			labelOverlays.forEach((overlay) => map.removeOverlay(overlay));
		}
	}

	function setFloor(newFloor) {
		if (newFloor < 0 || newFloor > 15) return;
		currentFloor = newFloor;
		floorLabel.textContent = formatFloor(currentFloor);

		tileSource.changed();
		updateMarkersForFloor(currentFloor);
		updateAreasVisibility();
		updateUrlHash();
	}
	setFloor(currentFloor);

	// Overlay Toggles Control Group
	const toggleGroup = document.createElement('div');
	toggleGroup.className = 'map-control-group';
	controlsContainer.appendChild(toggleGroup);

	const exivaBtn = document.createElement('button');
	exivaBtn.className = 'map-btn';
	exivaBtn.textContent = 'E';
	exivaBtn.title = 'Toggle exiva overlay (E)';
	exivaBtn.addEventListener('click', toggleExiva);
	toggleGroup.appendChild(exivaBtn);

	const markersBtn = document.createElement('button');
	markersBtn.className = 'map-btn';
	markersBtn.textContent = 'M';
	markersBtn.title = 'Toggle markers (M)';
	if (markersEnabled) markersBtn.classList.add('active');
	markersBtn.addEventListener('click', toggleMarkers);
	toggleGroup.appendChild(markersBtn);

	const areasBtn = document.createElement('button');
	areasBtn.className = 'map-btn';
	areasBtn.textContent = 'A';
	areasBtn.title = 'Toggle subarea outlines (A)';
	if (areasEnabled) areasBtn.classList.add('active');
	areasBtn.addEventListener('click', toggleAreas);
	toggleGroup.appendChild(areasBtn);

	const typeBtn = document.createElement('button');
	typeBtn.className = 'map-btn';
	typeBtn.textContent = 'P';
	typeBtn.title = 'Toggle map type (P)';
	typeBtn.addEventListener('click', toggleMapType);
	toggleGroup.appendChild(typeBtn);

	// Fullscreen Control Group
	const fsGroup = document.createElement('div');
	fsGroup.className = 'map-control-group';
	controlsContainer.appendChild(fsGroup);

	const unembed = function (url) {
		return url.replace('/embed', '').replace('?forceBlankTarget', '');
	};

	let fullscreenBtn;
	if (isEmbed) {
		fullscreenBtn = document.createElement('a');
		fullscreenBtn.className = 'map-btn';
		fullscreenBtn.textContent = 'F';
		fullscreenBtn.title = 'Explore this area in the map viewer';
		fullscreenBtn.href = unembed(location.href);
		const forceBlankTarget = new URLSearchParams(location.search).has(
			'forceBlankTarget',
		);
		if (forceBlankTarget) {
			fullscreenBtn.target = '_blank';
		}
		fullscreenBtn.addEventListener('click', function (event) {
			if (!forceBlankTarget) {
				window.top.location = fullscreenBtn.href;
				event.preventDefault();
			}
		});
	} else {
		fullscreenBtn = document.createElement('button');
		fullscreenBtn.className = 'map-btn';
		fullscreenBtn.textContent = 'F';
		fullscreenBtn.title = 'Toggle pseudo-fullscreen (F)';
		fullscreenBtn.addEventListener('click', togglePseudoFullscreen);
	}
	fsGroup.appendChild(fullscreenBtn);

	function toggleExiva() {
		exivaEnabled = !exivaEnabled;
		exivaBtn.classList.toggle('active', exivaEnabled);
		const center = view.getCenter();
		updateCrosshairGeometries(center);
	}

	// Make sure toggleMarkers exists as a function since it is bound to markersBtn event listener
	function toggleMarkers() {
		markersEnabled = !markersEnabled;
		markersBtn.classList.toggle('active', markersEnabled);
		updateMarkersForFloor(currentFloor);
	}

	function toggleMapType() {
		isColorMap = !isColorMap;
		typeBtn.classList.toggle('active', !isColorMap);
		tileSource.changed();
	}

	function toggleAreas() {
		areasEnabled = !areasEnabled;
		areasBtn.classList.toggle('active', areasEnabled);
		updateAreasVisibility();
	}

	function togglePseudoFullscreen() {
		pseudoFullscreenEnabled = !pseudoFullscreenEnabled;
		document.documentElement.classList.toggle(
			'map-pseudo-fullscreen',
			pseudoFullscreenEnabled,
		);
		fullscreenBtn.classList.toggle('active', pseudoFullscreenEnabled);
		map.updateSize();
	}

	// Coordinates Overlay.
	const coordsOverlay = document.createElement('div');
	coordsOverlay.className = 'coords-overlay';
	document.body.appendChild(coordsOverlay);

	coordsOverlay.appendChild(coordsLabelX);
	coordsOverlay.appendChild(coordsLabelY);
	coordsOverlay.appendChild(coordsLabelZ);

	// Global Keyboard Shortcuts.
	document.documentElement.addEventListener('keydown', function (event) {
		const key = event.key.toLowerCase();

		// Prevent arrow key default page scrolling
		if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
			event.preventDefault();
		}

		const panDelta = 40; // Pixels to pan
		const currentResolution = view.getResolution();
		if (currentResolution !== undefined) {
			const mapDelta = panDelta * currentResolution;

			// Accumulate target center relative to previous target if currently animating
			if (!view.getAnimating() || !panTargetCenter) {
				panTargetCenter = view.getCenter();
			}

			if (panTargetCenter) {
				let targetUpdated = false;
				if (key === 'arrowup') {
					panTargetCenter = [panTargetCenter[0], panTargetCenter[1] + mapDelta];
					targetUpdated = true;
				}
				if (key === 'arrowdown') {
					panTargetCenter = [panTargetCenter[0], panTargetCenter[1] - mapDelta];
					targetUpdated = true;
				}
				if (key === 'arrowleft') {
					panTargetCenter = [panTargetCenter[0] - mapDelta, panTargetCenter[1]];
					targetUpdated = true;
				}
				if (key === 'arrowright') {
					panTargetCenter = [panTargetCenter[0] + mapDelta, panTargetCenter[1]];
					targetUpdated = true;
				}

				if (targetUpdated) {
					view.animate({
						center: panTargetCenter,
						duration: 100,
					});
				}
			}
		}

		if (key === 'f') {
			if (isEmbed) {
				fullscreenBtn.click();
			} else {
				togglePseudoFullscreen();
			}
		}
		if (key === 'escape' && pseudoFullscreenEnabled) {
			togglePseudoFullscreen();
		}
		if (key === 'c') {
			view.setCenter([crosshairX, -crosshairY]);
		}
		if (key === 'a') {
			toggleAreas();
		}
		if (key === 'e') {
			toggleExiva();
		}
		if (key === 'm') {
			toggleMarkers();
		}
		if (key === 'p') {
			toggleMapType();
		}
		// Floor navigation
		if (key === 'k') {
			setFloor(currentFloor - 1);
		}
		if (key === 'j') {
			setFloor(currentFloor + 1);
		}
		// Zoom navigation
		if (key === '=' || key === '+') {
			const currentZoom = view.getZoom();
			if (currentZoom !== undefined) {
				view.animate({
					zoom: Math.min(4, currentZoom + 1),
					duration: 120,
				});
			}
		}
		if (key === '-') {
			const currentZoom = view.getZoom();
			if (currentZoom !== undefined) {
				view.animate({
					zoom: Math.max(0, currentZoom - 1),
					duration: 120,
				});
			}
		}
	});

	window.olMap = map;
})();
