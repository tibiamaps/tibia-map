// Custom code.
L.Control.Coordinates = L.Control.extend({
	options: {
		position: 'bottomright',
		decimals: 4,
		decimalSeparator: '.',
		labelTemplateLat: 'X: {y}',
		labelTemplateLng: 'Y: {x}',
		labelFormatterLat: undefined,
		labelFormatterLng: undefined,
		enableUserInput: true,
		useLatLngOrder: false,
		centerUserCoordinates: false
	},
	onAdd: function(map) {
		this._map = map;
		const className = 'leaflet-control-coordinates';
		const container = this._container = L.DomUtil.create('div', className);
		const options = this.options;
		this._labelcontainer = L.DomUtil.create('div', 'uiElement label', container);
		this._label = L.DomUtil.create('span', 'labelFirst', this._labelcontainer);
		this._inputcontainer = L.DomUtil.create('div', 'uiElement input uiHidden', container);
		let xSpan;
		let ySpan;
		if (options.useLatLngOrder) {
			ySpan = L.DomUtil.create('span', '', this._inputcontainer);
			this._inputY = this._createInput('inputY', this._inputcontainer);
			xSpan = L.DomUtil.create('span', '', this._inputcontainer);
			this._inputX = this._createInput('inputX', this._inputcontainer);
		} else {
			xSpan = L.DomUtil.create('span', '', this._inputcontainer);
			this._inputX = this._createInput('inputX', this._inputcontainer);
			ySpan = L.DomUtil.create('span', '', this._inputcontainer);
			this._inputY = this._createInput('inputY', this._inputcontainer);
		}
		xSpan.innerHTML = options.labelTemplateLng.replace('{x}', '');
		ySpan.innerHTML = options.labelTemplateLat.replace('{y}', '');
		L.DomEvent.on(this._inputX, 'keyup', this._handleKeypress, this);
		L.DomEvent.on(this._inputY, 'keyup', this._handleKeypress, this);
		map.on('mousemove', this._update, this);
		map.on('dragstart', this.collapse, this);
		map.whenReady(this._update, this);
		this._showsCoordinates = true;
		if (options.enableUserInput) {
			L.DomEvent.addListener(this._container, 'click', this._switchUI, this);
		}
		return container;
	},
	_createInput: function(classname, container) {
		const input = L.DomUtil.create('input', classname, container);
		L.DomEvent.disableClickPropagation(input);
		return input;
	},
	_clearMarker: function() {
		this._map.removeLayer(this._marker);
	},
	_handleKeypress: function(event) {
		switch (event.key) {
			case 'Escape':
				this.collapse();
				break;
			case 'Enter':
				this._handleSubmit();
				this.collapse();
				break;
			default:
				this._handleSubmit();
				break;
		}
	},
	_handleSubmit: function() {
		const x = L.NumberFormatter.createValidNumber(this._inputX.value, this.options.decimalSeparator);
		const y = L.NumberFormatter.createValidNumber(this._inputY.value, this.options.decimalSeparator);
		if (x !== undefined && y !== undefined) {
			const marker = this._marker;
			if (!marker) {
				marker = this._marker = L.marker();
				marker.on('click', this._clearMarker, this);
			}
			const ll = new L.LatLng(y, x);
			marker.setLatLng(ll);
			marker.addTo(this._map);
			if (this.options.centerUserCoordinates) {
				this._map.setView(ll, this._map.getZoom());
			}
		}
	},
	expand: function() {
		this._showsCoordinates = false;
		this._map.off('mousemove', this._update, this);
		L.DomEvent.addListener(this._container, 'mousemove', L.DomEvent.stop);
		L.DomEvent.removeListener(this._container, 'click', this._switchUI, this);
		L.DomUtil.addClass(this._labelcontainer, 'uiHidden');
		L.DomUtil.removeClass(this._inputcontainer, 'uiHidden');
	},
	_createCoordinateLabel: function(ll) {
		const opts = this.options;
		let x;
		let y;
		if (opts.labelFormatterLng) {
			x = opts.labelFormatterLng(ll.x);
		} else {
			x = L.Util.template(opts.labelTemplateLng, {
				x: this._getNumber(ll.x, opts)
			});
		}
		if (opts.labelFormatterLat) {
			y = opts.labelFormatterLat(ll.y);
		} else {
			y = L.Util.template(opts.labelTemplateLat, {
				y: this._getNumber(ll.y, opts)
			});
		}
		if (opts.useLatLngOrder) {
			return y + ' ' + x;
		}
		return x + ' ' + y;
	},
	_getNumber: function(n, opts) {
		return L.NumberFormatter.round(n, opts.decimals, opts.decimalSeparator);
	},
	collapse: function() {
		if (!this._showsCoordinates) {
			this._map.on('mousemove', this._update, this);
			this._showsCoordinates = true;
			L.DomEvent.addListener(this._container, 'click', this._switchUI, this);
			L.DomEvent.removeListener(this._container, 'mousemove', L.DomEvent.stop);
			L.DomUtil.addClass(this._inputcontainer, 'uiHidden');
			L.DomUtil.removeClass(this._labelcontainer, 'uiHidden');
			if (this._marker) {
				const m = L.marker();
				const ll = this._marker.getLatLng();
				m.setLatLng(ll);
				const container = L.DomUtil.create('div', '');
				const label = L.DomUtil.create('div', '', container);
				label.innerHTML = this._createCoordinateLabel(ll);
				const close = L.DomUtil.create('a', '', container);
				close.textContent = 'Remove';
				close.href = '#';
				const stop = L.DomEvent.stopPropagation;
				L.DomEvent
					.on(close, 'click', stop)
					.on(close, 'mousedown', stop)
					.on(close, 'dblclick', stop)
					.on(close, 'click', L.DomEvent.preventDefault)
					.on(close, 'click', function() {
						this._map.removeLayer(m);
					}, this);
				m.bindPopup(container);
				m.addTo(this._map);
				this._map.removeLayer(this._marker);
				this._marker = null;
			}
		}
	},
	_switchUI: function(event) {
		L.DomEvent.stop(event);
		L.DomEvent.stopPropagation(event);
		L.DomEvent.preventDefault(event);
		if (this._showsCoordinates) {
			this.expand();
		} else {
			this.collapse();
		}
	},
	onRemove: function(map) {
		map.off('mousemove', this._update, this);
	},
	_update: function(event) {
		let pos = event.latlng;
		const opts = this.options;
		if (pos) {
			pos = pos.wrap();
			this._currentPos = pos;
			this._inputY.value = L.NumberFormatter.round(pos.lat, opts.decimals, opts.decimalSeparator);
			this._inputX.value = L.NumberFormatter.round(pos.lng, opts.decimals, opts.decimalSeparator);
			this._label.innerHTML = this._createCoordinateLabel(
				this._map.project(event.latlng, 0)
			);
		}
	}
});
L.control.coordinates = function(options) {
	return new L.Control.Coordinates(options);
};
L.Map.mergeOptions({
	coordinateControl: false
});
L.Map.addInitHook(function() {
	if (this.options.coordinateControl) {
		this.coordinateControl = new L.Control.Coordinates();
		this.addControl(this.coordinateControl);
	}
});
L.NumberFormatter = {
	round: function(num, dec, sep) {
		let res = L.Util.formatNum(num, dec) + '';
		const numbers = res.split('.');
		if (numbers[1]) {
			let d = dec - numbers[1].length;
			for (; d > 0; d--) {
				numbers[1] += '0';
			}
			res = numbers.join(sep || '.');
		}
		return res;
	},
	createValidNumber: function(num, sep) {
		if (num && num.length > 0) {
			const numbers = num.split(sep || '.');
			try {
				const numRes = Number(numbers.join('.'));
				if (isNaN(numRes)) {
					return undefined;
				}
				return numRes;
			} catch (exception) {
				return undefined;
			}
		}
		return undefined;
	}
};
