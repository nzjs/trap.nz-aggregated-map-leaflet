var $ = jQuery;

function buildMap(opts) {
  if (opts.fullscreen) {
    $('html, body, ' + opts.selector).css('width', '100%').css('height', '100%');
    $(opts.selector).height($(window).height()).width($(window).width());
  }

  var map = new L.map(opts.id, opts.options);
  map.map_opts = opts;

  if (opts.boundsPadding) {
    map.setMaxBounds(map.getBounds().pad(opts.boundsPadding));
  }

  if (opts.panes) {
    for (var panename in opts.panes) {
      var pane = map.createPane(panename);
      pane.style.zIndex = opts.panes[panename].style.zIndex;
      if (pane.style.pointerEvents) {
        opts.panes[panename].style.pointerEvents = pane.style.pointerEvents;
      }
    }
  }

  map.base_layers = {};
  for (var basename in opts.layers.base) {
    var base = opts.layers.base[basename];
    if (base.layergroup) {
      var group_layers = [];
      for (var l=0; l<base.layers.length; l++) {
        var lyr = base.layers[l];
        group_layers.push(L.tileLayer(lyr.url, lyr.settings));
      }
      map.base_layers[base.label] = L.layerGroup(group_layers);
    } else {
      map.base_layers[base.label] = L.tileLayer(base.url, base.settings);
    }
    if (base.visible) map.base_layers[base.label].addTo(map);
  }

  map.overlay_layers = {};
  for (var overlayname in opts.layers.overlay) {
    var overlay = opts.layers.overlay[overlayname];
    if (overlay.layergroup) {
      var group_layers = [];
      for (var l=0; l<overlay.layers.length; l++) {
        var lyr = overlay.layers[l];
        group_layers.push(createLayer(map, lyr));
      }
      map.overlay_layers[overlay.label] = L.layerGroup(group_layers);
    } else {
      map.overlay_layers[overlay.label] = createLayer(map, overlay);
    }
    if (overlay.visible) {
      map.overlay_layers[overlay.label].addTo(map);
    }
  }

  if (opts.controls.layerswitcher) {
    var layer_control = L.control.layers(map.base_layers, map.overlay_layers);
    layer_control.addTo(map);
    map.layer_control = layer_control;
  }

  if (opts.controls.legends) {
    map.legends = {};
    for (var legend_id in opts.controls.legends) {
      (function(legend_id) { // preserve scope of legend_id in closure
        var legend_opts = opts.controls.legends[legend_id]
        if (legend_opts.ajax) {
          if (!legend_opts.legends) legend_opts.legends = [];
          if (legend_opts.ajax.success) {
            var custom_success = legend_opts.ajax.success;
            legend_opts.ajax.success = function(data) {
              legend_opts.legends.push({ elements: [{ html: legend_opts.ajax.html(data) }]});
              custom_success(data, map, legend_id, legend_opts);
            }
          } else {
            legend_opts.ajax.success = function(data) {
              legend_opts.legends.push({ elements: [{ html: legend_opts.ajax.html(data) }]});
              var legend = L.control.htmllegend(legend_opts);
              map.legends[legend_id] = legend;
              if (legend_opts.visible) map.addControl(legend);
            }
          }
          ajaxLoad(map, legend_opts.ajax);
        } else {
          var legend = L.control.htmllegend(legend_opts);
          map.legends[legend_id] = legend;
          if (legend_opts.visible) map.addControl(legend);
        }
      })(legend_id);
    }
  }

  if (opts.controls.attribution) {
    if (opts.controls.attribution.prefix) {
      map.attributionControl.setPrefix(opts.controls.attribution.prefix);
    }
  }

  if (opts.controls.fullscreen) map.addControl(new L.Control.Fullscreen());
  if (opts.controls.locate) L.control.locate(opts.controls.locate).addTo(map);
  if (opts.controls.scale) L.control.scale(opts.controls.scale).addTo(map);

  return map;
}


