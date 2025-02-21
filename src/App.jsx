import { useState, useEffect, useCallback } from "react";
import MyMap from "./MyMap.jsx";
import "./App.css";
import "./list.css";
import Header from "./header.jsx";
import { debounce } from 'lodash';
import { zoneIdToGeojsonId } from './zoneMapping';
import getUnicodeFlagIcon from 'country-flag-icons/unicode';

const createUniqueId = (prefix, item) => {
  return `${prefix}-${item.Country || ''}-${item['Zone Name'] || ''}-${item.date?.getTime() || Date.now()}`;
};

const CSV_DATA_PATH = '/electricity_data.csv';

const parseDateFromCSV = (dateTimeStr) => {
  if (!dateTimeStr) return null;
  
  try {
    if (dateTimeStr.includes('/')) {
      const parts = dateTimeStr.split(' ');
      if (parts.length >= 2) {
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        
        if (dateParts.length === 3) {
          const day = dateParts[0].padStart(2, '0');
          const month = dateParts[1].padStart(2, '0');
          const year = dateParts[2];
          const hour = timeParts[0].padStart(2, '0');
          const minute = timeParts[1] ? timeParts[1].padStart(2, '0') : '00';
          
          const dateStr = `${year}-${month}-${day}T${hour}:${minute}:00`;
          return new Date(dateStr);
        }
      }
    }
    
    return new Date(dateTimeStr);
  } catch (error) {
    return null;
  }
};

const formatDateForInput = (date) => {
  if (!date) return '';
  return date.toISOString().slice(0, 16);
};

