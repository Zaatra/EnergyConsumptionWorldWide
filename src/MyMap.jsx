// File: /src/MyMap.jsx
import PropTypes from 'prop-types';
import { useState, useCallback, useMemo, useEffect } from 'react';
import MapGL, { Layer, Source, NavigationControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MyMap.css';
import { zoneIdToGeojsonId } from './zoneMapping';

const MAPTILER_ACCESS_TOKEN = import.meta.env.VITE_MAPTILER_ACCESS_TOKEN;
// Define two map style URLs for dark and light themes
const darkMapStyle = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_ACCESS_TOKEN}`;
const lightMapStyle = `https://api.maptiler.com/maps/streets-v2-light/style.json?key=${MAPTILER_ACCESS_TOKEN}`;
// Environment variable for CSV date field key
const Date_TIME_UTC = import.meta.env.VITE_DATE_TIME_UTC;

// Adjusted so that CSV dates are parsed as local time
const formatDateForComparison = (dateInput) => {
  try {
    if (!dateInput) return null;
    let date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      if (dateInput.includes('/')) {
        // CSV dates are in "DD/MM/YYYY HH:mm" format and are in local time.
        const [datePart, timePart] = dateInput.split(' ');
        const [dayPart, monthPart, yearPart] = datePart.split('/');
        const hours = timePart ? timePart.split(':')[0].padStart(2, '0') : '00';
        const minutes = timePart ? timePart.split(':')[1].padStart(2, '0') : '00';
        // Build an ISO string WITHOUT appending "Z" so that it is treated as local time.
        const isoString = `${yearPart}-${monthPart.padStart(2, '0')}-${dayPart.padStart(2, '0')}T${hours}:${minutes}:00`;
        date = new Date(isoString);
      } else {
        date = new Date(dateInput);
      }
    } else {
      date = new Date(dateInput);
    }
    if (Number.isNaN(date.getTime())) return null;
    // Format based on local date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
};

