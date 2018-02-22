L.LevelButtons = L.Control.extend({
	'options': {
		'position': 'topleft',
		'autoZIndex': true
	},
	onAdd: function(map) {
		this._map = map;
		var plugin_container = L.DomUtil.create('div', 'leaflet-control-level-buttons-panel leaflet-bar');

		var up_button = L.DomUtil.create('a', 'leaflet-control-level-buttons-a', plugin_container);
		up_button.id = 'up_button';
		up_button.textContent = '\u25B2';
		up_button.href = '#';
		this._setEnableFloorButton(up_button, 'click', this._onUpButton, this);
		L.DomEvent.disableClickPropagation(up_button);
		plugin_container.appendChild(up_button);

		var floor_button = L.DomUtil.create('span', 'leaflet-control-level-buttons-span', plugin_container);
		floor_button.id = 'floor_button';
		plugin_container.appendChild(floor_button);

		var down_button = L.DomUtil.create('a', 'leaflet-control-level-buttons-a', plugin_container);
		down_button.id = 'down_button';
		down_button.textContent = '\u25BC';
		down_button.href = '#';
		this._setEnableFloorButton(down_button, 'click', this._onDownButton, this);
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
			if(upper_floor_index == 0){
				this._setDisableFloorButton(L.DomUtil.get('up_button'), 'click', this._onUpButton);
			}else{
				this._setEnableFloorButton(L.DomUtil.get('down_button'), 'click', this._onDownButton);
			}
		}
		event.preventDefault();
	},
	_onDownButton: function(event) {
		var lower_floor_index = this._tibia_map_obj.floor + 1;

		if (lower_floor_index <= 15) {
			this._bringToFront(lower_floor_index);
			this._setFloor(lower_floor_index);
			this._updateUrl(lower_floor_index);
			if(lower_floor_index == 15){
				this._setDisableFloorButton(L.DomUtil.get('down_button'), 'click', this._onDownButton);
			}else{
				this._setEnableFloorButton(L.DomUtil.get('up_button'), 'click', this._onUpButton);
			}
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
		var ground_floor = 7; // 0: high above ground; 15: deep underground
		var text = '';
		if (floor == ground_floor) {
			text = '0';
		} else if (floor < ground_floor){
			text = '+' + String(ground_floor - floor);
		} else {
			text = '-' + String(floor - ground_floor);
		}
		floor_button.textContent = text;
	},
	_updateUrl: function(floor) {
		var coordinates = this._tibia_map_obj.getUrlPosition();
		coordinates.floor = floor;
		this._tibia_map_obj.setUrlPosition(coordinates, true);
	},
	_addClassDisabled: function(element){
		if(element !== null && !L.DomUtil.hasClass(element, 'leaflet-disabled')){
			L.DomUtil.addClass(element, 'leaflet-disabled');
		}
	},
	_rmClassDisabled: function(element){
		if(element !== null && L.DomUtil.hasClass(element, 'leaflet-disabled')){
			L.DomUtil.removeClass(element, 'leaflet-disabled');
		}
	},
	_setEnableFloorButton: function(element, types, fn, context){
		if (element !== null){
			L.DomEvent.addListener(element, types, fn, context);
			this._rmClassDisabled(element);
		}
	},
	_setDisableFloorButton: function(element, types, fn, context){
		if (element !== null){
			L.DomEvent.removeListener(element, types, fn, context);
			this._addClassDisabled(element);
		}
	}
});

L.levelButtons = function(options) {
	return new L.LevelButtons(options);
};
