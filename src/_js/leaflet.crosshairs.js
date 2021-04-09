// Customized version of https://github.com/frankrowe/Leaflet.Crosshairs
L.Crosshairs = L.LayerGroup.extend({
	'options': {
		'style': {
			'opacity': 1,
			'fillOpacity': 0,
			'weight': 2,
			'color': '#333',
			'clickable': false,
			'pointerEvents': 'none'
		}
	},
	initialize: function(options) {
		L.LayerGroup.prototype.initialize.call(this);
		L.Util.setOptions(this, options);
		this.crosshair = {
			'rectangle': L.rectangle(
				[
					[0, 0],
					[1, 1]
				],
				this.options.style
			),
			'rectangle_exiva_100': L.rectangle(
				[
					[-100, -100],
					[101, 101]
				],
				this.options.style
			),
			'rectangle_exiva_250': L.rectangle(
				[
					[-274, -274],
					[275, 275]
				],
				this.options.style
			),
			'longitude_line_north': L.polyline([], this.options.style),
			'longitude_line_south': L.polyline([], this.options.style),
			'latitude_line_east': L.polyline([], this.options.style),
			'latitude_line_west': L.polyline([], this.options.style),
		}
		for (var layer in this.crosshair) {
			this.addLayer(this.crosshair[layer]);
		}
	},
	onAdd: function(map) {
		this._map = map
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
	_moveCrosshairs: function(e) {
		var bounds;
		var bounds_exiva_100;
		var bounds_exiva_250;
		if (e.latlng) {
			var pos = this._map.project(e.latlng, 0);
			var x = Math.floor(pos.x);
			var y = Math.floor(pos.y);
			bounds = L.latLngBounds(
				this._map.unproject([x, y], 0),
				this._map.unproject([x + 1, y + 1], 0)
			);
			bounds_exiva_100 = L.latLngBounds(
				this._map.unproject([x - 100, y - 100], 0),
				this._map.unproject([x + 101, y + 101], 0)
			);
			bounds_exiva_250 = L.latLngBounds(
				this._map.unproject([x - 250, y - 250], 0),
				this._map.unproject([x + 251, y + 251], 0)
			);
		} else {
			bounds = this.crosshair.rectangle.getBounds();
			bounds_exiva_100 = this.crosshair.rectangle_exiva_100.getBounds();
			bounds_exiva_250 = this.crosshair.rectangle_exiva_250.getBounds();
		}
		var latlng = bounds.getCenter();
		this.crosshair.rectangle.setBounds(bounds);
		this.crosshair.rectangle_exiva_100.setBounds(bounds_exiva_100);
		this.crosshair.rectangle_exiva_250.setBounds(bounds_exiva_250);
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
	}
});
L.crosshairs = function(options) {
	return new L.Crosshairs(options);
};
