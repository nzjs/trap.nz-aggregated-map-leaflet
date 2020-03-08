// Created by J. Stowell, WCRC, for Predator Free Lake Brunner
//
// NOTES ABOUT THIS LEAFLET MAP
//
// Trap.NZ --
// We haven’t formally released any general purpose reports or API yet 
// but if it’s useful to you you can get a feed of traps for any number of projects 
// that have opted into sharing anonymised data. Trap locations are snapped to a 200m grid. 
// The feed URL is: https://io.trap.nz/maps/trap-killcount?projects=123,456,789 
//
// where 123, 456 and 789 are the project IDs you want to map. You can also optionally filter by date by adding:
//
// ?date-from=2019-01-01
// ?date-to=2019-08-01
//
// You can see a demo of this in action here: https://www.trap.nz/static/pfw-hex.html  - feel free to use any part of the code. We plan to release some publicly available reports in this style in the near future but hopefully this is useful in the meantime.
//
// Thanks,
// Trap.NZ Team


var project_list = {
    2170393:"predator-free-lake-brunner/",
    // eg. 
    // 123:"name-of-project",
    // 456:"blah blah"
  }
  
  var map_opts = {
    id: 'trapMap',
    selector: '#trapMap',
  
    options: { // Leaflet map constructor
      center: [-42.661232, 171.496582], // Lake Brunner lat/long
      zoom: 12,
      minZoom: 11,
      maxZoom: 14,
    },
    boundsPadding: 0.5,
  
    panes: {
      hexes: {
        style: {
          zIndex: 200
        }
      },
    },
  
    layers: {
      base: {
        linz_colour_basemap: {
          layergroup: true,
          visible: true,
          label: 'LINZ Colour Basemap',
          layers: [
            {
              label: 'LINZ NZ Basemap',
              url: '//tiles{s}.maps.linz.io/nz_colour_basemap/' + linz_proj + '/{z}/{x}/{y}.png',
              settings: linz_basemap_settings,
            },
            {
              label: 'LINZ Basemap Labels',
              url: '//tiles{s}.maps.linz.io/nz_colour_basemap_labels/' + linz_proj + '/{z}/{x}/{y}.png',
              settings: linz_basemap_settings,
            },
          ],
        },
      },
  
      overlay: {
        catches_hex: {
          label: 'Catch summary hexes',
          layerType: 'L.HexbinLayer',
          ajax: {
            url: catchesHexURL('https://io.trap.nz/maps/trap-killcount?'),
            dataType: 'json',
            success: catchesHexData,
          },
          init: catchesHexInit,
          visible: true,
          settings: {
            radius: 12,
            radiusRange: [12, 12],
            opacity: 0.7,
            duration: 0,
            minZoom: 0, // hide below this zoom
            maxZoom: 13, // increase size above this zoom
            colorScale: ['#FFFFCC', 'yellow', 'orange', 'red', 'brown'],
            allowedSpecies: ['None', 'Other', 'Ferret', 'Hedgehog', 'Mouse', 'Possum', 'Rabbit', 'Rat', 'Stoat', 'Weasel'],
            hoverHandlers: {
              tooltip: catchesHexTooltip,
              scale: { radiusScale: 0.5 },
            },
            colorValue: catchesHexColorValue,
            pane: 'hexes',
          },
        },
      },
  
    },
  
    fullscreen: true,
    controls: {
      fullscreen: false,
      scale: { imperial: false },
      layerswitcher: false,
  
      attribution: { prefix: 'Created for Predator Free Lake Brunner using <a href="https://www.trap.nz"><strong><span style="color:#bd1f2d;">TRAP</span><span style="color:black">.NZ</span></strong></a> data' },
  
      legends: {
        gt_attribution: {
          position: 'bottomright',
          visible: true,
        //   legends: [{
        //     elements: [{
        //       html: '<style type="text/CSS"><!-- .leaflet-bar .legend-block a, .leaflet-bar .legend-block a:hover { display: inline; } .legend-block { margin: 0 !important; } --></style><div>Created for <a href="https://www.trap.nz"><strong><span style="color:#bd1f2d;">TRAP</span><span style="color:black">.NZ</span></strong></a> by <a href="https://www.groundtruth.co.nz"><span style="font-family:serif; font-size: 1.2em; color:black"><strong>ground<span style="color:#2e7a34">truth</span></strong></span></a></div>',
        //       style: { 'font-size': '0.6em', 'margin': '0 0.5em' },
        //     }],
        //   }],
        },
  
        catch_summary: {
          position: 'bottomleft',
          visible: true,
          ajax: {
            url: projectBoundaryURL('https://www.trap.nz/project/trap-stats-shape.geojson?'),
            html: catchSummaryHTML,
          },
          style: { 'font-size': '0.6em', 'margin': '0 0.5em' },
        },
      }
    }
  };
  
  var map = buildMap(map_opts);
  
  ///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\
  // Trap hex layer //
  
  function projectBoundaryURL(base_url) {
    var url = base_url;
    for(var key in project_list) {
      url += 'id[]=' + key + '&';
    }
    return url;
  }
  
  function catchesHexURL(base_url) {
    var url = base_url;
    var project_ids = Object.keys(project_list);
    var project_ids_imploded = project_ids.join(',');
    url += 'projects=' + project_ids_imploded;
    return url;
  }
  
  function catchesHexInit(map, layer, opts) {
    map.on('zoomend', function(e) {
      var zoom = e.target._zoom;
      var zoomDiff = zoom - opts.settings.maxZoom;
      var newRadius = opts.settings.radius;
      if (zoomDiff >= 1) {
        newRadius = opts.settings.radius * (2**zoomDiff);
      }
  
      layer.radius(newRadius);
      layer.radiusRange([newRadius, newRadius]);
      map.strikesHexLayer.radius(newRadius);
      map.strikesHexLayer.radiusRange([newRadius/2, newRadius/2]);
  
      if (zoom >= opts.settings.minZoom) {
        map.addLayer(layer);
      } else {
        map.removeLayer(layer);
      }
    });
  }
  
  function catchesHexData(data, map, layer, opts) {
    // feed data into hexmap layer
    layer.data(data.features);
    // create interior sub-hexes for strikes density
    var strikes_opts = opts;
    strikes_opts.init = null;
    strikes_opts.ajax = null;
    strikes_opts.data = data;
    strikes_opts.settings.radiusRange = [6, 6];
    strikes_opts.settings.colorValue = strikesHexColorValue;
    var strikesHexLayer = createLayer(map, strikes_opts);
    strikesHexLayer.addTo(map);
    map.strikesHexLayer = strikesHexLayer;
  }
  
  function catchesHexTooltip(d) {
    var strikes = sumStrikes(d);
    var out = 'Traps: ' + strikes.total_traps + '<br />';
    out += 'Catches: ' + strikes.total_strikes + '<br />';
    for (var s in strikes.species) {
      out += '&nbsp;' + s + ': ' + strikes.species[s] + '<br />';
    }
    return out;
  }
  
  function catchesHexColorValue(d) {
    return sumTraps(d);
  }
  
  function strikesHexColorValue(d) {
    return sumStrikes(d).total_strikes;
  }
  
  function sumTraps(d) {
    var traps = 0;
    for (var i=0; i<d.length; i++) {
      if (d[i].o) {
        traps += d[i].o.properties.traps;
      } else {
        traps += d[i].properties.traps;
      }
    }
    return traps;
  }
  
  function sumStrikes(d, total_only) {
    var strikes = { 'total_traps': 0, 'total_strikes': 0, 'species': {} };
    for (var i=0; i<d.length; i++) {
      if (d[i].o) {
        strikes.total_traps += d[i].o.properties.traps;
        strikes.total_strikes += d[i].o.properties.kill_count;
      } else {
        strikes.total_traps += d[i].properties.traps;
        strikes.total_strikes += d[i].properties.kill_count;
      }
      if (!total_only) {
        var species = d[i].o.properties.species;
        var allowedSpecies = map_opts.layers.overlay.catches_hex.settings.allowedSpecies;
        for (var s in species) {
          var count = species[s];
          if (allowedSpecies.indexOf(s) == -1) {
            // species not in allowed species list, make 'Other'
            s = 'Other';
          }
          if (!strikes.species[s]) strikes.species[s] = 0;
          strikes.species[s] += count;
        }
      }
    }
    return strikes;
  }
  
  
  ///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\
  // Summary info legend //
  
  function catchSummaryHTML(data) {
    var totalKills = 0;
    var totalTraps = 0;
    $(data.features).each(function(key, data) {
      totalKills += data['properties']['Total kills'];
      totalTraps += data['properties']['Trap count'];
    });
  
    //totals legend
    var html = '<p><strong>Predator Free Lake Brunner</strong>';
    html += '<br />Total pests killed: <strong>'+ numberWithCommas(totalKills) + '</strong>';
    html += '<br />Traps deployed: <strong>'+ numberWithCommas(totalTraps) +'</strong></p>';
  
    return html;
  }