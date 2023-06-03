(function() {

	const IS_TIBIAMAPS_IO = location.origin === 'https://tibiamaps.io';
	function TibiaMap() {
		this.map = null;
		this.crosshairs = null;
		this.floor = 7;
		this.mapFloors = [];
		this.markersLayers = [];
		this.markersLayerVisible = false;
		this.options = {};
		this.isColorMap = true;
	}
	const URL_PREFIX = 'https://tibiamaps.github.io/tibia-map-data/';
	// `KNOWN_TILES` is a placeholder for the whitelist of known tiles:
	// https://tibiamaps.github.io/tibia-map-data/mapper/tiles.json
	let KNOWN_TILES = null;
	const fetchKnownTiles = function() {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', URL_PREFIX + 'mapper/tiles.json', true);
		xhr.responseType = 'json';
		xhr.onload = function() {
			if (xhr.status === 200) {
				KNOWN_TILES = new Set(xhr.response);
			}
		};
		xhr.send();
	};
	fetchKnownTiles();
	const isEmbed = location.pathname.indexOf('/embed') !== -1 || location.pathname.indexOf('/poi') !== -1;
	const setUrlPosition = function(coords, forceHash) {
		const url = '#' + coords.x + ',' + coords.y + ',' + coords.floor + ':' + coords.zoom;
		if (
			forceHash &&
			location.hash != url
		) {
			window.history.pushState(null, null, url);
		}
	};
	TibiaMap.prototype.setUrlPosition = setUrlPosition;
	const getUrlPosition = function() {
		const position = {
			'x': 32368,
			'y': 32198,
			'floor': 7,
			'zoom': 0
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
	TibiaMap.prototype.getUrlPosition = getUrlPosition;
	const modifyLeaflet = function() {
		L.CRS.CustomZoom = L.extend({}, L.CRS.Simple, {
			'scale': function(zoom) {
				switch (zoom) {
					case 0:
						return 256;
					case 1:
						return 512;
					case 2:
						return 1792;
					case 3:
						return 5120;
					case 4:
						return 10240;
					default:
						return 256;
				}
			},
			'latLngToPoint': function(latlng, zoom) {
				const projectedPoint = this.projection.project(latlng);
				const scale = this.scale(zoom);
				return this.transformation._transform(projectedPoint, scale);
			},
			'pointToLatLng': function(point, zoom) {
				const scale = this.scale(zoom);
				const untransformedPoint = this.transformation.untransform(point, scale);
				return this.projection.unproject(untransformedPoint);
			}
		});
	};
	TibiaMap.prototype._createMapFloorLayer = function(floor) {
		const _this = this;
		const mapLayer = _this.mapFloors[floor] = new L.GridLayer({
			'floor': floor
		});
		mapLayer.getTileSize = function() {
			const tileSize = L.GridLayer.prototype.getTileSize.call(this);
			const zoom = this._tileZoom;
			// Increase tile size when scaling above `maxNativeZoom`.
			if (zoom > 0) {
				return tileSize.divideBy(this._map.getZoomScale(0, zoom)).round();
			}
			return tileSize;
		};
		mapLayer._setZoomTransform = function(level, center, zoom) {
			const coords = getUrlPosition();
			coords.zoom = zoom;
			setUrlPosition(coords, true);
			const scale = this._map.getZoomScale(zoom, level.zoom);
			const translate = level.origin.multiplyBy(scale).subtract(
				this._map._getNewPixelOrigin(center, zoom)
			).round();
			L.DomUtil.setTransform(level.el, translate, scale);
		};
		mapLayer.createTile = function(coords, done) {
			const tile = document.createElement('canvas');
			const ctx = tile.getContext('2d');
			tile.width = tile.height = 256;

			const latlng = this._map.project({ lng: coords.x, lat: coords.y }, 0);
			Object.keys(latlng).map(function(key) {
				latlng[key] = Math.abs(latlng[key]);
			});

			const tileId = latlng.x + '_' + latlng.y + '_' + this.options.floor;
			// Only fetch the map file if it’s in the whitelist, or if the whitelist
			// has not finished loading yet.
			if (KNOWN_TILES && !KNOWN_TILES.has(tileId)) {
				ctx.fillStyle = '#000';
				ctx.fillRect(0, 0, 256, 256);
				return tile;
			}
			ctx.imageSmoothingEnabled = false;
			const image = new Image();
			image.onload = function() {
				ctx.drawImage(image, 0, 0, 256, 256);
				done(null, tile);
			};
			image.src = URL_PREFIX + 'mapper/Minimap_' + (
				_this.isColorMap ? 'Color' : 'WaypointCost'
			) + '_' + tileId + '.png';
			return tile;
		};
		return mapLayer;
	};
	TibiaMap.prototype._showHoverTile = function() {
		const map = this.map;
		const _this = this;
		map.on('mouseout', function(event) {
			_this.hoverTile.setBounds([
				[0, 0],
				[0, 0]
			]);
		});
		map.on('mousemove', function(event) {
			const pos = map.project(event.latlng, 0);
			const x = Math.floor(pos.x);
			const y = Math.floor(pos.y);
			const bounds = [map.unproject([x, y], 0), map.unproject([x + 1, y + 1], 0)];
			if (!_this.hoverTile) {
				_this.hoverTile = L.rectangle(bounds, {
					color: '#009eff',
					weight: 1,
					clickable: false,
					pointerEvents: 'none'
				}).addTo(map);
			} else {
				_this.hoverTile.setBounds(bounds);
			}
		});
	};
	TibiaMap.prototype._loadMarkers = function () {
		const _this = this;
		const icons = []
		// https://tibiamaps.io/guides/map-file-format#map-marker-data
		const symbols = [
			'!', '$', '?', 'bag', 'checkmark', 'cross', 'crossmark', 'down',
			'flag', 'lock', 'mouth', 'red down', 'red left', 'red right',
			'red up', 'skull', 'spear', 'star', 'sword', 'up',
		];
		const IMAGE_URL_PREFIX = IS_TIBIAMAPS_IO ? '/_img/marker-icons/' : '_img/marker-icons/';
		symbols.forEach(s => {
			icons[s] = L.icon({
				iconSize: [11, 11],
				className: 'leaflet-marker-icon',
				iconUrl: IMAGE_URL_PREFIX + s.replace('!', 'exclamation').replace('$', 'dollar').replace('?', 'question').replace(' ', '-') + '.png',
			});
		});

		function getMarkersSource() {
			const urlParams = new URLSearchParams(window.location.search);
			// Possible markers sources
			// A) https://example.com?markers=<base64-json-str>#32368,32198,7:0
			// B) https://example.com?markersUrl=https://example.com/pack.json#32368,32198,7:0
			// C) <div id="map" data-markers="<json-str>" …>
			// D) <div id="map" data-markers-url="https://example.com/pack.json" …>
			// E) fallback: https://tibiamaps.github.io/tibia-map-data/markers.json
			try {
				if (urlParams.get('markers')) return JSON.parse(atob(urlParams.get('markers')));
				if (urlParams.get('markersUrl')) return urlParams.get('markersUrl');
				if (_this.options.markers) return JSON.parse(_this.options.markers);
				if (_this.options.markersUrl) return _this.options.markersUrl;
			} catch (error) {
				console.error('Invalid custom markers data. Falling back to default markers');
			}
			return URL_PREFIX + 'markers.json';
		}

		const markersSource = getMarkersSource();
		if (typeof markersSource === 'string') {
			loadMarkersFromUrl(markersSource);
		} else {
			buildMarkerLayers(markersSource);
		}

		function loadMarkersFromUrl(url) {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', url);
			xhr.responseType = 'json';
			xhr.onload = function () {
				if (xhr.status === 200) {
					buildMarkerLayers(xhr.response);
				}
			};
			xhr.send();
		}

		function buildMarkerLayers(markersData) {
			markersData.forEach(m => {
				const options = {'title': m.description};
				if (m.icon && m.icon in icons) { options.icon = icons[m.icon]; }
				if (!_this.markersLayers[m.z]) { _this.markersLayers[m.z] = new L.layerGroup(); }
				_this.markersLayers[m.z].addLayer(
					L.marker(_this.map.unproject([m.x + 0.5, m.y + 0.5], 0), options)
				);
			});
			_this._tryShowMarkers();
		}
	};
	TibiaMap.prototype._toggleMarkers = function() {
		this.markersLayerVisible = !this.markersLayerVisible;
		if (this.markersLayers.length === 0) {
			this._loadMarkers(); // Lazy load in case markers were originally disabled
		} else {
			this._tryShowMarkers();
		}
	};
	TibiaMap.prototype._toggleMapType = function() {
		this.isColorMap = !this.isColorMap;
		// TODO: Find a cleaner way to re-render the map.
		const map = this.map;
		map._resetView(map.getCenter(), map.getZoom(), true);
	};
	TibiaMap.prototype._tryShowMarkers = function() {
		const _this = this;
		this.markersLayers.forEach((layer, floor) => {
			if (floor === _this.floor && _this.markersLayerVisible) { _this.map.addLayer(layer); }
			else { _this.map.removeLayer(layer); }
		});
	};


	TibiaMap.prototype.init = function(options) {
		const _this = this;
		_this.options = options;
		modifyLeaflet();
		// Taken from https://tibiamaps.github.io/tibia-map-data/bounds.json, which
		// rarely (if ever) changes.
		const bounds = { xMin: 124, xMax: 133, yMin: 121, yMax: 128 };
		const xPadding = window.innerWidth / 256 / 2;
		const yPadding = window.innerHeight / 256 / 2;
		const yMin = bounds.yMin - yPadding;
		const xMin = bounds.xMin - xPadding;
		const yMax = bounds.yMax + 1 + yPadding;
		const xMax = bounds.xMax + 1 + xPadding;
		const maxBounds = L.latLngBounds(L.latLng(-yMin, xMin), L.latLng(-yMax, xMax));
		const map = _this.map = L.map('map', {
			'attributionControl': false,
			'crs': L.CRS.CustomZoom,
			'fadeAnimation': false,
			'keyboardPanOffset': 400,
			'maxBounds': maxBounds,
			'maxNativeZoom': 0,
			'maxZoom': 4,
			'minZoom': 0,
			'scrollWheelZoom': !isEmbed,
			'unloadInvisibleTiles': false,
			'updateWhenIdle': true,
			'zoomAnimationThreshold': 4,
			'touchZoom': false
		});
		L.control.fullscreen({
			title: {
				false: isEmbed ? 'Explore this area in the map viewer' : 'View fullscreen',
				true: 'Exit fullscreen'
			},
			'pseudoFullscreen': true
		}).addTo(map);
		const baseMaps = {
			'Floor +7': _this._createMapFloorLayer(0),
			'Floor +6': _this._createMapFloorLayer(1),
			'Floor +5': _this._createMapFloorLayer(2),
			'Floor +4': _this._createMapFloorLayer(3),
			'Floor +3': _this._createMapFloorLayer(4),
			'Floor +2': _this._createMapFloorLayer(5),
			'Floor +1': _this._createMapFloorLayer(6),
			'Ground floor': _this._createMapFloorLayer(7),
			'Floor -1': _this._createMapFloorLayer(8),
			'Floor -2': _this._createMapFloorLayer(9),
			'Floor -3': _this._createMapFloorLayer(10),
			'Floor -4': _this._createMapFloorLayer(11),
			'Floor -5': _this._createMapFloorLayer(12),
			'Floor -6': _this._createMapFloorLayer(13),
			'Floor -7': _this._createMapFloorLayer(14),
			'Floor -8': _this._createMapFloorLayer(15)
		};
		const layers_widget = L.control.layers(baseMaps, {}).addTo(map);
		const current = getUrlPosition();
		_this.floor = current.floor;
		map.setView(map.unproject([current.x, current.y], 0), current.zoom);
		_this.mapFloors[current.floor].addTo(map);
		window.addEventListener('popstate', function(event) {
			const current = getUrlPosition();
			if (current.floor !== _this.floor) {
				_this.floor = current.floor;
				_this.mapFloors[_this.floor].addTo(map);
			}
			if (current.zoom !== map.getZoom()) {
				map.setZoom(current.zoom);
			}
			map.panTo(map.unproject([current.x, current.y], 0));
		});
		map.on('baselayerchange', function(layer) {
			_this.floor = layer.layer.options.floor;
			_this._tryShowMarkers();
		});
		map.on('click', function(event) {
			const coords = L.CRS.CustomZoom.latLngToPoint(event.latlng, 0);
			const zoom = map.getZoom();
			const coordX = Math.floor(Math.abs(coords.x));
			const coordY = Math.floor(Math.abs(coords.y));
			const coordZ = _this.floor;
			setUrlPosition({
				x: coordX,
				y: coordY,
				floor: coordZ,
				zoom: zoom
			}, true);
			if (window.console) {
				const xID = Math.floor(coordX / 256) * 256;
				const yID = Math.floor(coordY / 256) * 256;
				const id = xID + '_' + yID + '_' + coordZ;
				console.log(id);
			}
		});
		this.crosshairs = L.crosshairs().addTo(map);
		L.control.coordinates({
			position: 'bottomleft',
			enableUserInput: false,
			labelFormatterLat: function(lat) {
				return '<b>Y</b>: ' + Math.floor(lat) + ' <b>Z</b>: ' + _this.floor;
			},
			labelFormatterLng: function(lng) {
				return '<b>X</b>: ' + Math.floor(lng);
			}
		}).addTo(map);
		L.LevelButtons.btns = L.levelButtons({
			layers_widget: layers_widget
		}).addTo(map);
		L.ExivaButton.btns = L.exivaButton({
			crosshairs: this.crosshairs
		}).addTo(map);
		_this._showHoverTile();

		L.MarkersButton.btns = L.markersButton({
			map: _this
		}).addTo(map);
		if (_this.options.markersEnabled === 'true') {
			_this.markersLayerVisible = true;
			_this._loadMarkers();
		}
	};

	const mapContainer = document.querySelector('#map');
	const map = new TibiaMap();
	map.init(mapContainer.dataset);
	L.LevelButtons.btns.setTibiaMap(map);

	const fakeClick = function(target) {
		const event = document.createEvent('MouseEvents');
		event.initMouseEvent('click');
		target.dispatchEvent(event);
	};

	const unembed = function(url) {
		const updated = url.replace('/embed', '').replace('?forceBlankTarget', '');
		return updated;
	};

	const fullscreen = document.querySelector('.leaflet-control-fullscreen-button');
	// Make the fullscreen ‘button’ act as a permalink in embed views.
	if (isEmbed) {
		// Ensure right-click → copy URL works.
		fullscreen.href = unembed(location.href);
		const forceBlankTarget = new URLSearchParams(location.search).has('forceBlankTarget');
		if (forceBlankTarget) {
			fullscreen.target = '_blank';
		}
		// Override the fullscreen behavior.
		fullscreen.addEventListener('click', function(event) {
			if (forceBlankTarget) {
				window.open(fullscreen.href, '_blank');
			} else {
				window.top.location = fullscreen.href;
			}
			event.stopPropagation();
		});
	} else {
		// Add keyboard shortcuts.
		// Since `fakeClick` seems to follow the `href` no matter what (at
		// least in Chrome), change it to a no-op.
		fullscreen.href = 'javascript:null';
		document.documentElement.addEventListener('keydown', function(event) {
			const _map = map.map;
			if (
				// Press `F` to toggle pseudo-fullscreen mode.
				event.key === 'f' ||
				// Press `Esc` to exit pseudo-fullscreen mode.
				(event.key === 'Escape' && _map.isFullscreen())
			) {
				// The following doesn’t seem to work:
				//_map.toggleFullscreen();
				// …so let’s hack around it:
				fakeClick(fullscreen);
			}
			// Press `C` to center the map on the selected coordinate.
			if (event.key === 'c') {
				const current = getUrlPosition();
				_map.panTo(_map.unproject([current.x, current.y], 0));
			}
			// Press `E` to toggle the exiva overlay.
			if (event.key === 'e') {
				map.crosshairs._toggleExiva();
			}
			// Press `M` to toggle the markers overlay.
			if (event.key === 'm') {
				map._toggleMarkers();
			}
			// Press `P` to toggle the map type (color data vs. pathfinding data).
			if (event.key === 'p') {
				map._toggleMapType();
			}
		});
	}

}());
