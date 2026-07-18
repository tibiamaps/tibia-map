// Import Leaflet first so it is available globally for the plugins.
import L from 'leaflet';
window.L = L;

// Import plugins (which extend global L).
import './_js/leaflet.coordinates.js';
import './_js/leaflet.crosshairs.js';
import './_js/leaflet.levelbuttons.js';
import './_js/leaflet.exivabutton.js';
import './_js/leaflet.markersbutton.js';
import 'leaflet-fullscreen';

// Import map initialization.
import './_js/map.js';

// Import stylesheets.
import 'leaflet/dist/leaflet.css';
import './_css/leaflet.coordinates.css';
import './_css/leaflet.buttons.css';
import 'leaflet-fullscreen/dist/leaflet.fullscreen.css';
import './_css/map.css';
