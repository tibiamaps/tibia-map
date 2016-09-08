L.LevelButtons = L.Control.extend({
	options:{
		position: 'topright',
		autoZIndex: true
	},
	onAdd: function(map){
		this._map = map;
		var plugin_container = L.DomUtil.create('div', 'levelbuttons-panel leaflet-bar');

		var up_button = L.DomUtil.create('a', 'levelbuttons-panel-a', plugin_container);
		up_button.innerHTML = '+';
		up_button.href = '#';
		L.DomEvent.addListener(up_button, 'click', this._onUpButton, this);
		plugin_container.appendChild(up_button);

		var down_button = L.DomUtil.create('a', 'levelbuttons-panel-a', plugin_container);
		L.DomEvent.addListener(down_button, 'click', this._onDownButton, this);
		down_button.innerHTML = '-';
		down_button.href = '#';

		plugin_container.appendChild(down_button);

		return plugin_container;
	},
	onRemove: function(){},
	_onUpButton: function(e){
		upper_floor_index = this._tibia_map_obj.floor - 1;
		if (upper_floor_index >= 0){
			this._bringToFront(upper_floor_index);
		}
		L.DomEvent.stop(e);
	},
	_onDownButton: function(e){
		lower_floor_index = this._tibia_map_obj.floor + 1;
		if (lower_floor_index <= 15){
			this._bringToFront(lower_floor_index);
		}
		L.DomEvent.stop(e);
	},
	setTibiaMap: function(tibia_map_obj){
		this._tibia_map_obj = tibia_map_obj;
	},
	_bringToFront: function(layer_index){
		// Simulate click on to choice option
		// Its most bug free and efficient method of switching layers
		// also it simplifies checking appropriate radio button in L.Controls.Layers widget
		this.options.layers_widget._form[layer_index].click();
	}
});

L.levelButtons = function(options) {
	return new L.LevelButtons(options);
}
