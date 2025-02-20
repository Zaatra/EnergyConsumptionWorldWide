// File 1: /my_Project/src/MyMap.jsx

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MyMap = ({
  selectedDate,
  selectedTimeRange,
  viewMode,
  zoneViewEnabled,
  csvDataPath,
  isLiveMode,
  mapData,
  dataFound,
  countryData,
  currentDate
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(2.5);
  const [lat] = useState(48.5);
  const [zoom] = useState(4);
  const [countriesData, setCountriesData] = useState(null);
  const [showLabels, setShowLabels] = useState(false); // Set showLabels to false by default and remove toggle
  const [show3D, setShow3D] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showDayNight, setShowDayNight] = useState(false);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    if (map.current) return;

    try {
      console.log('Map initialization started...'); // Debug log: Map initialization start
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          // glyphs: 'https://fonts.openmaptiles.org/Open%20Sans/{range}.pbf', // REMOVE or comment out the glyphs property
          sources: {
            'raster-tiles': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors, © CARTO'
            }
          },
          layers: [
            {
              id: 'base-map',
              type: 'raster',
              source: 'raster-tiles',
              minzoom: 0,
              maxzoom: 20
            }
          ]
        },
        center: [lng, lat],
        zoom: zoom,
        maxBounds: [[-30, 30], [50, 75]]
      });
      console.log('Map object created:', map.current); // Debug log: Map object created
    } catch (mapError) {
      console.error('Map initialization error:', mapError); // Debug log: Map initialization error
      return; // Exit if map initialization fails
    }


    map.current.on('load', () => {
      console.log('Map loaded event fired.'); // Debug log: Map load event

      // Check map container dimensions after load
      if (mapContainer.current) {
        const rect = mapContainer.current.getBoundingClientRect();
        console.log('Map container dimensions on load:', { width: rect.width, height: rect.height }); // Debug log: Container dimensions
      }

      loadGeoJSON();

      if (!window.mapControls) {
        window.mapControls = {
          fitBounds: () => {
            if (map.current && countriesData) {
              const bounds = new maplibregl.LngLatBounds();
              countriesData.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                  if (feature.geometry.type === 'Polygon') {
                    feature.geometry.coordinates.forEach(ring => {
                      ring.forEach(coord => {
                        bounds.extend(coord);
                      });
                    });
                  } else if (feature.geometry.type === 'MultiPolygon') {
                    feature.geometry.coordinates.forEach(polygon => {
                      polygon.forEach(ring => {
                        bounds.extend(coord);
                      });
                    });
                  }
                }
              });
              map.current.fitBounds(bounds, { padding: 20 });
            }
          },
          resetOrientation: () => {
            if (map.current) {
              map.current.easeTo({
                pitch: 0,
                bearing: 0,
                duration: 1000
              });
            }
          },
          toggle3DMode: () => {
            if (map.current) {
              setShow3D(!show3D);
              if (!show3D) {
                map.current.easeTo({
                  pitch: 45,
                  bearing: -17.6,
                  duration: 1000
                });
              } else {
                map.current.easeTo({
                  pitch: 0,
                  bearing: 0,
                  duration: 1000
                });
              }
            }
          },
          toggleDayNight: () => {
            setShowDayNight(!showDayNight);
          },
          toggleGrid: () => {
            setShowGrid(!showGrid);
          },
          toggleLabels: () => {
            setShowLabels(!showLabels); // Keep the state function but it won't toggle labels now
          }
        };
      }

      // Initialize popup
      const newPopup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '400px'
      });
      setPopup(newPopup);
    });

    map.current.on('error', (error) => {
      console.error('Map error event:', error); // Debug log: Map error event
    });

    map.current.on('sourcedata', (event) => {
      if (event.isSourceLoaded && event.sourceId === 'raster-tiles') {
        console.log('Raster source loaded successfully:', event); // Debug log: Raster source loaded
      } else if (event.isSourceLoaded && event.sourceId === 'countries') {
        console.log('Countries source loaded successfully:', event); // Debug log: Countries source loaded
      } else if (event.isSourceLoaded) {
        console.log('Source loaded successfully:', event); // Debug log: Generic source loaded
      } else if (event.isError) {
        console.error('Source data error:', event); // Debug log: Source data error
      }
    });

    return () => {
      if (popup) {
        popup.remove();
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [lng, lat, zoom]);

  useEffect(() => {
    if (countriesData && map.current && map.current.isStyleLoaded() && popup) {
      updateMapData();
    }
  }, [
    countriesData,
    selectedDate,
    viewMode,
    zoneViewEnabled,
    mapData,
    dataFound,
    // showLabels,  // Remove showLabels from dependencies
    show3D,
    showGrid,
    showDayNight
  ]);

  const loadGeoJSON = async () => {
    try {
      const response = await fetch('/countries.geo.json');
      const data = await response.json();
      setCountriesData(data);
      console.log('GeoJSON data loaded successfully:', data); // Debug log: GeoJSON load success
    } catch (error) {
      console.error('Failed to load GeoJSON:', error); // Debug log: GeoJSON load error
    }
  };

  const getColorForIntensity = (intensity) => {
    // If no intensity data is available, use a neutral color
    if (intensity === undefined || intensity === null || isNaN(intensity)) {
      return '#CCCCCC';
    }

    // Color scale from green (low) to red (high)
    if (intensity <= 50) return '#00CC00';
    if (intensity <= 100) return '#66CC00';
    if (intensity <= 150) return '#CCCC00';
    if (intensity <= 200) return '#CC6600';
    if (intensity <= 300) return '#CC3300';
    if (intensity <= 400) return '#CC0000';
    return '#990000';
  };

  const getFillOpacity = () => {
    return 0.7;
  };

  const getCountryIntensity = (countryName, selectedDate) => {
    if (!dataFound || !mapData || mapData.length === 0) {
      return null;
    }

    // Get data for the selected country on the selected date
    const countryEntries = mapData.filter(
      entry => entry.Country === countryName &&
      entry.date.toDateString() === selectedDate.toDateString()
    );

    if (countryEntries.length === 0) {
      return null;
    }

    // Get the entry closest to the selected time
    const targetHour = selectedDate.getHours();
    let closestEntry = countryEntries[0];
    let smallestHourDiff = Math.abs(closestEntry.date.getHours() - targetHour);

    countryEntries.forEach(entry => {
      const hourDiff = Math.abs(entry.date.getHours() - targetHour);
      if (hourDiff < smallestHourDiff) {
        smallestHourDiff = hourDiff;
        closestEntry = entry;
      }
    });

    return viewMode === 'production' ? closestEntry.directIntensity : closestEntry.lcaIntensity;
  };

  const updateMapData = () => {
    if (!map.current || !map.current.isStyleLoaded() || !countriesData) return;

    // Check if source already exists, if not add it
    if (!map.current.getSource('countries')) {
      console.log('Adding countries source.'); // Debug log: Adding countries source
      map.current.addSource('countries', {
        type: 'geojson',
        data: countriesData
      });
    } else {
      console.log('Setting data for countries source.'); // Debug log: Setting countries source data
      // Update the source data
      map.current.getSource('countries').setData(countriesData);
    }

    // Remove existing layers if they exist
    if (map.current.getLayer('country-fills')) {
      console.log('Removing country-fills layer.'); // Debug log: Removing country-fills layer
      map.current.removeLayer('country-fills');
    }
    if (map.current.getLayer('country-borders')) {
      console.log('Removing country-borders layer.'); // Debug log: Removing country-borders layer
      map.current.removeLayer('country-borders');
    }
    if (map.current.getLayer('country-labels')) {
      console.log('Removing country-labels layer.'); // Debug log: Removing country-labels layer
      map.current.removeLayer('country-labels'); // REMOVE country-labels layer
    }
    if (map.current.getLayer('grid-lines')) {
      console.log('Removing grid-lines layer.'); // Debug log: Removing grid-lines layer
      map.current.removeLayer('grid-lines');
    }
    if (map.current.getLayer('day-night-layer')) {
      console.log('Removing day-night-layer layer.'); // Debug log: Removing day-night-layer layer
      map.current.removeLayer('day-night-layer');
    }

    // Prepare color stops for the 'match' expression
    const colorExpression = ['match', ['get', 'name']];
    countriesData.features.forEach(feature => {
      const countryName = feature.properties.name;
      const intensity = getCountryIntensity(countryName, selectedDate);
      const color = getColorForIntensity(intensity);
      colorExpression.push(countryName, color);
    });
    // Default color if no match
    colorExpression.push('#CCCCCC');

    // Add country fill layer
    console.log('Adding country-fills layer.'); // Debug log: Adding country-fills layer
    map.current.addLayer({
      id: 'country-fills',
      type: 'fill',
      source: 'countries',
      layout: {},
      paint: {
        'fill-color': colorExpression, // Use the 'match' expression here
        'fill-opacity': getFillOpacity(),
        // 'fill-extrusion-height': show3D ?  // Removed fill-extrusion-height
        //   [
        //     'case',
        //     ['has', 'name'],
        //     [
        //       'function',
        //       ['get', 'name'],
        //       ['literal', countriesData.features.reduce((acc, feature) => {
        //         const countryName = feature.properties.name;
        //         const intensity = getCountryIntensity(countryName, selectedDate) || 0;
        //         const height = intensity * 100;
        //         return { ...acc, [countryName]: height };
        //       }, {})]
        //     ],
        //     0
        //   ] : 0
      }
    });

    // Add country border layer
    console.log('Adding country-borders layer.'); // Debug log: Adding country-borders layer
    map.current.addLayer({
      id: 'country-borders',
      type: 'line',
      source: 'countries',
      layout: {},
      paint: {
        'line-color': '#000',
        'line-width': 1
      }
    });

    // // Add country labels layer if showLabels is true  // REMOVE or comment out the labels layer addition
    // if (showLabels) {
    //   map.current.addLayer({
    //     id: 'country-labels',
    //     type: 'symbol',
    //     source: 'countries',
    //     layout: {
    //       'text-field': ['get', 'name'],
    //       'text-variable-anchor': ['center'],
    //       'text-justify': 'center',
    //       'text-size': 12
    //     },
    //     paint: {
    //       'text-color': '#333',
    //       'text-halo-color': '#fff',
    //       'text-halo-width': 1
    //     }
    //   });
    // }

    // Add grid lines layer if showGrid is true
    if (showGrid) {
      const gridSource = {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      };

      // Generate grid lines
      for (let lat = 30; lat <= 75; lat += 5) {
        const lineFeature = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[-30, lat], [50, lat]]
          },
          properties: {}
        };
        gridSource.data.features.push(lineFeature);
      }

      for (let lng = -30; lng <= 50; lng += 5) {
        const lineFeature = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[lng, 30], [lng, 75]]
          },
          properties: {}
        };
        gridSource.data.features.push(lineFeature);
      }

      if (!map.current.getSource('grid')) {
        console.log('Adding grid source.'); // Debug log: Adding grid source
        map.current.addSource('grid', gridSource);
      } else {
        console.log('Setting data for grid source.'); // Debug log: Setting grid source data
        map.current.getSource('grid').setData(gridSource.data);
      }

      console.log('Adding grid-lines layer.'); // Debug log: Adding grid-lines layer
      map.current.addLayer({
        id: 'grid-lines',
        type: 'line',
        source: 'grid',
        layout: {},
        paint: {
          'line-color': '#ccc',
          'line-width': 0.5,
          'line-dasharray': [2, 2]
        }
      });
    }

    // Add day-night layer if showDayNight is true
    if (showDayNight) {
      // Create a simple day-night visualization
      const hour = selectedDate.getUTCHours();
      const dayNightSource = {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-180, 90],
                [0, 90],
                [0, -90],
                [-180, -90],
                [-180, 90]
              ]
            ]
          },
          properties: {}
        }
      };

      if (!map.current.getSource('day-night')) {
        console.log('Adding day-night source.'); // Debug log: Adding day-night source
        map.current.addSource('day-night', dayNightSource);
      } else {
        console.log('Setting data for day-night source.'); // Debug log: Setting day-night source data
        map.current.getSource('day-night').setData(dayNightSource.data);
      }

      console.log('Adding day-night-layer layer.'); // Debug log: Adding day-night-layer layer
      map.current.addLayer({
        id: 'day-night-layer',
        type: 'fill',
        source: 'day-night',
        layout: {},
        paint: {
          'fill-color': '#000',
          'fill-opacity': 0.2
        }
      });
    }

    // Add click handler for countries (no changes needed here)
    map.current.on('click', 'country-fills', (e) => {
      if (!e.features.length) return;

      const feature = e.features[0];
      const countryName = feature.properties.name;

      // Find intensity data for the clicked country
      const intensity = getCountryIntensity(countryName, selectedDate);

      if (intensity === null) {
        popup.setLngLat(e.lngLat)
          .setHTML(`
              <div>
                <h3>${countryName} ()</h3>
                <p>Carbon Intensity (Direct): No data available</p>
              </div>
            `)
          .addTo(map.current);
        return;
      }

      // Find the full data entry for more details
      const countryEntries = mapData.filter(
        entry => entry.Country === countryName &&
          entry.date.toDateString() === selectedDate.toDateString()
      );

      let closestEntry = null;
      if (countryEntries.length > 0) {
        const targetHour = selectedDate.getHours();
        closestEntry = countryEntries[0];
        let smallestHourDiff = Math.abs(closestEntry.date.getHours() - targetHour);

        countryEntries.forEach(entry => {
          const hourDiff = Math.abs(entry.date.getHours() - targetHour);
          if (hourDiff < smallestHourDiff) {
            smallestHourDiff = hourDiff;
            closestEntry = entry;
          }
        });
      }

      if (closestEntry) {
        const formattedDate = closestEntry.date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        });

        const zoneInfo = closestEntry['Zone Name'] !== countryName
          ? `(${closestEntry['Zone Name']})`
          : '';

        popup.setLngLat(e.lngLat)
          .setHTML(`
              <div>
                <h3>${countryName} ${zoneInfo}</h3>
                <p>Data as of: ${formattedDate}</p>
                <p>Carbon Intensity (Direct): ${closestEntry.directIntensity.toFixed(2)} gCO<sub>2</sub>eq/kWh</p>
                <p>Carbon Intensity (LCA): ${closestEntry.lcaIntensity.toFixed(2)} gCO<sub>2</sub>eq/kWh</p>
                <p>Low Carbon: ${closestEntry.lowCarbonPercentage.toFixed(2)}%</p>
                <p>Renewable: ${closestEntry.renewablePercentage.toFixed(2)}%</p>
                <p>Viewed by: ${localStorage.getItem('username') || 'Guest'}</p>
              </div>
            `)
          .addTo(map.current);
      }
    });

    // Change cursor on hover (no changes needed here)
    map.current.on('mouseenter', 'country-fills', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'country-fills', () => {
      map.current.getCanvas().style.cursor = '';
    });
  };

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map" />
      {!dataFound && (
        <div className="no-data-overlay">
          <div className="no-data-message">
            No data available for the selected date and time
          </div>
        </div>
      )}
    </div>
  );
};

export default MyMap;