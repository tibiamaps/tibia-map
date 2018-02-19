L.LevelButtons = L.Control.extend({
	'options': {
		'position': 'topleft',
		'autoZIndex': true
	},
	onAdd: function(map) {
		this._map = map;
		var plugin_container = L.DomUtil.create('div', 'leaflet-control-level-buttons-panel leaflet-bar');

		var up_button = L.DomUtil.create('a', 'leaflet-control-level-buttons-a', plugin_container);
		up_button.textContent = '\u25B2';
		up_button.href = '#';
		L.DomEvent.addListener(up_button, 'click', this._onUpButton, this);
		L.DomEvent.disableClickPropagation(up_button);
		plugin_container.appendChild(up_button);

		var floor_button = L.DomUtil.create('span', 'leaflet-control-level-buttons-span', plugin_container);
		floor_button.id = 'floor_button';

		plugin_container.appendChild(floor_button);

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
			this._setFloor(upper_floor_index);
			this._updateUrl(upper_floor_index);
		}
		event.preventDefault();
	},
	_onDownButton: function(event) {
		var lower_floor_index = this._tibia_map_obj.floor + 1;
		if (lower_floor_index <= 15) {
			this._bringToFront(lower_floor_index);
			this._setFloor(lower_floor_index);
			this._updateUrl(lower_floor_index);
		}

		event.preventDefault();
	},
	setTibiaMap: function(tibia_map_obj) {
		this._tibia_map_obj = tibia_map_obj;
		var floor_button = L.DomUtil.get('floor_button');
		this._setFloor(this._tibia_map_obj.floor);
	},
	_bringToFront: function(layer_index) {
		// Simulate a click on the chosen option.
		this.options.layers_widget._form[layer_index].click();
	},
	_setFloor: function(floor) {
		var floor_button = L.DomUtil.get('floor_button');
		var ground_floor = 7; // 0 - sky // 15 - deep
		
		if(floor == ground_floor) {
			floor_button.textContent = "0";
		}
		else if (floor < ground_floor){
			floor_button.textContent = String(ground_floor - floor).padStart(2, '+');
		}
		else {
			floor_button.textContent = String(floor - ground_floor).padStart(2, '-');
		}
		
	},
	_updateUrl: function(floor) {
		var coordinates = this._tibia_map_obj.getUrlPosition();
		coordinates.floor = floor;
		this._tibia_map_obj.setUrlPosition(coordinates, true);
	}
});

L.levelButtons = function(options) {
	return new L.LevelButtons(options);
};