function App() {
  const DATA_START_DATE = new Date('2023-01-01T00:00:00');
  const DATA_END_DATE = new Date('2024-12-31T23:59:59');
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [viewMode, setViewMode] = useState('production');
  const [zoneViewEnabled, setZoneViewEnabled] = useState(false);
  const [historicalData, setHistoricalData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [dataDateRange, setDataDateRange] = useState({
    start: DATA_START_DATE,
    end: DATA_END_DATE
  });
  const [dateTimeInputValue, setDateTimeInputValue] = useState('');
  const [closestAvailableDate, setClosestAvailableDate] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        
        const response = await fetch(CSV_DATA_PATH);
        
        if (!response.ok) {
          throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        
        if (csvText.trim().startsWith('<!doctype html>') || 
            csvText.trim().startsWith('<html')) {
          throw new Error('Received HTML instead of CSV data');
        }
        
        if (csvText.trim().length === 0) {
          throw new Error('CSV file is empty');
        }

        const lines = csvText.trim().split('\n');
        if (lines.length <= 1) {
          throw new Error('CSV file has insufficient data');
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        
        const requiredHeaders = [
          'Datetime (UTC)', 'Country', 'Zone Name', 
          'Carbon Intensity gCO₂eq/kWh (direct)', 
          'Carbon Intensity gCO₂eq/kWh (LCA)'
        ];
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          throw new Error(`CSV missing required headers: ${missingHeaders.join(', ')}`);
        }

        const chunkSize = 10000;
        const totalChunks = Math.ceil((lines.length - 1) / chunkSize);
        const processed = [];
        const uniqueDates = new Set();
        let earliestDate = new Date('9999-12-31');
        let latestDate = new Date('1970-01-01');
        
        for (let chunk = 0; chunk < totalChunks; chunk++) {
          const startIdx = chunk * chunkSize + 1;
          const endIdx = Math.min(startIdx + chunkSize, lines.length);
          
          for (let i = startIdx; i < endIdx; i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(',');
            if (values.length !== headers.length) {
              continue;
            }
            
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index]?.trim();
            });
            
            const date = parseDateFromCSV(row['Datetime (UTC)']);
            if (!date || isNaN(date.getTime())) {
              continue;
            }
            
            if (date < earliestDate) earliestDate = new Date(date);
            if (date > latestDate) latestDate = new Date(date);
            
            uniqueDates.add(date.toISOString().split('T')[0]);
            
            processed.push({
              ...row,
              date,
              directIntensity: parseFloat(row['Carbon Intensity gCO₂eq/kWh (direct)']),
              lcaIntensity: parseFloat(row['Carbon Intensity gCO₂eq/kWh (LCA)']),
              lowCarbonPercentage: parseFloat(row['Low Carbon Percentage'] || '0'),
              renewablePercentage: parseFloat(row['Renewable Percentage'] || '0')
            });
          }
          
          if (chunk % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        
        if (processed.length === 0) {
          throw new Error('No valid data rows found in CSV');
        }
        
        const sortedDates = Array.from(uniqueDates)
          .sort()
          .map(dateStr => new Date(dateStr));
        
        setAvailableDates(sortedDates);
        
        const dateRange = {
          start: earliestDate,
          end: latestDate
        };
        
        setDataDateRange(dateRange);
        setHistoricalData(processed);
        setFilteredData(processed);
        
      } catch (error) {
        console.error("Failed to load data:", error);
        setLoadError(`Error: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadHistoricalData();
  }, []);

  useEffect(() => {
    if (!isLiveMode) {
      setDateTimeInputValue(formatDateForInput(selectedDate));
    } else {
      setDateTimeInputValue(formatDateForInput(new Date()));
    }
  }, [selectedDate, isLiveMode]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredData(historicalData);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = historicalData.filter(item => 
      (item.Country || '').toLowerCase().includes(query) ||
      (item['Zone Name'] || '').toLowerCase().includes(query) ||
      (item.Region || '').toLowerCase().includes(query)
    );
    
    setFilteredData(filtered);
  }, [searchQuery, historicalData]);

  const findClosestDate = useCallback((targetDate) => {
    if (!availableDates || availableDates.length === 0) return null;
    
    let closestDate = availableDates[0];
    let smallestDiff = Math.abs(availableDates[0].getTime() - targetDate.getTime());
    
    for (let i = 1; i < availableDates.length; i++) {
      const diff = Math.abs(availableDates[i].getTime() - targetDate.getTime());
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestDate = availableDates[i];
      }
    }
    
    const diffInMinutes = Math.floor(smallestDiff / (1000 * 60));
    
    return {
      date: closestDate,
      diffMinutes: diffInMinutes
    };
  }, [availableDates]);

  const goToPreviousDay = useCallback(() => {
    setIsLiveMode(false);
    
    if (availableDates.length === 0) return;
    
    const currentDateStr = selectedDate.toISOString().split('T')[0];
    const currentIndex = availableDates.findIndex(d => 
      d.toISOString().split('T')[0] === currentDateStr
    );
    
    if (currentIndex > 0) {
      const newDate = availableDates[currentIndex - 1];
      setSelectedDate(newDate);
      setClosestAvailableDate({
        date: newDate,
        diffMinutes: 0
      });
    }
  }, [selectedDate, availableDates]);

  const goToNextDay = useCallback(() => {
    if (availableDates.length === 0) return;
    
    const currentDateStr = selectedDate.toISOString().split('T')[0];
    const currentIndex = availableDates.findIndex(d => 
      d.toISOString().split('T')[0] === currentDateStr
    );
    
    if (currentIndex < availableDates.length - 1) {
      const newDate = availableDates[currentIndex + 1];
      setSelectedDate(newDate);
      setIsLiveMode(false);
      setClosestAvailableDate({
        date: newDate,
        diffMinutes: 0
      });
    } else if (new Date() > availableDates[availableDates.length - 1]) {
      goToLive();
    }
  }, [selectedDate, availableDates]);

  const goToLive = useCallback(() => {
    setIsLiveMode(true);
    setSelectedDate(new Date());
    setClosestAvailableDate(null);
  }, []);

  const handleDateTimeChange = useCallback((e) => {
    const inputValue = e.target.value;
    setDateTimeInputValue(inputValue);
    
    if (!inputValue) return;
    
    const newDate = new Date(inputValue + ':00Z');
    
    if (isNaN(newDate.getTime())) {
      return;
    }
    
    if (newDate < dataDateRange.start) {
      setSelectedDate(dataDateRange.start);
      setIsLiveMode(false);
      return;
    }
    
    if (newDate > dataDateRange.end) {
      if (newDate <= new Date()) {
        setIsLiveMode(false);
        setSelectedDate(newDate);
      } else {
        goToLive();
      }
      return;
    }
    
    const closest = findClosestDate(newDate);
    
    setIsLiveMode(false);
    if (closest) {
      setSelectedDate(closest.date);
      setClosestAvailableDate({
        date: closest.date,
        diffMinutes: closest.diffMinutes
      });
    } else {
      setSelectedDate(newDate);
      setClosestAvailableDate(null);
    }
  }, [dataDateRange, findClosestDate, goToLive]);

  const handleProductionMode = useCallback(() => {
    setViewMode('production');
  }, []);

  const handleConsumptionMode = useCallback(() => {
    setViewMode('consumption');
  }, []);

  const handleCountryView = useCallback(() => {
    setZoneViewEnabled(false);
  }, []);

  const handleZoneView = useCallback(() => {
    setZoneViewEnabled(true);
  }, []);

  const formatDisplayDate = useCallback((date) => {
    if (isLiveMode) {
      return 'LIVE';
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }, [isLiveMode]);

  const getCountryFlag = (countryCode) => {
    const isoCode = zoneIdToGeojsonId[countryCode];
    if (!isoCode) return '🏳️';
    
    try {
      return getUnicodeFlagIcon(isoCode);
    } catch (error) {
      return '🏳️';
    }
  };

  const renderRankedList = () => {
    if (isLoading) {
      return <div className="loading-indicator">Loading data...</div>;
    }

    const uniqueEntries = new Map();
    filteredData.forEach(item => {
      const key = `${item.Country}-${item['Zone Name']}`;
      if (!uniqueEntries.has(key)) {
        uniqueEntries.set(key, item);
      }
    });

    const sortedData = [...uniqueEntries.values()].sort((a, b) => {
      const aValue = viewMode === 'production' ? a.directIntensity : a.lcaIntensity;
      const bValue = viewMode === 'production' ? b.directIntensity : b.lcaIntensity;
      return bValue - aValue;
    });

    return (
      <ul>
        {sortedData.slice(0, 20).map((item, idx) => {
          const flag = getCountryFlag(item['Zone Id']);
          const intensity = viewMode === 'production' 
            ? item.directIntensity 
            : item.lcaIntensity;
          const uniqueId = createUniqueId('location', item);
            
          return (
            <li key={uniqueId}>
              <span>{idx + 1}</span>
              <span className="flag">{flag}</span>
              {item.Country}
              {item['Zone Name'] !== item.Country && (
                <span className="location">{item['Zone Name']}</span>
              )}
              <span className="intensity">{intensity.toFixed(1)}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  const mapDataWithDebug = () => {
    return {
      mapData: filteredData,
      dataFound: filteredData.length> 0,
      currentDate: selectedDate,
      countryData: filteredData.reduce((acc, item) => {
        if (!acc[item.Country]) {
          acc[item.Country] = {};
        }
        
        const dateKey = item.date.toISOString();
        if (!acc[item.Country][dateKey]) {
          acc[item.Country][dateKey] = item;
        }
        
        return acc;
      }, {})
    };
  };

  return (
    <div className="App electricity-maps-app">
      <Header 
        onProductionClick={handleProductionMode}
        onConsumptionClick={handleConsumptionMode}
        onCountryClick={handleCountryView}
        onZoneClick={handleZoneView}
        viewMode={viewMode}
        zoneViewEnabled={zoneViewEnabled}
      />
      <div className="app-body">
        <aside className="left-sidebar">
          <div className="sidebar-header">
            <h1>Electricity Grid Carbon Emissions</h1>
            <p>
              See where your electricity comes from and how much CO2 was emitted
              to produce it
            </p>
            {loadError && (
              <div className="data-error-notice">
                {loadError}
              </div>
            )}
          </div>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search areas (ranked by carbon intensity)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="ranked-list">
            {renderRankedList()}
          </div>
          <details className="about-section">
            <summary>About Electricity Consumption Map</summary>
            <div className="about-content">
              <p>
                Electricity Consumption Map is a platform providing real-time
                and predictive electricity signals allowing any device to reduce
                their cost and emissions by informing them about the best time
                to consume electricity.
              </p>
              <p>
                The data displayed shows carbon intensity metrics 
                {viewMode === 'production' ? ' (direct)' : ' (lifecycle assessment)'} 
                for various countries and zones, with 
                {zoneViewEnabled ? ' zone-level' : ' country-level'} granularity.
              </p>
              <p>
                Low carbon percentage includes nuclear, while renewable percentage only includes
                wind, solar, hydro, and other renewable sources.
              </p>
              {closestAvailableDate && closestAvailableDate.diffMinutes > 0 && (
                <div className="debug-info">
                  <p className="note">
                    Note: Selected time is {closestAvailableDate.diffMinutes} minutes from nearest data point
                  </p>
                </div>
              )}
            </div>
          </details>
          <div className="datetime-controls">
            <div className="date-time-picker">
              <button 
                onClick={goToPreviousDay} 
                disabled={isLiveMode || availableDates.length === 0 || 
                  (selectedDate <= dataDateRange.start)}
              >
                &lt;
              </button>
              <span>{formatDisplayDate(selectedDate)}</span>
              <button 
                onClick={goToNextDay} 
                disabled={
                  (isLiveMode && availableDates.length === 0) ||
                  (!isLiveMode && selectedDate >= dataDateRange.end)
                }
              >
                &gt;
              </button>
              <button 
                onClick={goToLive}
                disabled={isLiveMode}
                className={isLiveMode ? 'active' : ''}
              >
                →
              </button>
            </div>
            <div className="datetime-input-container">
              <input 
                type="datetime-local"
                value={dateTimeInputValue}
                onChange={handleDateTimeChange}
                min={formatDateForInput(dataDateRange.start)}
                max={formatDateForInput(dataDateRange.end)}
                className="datetime-input"
                disabled={isLoading}
              />
              {isLiveMode && (
                <div className="live-indicator">LIVE MODE</div>
              )}
            </div>
          </div>
        </aside>
        <main className="main">
          <MyMap 
            selectedDate={isLiveMode ? new Date() : selectedDate}
            viewMode={viewMode}
            zoneViewEnabled={zoneViewEnabled}
            csvDataPath={CSV_DATA_PATH}
            isLiveMode={isLiveMode}
            {...mapDataWithDebug()}
          />
          {loadError && filteredData.length === 0 && (
            <div className="map-error-overlay">
              <div className="map-error-message">
                Unable to load map data
                <button onClick={() => window.location.reload()}>
                  Reload
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;