const MyMap = ({
  selectedDate,
  viewMode,
  isLiveMode,
  mapData,
  isLightMode, // New prop for theme
}) => {
  const [currentTime, setCurrentTime] = useState('');
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);

  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 1.5,
    bearing: 0,
    pitch: 0,
  });

  // Choose map style based on theme
  const mapStyleURL = isLightMode ? darkMapStyle : lightMapStyle;


  useEffect(() => {
    if (!mapData || !selectedDate) {
      setProcessedData(null);
      return;
    }

    const targetDateUTC = formatDateForComparison(selectedDate); // e.g., "2025-02-21"
    const processed = {};

    mapData.forEach((entry) => {
      // For live mode, always include Israel's live record
      if (isLiveMode && entry['Zone Id'] === 'IL') {
        const zoneId = entry['Zone Id'];
        processed[zoneId] = entry;
        return;
      }
      const entryDateUTC = formatDateForComparison(entry[import.meta.env.VITE_DATE_TIME_UTC]);
      if (entryDateUTC === targetDateUTC) {
        const zoneId = entry['Zone Id'];
        if (
          !processed[zoneId] ||
          new Date(entry[import.meta.env.VITE_DATE_TIME_UTC]) > new Date(processed[zoneId][import.meta.env.VITE_DATE_TIME_UTC])
        ) {
          processed[zoneId] = entry;
        }
      }
    });
    setProcessedData(processed);
  }, [mapData, selectedDate, isLiveMode]);

  const formatUTCDateTime = useCallback((date) => {
    try {
      const pad = (num) => String(num).padStart(2, '0');
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
      // For display purposes we still use UTC
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    } catch {
      return 'Invalid Date';
    }
  }, []);

  useEffect(() => {
    const updateTime = () => setCurrentTime(formatUTCDateTime(new Date()));
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [formatUTCDateTime]);

  const getColorForIntensity = useCallback((intensity) => {
    if (intensity === undefined || intensity === null || Number.isNaN(intensity)) return '#CCCCCC';
    const max = 1000;
    const min = 0;
    const norm = Math.max(min, Math.min(max, intensity));
    const ratio = (norm - min) / (max - min);
    let r;
    let g;
    const b = 0;
    if (ratio < 0.5) {
      r = Math.round(ratio * 2 * 255);
      g = 255;
    } else {
      g = Math.round(Math.max(0, (1 - (ratio - 0.5) * 2)) * 255);
      r = 255;
    }
    return `rgb(${r},${g},${b})`;
  }, []);

  // Use the numeric properties from CSV (which are assumed to be parsed correctly as local numbers)
  const mapFeature = useCallback((feature, zoneData, currentViewMode) => {
    const geojsonId = feature.id;
    const csvZoneId = Object.keys(zoneIdToGeojsonId).find(
      (key) => zoneIdToGeojsonId[key] === geojsonId,
    );
    let intensity = null;
    let record = null;
    let lowCarbon = null;
    let renewable = null;

    if (csvZoneId && zoneData[csvZoneId]) {
      record = zoneData[csvZoneId];
      if (currentViewMode === 'production') {
        intensity = Number(record.directIntensity || 0);
        lowCarbon = Number(record.lowCarbonPercentage || 0);
        renewable = Number(record.renewablePercentage || 0);
      } else if (currentViewMode === 'lca' || currentViewMode === 'consumption') {
        intensity = Number(record.lcaIntensity || 0);
      }
    }

    return {
      ...feature,
      id: geojsonId,
      properties: {
        ...feature.properties,
        csvZoneId,
        intensity,
        fillColor: getColorForIntensity(intensity),
        record,
        lowCarbon,
        renewable,
      },
    };
  }, [getColorForIntensity]);

  useEffect(() => {
    const loadGeoJSON = async () => {
      if (!processedData) return;
      try {
        const response = await fetch(import.meta.env.VITE_COUNTRIES_GEONAMES_PATH);
        if (!response.ok) throw new Error('Failed to fetch GeoJSON');
        const data = await response.json();
        const features = data.features.map(feature => mapFeature(feature, processedData, viewMode));
        setGeoJsonData({
          type: 'FeatureCollection',
          features,
        });
      } catch (error) {
        console.info('GeoJSON loading error:', error.message);
      }
    };
    loadGeoJSON();
  }, [processedData, viewMode, mapFeature]);

  const handleCountryClick = useCallback((event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const { name: countryName, record, lowCarbon, renewable } = feature.properties;
    const { lng: longitude, lat: latitude } = event.lngLat;
    setPopupInfo({
      longitude,
      latitude,
      countryName,
      record,
      intensity: feature.properties.intensity,
      lowCarbon,
      renewable
    });
  }, []);

  const onHover = useCallback((event) => {
    const map = event.target;
    const features = event.features;
    if (features && features.length > 0) {
      map.getCanvas().style.cursor = 'pointer';
      if (hoveredCountry !== null) {
        try {
          map.setFeatureState({ source: 'countries', id: hoveredCountry }, { hover: false });
        } catch {
          // Ignore errors
        }
      }
      const feature = features[0];
      const id = feature.id;
      if (id !== undefined && id !== null) {
        try {
          map.setFeatureState({ source: 'countries', id }, { hover: true });
          setHoveredCountry(id);
        } catch {
          // Ignore errors
        }
      }
    }
  }, [hoveredCountry]);

  const onMouseLeave = useCallback((event) => {
    const map = event.target;
    map.getCanvas().style.cursor = '';
    if (hoveredCountry !== null) {
      try {
        map.setFeatureState({ source: 'countries', id: hoveredCountry }, { hover: false });
        setHoveredCountry(null);
      } catch {
        // Ignore errors
      }
    }
  }, [hoveredCountry]);

  const handleMove = useCallback((evt) => {
    setViewState(evt.viewState);
  }, []);

  const layerStyle = useMemo(() => ({
    id: 'countries',
    type: 'fill',
    paint: {
      'fill-color': ['get', 'fillColor'],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.9,
        0.7,
      ],
    },
  }), []);

  const getIntensityText = (intensity) => (
    intensity !== undefined && intensity !== null
      ? `${intensity.toFixed(2)} gCO₂eq/kWh`
      : 'No data available'
  );

  const getPercentageText = (value) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return '0.00%';
    }
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="map-wrapper">
      <MapGL
        {...viewState}
        onMove={handleMove}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyleURL}
        interactiveLayerIds={['countries']}
        onClick={handleCountryClick}
        onMouseMove={onHover}
        onMouseLeave={onMouseLeave}
        cursor={hoveredCountry ? 'pointer' : 'grab'}
      >
        {geoJsonData && (
          <Source id="countries" type="geojson" data={geoJsonData} generateId={false}>
            <Layer {...layerStyle} />
          </Source>
        )}
        <NavigationControl position="top-right" />
        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            anchor="bottom"
            closeOnClick={false}
            onClose={() => setPopupInfo(null)}
          >
            <div className="popup-content">
              <h3>{popupInfo.countryName}</h3>
              <div className="popup-data">
                <p>
                  <strong>Carbon Intensity ({viewMode}):</strong>{' '}
                  {typeof popupInfo.intensity === 'number'
                    ? popupInfo.intensity.toFixed(2) + ' gCO₂eq/kWh'
                    : 'No data available'}
                </p>
                {viewMode === 'production' && popupInfo.record && (
                  <>
                    <p>
                      <strong>Low Carbon:</strong>{' '}
                      {(Number(popupInfo.lowCarbon) || 0).toFixed(2)}%
                    </p>
                    <p>
                      <strong>Renewable:</strong>{' '}
                      {(Number(popupInfo.renewable) || 0).toFixed(2)}%
                    </p>
                  </>
                )}
                <p><strong>Mode:</strong> {isLiveMode ? 'Live' : 'Historical'}</p>
                <p>
                  <strong>Date:</strong>{' '}
                  {selectedDate.toLocaleDateString()}
                </p>
              </div>
              <div className="popup-footer">
                <p>UTC Time: {currentTime}</p>
              </div>
            </div>
          </Popup>
        )}
      </MapGL>
      <div className="map-info">
        <div className="time-status-indicator">
          <div className="status-badge">
            {isLiveMode ? (
              <>
                <span className="mode-label live">LIVE</span>
                <span className="time-label">{currentTime} UTC</span>
              </>
            ) : (
              <>
                <span className="mode-label historical">HISTORICAL</span>
                <span className="time-label">
                  {selectedDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                    day: 'numeric',
                  })}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="map-legend">
          <div className="legend-title">Carbon Intensity Scale (gCO₂eq/kWh)</div>
          <div className="gradient-bar" />
          <div className="gradient-labels">
            <span>0</span>
            <span>1000</span>
          </div>
        </div>
      </div>
      {!processedData && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="loading-message">Loading data...</div>
          </div>
        </div>
      )}
      {processedData && Object.keys(processedData).length === 0 && (
        <div className="no-data-overlay">
          <div className="no-data-message">
            <h3>No Data Available</h3>
            <p>No data is available for the selected date: {formatDateForComparison(selectedDate)}</p>
            <p>
              Please select a date between{' '}
              {formatDateForComparison(new Date('2023-12-31'))}{' '}
              and{' '}
              {formatDateForComparison(new Date('2024-12-31'))}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

MyMap.propTypes = {
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  viewMode: PropTypes.oneOf(['production', 'lca']).isRequired,
  isLiveMode: PropTypes.bool.isRequired,
  mapData: PropTypes.arrayOf(
    PropTypes.shape({
      Date_TIME_UTC: PropTypes.string.isRequired,
      'Zone Id': PropTypes.string.isRequired,
      'Carbon Intensity gCO₂eq/kWh (direct)': PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
      ]),
      'Carbon Intensity gCO₂eq/kWh (LCA)': PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
      ]),
      'Low Carbon Percentage': PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
      ]),
      'Renewable Percentage': PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
      ]),
    })
  ).isRequired,
  isLightMode: PropTypes.bool.isRequired,
};

export default MyMap;
