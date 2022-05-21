L.MarkersButton = L.Control.extend({
	options: {
		position: 'topleft',
		autoZIndex: true,
		map: null,
	},
	onAdd: function(map) {
		this._map = map;
		const container = L.DomUtil.create('div', 'leaflet-control-markers-button-panel leaflet-bar leaflet-control');
		const button = L.DomUtil.create('a', 'leaflet-control-markers-button leaflet-bar-part', container);
		button.textContent = 'M';
		button.title = 'Toggle markers overlay'
		button.href = '#';
		L.DomEvent.addListener(button, 'click', this._onClick, this);
		L.DomEvent.disableClickPropagation(button);
		return container;
	},
	_onClick: function(event) {
		L.DomEvent.stopPropagation(event);
		L.DomEvent.preventDefault(event);
		this.options.map._toggleMarkers();
	},
});

L.markersButton = function(options) {
	return new L.MarkersButton(options);
};
