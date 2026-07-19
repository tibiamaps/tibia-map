(function () {
	const IS_TIBIAMAPS_IO = location.origin === 'https://tibiamaps.io';
	const IS_LOCALHOST =
		location.hostname === 'localhost' || location.hostname === '127.0.0.1';
	const URL_PREFIX = 'https://tibiamaps.github.io/tibia-map-data/';
	const IMAGE_URL_PREFIX = IS_TIBIAMAPS_IO
		? '/_img/marker-icons/'
		: '_img/marker-icons/';

	const ZOOM_SCALES = [1, 2, 7, 20, 40];
	// Keep in sync with https://tibiamaps.github.io/tibia-map-data/bounds.json,
	// adding `256` for `xMax` and `yMax`.
	const MAP_BOUNDS = { xMin: 31744, xMax: 34304, yMin: 30976, yMax: 33024 };

	let KNOWN_TILES = null;
	const fetchKnownTiles = async function () {
		try {
			const res = await fetch(URL_PREFIX + 'mapper/tiles.json');
			if (res.ok) {
				const data = await res.json();
				KNOWN_TILES = new Set(data);
				draw();
			}
		} catch (error) {}
	};
	fetchKnownTiles();

	// State variables (all Y values are positive).
	let centerX = 32368;
	let centerY = 32198;
	let currentFloor = 7;
	let zoomLevel = 0;
	let exivaEnabled = false;
	let markersEnabled = true;
	let areasEnabled = false;
	let isColorMap = true;
	let pseudoFullscreenEnabled = false;

	let crosshairX = 32368;
	let crosshairY = 32198;

	let allAreasData = [];
	let markersData = [];
	let hoveredSubareaId = null;
	let hoveredMarker = null;

	// Animation target variables.
	let panTargetX = null;
	let panTargetY = null;
	let zoomTargetScale = ZOOM_SCALES[zoomLevel];
	let zoomCurrentScale = ZOOM_SCALES[zoomLevel];
	let zoomPivotGameX = null;
	let zoomPivotGameY = null;
	let zoomPivotScreenX = null;
	let zoomPivotScreenY = null;

	// Canvas and cache.
	let canvas, ctx;
	const tileCache = new Map();
	const markerIconCache = new Map();

	// Coordinates overlays elements.
	let coordsLabelX, coordsLabelY, coordsLabelZ;
	let floorLabel, exivaBtn, markersBtn, areasBtn, typeBtn, fullscreenBtn;

	const setUrlPosition = function (coords, forceHash) {
		const url =
			'#' + coords.x + ',' + coords.y + ',' + coords.floor + ':' + coords.zoom;
		if (forceHash && location.hash != url) {
			window.history.pushState(null, null, url);
		}
	};

	const getUrlPosition = function () {
		const position = {
			x: 32368,
			y: 32198,
			floor: 7,
			zoom: 0,
		};
		let parts;
		let hash = window.location.hash.slice(1);
		if (hash.includes('%20')) {
			// Handle URLs containing copy-pasted markers from the
			// tibia-map-data repository, such as:
			//     #"x": 32838, "y": 32818, "z": 11
			// Such URLs do not specify a zoom level.
			hash = decodeURIComponent(hash);
			parts = hash.replace(/[^0-9,]/g, '').split(',');
			position.x = parseInt(parts[0], 10);
			position.y = parseInt(parts[1], 10);
			position.floor = parseInt(parts[2], 10);
			return position;
		}
		// Otherwise, handle URLs containing the expected format:
		//    #32838,32818,11:2
		// Note that the zoom level (`:2`) is optional.
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

	const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

	const clampCenter = function (x, y, scale) {
		if (!canvas) return { x: x, y: y };
		const halfW = canvas.width / 2 / scale;
		const halfH = canvas.height / 2 / scale;
		const limitX = 256;
		const limitY = 256;

		let xMin = MAP_BOUNDS.xMin - limitX + halfW;
		let xMax = MAP_BOUNDS.xMax + limitX - halfW;
		let yMin = MAP_BOUNDS.yMin - limitY + halfH;
		let yMax = MAP_BOUNDS.yMax + limitY - halfH;

		if (xMin > xMax) {
			const midX = (MAP_BOUNDS.xMin + MAP_BOUNDS.xMax) / 2;
			xMin = midX;
			xMax = midX;
		}
		if (yMin > yMax) {
			const midY = (MAP_BOUNDS.yMin + MAP_BOUNDS.yMax) / 2;
			yMin = midY;
			yMax = midY;
		}

		return {
			x: clamp(x, xMin, xMax),
			y: clamp(y, yMin, yMax),
		};
	};

	const isEmbed =
		location.pathname.indexOf('/embed') !== -1 ||
		location.pathname.indexOf('/poi') !== -1;

	// Load subareas.
	async function loadAreas() {
		const urlParams = new URLSearchParams(window.location.search);
		const container = document.getElementById('map');
		const dataset = container ? container.dataset : {};

		let url = '_json/areas.json';
		if (IS_LOCALHOST) {
			url += '?t=' + Date.now();
		}

		if (urlParams.get('areasUrl')) {
			url = urlParams.get('areasUrl');
		} else if (dataset.areasUrl) {
			url = dataset.areasUrl;
		}

		try {
			const res = await fetch(url);
			if (res.ok) {
				allAreasData = await res.json();
				draw();
				buildAreaLabels();
			}
		} catch (error) {}
	}

	// Load markers.
	async function loadMarkers() {
		// Possible markers sources.
		// A) https://example.com?markers=<base64-json-str>#32368,32198,7:0
		// B) https://example.com?markersUrl=https://example.com/pack.json#32368,32198,7:0
		// C) <div id="map" data-markers="<json-str>" …>
		// D) <div id="map" data-markers-url="https://example.com/pack.json" …>
		// E) Fallback: https://tibiamaps.github.io/tibia-map-data/markers.json.
		const urlParams = new URLSearchParams(window.location.search);

		// 1. Check custom markers inline data in URL params.
		try {
			if (urlParams.get('markers')) {
				markersData = JSON.parse(atob(urlParams.get('markers')));
				draw();
				return;
			}
		} catch (error) {
			console.error('Invalid URL markers parameter.');
		}

		// 2. Check inline data from container dataset.
		const container = document.getElementById('map');
		const dataset = container ? container.dataset : {};
		try {
			if (dataset.markers) {
				markersData = JSON.parse(dataset.markers);
				draw();
				return;
			}
		} catch (error) {
			console.error('Invalid inline data-markers attribute.');
		}

		// 3. Determine URL to fetch.
		let url = URL_PREFIX + 'markers.json';
		if (urlParams.get('markersUrl')) {
			url = urlParams.get('markersUrl');
		} else if (dataset.markersUrl) {
			url = dataset.markersUrl;
		}

		try {
			const res = await fetch(url);
			if (res.ok) {
				markersData = await res.json();
				draw();
			}
		} catch (error) {}
	}

	// Render area labels as HTML overlays positioned over the canvas.
	const labelsContainer = document.createElement('div');
	labelsContainer.className = 'map-labels-container';

	function buildAreaLabels() {
		labelsContainer.innerHTML = '';
		if (!areasEnabled || currentFloor !== 7) return;

		allAreasData.forEach((subarea) => {
			const labelEl = document.createElement('div');
			labelEl.className = 'map-subarea-label';
			labelEl.innerHTML = '<span>' + subarea.subarea + '</span>';
			labelsContainer.appendChild(labelEl);

			subarea.el = labelEl;

			labelEl.addEventListener('mouseenter', () => {
				document.getElementById('map').classList.add('map-dimmed');
				labelEl.classList.add('active');
				hoveredSubareaId = subarea.id;
				draw();
			});

			labelEl.addEventListener('mouseleave', () => {
				document.getElementById('map').classList.remove('map-dimmed');
				labelEl.classList.remove('active');
				hoveredSubareaId = null;
				draw();
			});
		});
		updateAreaLabelsPosition();
	}

	function updateAreaLabelsPosition() {
		if (!areasEnabled || currentFloor !== 7) {
			labelsContainer.style.display = 'none';
			return;
		}
		labelsContainer.style.display = 'block';

		const scale = zoomCurrentScale;
		const rect = canvas.getBoundingClientRect();
		const halfW = rect.width / 2;
		const halfH = rect.height / 2;

		allAreasData.forEach((subarea) => {
			if (!subarea.el) return;
			const sx = (subarea.center[0] - centerX) * scale + halfW;
			const sy = (subarea.center[1] - centerY) * scale + halfH;

			// Check if inside canvas boundaries.
			if (sx >= 0 && sx <= rect.width && sy >= 0 && sy <= rect.height) {
				subarea.el.style.display = 'block';
				subarea.el.style.left = sx + 'px';
				subarea.el.style.top = sy + 'px';
			} else {
				subarea.el.style.display = 'none';
			}
		});
	}

	// Main draw function.
	function draw() {
		if (!canvas) return;

		const width = canvas.width;
		const height = canvas.height;
		const scale = zoomCurrentScale;

		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, width, height);

		// 1. Draw map tiles.
		const minX = centerX - width / 2 / scale;
		const maxX = centerX + width / 2 / scale;
		const minY = centerY - height / 2 / scale;
		const maxY = centerY + height / 2 / scale;

		const startTileX = Math.floor(
			clamp(minX, MAP_BOUNDS.xMin, MAP_BOUNDS.xMax) / 256,
		);
		const endTileX = Math.floor(
			clamp(maxX, MAP_BOUNDS.xMin, MAP_BOUNDS.xMax) / 256,
		);
		const startTileY = Math.floor(
			clamp(minY, MAP_BOUNDS.yMin, MAP_BOUNDS.yMax) / 256,
		);
		const endTileY = Math.floor(
			clamp(maxY, MAP_BOUNDS.yMin, MAP_BOUNDS.yMax) / 256,
		);

		for (let tx = startTileX; tx <= endTileX; tx++) {
			for (let ty = startTileY; ty <= endTileY; ty++) {
				const tileId = tx * 256 + '_' + ty * 256 + '_' + currentFloor;
				if (KNOWN_TILES && !KNOWN_TILES.has(tileId)) continue;

				let img = tileCache.get(tileId);
				if (!img) {
					img = new Image();
					img.onload = () => draw();
					img.src =
						URL_PREFIX +
						'mapper/Minimap_' +
						(isColorMap ? 'Color' : 'WaypointCost') +
						'_' +
						tileId +
						'.png';
					tileCache.set(tileId, img);
				}

				if (img.complete && img.naturalWidth !== 0) {
					const dx = Math.round((tx * 256 - centerX) * scale + width / 2);
					const dy = Math.round((ty * 256 - centerY) * scale + height / 2);
					const dSize = Math.round(256 * scale);
					ctx.drawImage(img, dx, dy, dSize, dSize);
				}
			}
		}

		// 2. Draw boundaries and dimming overlay.
		if (areasEnabled && currentFloor === 7) {
			let hoveredSubarea = null;

			// Viewport bounds in game coordinates.
			const viewMinX = centerX - width / 2 / scale;
			const viewMaxX = centerX + width / 2 / scale;
			const viewMinY = centerY - height / 2 / scale;
			const viewMaxY = centerY + height / 2 / scale;

			allAreasData.forEach((subarea) => {
				if (subarea.id === hoveredSubareaId) {
					hoveredSubarea = subarea;
					return;
				}

				// Viewport culling using bounding box.
				if (
					subarea.bbox[2] < viewMinX ||
					subarea.bbox[0] > viewMaxX ||
					subarea.bbox[3] < viewMinY ||
					subarea.bbox[1] > viewMaxY
				) {
					return;
				}

				// Draw normal yellow stroke outlines.
				ctx.lineWidth = 1.5 * Math.sqrt(scale);
				ctx.strokeStyle = '#ffcc00';
				subarea.rings.forEach((ring) => {
					ctx.beginPath();
					ring.forEach((pt, idx) => {
						const sx = (pt[0] - centerX) * scale + width / 2;
						const sy = (pt[1] - centerY) * scale + height / 2;
						if (idx === 0) ctx.moveTo(sx, sy);
						else ctx.lineTo(sx, sy);
					});
					ctx.closePath();
					ctx.stroke();
				});
			});

			// If a subarea is hovered, draw the dimming overlay with cutouts.
			if (hoveredSubarea) {
				ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
				ctx.beginPath();
				ctx.rect(0, 0, width, height);

				hoveredSubarea.rings.forEach((ring) => {
					ring.forEach((pt, idx) => {
						const sx = (pt[0] - centerX) * scale + width / 2;
						const sy = (pt[1] - centerY) * scale + height / 2;
						if (idx === 0) ctx.moveTo(sx, sy);
						else ctx.lineTo(sx, sy);
					});
				});
				ctx.closePath();
				ctx.fill('evenodd');

				// Draw the hovered subarea's outlines thicker.
				ctx.lineWidth = 3.0 * Math.sqrt(scale);
				ctx.strokeStyle = '#ffcc00';
				hoveredSubarea.rings.forEach((ring) => {
					ctx.beginPath();
					ring.forEach((pt, idx) => {
						const sx = (pt[0] - centerX) * scale + width / 2;
						const sy = (pt[1] - centerY) * scale + height / 2;
						if (idx === 0) ctx.moveTo(sx, sy);
						else ctx.lineTo(sx, sy);
					});
					ctx.closePath();
					ctx.stroke();
				});
			}
		}

		// 3. Draw exiva crosshairs.
		// 3a. Draw target 1x1 square (always visible).
		const tx = Math.round((crosshairX - centerX) * scale + width / 2);
		const ty = Math.round((crosshairY - centerY) * scale + height / 2);
		const tSize = Math.round(Math.max(1, scale));
		ctx.strokeRect(tx, ty, tSize, tSize);

		// 3b. Center crosshair lines exactly on the target square.
		const cx = Math.round(tx + tSize / 2);
		const cy = Math.round(ty + tSize / 2);
		ctx.strokeStyle = '#333333';
		ctx.lineWidth = 2;
		if (exivaEnabled) {
			// 3b. Draw exiva 100 & 250 concentric squares.
			const s100 = Math.round(100 * scale);
			ctx.strokeRect(tx - s100, ty - s100, tSize + s100 * 2, tSize + s100 * 2);

			const s250 = Math.round(250 * scale);
			ctx.strokeRect(tx - s250, ty - s250, tSize + s250 * 2, tSize + s250 * 2);

			// 3c. Draw 8 radar guideline angles.
			const R = 3000;
			const angles = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
			ctx.beginPath();
			angles.forEach((deg) => {
				const rad = (deg * Math.PI) / 180;
				ctx.moveTo(cx, cy);
				ctx.lineTo(cx + R * Math.cos(rad), cy + R * Math.sin(rad));
			});
			ctx.stroke();
		} else {
			// 3d. Draw horizontal and vertical crosshair lines.
			ctx.beginPath();
			ctx.moveTo(cx, 0);
			ctx.lineTo(cx, height);
			ctx.moveTo(0, cy);
			ctx.lineTo(width, cy);
			ctx.stroke();
		}

		// 4. Draw Markers.
		if (markersEnabled) {
			markersData.forEach((m) => {
				if (m.z !== currentFloor) return;
				const mx = Math.round((m.x + 0.5 - centerX) * scale + width / 2);
				const my = Math.round((m.y + 0.5 - centerY) * scale + height / 2);

				const iconName = m.icon
					.replace('!', 'exclamation')
					.replace('$', 'dollar')
					.replace('?', 'question')
					.replace(' ', '-');
				const iconUrl = IMAGE_URL_PREFIX + iconName + '.png';

				let iconImg = markerIconCache.get(iconUrl);
				if (!iconImg) {
					iconImg = new Image();
					iconImg.onload = () => draw();
					iconImg.src = iconUrl;
					markerIconCache.set(iconUrl, iconImg);
				}

				if (iconImg.complete && iconImg.naturalWidth !== 0) {
					ctx.drawImage(
						iconImg,
						Math.round(mx - 5.5),
						Math.round(my - 5.5),
						11,
						11,
					);
				}
			});
		}

		// Update UI overlays positions.
		updateAreaLabelsPosition();
	}

	// Tooltip element for markers.
	const tooltipEl = document.createElement('div');
	tooltipEl.className = 'map-marker-tooltip';

	function checkHover(event) {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;
		const scale = zoomCurrentScale;

		// Convert screen mouse coordinates back to game coordinates.
		const gameX = (mouseX - rect.width / 2) / scale + centerX;
		const gameY = (mouseY - rect.height / 2) / scale + centerY;

		// 1. Update coords display HUD.
		coordsLabelX.textContent = 'X: ' + Math.floor(gameX);
		coordsLabelY.textContent = 'Y: ' + Math.floor(gameY);

		// 2. Check marker hover.
		let foundMarker = null;
		if (markersEnabled) {
			for (let i = 0; i < markersData.length; i++) {
				const m = markersData[i];
				if (m.z !== currentFloor) continue;
				const dist =
					Math.sqrt(
						Math.pow(m.x + 0.5 - gameX, 2) + Math.pow(m.y + 0.5 - gameY, 2),
					) * scale;
				if (dist <= 7.0) {
					// Hover hit zone within 7px radius.
					foundMarker = m;
					break;
				}
			}
		}

		if (
			foundMarker &&
			foundMarker.description &&
			foundMarker.description.trim()
		) {
			hoveredMarker = foundMarker;
			tooltipEl.textContent = foundMarker.description;
			tooltipEl.style.display = 'block';
			tooltipEl.style.left = mouseX + 10 + 'px';
			tooltipEl.style.top = mouseY + 10 + 'px';
		} else {
			hoveredMarker = null;
			tooltipEl.style.display = 'none';
		}
	}

	// Floor selection.
	function setFloor(newFloor) {
		if (newFloor < 0 || newFloor > 15) return;
		currentFloor = newFloor;
		floorLabel.textContent = formatFloor(currentFloor);
		coordsLabelZ.textContent = 'Z: ' + currentFloor;
		tileCache.clear();
		draw();
		buildAreaLabels();
		setUrlPosition(
			{ x: crosshairX, y: crosshairY, floor: currentFloor, zoom: zoomLevel },
			true,
		);
	}

	const formatFloor = function (floor) {
		if (floor === 7) {
			return '0';
		}
		if (floor < 7) {
			return '+' + (7 - floor);
		}
		return '-' + (floor - 7);
	};

	// Zoom operations.
	function zoomTo(newZoom, pivotX, pivotY) {
		newZoom = clamp(newZoom, 0, 4);
		if (newZoom === zoomLevel) return;

		const oldScale = zoomCurrentScale;
		zoomLevel = newZoom;
		zoomTargetScale = ZOOM_SCALES[zoomLevel];

		if (pivotX !== undefined && pivotY !== undefined) {
			// Record the pivot point in game coordinates using the current scale.
			zoomPivotGameX = (pivotX - canvas.width / 2) / oldScale + centerX;
			zoomPivotGameY = (pivotY - canvas.height / 2) / oldScale + centerY;
			zoomPivotScreenX = pivotX;
			zoomPivotScreenY = pivotY;
		} else {
			// Center of canvas as fallback pivot.
			zoomPivotGameX = centerX;
			zoomPivotGameY = centerY;
			zoomPivotScreenX = canvas.width / 2;
			zoomPivotScreenY = canvas.height / 2;
		}

		setUrlPosition(
			{ x: crosshairX, y: crosshairY, floor: currentFloor, zoom: zoomLevel },
			true,
		);
	}

	// Toggle operations.
	function toggleExiva() {
		exivaEnabled = !exivaEnabled;
		exivaBtn.classList.toggle('active', exivaEnabled);
		draw();
	}

	// Toggle markers.
	function toggleMarkers() {
		markersEnabled = !markersEnabled;
		markersBtn.classList.toggle('active', markersEnabled);
		draw();
	}

	// Toggle areas.
	function toggleAreas() {
		areasEnabled = !areasEnabled;
		areasBtn.classList.toggle('active', areasEnabled);
		draw();
		buildAreaLabels();
	}

	// Toggle map type.
	function toggleMapType() {
		isColorMap = !isColorMap;
		typeBtn.classList.toggle('active', !isColorMap);
		tileCache.clear();
		draw();
	}

	// Toggle pseudo fullscreen.
	function togglePseudoFullscreen() {
		pseudoFullscreenEnabled = !pseudoFullscreenEnabled;
		document.documentElement.classList.toggle(
			'map-pseudo-fullscreen',
			pseudoFullscreenEnabled,
		);
		fullscreenBtn.classList.toggle('active', pseudoFullscreenEnabled);
		resizeCanvas();
	}

	// LERP animation loop.
	function updateAnimation() {
		let needsRedraw = false;

		// 1. Pan smoothing interpolation.
		if (panTargetX !== null && panTargetY !== null) {
			const nextX = centerX + (panTargetX - centerX) * 0.25;
			const nextY = centerY + (panTargetY - centerY) * 0.25;
			const clamped = clampCenter(nextX, nextY, zoomCurrentScale);
			centerX = clamped.x;
			centerY = clamped.y;

			if (
				Math.abs(centerX - panTargetX) < 0.05 &&
				Math.abs(centerY - panTargetY) < 0.05
			) {
				centerX = panTargetX;
				centerY = panTargetY;
				panTargetX = null;
				panTargetY = null;
			}
			needsRedraw = true;
		}

		// 2. Zoom smoothing interpolation.
		if (Math.abs(zoomCurrentScale - zoomTargetScale) > 0.01) {
			zoomCurrentScale += (zoomTargetScale - zoomCurrentScale) * 0.2;
			if (zoomPivotGameX !== null && zoomPivotGameY !== null) {
				const tx =
					zoomPivotGameX -
					(zoomPivotScreenX - canvas.width / 2) / zoomCurrentScale;
				const ty =
					zoomPivotGameY -
					(zoomPivotScreenY - canvas.height / 2) / zoomCurrentScale;
				const clamped = clampCenter(tx, ty, zoomCurrentScale);
				centerX = clamped.x;
				centerY = clamped.y;
			}
			needsRedraw = true;
		} else {
			if (zoomCurrentScale !== zoomTargetScale) {
				zoomCurrentScale = zoomTargetScale;
				needsRedraw = true;
			}
			if (zoomPivotGameX !== null) {
				const tx =
					zoomPivotGameX -
					(zoomPivotScreenX - canvas.width / 2) / zoomCurrentScale;
				const ty =
					zoomPivotGameY -
					(zoomPivotScreenY - canvas.height / 2) / zoomCurrentScale;
				const clamped = clampCenter(tx, ty, zoomCurrentScale);
				centerX = clamped.x;
				centerY = clamped.y;
				zoomPivotGameX = null;
				zoomPivotGameY = null;
				needsRedraw = true;
			}
		}

		if (needsRedraw) {
			draw();
		}
		requestAnimationFrame(updateAnimation);
	}
	requestAnimationFrame(updateAnimation);

	// Resize canvas to container.
	function resizeCanvas() {
		if (!canvas) return;
		const container = document.getElementById('map');
		canvas.width = container.clientWidth;
		canvas.height = container.clientHeight;
		ctx.imageSmoothingEnabled = false;

		const clamped = clampCenter(centerX, centerY, zoomCurrentScale);
		centerX = clamped.x;
		centerY = clamped.y;

		draw();
	}

	// Initialize custom map viewer.
	function initMap() {
		const container = document.getElementById('map');

		// 1. Parse initial dataset state.
		const dataset = container ? container.dataset : {};
		if (dataset.markersEnabled !== undefined) {
			markersEnabled = dataset.markersEnabled === 'true';
		}
		if (dataset.areasEnabled !== undefined) {
			areasEnabled = dataset.areasEnabled === 'true';
		}
		if (dataset.exivaEnabled !== undefined) {
			exivaEnabled = dataset.exivaEnabled === 'true';
		}

		const initial = getUrlPosition();
		centerX = initial.x;
		centerY = initial.y;
		currentFloor = initial.floor;
		zoomLevel = initial.zoom;

		crosshairX = centerX;
		crosshairY = centerY;

		zoomTargetScale = ZOOM_SCALES[zoomLevel];
		zoomCurrentScale = ZOOM_SCALES[zoomLevel];

		// 2. Build canvas.
		canvas = document.createElement('canvas');
		canvas.style.display = 'block';
		canvas.style.imageRendering = 'pixelated';
		container.innerHTML = '';
		container.appendChild(canvas);
		container.appendChild(labelsContainer);
		container.appendChild(tooltipEl);
		ctx = canvas.getContext('2d');
		ctx.imageSmoothingEnabled = false;

		// 3. Register canvas listeners.
		let isDragging = false;
		let dragStartX, dragStartY;
		let dragStartCenterX, dragStartCenterY;

		canvas.addEventListener('mousedown', (event) => {
			isDragging = true;
			dragStartX = event.clientX;
			dragStartY = event.clientY;
			dragStartCenterX = centerX;
			dragStartCenterY = centerY;
			panTargetX = null; // Interrupt keyboard animations.
			panTargetY = null;
		});

		window.addEventListener('mouseup', () => {
			isDragging = false;
		});

		canvas.addEventListener('mousemove', (event) => {
			if (isDragging) {
				const dx = event.clientX - dragStartX;
				const dy = event.clientY - dragStartY;
				const scale = zoomCurrentScale;
				const tx = dragStartCenterX - dx / scale;
				const ty = dragStartCenterY - dy / scale;
				const clamped = clampCenter(tx, ty, scale);
				centerX = clamped.x;
				centerY = clamped.y;
				draw();
			} else {
				checkHover(event);
			}
		});

		// Mouse wheel instant snapping zoom with cooldown.
		let lastZoomTime = 0;
		const cooldownMs = 150;
		container.addEventListener('wheel', (event) => {
			event.preventDefault();
			const now = Date.now();
			if (now - lastZoomTime < cooldownMs) return;
			lastZoomTime = now;

			const rect = canvas.getBoundingClientRect();
			const pivotX = event.clientX - rect.left;
			const pivotY = event.clientY - rect.top;

			const newZoom = event.deltaY < 0 ? zoomLevel + 1 : zoomLevel - 1;
			zoomTo(newZoom, pivotX, pivotY);
		});

		// Canvas click updates exiva crosshairs and hash.
		canvas.addEventListener('click', (event) => {
			if (isDragging) return;
			const rect = canvas.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;
			const mouseY = event.clientY - rect.top;
			const scale = zoomCurrentScale;

			crosshairX = Math.floor((mouseX - rect.width / 2) / scale + centerX);
			crosshairY = Math.floor((mouseY - rect.height / 2) / scale + centerY);

			setUrlPosition(
				{ x: crosshairX, y: crosshairY, floor: currentFloor, zoom: zoomLevel },
				true,
			);

			if (window.console) {
				const xID = Math.floor(crosshairX / 256) * 256;
				const yID = Math.floor(crosshairY / 256) * 256;
				const id = xID + '_' + yID + '_' + currentFloor;
				console.log(id);
			}

			draw();
		});

		// Touch drag support.
		canvas.addEventListener('touchstart', (event) => {
			if (event.touches.length !== 1) return;
			isDragging = true;
			dragStartX = event.touches[0].clientX;
			dragStartY = event.touches[0].clientY;
			dragStartCenterX = centerX;
			dragStartCenterY = centerY;
			panTargetX = null;
			panTargetY = null;
		});

		canvas.addEventListener('touchmove', (event) => {
			if (!isDragging || event.touches.length !== 1) return;
			const dx = event.touches[0].clientX - dragStartX;
			const dy = event.touches[0].clientY - dragStartY;
			const scale = zoomCurrentScale;
			const tx = dragStartCenterX - dx / scale;
			const ty = dragStartCenterY - dy / scale;
			const clamped = clampCenter(tx, ty, scale);
			centerX = clamped.x;
			centerY = clamped.y;
			draw();
		});

		canvas.addEventListener('touchend', () => {
			isDragging = false;
		});

		window.addEventListener('resize', resizeCanvas);
		resizeCanvas();

		// Load external assets.
		loadAreas();
		loadMarkers();

		// 4. Build HUD overlays.
		buildHUD();
	}

	// Build HTML HUD panels.
	function buildHUD() {
		const container = document.getElementById('map');
		const controlsContainer = document.createElement('div');
		controlsContainer.className = 'map-controls';
		container.appendChild(controlsContainer);

		// Floor changer group.
		const floorGroup = document.createElement('div');
		floorGroup.className = 'map-control-group';
		controlsContainer.appendChild(floorGroup);

		const upBtn = document.createElement('button');
		upBtn.className = 'map-btn';
		upBtn.textContent = '▲';
		upBtn.title = 'Go up one floor (K)';
		upBtn.addEventListener('click', () => setFloor(currentFloor - 1));
		floorGroup.appendChild(upBtn);

		floorLabel = document.createElement('span');
		floorLabel.className = 'map-floor-display';
		floorLabel.textContent = formatFloor(currentFloor);
		floorGroup.appendChild(floorLabel);

		const downBtn = document.createElement('button');
		downBtn.className = 'map-btn';
		downBtn.textContent = '▼';
		downBtn.title = 'Go down one floor (J)';
		downBtn.addEventListener('click', () => setFloor(currentFloor + 1));
		floorGroup.appendChild(downBtn);

		// Overlay toggles group.
		const toggleGroup = document.createElement('div');
		toggleGroup.className = 'map-control-group';
		controlsContainer.appendChild(toggleGroup);

		exivaBtn = document.createElement('button');
		exivaBtn.className = 'map-btn';
		exivaBtn.textContent = 'E';
		exivaBtn.title = 'Toggle exiva overlay (E)';
		if (exivaEnabled) exivaBtn.classList.add('active');
		exivaBtn.addEventListener('click', toggleExiva);
		toggleGroup.appendChild(exivaBtn);

		markersBtn = document.createElement('button');
		markersBtn.className = 'map-btn';
		markersBtn.textContent = 'M';
		markersBtn.title = 'Toggle markers (M)';
		if (markersEnabled) markersBtn.classList.add('active');
		markersBtn.addEventListener('click', toggleMarkers);
		toggleGroup.appendChild(markersBtn);

		areasBtn = document.createElement('button');
		areasBtn.className = 'map-btn';
		areasBtn.textContent = 'A';
		areasBtn.title = 'Toggle subarea outlines (A)';
		if (areasEnabled) areasBtn.classList.add('active');
		areasBtn.addEventListener('click', toggleAreas);
		toggleGroup.appendChild(areasBtn);

		typeBtn = document.createElement('button');
		typeBtn.className = 'map-btn';
		typeBtn.textContent = 'P';
		typeBtn.title = 'Toggle map type (P)';
		typeBtn.addEventListener('click', toggleMapType);
		toggleGroup.appendChild(typeBtn);

		// Fullscreen group.
		const fsGroup = document.createElement('div');
		fsGroup.className = 'map-control-group';
		controlsContainer.appendChild(fsGroup);

		fullscreenBtn = document.createElement('button');
		fullscreenBtn.className = 'map-btn';
		fullscreenBtn.textContent = 'F';
		fullscreenBtn.title = 'Toggle pseudo-fullscreen (F)';
		fullscreenBtn.addEventListener('click', togglePseudoFullscreen);
		fsGroup.appendChild(fullscreenBtn);

		// Coordinates labels.
		const coordsOverlay = document.createElement('div');
		coordsOverlay.className = 'coords-overlay';
		container.appendChild(coordsOverlay);

		coordsLabelX = document.createElement('span');
		coordsLabelX.id = 'coords-x';
		coordsLabelX.textContent = 'X: ' + Math.floor(centerX);
		coordsOverlay.appendChild(coordsLabelX);

		coordsLabelY = document.createElement('span');
		coordsLabelY.id = 'coords-y';
		coordsLabelY.textContent = 'Y: ' + Math.floor(centerY);
		coordsOverlay.appendChild(coordsLabelY);

		coordsLabelZ = document.createElement('span');
		coordsLabelZ.id = 'coords-z';
		coordsLabelZ.textContent = 'Z: ' + currentFloor;
		coordsOverlay.appendChild(coordsLabelZ);
	}

	// Global keyboard shortcuts.
	document.documentElement.addEventListener('keydown', function (event) {
		const key = event.key.toLowerCase();

		if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
			event.preventDefault();
		}

		const panDelta = 40; // Pixels to pan.
		if (zoomCurrentScale !== undefined) {
			const mapDelta = panDelta / zoomCurrentScale;

			if (!panTargetX || !panTargetY) {
				panTargetX = centerX;
				panTargetY = centerY;
			}

			if (key === 'arrowup') {
				panTargetY -= mapDelta;
			}
			if (key === 'arrowdown') {
				panTargetY += mapDelta;
			}
			if (key === 'arrowleft') {
				panTargetX -= mapDelta;
			}
			if (key === 'arrowright') {
				panTargetX += mapDelta;
			}
		}

		if (key === 'f') {
			togglePseudoFullscreen();
		}
		if (key === 'escape' && pseudoFullscreenEnabled) {
			togglePseudoFullscreen();
		}
		if (key === 'c') {
			centerX = crosshairX;
			centerY = crosshairY;
			panTargetX = null;
			panTargetY = null;
			draw();
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
		if (key === 'k') {
			setFloor(currentFloor - 1);
		}
		if (key === 'j') {
			setFloor(currentFloor + 1);
		}
		if (key === '=' || key === '+') {
			zoomTo(zoomLevel + 1);
		}
		if (key === '-') {
			zoomTo(zoomLevel - 1);
		}
	});

	window.addEventListener('popstate', function () {
		const pos = getUrlPosition();
		if (pos.floor !== currentFloor) {
			setFloor(pos.floor);
		}
		if (pos.zoom !== zoomLevel) {
			zoomTo(pos.zoom);
		}
		const clamped = clampCenter(pos.x, pos.y, ZOOM_SCALES[zoomLevel]);
		centerX = clamped.x;
		centerY = clamped.y;
		crosshairX = centerX;
		crosshairY = centerY;
		draw();
	});

	// Boot map.
	window.addEventListener('DOMContentLoaded', initMap);
})();
