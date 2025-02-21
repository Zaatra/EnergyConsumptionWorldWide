import React, { useState, useCallback, useMemo, useEffect } from 'react';
import MapGL, { Layer, Source, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './MyMap.css';
import debounce from 'lodash/debounce';
import { zoneIdToGeojsonId } from './zoneMapping';

const MAPTILER_ACCESS_TOKEN = import.meta.env.VITE_MAPTILER_ACCESS_TOKEN;
const MAP_STYLE_URL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_ACCESS_TOKEN}`;

const formatDateForComparison = (dateInput) => {
  try {
    if (!dateInput) return null;
    
    let date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      if (dateInput.includes('/')) {
        const [datePart, timePart] = dateInput.split(' ');
        const [day, month, year] = datePart.split('/');
        let hours = '00';
        let minutes = '00';
        
        if (timePart) {
          [hours, minutes] = timePart.split(':');
        }
        
        const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00Z`;
        date = new Date(isoString);
      } else {
        date = new Date(dateInput);
      }
    } else {
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) {
      return null;
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    return null;
  }
};

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
  const [currentTime, setCurrentTime] = useState('');
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [geoJsonStatus, setGeoJsonStatus] = useState({
    fileFound: false,
    fileReadable: false,
    parseStatus: null,
    featureCount: 0,
    layerRendered: false,
    error: null,
    lastCheck: Date.now()
  });

  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 1.5,
    bearing: 0,
    pitch: 0
  });

  useEffect(() => {
    if (!mapData || !selectedDate) return;

    const targetDate = formatDateForComparison(selectedDate);
    if (!targetDate) return;

    const startDate = '2023-12-31';
    const endDate = '2024-12-31';
    
    if (targetDate < startDate || targetDate > endDate) {
      setProcessedData({});
      return;
    }

    const processed = {};
    mapData.forEach((entry) => {
      try {
        const entryDate = formatDateForComparison(entry['Datetime (UTC)']);
        if (entryDate === targetDate) {
          const zoneId = entry['Zone Id'];
          if (!processed[zoneId] || 
              new Date(entry['Datetime (UTC)']) > new Date(processed[zoneId]['Datetime (UTC)'])) {
            processed[zoneId] = entry;
          }
        }
      } catch (error) {
        // Skip invalid entries
      }
    });

    setProcessedData(processed);
  }, [mapData, selectedDate]);

  const formatUTCDateTime = useCallback((date) => {
    try {
      const pad = (num) => String(num).padStart(2, '0');
      const d = new Date(date);
      if (isNaN(d.getTime())) throw new Error('Invalid date');
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    } catch (error) {
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
    if (intensity === undefined || intensity === null || isNaN(intensity)) return '#CCCCCC';
    const max = 1000;
    const min = 0;
    const norm = Math.max(min, Math.min(max, intensity));
    const ratio = (norm - min) / (max - min);
    let r, g;
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

  useEffect(() => {
    const loadGeoJSON = async () => {
      if (!processedData) return;

      try {
        const response = await fetch(import.meta.env.VITE_COUNTRIES_GEONAMES_PATH);
        if (!response.ok) throw new Error('Failed to fetch GeoJSON');
        
        const data = await response.json();
        
        const features = data.features.map((feature) => {
          const geojsonId = feature.id;
          const csvZoneId = Object.keys(zoneIdToGeojsonId).find(
            key => zoneIdToGeojsonId[key] === geojsonId
          );
          
          let intensity = null;
          let record = null;
          
          if (csvZoneId && processedData[csvZoneId]) {
            record = processedData[csvZoneId];
            intensity = viewMode === 'production' 
              ? parseFloat(record['Carbon Intensity gCO₂eq/kWh (direct)'])
              : parseFloat(record['Carbon Intensity gCO₂eq/kWh (LCA)']);
          }
          
          return {
            ...feature,
            id: geojsonId,
            properties: {
              ...feature.properties,
              csvZoneId,
              intensity,
              fillColor: getColorForIntensity(intensity),
              record: record
            }
          };
        });

        setGeoJsonData({
          type: 'FeatureCollection',
          features
        });

        setGeoJsonStatus({
          fileFound: true,
          fileReadable: true,
          parseStatus: 'success',
          featureCount: features.length,
          layerRendered: true,
          error: null,
          lastCheck: Date.now()
        });
      } catch (error) {
        setGeoJsonStatus(prev => ({
          ...prev,
          error: error.message,
          lastCheck: Date.now()
        }));
      }
    };

    loadGeoJSON();
  }, [processedData, viewMode, getColorForIntensity]);

  const handleCountryClick = useCallback((event) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const countryName = feature.properties.name;
    const record = feature.properties.record;
    const intensity = feature.properties.intensity;

    toast.info(
      <div className="popup-content">
        <h3>{countryName}</h3>
        <div className="popup-data">
          <p>
            <strong>Carbon Intensity ({viewMode}):</strong> {intensity ? `${intensity.toFixed(2)} gCO₂eq/kWh` : 'No data available'}
          </p>
          {record && (
            <>
              <p><strong>Low Carbon:</strong> {record['Low Carbon Percentage']}%</p>
              <p><strong>Renewable:</strong> {record['Renewable Percentage']}%</p>
            </>
          )}
          <p><strong>Mode:</strong> {isLiveMode ? 'Live' : 'Historical'}</p>
          <p><strong>Date:</strong> {selectedDate.toLocaleDateString()}</p>
        </div>
        <div className="popup-footer">
          <p>UTC Time: {currentTime}</p>
        </div>
      </div>,
      {
        position: 'top-center',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      }
    );
  }, [viewMode, isLiveMode, currentTime, selectedDate]);

  const onHover = useCallback(event => {
    const map = event.target;
    const features = event.features;
    
    if (features && features.length > 0) {
      map.getCanvas().style.cursor = 'pointer';
      
      if (hoveredCountry !== null) {
        try {
          map.setFeatureState(
            { source: 'countries', id: hoveredCountry },
            { hover: false }
          );
        } catch (err) {}
      }
      
      const feature = features[0];
      const id = feature.id;
      
      if (id !== undefined && id !== null) {
        try {
          map.setFeatureState(
            { source: 'countries', id },
            { hover: true }
          );
          setHoveredCountry(id);
        } catch (err) {}
      }
    }
  }, [hoveredCountry]);

  const onMouseLeave = useCallback(event => {
    const map = event.target;
    map.getCanvas().style.cursor = '';
    
    if (hoveredCountry !== null) {
      try {
        map.setFeatureState(
          { source: 'countries', id: hoveredCountry },
          { hover: false }
        );
        setHoveredCountry(null);
      } catch (err) {}
    }
  }, [hoveredCountry]);

  const handleMove = useCallback(evt => {
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
        0.7
      ]
    }
  }), []);

  return (
    <div className="map-wrapper">
      <MapGL
        {...viewState}
        onMove={handleMove}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE_URL}
        interactiveLayerIds={['countries']}
        onClick={handleCountryClick}
        onMouseMove={onHover}
        onMouseLeave={onMouseLeave}
        cursor={hoveredCountry ? 'pointer' : 'grab'}
      >
        {geoJsonData && (
          <Source 
            id="countries" 
            type="geojson" 
            data={geoJsonData}
            generateId={false}
          >
            <Layer {...layerStyle} />
          </Source>
        )}
        <NavigationControl position="top-right" />
      </MapGL>

      <ToastContainer />

      {mapError && (
        <div className="map-error-overlay">
          <div className="map-error-message">
            {mapError}
            <button onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      )}

      <div className="map-info">
        <div className="time-status-indicator">
          <div className="status-badge">
            {isLiveMode ? (
              <>
                <span className="mode-label live">LIVE</span>
                <span className="time-label">{currentTime} UTC</span>
              </>) : (
              <>
                <span className="mode-label historical">HISTORICAL</span>
                <span className="time-label">
                  {selectedDate?.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                    day: 'numeric'
                  }) || 'Loading...'}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="map-legend">
          <div className="legend-title">Carbon Intensity Scale (gCO₂eq/kWh)</div>
          <div className="gradient-bar"></div>
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
            <p>Please select a date between {formatDateForComparison(new Date('2023-12-31'))} and {formatDateForComparison(new Date('2024-12-31'))}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyMap;