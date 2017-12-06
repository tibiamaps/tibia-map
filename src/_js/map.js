(function() {
	function TibiaMap() {
		this.map = null;
		this.floor = 7;
		this.mapFloors = [];
		this.mapDataStore = [];
		this.waypoints = [];
		this.markers = {};
		this.layer_marker = null;
		this.custom_icons = {};
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
	var isEmbed = location.pathname.indexOf('/embed') != -1;
	var padNumber = function(number, size) {
		var s = '000' + String(number);
		return s.substr(s.length - size);
	};
	var setUrlPosition = function(coords, markers, forceHash) {
		var markers_str = "&markers=" + JSON.stringify(markers);
		var url = '#' + coords.x + ',' + coords.y + ',' + coords.floor + ':' + coords.zoom + markers_str;
		if (
			forceHash &&
			location.hash != url
		) {
			window.history.pushState(null, null, url);
		}
	};
	TibiaMap.prototype.setUrlPosition = setUrlPosition;
	var getUrlPosition = function() {
		var _COORDINATES = 0;
        var _ZOOM = 1;
		var position = {
			'x': 32368,
			'y': 32198,
			'floor': 7,
			'zoom': 0
		};
		var parts = window.location.hash.slice(1).split(':');
		if (parts[_COORDINATES]) {
			var tempPos = parts[_COORDINATES].split(',');
			var _X = 0;
			var _Y = 1;
			var _FLOOR = 2;
			if (tempPos.length == 3) {
				position.x = parseInt(tempPos[_X], 10);
				position.y = parseInt(tempPos[_Y], 10);
				position.floor = parseInt(tempPos[_FLOOR], 10);
			}
		}
		if (parts[_ZOOM]) {
			position.zoom = parseInt(parts[_ZOOM], 10);
		}
		return position;
	};
	TibiaMap.prototype.getUrlPosition = getUrlPosition;
	var createCustomIcons = function(){
		var symbols = [
			{id:'0x00', file: 'green_tick.png'},
			{id:'0x07', file: 'spear.png'},
			{id:'0x01', file: 'blue_question_mark.png'},
			{id:'0x08', file: 'sword.png'},
			{id:'0x02', file: 'red_exclamation_mark.png'},
			{id:'0x09', file: 'blue_flag.png'},
			{id:'0x03', file: 'orange_star.png'},
			{id:'0x0A', file: 'golden_lock.png'},
			{id:'0x04', file: 'red_cross.png'},
			{id:'0x0B', file: 'brown_bag.png'},
			{id:'0x05', file: 'brown_plus.png'},
			{id:'0x0C', file: 'white_skull.png'},
			{id:'0x06', file: 'lips.png'},
			{id:'0x0D', file: 'green_dollar_sign.png'},
			{id:'0x0E', file: 'red_arrow_up.png'},
			{id:'0x0F', file: 'red_arrow_down.png'},
			{id:'0x10', file: 'red_arrow_right.png'},
			{id:'0x11', file: 'red_arrow_left.png'},
			{id:'0x12', file: 'green_arrow_up.png'},
			{id:'0x13', file: 'green_arrow_down.png'}
		];
		var icons = {};

		var CustomIcon = L.Icon.extend({
			options: {
				iconSize: [20, 20],
			}
		});
		function create_custom_icon(element, index, array){
			var url = 'images/markers/' + element.file;
			icons[element.id] = new CustomIcon({iconUrl: url})
		}
		symbols.forEach(create_custom_icon);
		return icons;
	}

	var getUrlMarkers = function(){
		_MARKERS = 1;
		var parts = window.location.hash.slice(1).split('&markers=');

		if(parts[_MARKERS]){
			try{
				return JSON.parse(parts[_MARKERS]);
			}catch(e){console.log('Error in your marker. Check it!'+e.message);};
		}
		return [];
	};
	TibiaMap.prototype.getUrlMarkers = getUrlMarkers;

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
		var map = this.map;
		var _this = this;
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
			setUrlPosition(coords, getUrlMarkers(), true);
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
			var tileId = (coords.x * 256) + '_' + (coords.y * 256) + '_' + this.options.floor;
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
	TibiaMap.prototype._createMapFloorMakers = function(floor){
		var this_ = this;
		var _X = 0;
		var _Y = 1;
		var _FLOOR = 2;
		var _ICON = 3;
		var _TITLE = 4;
		var _ZOOM = 0;

		function isSameFloor(marker) {
			return marker[_FLOOR] === floor;
		}

		function isValidate(marker){
			return marker[_X] && marker[_Y] && marker[_FLOOR];
		}

		function createMarker(marker){
			var title = ''
			if(marker[_TITLE])
				title = marker[_TITLE];

			var custom_icon = "0x00";
			if(marker[_ICON] && marker[_ICON] in this_.custom_icons)
				custom_icon = marker[_ICON];

			var marker = L.marker(
				this_.map.unproject([marker[_X], marker[_Y]], _ZOOM), {icon:this_.custom_icons[custom_icon], 'title':title}
			);
			this_.layer_marker.addLayer(marker);
		}

		var markers = this.markers = getUrlMarkers();

		if(this.layer_marker !== null){
			this.map.removeLayer(this.layer_marker);
		}

		this.layer_marker = new L.layerGroup();
		markers.filter(isSameFloor).filter(isValidate).forEach(createMarker);
		this.map.addLayer(this.layer_marker);
	};
	TibiaMap.prototype.init = function() {
		var _this = this;
		modifyLeaflet();
		// Taken from https://tibiamaps.github.io/tibia-map-data/bounds.json, which
		// rarely (if ever) changes.
		var bounds = { 'xMin': 124, 'xMax': 132, 'yMin': 121, 'yMax': 128 };
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
			_this.floor = layer.layer.options.floor;
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
			},
			_this.markers,
			true);
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

		_this.custom_icons = createCustomIcons();
		_this._createMapFloorMakers(current.floor);
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
