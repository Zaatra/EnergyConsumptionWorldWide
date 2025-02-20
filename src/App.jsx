import { useState, useEffect, useCallback, useRef } from "react";
import MyMap from "./MyMap.jsx";
import "./App.css";
import "./list.css";
import Header from "./header.jsx";

const createUniqueId = (prefix, item) => {
  return `${prefix}-${item.Country || ''}-${item['Zone Name'] || ''}-${item.date?.getTime() || Date.now()}`;
};

// Correctly reference the CSV file in the public directory
const CSV_DATA_PATH = '/electricity_data.csv';

// Debug logger - checks both development mode and a debug flag
const isDevMode = () => {
  return import.meta.env?.MODE === 'development' || 
         window.location.hostname === 'localhost' ||
         window.ENV_DEBUG === true;
};

const debugLog = (message, data) => {
  if (isDevMode()) {
    console.log(`[DEBUG] ${message}`, data);
  }
};

// Improved CSV date parser to handle different formats
const parseDateFromCSV = (dateTimeStr) => {
  if (!dateTimeStr) return null;
  
  try {
    // Handle DD/MM/YYYY HH:MM format (your sample data format)
    if (dateTimeStr.includes('/')) {
      const parts = dateTimeStr.split(' ');
      if (parts.length >= 2) {
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        
        if (dateParts.length === 3) {
          // Format as YYYY-MM-DDThh:mm:00
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
    
    // Default fallback parsing
    return new Date(dateTimeStr);
  } catch (error) {
    debugLog('Date parsing error', { input: dateTimeStr, error: error.message });
    return null;
  }
};

// Format date for datetime-local input
const formatDateForInput = (date) => {
  if (!date) return '';
  return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDThh:mm
};

function App() {
  // Define data range constants
  const DATA_START_DATE = new Date('2023-01-01T00:00:00');
  const DATA_END_DATE = new Date('2024-12-31T23:59:59');
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('72h');
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
  
  // Refs for debugging
  const debugRef = useRef({
    lastSelectedDate: null,
    lastFilteredDataCount: 0,
    dateChangeSource: 'init'
  });

  // Hardcoded sample data as fallback in case file loading fails
  const getSampleData = () => {
    const baseData = [
      { date: '20/02/2023 2:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 106.61, lcaIntensity: 147.72, lowCarbon: 78.12, renewable: 42.5 },
      { date: '20/02/2023 3:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 111.32, lcaIntensity: 154.12, lowCarbon: 76.95, renewable: 41.63 },
      { date: '20/02/2023 4:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 110.01, lcaIntensity: 152.65, lowCarbon: 77.39, renewable: 42.6 },
      { date: '20/02/2023 5:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 109.22, lcaIntensity: 152.81, lowCarbon: 77.24, renewable: 42.9 },
      { date: '20/02/2023 6:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 124.75, lcaIntensity: 171.31, lowCarbon: 74.71, renewable: 40.95 },
      { date: '20/02/2023 7:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 131.42, lcaIntensity: 178.34, lowCarbon: 74.21, renewable: 42.58 },
      { date: '20/02/2023 8:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 127.89, lcaIntensity: 174.9, lowCarbon: 74.6, renewable: 44.19 },
      { date: '20/02/2023 9:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 121.58, lcaIntensity: 168.94, lowCarbon: 74.76, renewable: 44.05 },
      { date: '20/02/2023 10:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 119.69, lcaIntensity: 167.02, lowCarbon: 75.26, renewable: 44.51 },
      { date: '20/02/2023 11:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 117.92, lcaIntensity: 165.61, lowCarbon: 75.19, renewable: 44.29 },
      { date: '20/02/2023 12:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 115.02, lcaIntensity: 162.49, lowCarbon: 76.24, renewable: 45.31 },
      { date: '20/02/2023 13:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 116.24, lcaIntensity: 163.9, lowCarbon: 75.8, renewable: 44.88 },
      { date: '20/02/2023 14:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 116.31, lcaIntensity: 163.7, lowCarbon: 75.74, renewable: 44.44 },
      { date: '20/02/2023 15:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 121.16, lcaIntensity: 168.98, lowCarbon: 75.22, renewable: 42.33 },
      { date: '20/02/2023 16:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 130.75, lcaIntensity: 179.12, lowCarbon: 73.69, renewable: 40.69 },
      { date: '20/02/2023 17:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 141.74, lcaIntensity: 189.66, lowCarbon: 72.57, renewable: 42.67 },
      { date: '20/02/2023 18:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 150.02, lcaIntensity: 199.69, lowCarbon: 71.01, renewable: 42.04 },
      { date: '20/02/2023 19:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 148.91, lcaIntensity: 200.37, lowCarbon: 70.16, renewable: 39.94 },
      { date: '20/02/2023 20:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 152.97, lcaIntensity: 205.44, lowCarbon: 69.74, renewable: 38.02 },
      { date: '20/02/2023 21:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 158.39, lcaIntensity: 211.82, lowCarbon: 69.18, renewable: 36.22 },
      { date: '20/02/2023 22:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 156.42, lcaIntensity: 210.86, lowCarbon: 69.05, renewable: 33.83 },
      { date: '20/02/2023 23:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 146.92, lcaIntensity: 200.06, lowCarbon: 70.66, renewable: 32.21 },
      { date: '21/02/2023 0:00', country: 'Belgium', zone: 'Belgium', zoneId: 'BE', directIntensity: 152.95, lcaIntensity: 206.47, lowCarbon: 69.91, renewable: 30.96 }
    ];
    
    return baseData.map(item => {
      const parsedDate = parseDateFromCSV(item.date);
      return {
        date: parsedDate,
        Country: item.country,
        'Zone Name': item.zone,
        'Zone Id': item.zoneId,
        'Carbon Intensity gCO₂eq/kWh (direct)': item.directIntensity.toString(),
        'Carbon Intensity gCO₂eq/kWh (LCA)': item.lcaIntensity.toString(),
        'Low Carbon Percentage': item.lowCarbon.toString(),
        'Renewable Percentage': item.renewable.toString(),
        Year: parsedDate.getFullYear().toString(),
        Month: (parsedDate.getMonth() + 1).toString(),
        Day: parsedDate.getDate().toString(),
        Hour: parsedDate.getHours().toString(),
        Weekday: '0',
        Season: 'Winter',
        Region: 'Europe',
        directIntensity: item.directIntensity,
        lcaIntensity: item.lcaIntensity,
        lowCarbonPercentage: item.lowCarbon,
        renewablePercentage: item.renewable
      };
    });
  };

  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        debugLog('Loading data from', CSV_DATA_PATH);
        
        // Try to load from file first
        let processed = [];
        let csvText = '';
        let usingSampleData = false;
        
        try {
          const response = await fetch(CSV_DATA_PATH);
          
          // Check the response status
          if (!response.ok) {
            throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`);
          }
          
          csvText = await response.text();
          
          // Verify this is actually CSV data
          if (csvText.trim().startsWith('<!doctype html>') || 
              csvText.trim().startsWith('<html')) {
            throw new Error('Received HTML instead of CSV data');
          }
          
          if (csvText.trim().length === 0) {
            throw new Error('CSV file is empty');
          }
          
          debugLog('CSV data loaded successfully, size', csvText.length);
          debugLog('First 100 chars:', csvText.substring(0, 100));
        } catch (loadError) {
          // If file loading fails, use sample data
          debugLog('CSV loading failed, using sample data', loadError);
          processed = getSampleData();
          usingSampleData = true;
          setLoadError(`Using sample data. Original error: ${loadError.message}`);
        }
        
        if (!usingSampleData) {
          // Process the loaded CSV data
          try {
            const lines = csvText.trim().split('\n');
            if (lines.length <= 1) {
              throw new Error('CSV file has insufficient data');
            }
            
            // Parse headers - trim and normalize
            const headers = lines[0].split(',').map(h => h.trim());
            debugLog('CSV headers:', headers);
            
            // Ensure required headers exist
            const requiredHeaders = [
              'Datetime (UTC)', 'Country', 'Zone Name', 
              'Carbon Intensity gCO₂eq/kWh (direct)', 
              'Carbon Intensity gCO₂eq/kWh (LCA)'
            ];
            
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
            if (missingHeaders.length > 0) {
              throw new Error(`CSV missing required headers: ${missingHeaders.join(', ')}`);
            }

            // For very large datasets, process in chunks to avoid call stack size exceeded
            // This uses a more efficient approach for large datasets
            const chunkSize = 10000; // Process 10,000 lines at a time
            const totalChunks = Math.ceil((lines.length - 1) / chunkSize);
            processed = [];
            const uniqueDates = new Set();
            let earliestDate = new Date('9999-12-31');
            let latestDate = new Date('1970-01-01');
            
            debugLog('Processing large dataset in chunks', {
              totalRows: lines.length - 1,
              chunkSize,
              totalChunks
            });
            
            // Process chunks iteratively to avoid recursion stack issues
            for (let chunk = 0; chunk < totalChunks; chunk++) {
              const startIdx = chunk * chunkSize + 1; // +1 to skip header
              const endIdx = Math.min(startIdx + chunkSize, lines.length);
              
              // Process this chunk
              for (let i = startIdx; i < endIdx; i++) {
                if (!lines[i].trim()) continue;
                
                const values = lines[i].split(',');
                if (values.length !== headers.length) {
                  // Skip malformed rows
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
                
                // Track date range
                if (date < earliestDate) earliestDate = new Date(date);
                if (date > latestDate) latestDate = new Date(date);
                
                // Track unique dates by day only (for performance)
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
              
              // Optional: yield to browser to prevent UI freeze during processing
              if (chunk % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            }
            
            debugLog('Processed data items from CSV', processed.length);
            
            if (processed.length === 0) {
              throw new Error('No valid data rows found in CSV');
            }
            
            // Convert unique dates set to sorted array
            const sortedDates = Array.from(uniqueDates)
              .sort()
              .map(dateStr => new Date(dateStr));
            
            setAvailableDates(sortedDates);
            debugLog('Available unique dates', sortedDates.length);
            
            // Set date range based on actual data
            const dateRange = {
              start: earliestDate,
              end: latestDate
            };
            
            setDataDateRange(dateRange);
            debugLog('Data date range', {
              start: dateRange.start.toISOString(),
              end: dateRange.end.toISOString(),
              totalDays: Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24))
            });
            
            setHistoricalData(processed);
            setFilteredData(processed);
            
          } catch (processingError) {
            debugLog('Error processing CSV data', processingError);
            // Fall back to sample data if processing fails
            processed = getSampleData();
            setLoadError(`Error processing CSV: ${processingError.message}`);
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load data:", error);
        debugLog('Error loading data', error);
        
        // Always fall back to sample data on any error
        const sampleData = getSampleData();
        setHistoricalData(sampleData);
        setFilteredData(sampleData);
        
        // Set date range based on sample data
        const sampleDates = sampleData.map(item => item.date);
        const earliestSample = new Date(Math.min(...sampleDates));
        const latestSample = new Date(Math.max(...sampleDates));
        
        setDataDateRange({
          start: earliestSample,
          end: latestSample
        });
        
        // Get unique dates from sample data
        const sampleDateSet = new Set(sampleData.map(item => 
          item.date.toISOString().split('T')[0]
        ));
        
        const sortedSampleDates = Array.from(sampleDateSet)
          .sort()
          .map(dateStr => new Date(dateStr));
          
        setAvailableDates(sortedSampleDates);
        
        setLoadError(`Error: ${error.message}`);
        setIsLoading(false);
      }
    };
    
    loadHistoricalData();
  }, []);

  // Update datetime input when selected date changes
  useEffect(() => {
    if (!isLiveMode) {
      setDateTimeInputValue(formatDateForInput(selectedDate));
    } else {
      setDateTimeInputValue(formatDateForInput(new Date()));
    }
    
    debugRef.current.lastSelectedDate = selectedDate;
    debugLog('Selected date updated', {
      date: selectedDate?.toISOString(),
      source: debugRef.current.dateChangeSource,
      isLiveMode
    });
  }, [selectedDate, isLiveMode]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredData(historicalData);
      debugRef.current.lastFilteredDataCount = historicalData.length;
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = historicalData.filter(item => 
      (item.Country || '').toLowerCase().includes(query) ||
      (item['Zone Name'] || '').toLowerCase().includes(query) ||
      (item.Region || '').toLowerCase().includes(query)
    );
    
    setFilteredData(filtered);
    debugRef.current.lastFilteredDataCount = filtered.length;
    debugLog('Search filtered data', {
      query,
      resultCount: filtered.length
    });
  }, [searchQuery, historicalData]);

  // Find closest date in dataset to target date
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
    debugLog('Found closest date', {
      target: targetDate.toISOString(),
      closest: closestDate.toISOString(),
      diffMinutes: diffInMinutes
    });
    
    return {
      date: closestDate,
      diffMinutes
    };
  }, [availableDates]);

  // Modified to work with our specific date range
  const handleTimeRangeSelect = useCallback((range) => {
    debugRef.current.dateChangeSource = 'timeRangeSelect';
    setSelectedTimeRange(range);
    
    if (range === 'live') {
      setIsLiveMode(true);
      setSelectedDate(new Date());
      return;
    }
    
    // Continue with existing logic for other ranges
    setIsLiveMode(false);
    const now = new Date();
    let startDate;
    
    switch(range) {
      case '72h':
        startDate = new Date(now);
        startDate.setHours(now.getHours() - 72);
        break;
      case '3mo':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '12mo':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'All':
        // No filtering needed
        break;
      default:
        startDate = new Date(now);
        startDate.setHours(now.getHours() - 72);
        break;
    }
    
    if (range !== 'All' && startDate) {
      const filtered = historicalData.filter(item => item.date >= startDate);
      setFilteredData(filtered);
      debugLog('Time range filtered data', {
        range,
        startDate: startDate?.toISOString(),
        resultCount: filtered.length
      });
    } else {
      setFilteredData(historicalData);
      debugLog('Time range reset to all data', {
        totalCount: historicalData.length
      });
    }
  }, [historicalData]);

  const goToPreviousDay = useCallback(() => {
    debugRef.current.dateChangeSource = 'previousDay';
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
      
      debugLog('Going to previous day', {
        from: selectedDate.toISOString(),
        to: newDate.toISOString(),
        indexChange: `${currentIndex} → ${currentIndex - 1}`
      });
    }
  }, [selectedDate, availableDates]);

  const goToNextDay = useCallback(() => {
    debugRef.current.dateChangeSource = 'nextDay';
    
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
      
      debugLog('Going to next day', {
        from: selectedDate.toISOString(),
        to: newDate.toISOString(),
        indexChange: `${currentIndex} → ${currentIndex + 1}`
      });
    } else if (new Date() > availableDates[availableDates.length - 1]) {
      // If we're at the end of available dates and current time is after the last date
      goToLive();
    }
  }, [selectedDate, availableDates]);

  const goToLive = useCallback(() => {
    debugRef.current.dateChangeSource = 'goLive';
    setIsLiveMode(true);
    setSelectedDate(new Date());
    setClosestAvailableDate(null);
    
    debugLog('Going to live mode', {
      currentTime: new Date().toISOString()
    });
  }, []);

  // Handle date-time input change
  const handleDateTimeChange = useCallback((e) => {
    const inputValue = e.target.value;
    setDateTimeInputValue(inputValue);
    
    if (!inputValue) return;
    
    const newDate = new Date(inputValue + ':00Z'); // Add seconds and UTC
    
    if (isNaN(newDate.getTime())) {
      debugLog('Invalid date input', inputValue);
      return;
    }
    
    debugRef.current.dateChangeSource = 'dateTimeInput';
    
    // Check if date is in valid range
    if (newDate < dataDateRange.start) {
      debugLog('Date before range start', {
        input: newDate.toISOString(),
        rangeStart: dataDateRange.start.toISOString()
      });
      return;
    }
    
    if (newDate > dataDateRange.end) {
      debugLog('Date after range end', {
        input: newDate.toISOString(),
        rangeEnd: dataDateRange.end.toISOString()
      });
      // If after data range but before current time, use the date
      if (newDate <= new Date()) {
        setIsLiveMode(false);
        setSelectedDate(newDate);
      } else {
        goToLive();
      }
      return;
    }
    
    // Find closest date in dataset
    const closest = findClosestDate(newDate);
    setClosestAvailableDate(closest);
    
    setIsLiveMode(false);
    if (closest) {
      setSelectedDate(closest.date);
    } else {
      setSelectedDate(newDate);
    }
  }, [dataDateRange, findClosestDate, goToLive]);

  const handleProductionMode = useCallback(() => {
    setViewMode('production');
    debugLog('View mode changed', 'production');
  }, []);

  const handleConsumptionMode = useCallback(() => {
    setViewMode('consumption');
    debugLog('View mode changed', 'consumption');
  }, []);

  const handleCountryView = useCallback(() => {
    setZoneViewEnabled(false);
    debugLog('View changed', 'country');
  }, []);

  const handleZoneView = useCallback(() => {
    setZoneViewEnabled(true);
    debugLog('View changed', 'zone');
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

  const handleFitBounds = useCallback(() => {
    if (window.mapControls?.fitBounds) {
      window.mapControls.fitBounds();
    }
  }, []);

  const handleResetOrientation = useCallback(() => {
    if (window.mapControls?.resetOrientation) {
      window.mapControls.resetOrientation();
    }
  }, []);

  const handle3DMode = useCallback(() => {
    if (window.mapControls?.toggle3DMode) {
      window.mapControls.toggle3DMode();
    }
  }, []);

  const handleDayNightToggle = useCallback(() => {
    if (window.mapControls?.toggleDayNight) {
      window.mapControls.toggleDayNight();
    }
  }, []);

  const handleGridToggle = useCallback(() => {
    if (window.mapControls?.toggleGrid) {
      window.mapControls.toggleGrid();
    }
  }, []);

  const handleLabelsToggle = useCallback(() => {
    if (window.mapControls?.toggleLabels) {
      window.mapControls.toggleLabels();
    }
  }, []);

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

    const countryToFlagMap = {
      'Belgium': '🇧🇪',
      'France': '🇫🇷',
      'Germany': '🇩🇪',
      'United Kingdom': '🇬🇧',
      'Netherlands': '🇳🇱',
      'Spain': '🇪🇸',
      'Italy': '🇮🇹',
      'Switzerland': '🇨🇭',
      'Austria': '🇦🇹',
      'Sweden': '🇸🇪',
      'Poland': '🇵🇱',
      'Kenya': '🇰🇪'
    };

    return (
      <ul>
        {sortedData.slice(0, 20).map((item, idx) => {
          const flag = countryToFlagMap[item.Country] || '🏳️';
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

  // Map data debugging and processing function
  const mapDataWithDebug = () => {
    // For debugging map data
    const debug = isDevMode();
    
    if (debug) {
      // Look for Belgium data on the selected date for debugging
      let belgiumData = null;
      
      if (selectedDate && !isLiveMode) {
        const dateStr = selectedDate.toISOString().slice(0, 10);
        const matchingData = filteredData.filter(item => 
          item.Country === 'Belgium' && 
          item.date.toISOString().slice(0, 10) === dateStr
        );
        
        if (matchingData.length > 0) {
          belgiumData = matchingData[0];
          debugLog('Belgium data found for selected date', {
            date: dateStr,
            directIntensity: belgiumData.directIntensity,
            lcaIntensity: belgiumData.lcaIntensity
          });
        } else {
          debugLog('No Belgium data found for selected date', dateStr);
        }
      }
    }
    
    // Return filtered and processed data with the props
    return {
      mapData: filteredData,
      dataFound: filteredData.length > 0,
      currentDate: selectedDate,
      countryData: filteredData.reduce((acc, item) => {
        // Create lookup object for faster country data access
        if (!acc[item.Country]) {
          acc[item.Country] = {};
        }
        
        // Format date as a string key
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
            <div className="timeline-buttons">
              <button 
                className={`timeline-button ${selectedTimeRange === '72h' ? 'active' : ''}`}
                onClick={() => handleTimeRangeSelect('72h')}
              >
                72h
              </button>
              <button 
                className={`timeline-button ${selectedTimeRange === '3mo' ? 'active' : ''}`}
                onClick={() => handleTimeRangeSelect('3mo')}
              >
                3mo
              </button>
              <button 
                className={`timeline-button ${selectedTimeRange === '12mo' ? 'active' : ''}`}
                onClick={() => handleTimeRangeSelect('12mo')}
              >
                12mo
              </button>
              <button 
                className={`timeline-button ${selectedTimeRange === 'All' ? 'active' : ''}`}
                onClick={() => handleTimeRangeSelect('All')}
              >
                All
              </button>
            </div>
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
            
            {isDevMode() && (
              <div className="debug-panel">
                <details>
                  <summary>Debug Info</summary>
                  <div>
                    <p>Data range: {dataDateRange.start.toLocaleDateString()} - {dataDateRange.end.toLocaleDateString()}</p>
                    <p>Selected date: {selectedDate.toISOString()}</p>
                    <p>Mode: {isLiveMode ? 'LIVE' : 'Historical'}</p>
                    <p>Data points: {historicalData.length}</p>
                    <p>Filtered: {filteredData.length}</p>
                    <p>Unique dates: {availableDates.length}</p>
                    <p>CSV Path: {CSV_DATA_PATH}</p>
                    {closestAvailableDate && (
                      <p>Closest data: {closestAvailableDate.date.toISOString()} (diff: {closestAvailableDate.diffMinutes}min)</p>
                    )}
                    {loadError && (
                      <p className="error">Error: {loadError}</p>
                    )}
                  </div>
                </details>
              </div>
            )}
          </div>
        </aside>
        <main className="main">
  <MyMap 
    selectedDate={isLiveMode ? new Date() : selectedDate}
    selectedTimeRange={selectedTimeRange}
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

        <aside className="right-sidebar">
          <div className="zoom-controls">
          </div>
          <div className="other-controls">
            <button className="control-button" onClick={handleFitBounds}>
              <i className="fas fa-expand"></i>
              <span className="control-tooltip">Fit Bounds</span>
            </button>
            <button className="control-button" onClick={handleResetOrientation}>
              <i className="fas fa-compass"></i>
              <span className="control-tooltip">Reset Orientation</span>
            </button>
            <button className="control-button" onClick={handle3DMode}>
              <i className="fas fa-cube"></i>
              <span className="control-tooltip">3D Mode</span>
            </button>
            <button className="control-button" onClick={handleDayNightToggle}>
              <i className="fas fa-moon"></i>
              <span className="control-tooltip">Day/Night</span>
            </button>
            <button className="control-button" onClick={handleGridToggle}>
              <i className="fas fa-th"></i>
              <span className="control-tooltip">Grid</span>
            </button>
            <button className="control-button" onClick={handleLabelsToggle}>
              <i className="fas fa-font"></i>
              <span className="control-tooltip">Labels</span>
            </button>
          </div>
        </aside>
      </div>
      <style jsx>{`
        .data-error-notice {
          margin-top: 8px;
          padding: 8px;
          background-color: rgba(255, 200, 200, 0.2);
          border-left: 3px solid #ff5555;
          color: #d44;
          font-size: 14px;
        }
        
        .datetime-input-container {
          margin-top: 10px;
          position: relative;
        }
        
        .datetime-input {
          width: 100%;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #ccc;
        }
        
        .live-indicator {
          position: absolute;
          right: 10px;
          top: 10px;
          background: rgba(255, 0, 0, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          pointer-events: none;
        }
        
        .debug-panel {
          margin-top: 15px;
          font-size: 12px;
          background: #f5f5f5;
          padding: 8px;
          border-radius: 4px;
        }
        
        .debug-panel details summary {
          cursor: pointer;
          font-weight: bold;
        }
        
        .debug-panel .error {
          color: #d44;
        }
        
        .note {
          font-style: italic;
          color: #666;
          font-size: 12px;
        }

        .map-error-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .map-error-message {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .map-error-message button {
          padding: 8px 16px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .no-data-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255, 255, 255, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 900;
        }
        
        .no-data-message {
          background-color: white;
          padding: 12px 20px;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

export default App;