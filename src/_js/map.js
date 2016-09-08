(function() {
	function TibiaMap() {
		this.map = null;
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
			if (xhr.status == 200) {
				KNOWN_TILES = new Set(xhr.response);
			}
		};
		xhr.send();
	};
	fetchKnownTiles();
	// https://github.com/tibiamaps/tibia-maps-script/blob/master/src/colors.js
	var MAP_COLORS = {
		0x00: { r: 0, g: 0, b: 0 }, // black (empty)
		0x0C: { r: 0, g: 102, b: 0 }, // dark green (trees)
		0x18: { r: 0, g: 204, b: 0 }, // green (grass)
		0x1E: { r: 0, g: 255, b: 0 }, // light green (old swamp)
		0x33: { r: 51, g: 102, b: 153 }, // light blue (water)
		0x56: { r: 102, g: 102, b: 102 }, // dark gray (stone/mountains)
		0x72: { r: 153, g: 51, b: 0 }, // dark brown (earth/stalagmites)
		0x79: { r: 153, g: 102, b: 51 }, // brown (earth)
		0x81: { r: 153, g: 153, b: 153 }, // gray (floor)
		0x8C: { r: 153, g: 255, b: 102 }, // light green (light spots in grassy areas)
		0xB3: { r: 204, g: 255, b: 255 }, // light blue (ice)
		0xBA: { r: 255, g: 51, b: 0 }, // red (city/walls)
		0xC0: { r: 255, g: 102, b: 0 }, // orange (lava)
		0xCF: { r: 255, g: 204, b: 153 }, // beige (sand)
		0xD2: { r: 255, g: 255, b: 0 }, // yellow (ladders/holes/…)
		0xD7: { r: 255, g: 255, b: 255 } // white (snow / target?)
	};
	var BLANK_COLOR = MAP_COLORS[0x00];
	var EMPTY_MAP_DATA = new Uint8Array(new ArrayBuffer(256 * 256));
	var isEmbed = location.pathname.indexOf('/embed') != -1;
	var padNumber = function(number, size) {
		var s = '000' + String(number);
		return s.substr(s.length - size);
	};
	var setUrlPosition = function(coords, forceHash) {
		var url = '#' + coords.x + ',' + coords.y + ',' + coords.floor + ':' + coords.zoom;
		if (
			forceHash &&
			location.hash != url
		) {
			window.history.pushState(null, null, url);
		}
	};
	var getUrlPosition = function() {
		var position = {
			'x': 32368,
			'y': 32198,
			'floor': 7,
			'zoom': 0
		};
		var parts = window.location.hash.slice(1).split(':');
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
	TibiaMap.prototype._getMapData = function(x, y, z, callback) {
		var mapName = padNumber(x, 3) + padNumber(y, 3) + padNumber(z, 2);
		var dataStore = this.mapDataStore;
		if (dataStore[mapName]) {
			window.requestAnimationFrame(function() {
				callback(dataStore[mapName]);
			});
		} else {
			// Only fetch the map file if it’s in the whitelist, or if the whitelist
			// has not finished loading yet.
			if (!KNOWN_TILES || KNOWN_TILES.has(mapName)) {
				var xhr = new XMLHttpRequest();
				xhr.open('GET', URL_PREFIX + mapName + '.map', true);
				xhr.responseType = 'arraybuffer';
				xhr.onload = function(exception) {
					var mapData;
					if (this.status == 200) {
						mapData = new Uint8Array(this.response);
					} else {
						mapData = EMPTY_MAP_DATA;
					}
					dataStore[mapName] = mapData;
					callback(mapData);
				};
				xhr.send();
			}
		}
	};
	TibiaMap.prototype._createMapImageData = function(imageData, baseX, baseY, baseZ, callback) {
		this._getMapData(baseX, baseY, baseZ, function(mapData) {
			var index = 0;
			for (var x = 0; x < 256; x++) {
				for (var y = 0; y < 256; y++) {
					var data = mapData[index];
					var color = MAP_COLORS[data] || BLANK_COLOR;
					var base = (y * imageData.width + x) * 4;
					imageData.data[base + 0] = color.r;
					imageData.data[base + 1] = color.g;
					imageData.data[base + 2] = color.b;
					imageData.data[base + 3] = 255;
					++index;
				}
			}
			callback(imageData);
		});
	};
	TibiaMap.prototype._createMapFloorLayer = function(floor) {
		var mapLayer = this.mapFloors[floor] = new L.GridLayer();
		var map = this.map;
		var _this = this;
		mapLayer._getTileSize = function() {
			return L.CRS.CustomZoom.scale(map.getZoom())
		};
		mapLayer._setZoomTransform = function(level, center, zoom) {
			var coords = getUrlPosition();
			coords.zoom = zoom;
			setUrlPosition(coords, false);
			var scale = this._map.getZoomScale(zoom, level.zoom);
			var translate = level.origin.multiplyBy(scale).subtract(
				this._map._getNewPixelOrigin(center, zoom)
			).round();
			L.DomUtil.setTransform(level.el, translate, scale);
		};
		mapLayer.createTile = function(coords, done) {
			var tile = document.createElement('canvas');
			tile.width = tile.height = 256;
			var ctx = tile.getContext('2d');
			var data = ctx.createImageData(256, 256);
			_this._createMapImageData(data, coords.x, coords.y, floor, function(image) {
				ctx.putImageData(image, 0, 0);
				ctx.imageSmoothingEnabled = false;
				done(null, tile);
			});
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
		var bounds = { 'xMin': 124, 'xMax': 131, 'yMin': 121, 'yMax': 128 };
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
			'zoomAnimationThreshold': 4
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
			for (var floorID = 0; floorID <= 15; floorID++) {
				if (_this.mapFloors[floorID]._leaflet_id == layer._leaflet_id) {
					_this.floor = floorID;
					break;
				}
			};
		});
		map.on('click', function(event) {
			var coords = L.CRS.CustomZoom.latLngToPoint(event.latlng, 0);
			var zoom = map.getZoom();
			var coordX = Math.floor(Math.abs(coords.x));
			var coordY = Math.floor(Math.abs(coords.y));
			setUrlPosition({
				'x': coordX,
				'y': coordY,
				'floor': _this.floor,
				'zoom': zoom
			}, true);
		});
		// Workaround for https://github.com/tibiamaps/tibia-map/issues/2.
		// TODO: Remove this after updating Leaflet.
		map.on('dblclick', function() {
			if (map.getZoom() == 4) {
				map.doubleClickZoom.disable();
			} else {
				map.doubleClickZoom.enable();
			}
		});
		L.crosshairs().addTo(map);
		L.control.coordinates({
			'position': 'bottomleft',
			'enableUserInput': false,
			'labelFormatterLat': function(lat) {
				var coordX = Math.floor(Math.abs(lat * 256));
				return '<b>Y</b>: ' + coordX + ' <b>Z</b>: ' + _this.floor;
			},
			'labelFormatterLng': function(lng) {
				var coordY = Math.floor(Math.abs(lng * 256));
				return '<b>X</b>: ' + coordY;
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
		// Since `fakeClick` seems to follow the `href` no matter what (at least in
		// Chrome/Opera), change it to a no-op.
		fullscreen.href = 'javascript:null';
		document.documentElement.addEventListener('keydown', function(event) {
			var _map = map.map;
			if (
				// Press `F` to toggle pseudo-fullscreen mode.
				event.keyCode == 0x46 ||
				// Press `Esc` to exit pseudo-fullscreen mode.
				(event.keyCode == 0x1B && _map.isFullscreen())
			) {
				// The following doesn’t seem to work:
				//_map.toggleFullscreen();
				// …so let’s hack around it:
				fakeClick(fullscreen);
			}
			// Press `C` to center the map on the selected coordinate.
			if (event.keyCode == 0x43) {
				var current = getUrlPosition();
				_map.panTo(_map.unproject([current.x, current.y], 0));
			}
		});
	}

}());
