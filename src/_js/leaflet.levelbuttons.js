L.LevelButtons = L.Control.extend({
	'options': {
		'position': 'topleft',
		'autoZIndex': true
	},
	onAdd: function(map){
		this._map = map;
		var plugin_container = L.DomUtil.create('div', 'leaflet-control-level-buttons-panel leaflet-bar');

		var up_button = L.DomUtil.create('a', 'leaflet-control-level-buttons-a', plugin_container);
		up_button.textContent = '\u25B2';
		up_button.href = '#';
		L.DomEvent.addListener(up_button, 'click', this._onUpButton, this);
		L.DomEvent.disableClickPropagation(up_button);
		plugin_container.appendChild(up_button);

		var down_button = L.DomUtil.create('a', 'leaflet-control-level-buttons-a', plugin_container);
		down_button.textContent = '\u25BC';
		down_button.href = '#';
		L.DomEvent.addListener(down_button, 'click', this._onDownButton, this);
		L.DomEvent.disableClickPropagation(down_button);
		plugin_container.appendChild(down_button);

		return plugin_container;
	},
	onRemove: function() {},
	_onUpButton: function(event) {
		var upper_floor_index = this._tibia_map_obj.floor - 1;
		if (upper_floor_index >= 0) {
			this._bringToFront(upper_floor_index);
		}
		event.preventDefault();
	},
	_onDownButton: function(event) {
		var lower_floor_index = this._tibia_map_obj.floor + 1;
		if (lower_floor_index <= 15) {
			this._bringToFront(lower_floor_index);
		}
		event.preventDefault();
	},
	setTibiaMap: function(tibia_map_obj) {
		this._tibia_map_obj = tibia_map_obj;
	},
	_bringToFront: function(layer_index) {
		// Simulate a click on the chosen option.
		this.options.layers_widget._form[layer_index].click();
	}
});

L.levelButtons = function(options) {
	return new L.LevelButtons(options);
};