function createLayer(map, layer_opts) {
  // console.log(layer_opts.label);
  // console.log(layer_opts);
  switch (layer_opts.layerType) {

    case 'L.geoJSON':
      var layer = null;
      if (!layer_opts.settings.pointToLayer) {
        switch (layer_opts.settings.markerType) {
          case 'circle':
            layer_opts.settings.pointToLayer = function (feature, latlng) {
              return L.circleMarker(latlng);
            }
          break;
          case 'icon':
            layer_opts.settings.pointToLayer = function (feature, latlng) {
              return L.marker(latlng, {icon: L.icon(layer_opts.settings.style)});
            }
          break;
          default: // marker
            layer_opts.settings.pointToLayer = function (feature, latlng) {
              return L.marker(latlng);
            }
          break;
        }
      }

      if (layer_opts.data) {
        // local data, not loaded from URL
        layer = new L.geoJSON(layer_opts.data, layer_opts.settings);
        if (layer_opts.onData) {
          layer_opts.onData(map, layer, layer_opts.data, layer_opts.settings);
        }

      } else if (layer_opts.ajax) {
        layer = new L.geoJSON(null, layer_opts.settings);
        var custom_success = layer_opts.ajax.success;
        layer_opts.ajax.success = function(data) {
          if (custom_success) {
            custom_success(data, map, layer, layer_opts);
          } else {
            layer.addData(data.features);
          }
        }
        ajaxLoad(map, layer_opts.ajax);
      }

      if (layer_opts.init) {
        layer_opts.init(map, layer, layer_opts);
      }

      return layer;
    break;

    case 'L.markerClusterGroup':
      var layer = null;
      if (!layer_opts.settings.pointToLayer) {
        layer_opts.settings.pointToLayer = function (feature, latlng) {
          return L.marker(latlng);
        }
      }

      if (layer_opts.data) {
        // local data, not loaded from URL
        // layer = new L.geoJSON(layer_opts.data, layer_opts.settings);
        // if (layer_opts.onData) {
        //   layer_opts.onData(map, layer, layer_opts.data, layer_opts.settings);
        // }

      } else if (layer_opts.ajax) {
        layer = new L.markerClusterGroup(layer_opts.settings);
        var custom_success = layer_opts.ajax.success;
        layer_opts.ajax.success = function(data) {
          if (custom_success) {
            custom_success(data, map, layer, layer_opts);
          } else {
            for (var i = 0; i < data.features.length; i++) {
              var feature = data.features[i];
              var marker = L.marker(L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]));
              layer.addLayer(marker);
            }
          }
        }
        ajaxLoad(map, layer_opts.ajax);
      }

      if (layer_opts.init) {
        layer_opts.init(map, layer, layer_opts);
      }

      return layer;
    break;

    case 'L.HexbinLayer':
      var layer = L.hexbinLayer(layer_opts.settings);
      if (layer_opts.settings.colorScale) {
        layer.colorScale().range(layer_opts.settings.colorScale);
      }

      // assume lat and lng are taken from geojson data unless overridden
      if (!layer_opts.settings.lat) {
        layer_opts.settings.lat = function(d) {
          return d.geometry.coordinates[0];
        }
      }
      layer.lat(layer_opts.settings.lat);
      if (!layer_opts.settings.lng) {
        layer_opts.settings.lng = function(d) {
          return d.geometry.coordinates[1];
        }
      }
      layer.lng(layer_opts.settings.lng);

      if (layer_opts.settings.hoverHandlers) {
        var hovhnd = layer_opts.settings.hoverHandlers;
        var hover_handlers = [];
        if (hovhnd.tooltip) {
          hover_handlers.push(L.HexbinHoverHandler.tooltip({ tooltipContent: hovhnd.tooltip }));
        }
        if (hovhnd.scale) {
          hover_handlers.push(L.HexbinHoverHandler.resizeScale(hovhnd.scale));
        }
        layer.hoverHandler(L.HexbinHoverHandler.compound({ handlers: hover_handlers }));
      }

      if (layer_opts.settings.colorValue) {
        layer.colorValue(layer_opts.settings.colorValue);
      }

      if (layer_opts.data) {
        // local data, not loaded from URL
        layer.data(layer_opts.data.features);

      } else if (layer_opts.ajax) {
        var custom_success = layer_opts.ajax.success;
        layer_opts.ajax.success = function(data) {
          if (custom_success) {
            custom_success(data, map, layer, layer_opts);
          } else {
            layer.data(data.features);
          }
        }
        ajaxLoad(map, layer_opts.ajax);
      }

      if (layer_opts.init) {
        layer_opts.init(map, layer, layer_opts);
      }

      return layer;
    break;

    default:
      var layer = eval(`new ${layer_opts.layerType}(layer_opts.url, layer_opts.settings)`);
      if (layer_opts.init) {
        layer_opts.init(map, layer, layer_opts);
      }
      return layer;

  }
  return null;
}

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

if (L.hexbinLayer) {
  // ensure hexes are removed when the layer is removed
  L.HexbinLayer.prototype.onRemove = function(map) {
    L.SVG.prototype.onRemove.call(this);
    // Destroy the svg container
    this._destroyContainer();
    d3.select(this._container).remove();
    // Remove events
    map.off({ 'moveend': this.redraw }, this);
    this._map = null;
  };
}

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

function ajaxLoad(map, opts) {
  addSpinner(map);
  var old_complete = opts.complete;
  opts.complete = function(jqXHR, textStatus) {
    removeSpinner(map);
    if (old_complete) old_complete(jqXHR, textStatus);
  }
  $.ajax(opts);
}

function addSpinner(map) {
  if (!map.spinners) {
    map.spinners = 0;
    var spinnerContent = '<div class="lds-dual-ring"></div>';
    $(spinnerContent).insertBefore(map.map_opts.selector);
  }
  map.spinners++;
}
function removeSpinner(map) {
  map.spinners--;
  if (!map.spinners) {
    $('.lds-dual-ring').fadeOut(1000, function() { $(this).remove(); });
  }
}

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

function $_GET( name ){
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if ( results == null ) {
    return "";
  } else {
    return decodeURIComponent(results[1]);
  }
}

function createRelativeDate(days, months, years) {
  var date = new Date();
  date.setDate(date.getDate() + days);
  date.setMonth(date.getMonth() + months);
  date.setFullYear(date.getFullYear() + years);
  return date;
}
function datestringYMD(date) {
  if (!date) date = new Date();
  month = '' + (date.getMonth() + 1),
  day = '' + date.getDate(),
  year = date.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function toPoints(d) {
  var points = [];
  for (var i=0; i<d.length; i++) {
    points[i] = L.marker(d[i].geometry.coordinates);
  }
  return points;
}

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

var linz_basemap_settings = {
  maxZoom: 15,
  subdomains: '1234',
  attribution: '<a href="https://www.linz.govt.nz/linz-copyright" target="_blank">Basemap sourced from LINZ. CC-BY 4.0</a>',
  zIndex: 2
};
var linz_proj = 'GLOBAL_MERCATOR'; // 'NZTM';
