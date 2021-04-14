(function() {
	function TibiaMap() {
		this.map = null;
		this.crosshairs = null;
		this.floor = 7;
		this.mapFloors = [];
		this.mapDataStore = [];
		this.waypoints = [];
	}
	var URL_PREFIX = 'https://tibiamaps.github.io/tibia-map-data/mapper/';
	// `KNOWN_TILES` is a placeholder for the whitelist of known tiles:
	// https://tibiamaps.github.io/tibia-map-data/mapper/tiles.json
	var KNOWN_TILES = null;
	var fetchKnownTiles = function() {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', URL_PREFIX + 'tiles.json', true);
		xhr.responseType = 'json';
		xhr.onload = function() {
			if (xhr.status === 200) {
				KNOWN_TILES = new Set(xhr.response);
			}
		};
		xhr.send();
	};
	fetchKnownTiles();
	var isEmbed = location.pathname.indexOf('/embed') !== -1;
	var setUrlPosition = function(coords, forceHash) {
		var url = '#' + coords.x + ',' + coords.y + ',' + coords.floor + ':' + coords.zoom;
		if (
			forceHash &&
			location.hash != url
		) {
			window.history.pushState(null, null, url);
		}
	};
	TibiaMap.prototype.setUrlPosition = setUrlPosition;
	var getUrlPosition = function() {
		var position = {
			'x': 32368,
			'y': 32198,
			'floor': 7,
			'zoom': 0
		};
		var parts;
		var hash = window.location.hash.slice(1);
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
			var tempPos = parts[0].split(',');
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
	var modifyLeaflet = function() {
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
				var projectedPoint = this.projection.project(latlng);
				var scale = this.scale(zoom);
				return this.transformation._transform(projectedPoint, scale);
			},
			'pointToLatLng': function(point, zoom) {
				var scale = this.scale(zoom);
				var untransformedPoint = this.transformation.untransform(point, scale);
				return this.projection.unproject(untransformedPoint);
			}
		});
	};
	TibiaMap.prototype._createMapFloorLayer = function(floor) {
		var mapLayer = this.mapFloors[floor] = new L.GridLayer({
			'floor': floor
		});
		mapLayer.getTileSize = function() {
			var tileSize = L.GridLayer.prototype.getTileSize.call(this);
			var zoom = this._tileZoom;
			// Increase tile size when scaling above `maxNativeZoom`.
			if (zoom > 0) {
				return tileSize.divideBy(this._map.getZoomScale(0, zoom)).round();
			}
			return tileSize;
		};
		mapLayer._setZoomTransform = function(level, center, zoom) {
			var coords = getUrlPosition();
			coords.zoom = zoom;
			setUrlPosition(coords, true);
			var scale = this._map.getZoomScale(zoom, level.zoom);
			var translate = level.origin.multiplyBy(scale).subtract(
				this._map._getNewPixelOrigin(center, zoom)
			).round();
			L.DomUtil.setTransform(level.el, translate, scale);
		};
		mapLayer.createTile = function(coords, done) {
			var tile = document.createElement('canvas');
			var ctx = tile.getContext('2d');
			tile.width = tile.height = 256;

			var latlng = this._map.project({ lng: coords.x, lat: coords.y }, 0);
			Object.keys(latlng).map(function(key) {
				latlng[key] = Math.abs(latlng[key]);
			});

			var tileId = latlng.x + '_' + latlng.y + '_' + this.options.floor;
			// Only fetch the map file if it’s in the whitelist, or if the whitelist
			// has not finished loading yet.
			if (KNOWN_TILES && !KNOWN_TILES.has(tileId)) {
				ctx.fillStyle = '#000';
				ctx.fillRect(0, 0, 256, 256);
				return tile;
			}
			ctx.imageSmoothingEnabled = false;
			var image = new Image();
			image.onload = function() {
				ctx.drawImage(image, 0, 0, 256, 256);
				done(null, tile);
			};
			image.src = URL_PREFIX + 'Minimap_Color_' + tileId + '.png';
			return tile;
		};
		return mapLayer;
	};
	TibiaMap.prototype._showHoverTile = function() {
		var map = this.map;
		var _this = this;
		map.on('mouseout', function(event) {
			_this.hoverTile.setBounds([
				[0, 0],
				[0, 0]
			]);
		});
		map.on('mousemove', function(event) {
			var pos = map.project(event.latlng, 0);
			var x = Math.floor(pos.x);
			var y = Math.floor(pos.y);
			var bounds = [map.unproject([x, y], 0), map.unproject([x + 1, y + 1], 0)];
			if (!_this.hoverTile) {
				_this.hoverTile = L.rectangle(bounds, {
					'color': '#009eff',
					'weight': 1,
					'clickable': false,
					'pointerEvents': 'none'
				}).addTo(map);
			} else {
				_this.hoverTile.setBounds(bounds);
			}
		});
	};
	TibiaMap.prototype.init = function() {
		var _this = this;
		modifyLeaflet();
		// Taken from https://tibiamaps.github.io/tibia-map-data/bounds.json, which
		// rarely (if ever) changes.
		var bounds = { 'xMin': 124, 'xMax': 133, 'yMin': 121, 'yMax': 128 };
		var xPadding = window.innerWidth / 256 / 2;
		var yPadding = window.innerHeight / 256 / 2;
		var yMin = bounds.yMin - yPadding;
		var xMin = bounds.xMin - xPadding;
		var yMax = bounds.yMax + 1 + yPadding;
		var xMax = bounds.xMax + 1 + xPadding;
		var maxBounds = L.latLngBounds(L.latLng(-yMin, xMin), L.latLng(-yMax, xMax));
		var map = _this.map = L.map('map', {
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
			'title': {
				'false': isEmbed ? 'Explore this area in the map viewer' : 'View fullscreen',
				'true': 'Exit fullscreen'
			},
			'pseudoFullscreen': true
		}).addTo(map);
		var baseMaps = {
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
		var layers_widget = L.control.layers(baseMaps, {}).addTo(map);
		var current = getUrlPosition();
		_this.floor = current.floor;
		map.setView(map.unproject([current.x, current.y], 0), current.zoom);
		_this.mapFloors[current.floor].addTo(map);
		window.addEventListener('popstate', function(event) {
			var current = getUrlPosition();
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
		});
		map.on('click', function(event) {
			var coords = L.CRS.CustomZoom.latLngToPoint(event.latlng, 0);
			var zoom = map.getZoom();
			var coordX = Math.floor(Math.abs(coords.x));
			var coordY = Math.floor(Math.abs(coords.y));
			var coordZ = _this.floor;
			setUrlPosition({
				x: coordX,
				y: coordY,
				floor: coordZ,
				zoom: zoom
			}, true);
			if (window.console) {
				var xID = Math.floor(coordX / 256) * 256;
				var yID = Math.floor(coordY / 256) * 256;
				var id = xID + '_' + yID + '_' + coordZ;
				console.log(id);
			}
		});
		this.crosshairs = L.crosshairs().addTo(map);
		L.control.coordinates({
			'position': 'bottomleft',
			'enableUserInput': false,
			'labelFormatterLat': function(lat) {
				return '<b>Y</b>: ' + Math.floor(lat) + ' <b>Z</b>: ' + _this.floor;
			},
			'labelFormatterLng': function(lng) {
				return '<b>X</b>: ' + Math.floor(lng);
			}
		}).addTo(map);
		L.LevelButtons.btns = L.levelButtons({
			'layers_widget': layers_widget
		}).addTo(map);
		_this._showHoverTile();
	};

	var map = new TibiaMap();
	map.init();
	L.LevelButtons.btns.setTibiaMap(map);

	var fakeClick = function(target) {
		var event = document.createEvent('MouseEvents');
		event.initMouseEvent('click');
		target.dispatchEvent(event);
	};

	var unembed = function(url) {
		return url.replace('/embed', '');
	};

	var fullscreen = document.querySelector('.leaflet-control-fullscreen-button');
	// Make the fullscreen ‘button’ act as a permalink in embed views.
	if (isEmbed) {
		// Ensure right-click → copy URL works.
		fullscreen.href = unembed(location.href);
		// Override the fullscreen behavior.
		fullscreen.addEventListener('click', function(event) {
			window.top.location = unembed(location.href);
			event.stopPropagation();
		});
	} else {
		// Add keyboard shortcuts.
		// Since `fakeClick` seems to follow the `href` no matter what (at
		// least in Chrome), change it to a no-op.
		fullscreen.href = 'javascript:null';
		document.documentElement.addEventListener('keydown', function(event) {
			var _map = map.map;
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
				var current = getUrlPosition();
				_map.panTo(_map.unproject([current.x, current.y], 0));
			}
			// Press `E` to toggle the exiva overlay.
			if (event.key === 'e') {
				map.crosshairs._toggleExiva();
			}
		});
	}

}());
