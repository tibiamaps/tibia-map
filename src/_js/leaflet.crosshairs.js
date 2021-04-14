// Customized version of https://github.com/frankrowe/Leaflet.Crosshairs
L.Crosshairs = L.LayerGroup.extend({
	options: {
		style: {
			opacity: 1,
			fillOpacity: 0,
			weight: 2,
			color: '#333',
			clickable: false,
			pointerEvents: 'none'
		}
	},
	exiva: false,
	initialize: function(options) {
		L.LayerGroup.prototype.initialize.call(this);
		L.Util.setOptions(this, options);
		this.crosshair = {
			rectangle: this.calculateExivaRectangle(0, this.options.style),
			longitude_line_north: L.polyline([], this.options.style),
			longitude_line_south: L.polyline([], this.options.style),
			latitude_line_east: L.polyline([], this.options.style),
			latitude_line_west: L.polyline([], this.options.style),
			exiva_rectangle_100: this.calculateExivaRectangle(100, this.options.style),
			exiva_rectangle_250: this.calculateExivaRectangle(250, this.options.style),
			exiva_line_northeast_1: L.polyline([], this.options.style),
			exiva_line_northeast_2: L.polyline([], this.options.style),
			exiva_line_southeast_1: L.polyline([], this.options.style),
			exiva_line_southeast_2: L.polyline([], this.options.style),
			exiva_line_southwest_1: L.polyline([], this.options.style),
			exiva_line_southwest_2: L.polyline([], this.options.style),
			exiva_line_northwest_1: L.polyline([], this.options.style),
			exiva_line_northwest_2: L.polyline([], this.options.style),
		};
		for (var layer in this.crosshair) {
			this.addLayer(this.crosshair[layer]);
		}
		this._hideExiva();
	},
	calculateExivaBounds: function(size, x, y) {
		return L.latLngBounds(
			this._map.unproject([x - size, y - size], 0),
			this._map.unproject([x + size + 1, y + size + 1], 0)
		);
	},
	calculateExivaRectangle: function(size, style) {
		return L.rectangle(
			[
				[-size, -size],
				[size + 1, size + 1]
			],
			style
		);
	},
	onAdd: function(map) {
		this._map = map;
		this._moveCrosshairs({
			latlng: this._map.getCenter()
		});
		this._map.on('click', this._moveCrosshairs.bind(this));
		this._map.on('move', this._moveCrosshairs.bind(this));
		this._map.on('zoomend', this._moveCrosshairs.bind(this));
		this._map.on('mouseover', this._show.bind(this));
		this.eachLayer(map.addLayer, map);
	},
	onRemove: function(map) {
		this._map.off('click', this._moveCrosshairs);
		this._map.off('zoomend', this._moveCrosshairs);
		this.eachLayer(this.removeLayer, this);
	},
	_show: function() {
		this.eachLayer(function(l) {
			this._map.addLayer(l);
		}, this);
	},
	_hide: function() {
		this.eachLayer(function(l) {;
			this._map.removeLayer(l);
		}, this);
	},
	_exivaLayers: {
		show: [
			'exiva_rectangle_100',
			'exiva_rectangle_250',
			'exiva_line_northeast_1',
			'exiva_line_northeast_2',
			'exiva_line_southeast_1',
			'exiva_line_southeast_2',
			'exiva_line_southwest_1',
			'exiva_line_southwest_2',
			'exiva_line_northwest_1',
			'exiva_line_northwest_2',
		],
		hide: [
			'longitude_line_north',
			'longitude_line_south',
			'latitude_line_east',
			'latitude_line_west',
		]
	},
	_showExiva: function() {
		this.exiva = true;
		for (const layerId of this._exivaLayers.show) {
			this.addLayer(this.crosshair[layerId]);
		}
		for (const layerId of this._exivaLayers.hide) {
			this.removeLayer(this.crosshair[layerId]);
		}
	},
	_hideExiva: function() {
		this.exiva = false;
		for (const layerId of this._exivaLayers.hide) {
			this.addLayer(this.crosshair[layerId]);
		}
		for (const layerId of this._exivaLayers.show) {
			this.removeLayer(this.crosshair[layerId]);
		}
	},
	_toggleExiva: function() {
		if (this.exiva) {
			this._hideExiva();
		} else {
			this._showExiva();
		}
	},
	_moveCrosshairs: function(e) {
		var bounds;
		var bounds_exiva_100;
		var bounds_exiva_250;
		if (e.latlng) {
			var pos = this._map.project(e.latlng, 0);
			var x = Math.floor(pos.x);
			var y = Math.floor(pos.y);
			bounds = this.calculateExivaBounds(0, x, y);
			bounds_exiva_100 = this.calculateExivaBounds(100, x, y);
			bounds_exiva_250 = this.calculateExivaBounds(250, x, y);
		} else {
			bounds = this.crosshair.rectangle.getBounds();
			bounds_exiva_100 = this.crosshair.exiva_rectangle_100.getBounds();
			bounds_exiva_250 = this.crosshair.exiva_rectangle_250.getBounds();
		}
		var latlng = bounds.getCenter();
		this.crosshair.rectangle.setBounds(bounds);
		this.crosshair.exiva_rectangle_100.setBounds(bounds_exiva_100);
		this.crosshair.exiva_rectangle_250.setBounds(bounds_exiva_250);
		var point = this._map.project(latlng);
		this.crosshair.longitude_line_north.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([point.x, this._map.getPixelBounds().min.y])
		]);
		this.crosshair.longitude_line_south.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([point.x, this._map.getPixelBounds().max.y])
		]);
		this.crosshair.latitude_line_east.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([this._map.getPixelBounds().min.x, point.y])
		]);
		this.crosshair.latitude_line_west.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([this._map.getPixelBounds().max.x, point.y])
		]);
		// This number should be large enough to cover the difference
		// between xMin/xMax and yMin/yMax on all zoom levels.
		//console.log(point.x, point.y, this._map.getZoom());
		// bottom right = 1372140 1320940
		// top left     = 1269780 1239060
		// ------------------------------
		// delta        =  102360   81880
		// https://tibiamaps.github.io/tibia-map-data/bounds.json
		var DIAGONAL_SIZE = 102360;
		var OTHER_DIAGONAL_SIZE = DIAGONAL_SIZE * 2.42;
		this.crosshair.exiva_line_northeast_1.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([point.x + DIAGONAL_SIZE, point.y - OTHER_DIAGONAL_SIZE])
		]);
		this.crosshair.exiva_line_northeast_2.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([point.x + OTHER_DIAGONAL_SIZE, point.y - DIAGONAL_SIZE])
		]);
		this.crosshair.exiva_line_southeast_1.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([point.x + OTHER_DIAGONAL_SIZE, point.y + DIAGONAL_SIZE])
		]);
		this.crosshair.exiva_line_southeast_2.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([point.x + DIAGONAL_SIZE, point.y + OTHER_DIAGONAL_SIZE])
		]);
		this.crosshair.exiva_line_southwest_1.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([point.x - DIAGONAL_SIZE, point.y + OTHER_DIAGONAL_SIZE])
		]);
		this.crosshair.exiva_line_southwest_2.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([point.x - OTHER_DIAGONAL_SIZE, point.y + DIAGONAL_SIZE])
		]);
		this.crosshair.exiva_line_northwest_1.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([point.x - OTHER_DIAGONAL_SIZE, point.y - DIAGONAL_SIZE])
		]);
		this.crosshair.exiva_line_northwest_2.setLatLngs([
			this._map.unproject([point.x, point.y]),
			this._map.unproject([point.x - DIAGONAL_SIZE, point.y - OTHER_DIAGONAL_SIZE])
		]);
	}
});
L.crosshairs = function(options) {
	return new L.Crosshairs(options);
};
