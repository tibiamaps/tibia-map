L.AreasButton = L.Control.extend({
	options: {
		position: 'topleft',
		autoZIndex: true,
		map: null,
	},
	onAdd: function (map) {
		this._map = map;
		const container = L.DomUtil.create(
			'div',
			'leaflet-control-areas-button-panel leaflet-bar leaflet-control',
		);
		const button = L.DomUtil.create(
			'a',
			'leaflet-control-areas-button leaflet-bar-part',
			container,
		);
		button.textContent = 'A';
		button.title = 'Toggle subarea outlines overlay';
		button.href = '#';
		L.DomEvent.addListener(button, 'click', this._onClick, this);
		L.DomEvent.disableClickPropagation(button);
		return container;
	},
	_onClick: function (event) {
		L.DomEvent.stopPropagation(event);
		L.DomEvent.preventDefault(event);
		this.options.map._toggleAreas();
	},
});

L.areasButton = function (options) {
	return new L.AreasButton(options);
};
