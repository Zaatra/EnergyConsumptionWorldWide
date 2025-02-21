import { useState, useEffect, useCallback } from "react";
import MyMap from "./MyMap.jsx";
import "./App.css";
import "./list.css";
import Header from "./header.jsx";
import { useElectricityData } from './fetchAndSaveData';

// Helper function to create a unique ID
const createUniqueId = (prefix, item) => {
  let dateVal;
  if (item.date && typeof item.date.getTime === "function") {
    dateVal = item.date.getTime();
  } else {
    dateVal = Date.now();
  }
  return `${prefix}-${item.Country || ""}-${item["Zone Name"] || ""}-${dateVal}`;
};

const CSV_DATA_PATH = import.meta.env.VITE_CSV_DATA_PATH;

// Parse date in slash format (e.g., "01/01/2023 12:00")
const parseSlashFormat = (dateTimeStr) => {
  const parts = dateTimeStr.split(" ");
  if (parts.length < 2) return null;

  const dateParts = parts[0].split("/");
  if (dateParts.length !== 3) return null;

  const timeParts = parts[1].split(":");
  const day = dateParts[0].padStart(2, "0");
  const month = dateParts[1].padStart(2, "0");
  const year = dateParts[2];
  const hour = timeParts[0].padStart(2, "0");
  let minute = "00";
  if (timeParts[1]) {
    minute = timeParts[1].padStart(2, "0");
  }

  return `${year}-${month}-${day}T${hour}:${minute}:00`;
};

// Parse date from CSV string
const parseDateFromCSV = (dateTimeStr) => {
  if (!dateTimeStr) return null;
  try {
    if (dateTimeStr.includes("/")) {
      const formattedDate = parseSlashFormat(dateTimeStr);
      if (formattedDate) {
        return new Date(formattedDate);
      } else {
        return new Date(dateTimeStr);
      }
    } else {
      return new Date(dateTimeStr);
    }
  } catch (error) {
    console.info("Failed to parse date:", error);
    return null;
  }
};

// Format date for datetime-local input using local time,
// preserving the hour and minute components.
const formatDateForComparison = (dateInput) => {
  try {
    if (!dateInput) return null;
    let date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return null;
  }
};

// Parse a single CSV line into a row object
const parseCSVLine = (line, headers) => {
  const trimmedLine = line.trim();
  if (!trimmedLine) return null;

  const values = trimmedLine
    .split(",")
    .map((val) => val.trim().replace(/(?:^")|(?:"$)/g, ""));

  if (values.length !== headers.length) return null;

  const row = {};
  headers.forEach((header, index) => {
    row[header] = values[index];
  });

  const date = parseDateFromCSV(row["Datetime (UTC)"]);
  if (!date || isNaN(date.getTime())) return null;

  // Convert percentages with proper error handling
  const lowCarbon = parseFloat(row["Low Carbon Percentage"]);
  const renewable = parseFloat(row["Renewable Percentage"]);

  return {
    ...row,
    date,
    directIntensity: parseFloat(row["Carbon Intensity gCO₂eq/kWh (direct)"]) || 0,
    lcaIntensity: parseFloat(row["Carbon Intensity gCO₂eq/kWh (LCA)"]) || 0,
    lowCarbonPercentage: !isNaN(lowCarbon) ? Number(lowCarbon.toFixed(2)) : 0,
    renewablePercentage: !isNaN(renewable) ? Number(renewable.toFixed(2)) : 0
  };
};

// Custom hook to load historical data
const useHistoricalData = () => {
  const [historicalData, setHistoricalData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [dataDateRange, setDataDateRange] = useState({
    start: new Date("2023-01-01T00:00:00"),
    end: new Date("2024-12-31T23:59:59"),
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(CSV_DATA_PATH);
        if (!response.ok) {
          throw new Error(
            `Failed to load CSV: ${response.status} ${response.statusText}`
          );
        }
        const csvText = await response.text();
        const trimmedText = csvText.trim();
        if (
          trimmedText.startsWith("<!doctype html>") ||
          trimmedText.startsWith("<html")
        ) {
          throw new Error("Received HTML instead of CSV data");
        }
        if (trimmedText.length === 0) {
          throw new Error("CSV file is empty");
        }

        const lines = trimmedText.split("\n");
        if (lines.length <= 1) {
          throw new Error("CSV file has insufficient data");
        }
        const headerLine = lines[0].replace(/^\uFEFF/, "");
        const headers = headerLine.split(",").map((h) => h.trim());

        const requiredHeaders = [
          "Datetime (UTC)",
          "Country",
          "Zone Name",
          "Carbon Intensity gCO₂eq/kWh (direct)",
          "Low Carbon Percentage",
          "Renewable Percentage",
          "Carbon Intensity gCO₂eq/kWh (LCA)",
        ];
        const missingHeaders = requiredHeaders.filter(
          (h) => !headers.includes(h)
        );
        if (missingHeaders.length > 0) {
          throw new Error(
            `CSV missing required headers: ${missingHeaders.join(", ")}`
          );
        }

        const processed = [];
        const uniqueDates = new Set();
        let earliest = new Date("9999-12-31");
        let latest = new Date("1970-01-01");

        for (const line of lines.slice(1)) {
          const row = parseCSVLine(line, headers);
          if (row) {
            processed.push(row);
            const dateStr = formatDateForComparison(row.date);
            uniqueDates.add(dateStr);
            if (row.date < earliest) earliest = row.date;
            if (row.date > latest) latest = row.date;
          }
        }

        if (processed.length === 0) {
          throw new Error("No valid data rows found in CSV");
        }

        const sortedDates = Array.from(uniqueDates)
          .sort()
          .map((dateStr) => new Date(dateStr));
        setAvailableDates(sortedDates);
        setDataDateRange({ start: earliest, end: latest });
        setHistoricalData(processed);
      } catch (err) {
        console.info("Failed to load data:", err);
        setLoadError(`Error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return { historicalData, isLoading, loadError, availableDates, dataDateRange };
};

function App() {
  const { data: liveData, error: liveError, isLoading: liveLoading } = useElectricityData();
  
  const {
    historicalData,
    isLoading,
    loadError,
    availableDates,
    dataDateRange,
  } = useHistoricalData();

  // State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [viewMode, setViewMode] = useState("production");
  const [zoneViewEnabled] = useState(false);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateTimeInputValue, setDateTimeInputValue] = useState("");
  const [closestAvailableDate, setClosestAvailableDate] = useState(null);

  // For table sorting
  const [sortField, setSortField] = useState(null); // 'production' or 'consumption'
  const [sortDirection, setSortDirection] = useState("desc"); // 'desc' or 'asc'

  // Filtering logic
// In your App.jsx, update the useEffect for filtering data:

useEffect(() => {
  let filtered = historicalData;
  
  // If live mode is active and live data is available, inject it.
  if (isLiveMode && liveData) {
    const liveDataFormatted = {
      'Datetime (UTC)': liveData.datetime,
      Country: 'Israel',
      'Zone Name': 'Israel',
      'Zone Id': liveData.zone,
      'Carbon Intensity gCO₂eq/kWh (direct)': Number(liveData.powerData.powerProductionBreakdown.coal || 0),
      'Carbon Intensity gCO₂eq/kWh (LCA)': Number(liveData.powerData.powerConsumptionBreakdown.coal || 0),
      'Low Carbon Percentage': Number(liveData.powerData.fossilFreePercentage || 0),
      'Renewable Percentage': Number(liveData.powerData.renewablePercentage || 0),
      date: new Date(liveData.datetime)
    };
    filtered = [liveDataFormatted, ...filtered];
  }
  
  // Additional filtering based on search query or selected date, etc.
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.Country?.toLowerCase().includes(q) ||
        item["Zone Name"]?.toLowerCase().includes(q) ||
        item.Region?.toLowerCase().includes(q)
    );
  }
  
  if (!isLiveMode && selectedDate) {
    filtered = filtered.filter(item => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      const targetDate = new Date(selectedDate);
      return itemDate.toDateString() === targetDate.toDateString();
    });
  }
  
  setFilteredData(filtered);
}, [searchQuery, historicalData, selectedDate, isLiveMode, liveData]);


  // Date/time input logic
  useEffect(() => {
    if (!isLiveMode) {
      setDateTimeInputValue(formatDateForComparison(selectedDate));
    } else {
      setDateTimeInputValue(formatDateForComparison(new Date()));
    }
  }, [selectedDate, isLiveMode]);

  const findClosestDate = useCallback(
    (targetDate) => {
      if (!availableDates || availableDates.length === 0) {
        return null;
      }
      let closestDate = availableDates[0];
      let smallestDiff = Math.abs(
        availableDates[0].getTime() - targetDate.getTime()
      );
      
      for (const date of availableDates) {
        const diff = Math.abs(date.getTime() - targetDate.getTime());
        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestDate = date;
        }
      }
      
      setSelectedDate(closestDate);
      
      const diffInMinutes = Math.floor(smallestDiff / (1000 * 60));
      return { date: closestDate, diffMinutes: diffInMinutes };
    },
    [availableDates]
  );

  // Time nav
  const goToPreviousDay = useCallback(() => {
    setIsLiveMode(false);
    if (availableDates.length === 0) return;
    const currentDateStr = formatDateForComparison(selectedDate);
    const currentIndex = availableDates.findIndex(
      (d) => formatDateForComparison(d) === currentDateStr
    );
    if (currentIndex > 0) {
      const newDate = availableDates[currentIndex - 1];
      setSelectedDate(newDate);
      setClosestAvailableDate({ date: newDate, diffMinutes: 0 });
    }
  }, [selectedDate, availableDates]);

  const goToLive = useCallback(() => {
    setIsLiveMode(true);
    if (liveData && liveData.datetime) {
      // Use the live record's datetime so that it passes the date filter in MyMap.
      setSelectedDate(new Date(liveData.datetime));
    } else {
      setSelectedDate(new Date());
    }
    setClosestAvailableDate(null);
  }, [liveData]);
  

  const goToNextDay = useCallback(() => {
    if (availableDates.length === 0) return;
    const currentDateStr = formatDateForComparison(selectedDate);
    const currentIndex = availableDates.findIndex(
      (d) => formatDateForComparison(d) === currentDateStr
    );
    if (currentIndex < availableDates.length - 1) {
      const newDate = availableDates[currentIndex + 1];
      setSelectedDate(newDate);
      setIsLiveMode(false);
      setClosestAvailableDate({ date: newDate, diffMinutes: 0 });
    } else if (new Date() > availableDates[availableDates.length - 1]) {
      goToLive();
    } else {
      setSelectedDate(availableDates[availableDates.length - 1]);
      setIsLiveMode(false);
    }
  }, [selectedDate, availableDates, goToLive]);

  // Date/time picker
  const handleDateTimeChange = useCallback(
    (e) => {
      const inputValue = e.target.value;
      setDateTimeInputValue(inputValue);
      if (!inputValue) return;

      const [datePart, timePart] = inputValue.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute] = timePart.split(":").map(Number);

      const newDate = new Date(year, month - 1, day, hour, minute);
      if (isNaN(newDate.getTime())) return;

      setSelectedDate(newDate);
      setIsLiveMode(false);

      const closest = findClosestDate(newDate);
      if (closest) {
        setClosestAvailableDate({
          date: closest.date,
          diffMinutes: closest.diffMinutes,
        });
      } else {
        setClosestAvailableDate(null);
      }
    },
    [findClosestDate]
  );

  // Mode toggles
  const handleProductionMode = useCallback(() => {
    setViewMode("production");
  }, []);
  const handleConsumptionMode = useCallback(() => {
    setViewMode("consumption");
  }, []);

  // Sorting logic
  const handleSortClick = useCallback(
    (field) => {
      if (sortField === field) {
        setSortDirection(sortDirection === "desc" ? "asc" : "desc");
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField, sortDirection]
  );

  // Format display date
  const formatDisplayDate = useCallback(
    (date) => {
      if (isLiveMode) return "LIVE";
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    },
    [isLiveMode]
  );

  // Renders a table with sortable columns for Production & Consumption
  const renderRankedList = () => {
    if (isLoading || (isLiveMode && liveLoading)) {
      return <div className="loading-indicator">Loading data...</div>;
    }
  
    // De-duplicate by (Country, Zone Name)
    const uniqueEntries = new Map();
    filteredData.forEach((item) => {
      const key = `${item.Country}-${item["Zone Name"]}`;
      if (!uniqueEntries.has(key)) {
        uniqueEntries.set(key, {
          ...item,
          // Ensure numbers are properly formatted
          directIntensity: Number(item.directIntensity || 0),
          lcaIntensity: Number(item.lcaIntensity || 0),
          lowCarbonPercentage: Number(item.lowCarbonPercentage || 0),
          renewablePercentage: Number(item.renewablePercentage || 0)
        });
      }
    });
  
    let sortedData = [...uniqueEntries.values()];
  
    // Sort by chosen field
    if (sortField === "production") {
      sortedData.sort((a, b) => b.directIntensity - a.directIntensity);
    } else if (sortField === "consumption") {
      sortedData.sort((a, b) => b.lcaIntensity - a.lcaIntensity);
    } else {
      sortedData.sort((a, b) => b.directIntensity - a.directIntensity);
    }
  
    // Reverse if ascending
    if (sortDirection === "asc") {
      sortedData.reverse();
    }
  
    return (
      <div className="ranked-list">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Country / Zone</th>
              <th onClick={() => handleSortClick("production")}>
                Production
                {sortField === "production" && ` (${sortDirection})`}
              </th>
              <th onClick={() => handleSortClick("consumption")}>
                Consumption
                {sortField === "consumption" && ` (${sortDirection})`}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.slice(0, 20).map((item, idx) => {
              const uniqueId = createUniqueId("location", item);
              let zoneLabel = item.Country;
              if (item["Zone Name"] && item["Zone Name"] !== item.Country) {
                zoneLabel += ` – ${item["Zone Name"]}`;
              }
  
              return (
                <tr key={uniqueId}>
                  <td>{idx + 1}</td>
                  <td>{zoneLabel}</td>
                  <td>
                    <span className="intensity">
                      {Number(item.directIntensity).toFixed(1)}
                    </span>
                  </td>
                  <td>
                    <span className="intensity">
                      {Number(item.lcaIntensity).toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };
  

  // Provide map data
  const mapDataWithDebug = () => {
    return {
      mapData: filteredData,
      dataFound: filteredData.length > 0,
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
      }, {}),
    };
  };

  // Display labels
  let intensityLabel =
    viewMode === "production" ? " (direct)" : " (lifecycle assessment)";
  let granularityLabel = zoneViewEnabled ? "zone-level" : "country-level";

  let mapSelectedDate = isLiveMode ? new Date() : selectedDate;

  // Possibly show "LIVE MODE"
  let liveIndicator = null;
  if (isLiveMode) {
    liveIndicator = <div className="live-indicator">LIVE MODE</div>;
  }

  // Error displays
  let errorOverlay = null;
  if ((loadError || (isLiveMode && liveError)) && filteredData.length === 0) {
    errorOverlay = (
      <div className="map-error-overlay">
        <div className="map-error-message">
          Unable to load map data{" "}
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }

  let errorNotice = loadError ? (
    <div className="data-error-notice">{loadError}</div>
  ) : null;

  let liveDataError = isLiveMode && liveError ? (
    <div className="data-error-notice">
      Error fetching live data: {liveError}
    </div>
  ) : null;

  let debugInfo = null;
  if (closestAvailableDate && closestAvailableDate.diffMinutes > 0) {
    debugInfo = (
      <div className="debug-info">
        <p className="note">
          Note: Selected time is {closestAvailableDate.diffMinutes} minutes from
          nearest data point
        </p>
      </div>
    );
  }

  const isPrevDisabled =
    isLiveMode || availableDates.length === 0 || selectedDate <= dataDateRange.start;
  const isNextDisabled =
    (isLiveMode && availableDates.length === 0) ||
    (!isLiveMode && selectedDate >= dataDateRange.end);
  const isLiveButtonDisabled = isLiveMode;

  return (
    <div className="App electricity-maps-app">
      <Header
        onProductionClick={handleProductionMode}
        onConsumptionClick={handleConsumptionMode}
        viewMode={viewMode}
      />
      <div className="app-body">
        <aside className="left-sidebar">
          <div className="sidebar-header">
            <h1>Electricity Grid Carbon Emissions</h1>
            <p>
              See where your electricity comes from and how much CO₂ was emitted to
              produce it
            </p>
            {errorNotice}
            {liveDataError}
          </div>

          <div className="search-bar">
            <input
              type="text"
              placeholder="Search areas (ranked by carbon intensity)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {renderRankedList()}

          <details className="about-section">
            <summary>About Electricity Consumption Map</summary>
            <div className="about-content">
              <p>
                Electricity Consumption Map is a platform providing real-time and
                predictive electricity signals allowing any device to reduce their cost
                and emissions by informing them about the best time to consume
                electricity.
              </p>
              <p>
                The data displayed shows carbon intensity metrics{intensityLabel} for
                various countries and zones, with {granularityLabel} granularity.
              </p>
              <p>
                Low carbon percentage includes nuclear, while renewable percentage only
                includes wind, solar, hydro, and other renewable sources.
              </p>
              {debugInfo}
            </div>
          </details>

          <div className="datetime-controls">
            <div className="date-time-picker">
              <button onClick={goToPreviousDay} disabled={isPrevDisabled}>
                &lt;
              </button>
              <span>{formatDisplayDate(selectedDate)}</span>
              <button onClick={goToNextDay} disabled={isNextDisabled}>
                &gt;
              </button>
              <button
                onClick={goToLive}
                disabled={isLiveButtonDisabled}
                className={`${isLiveMode && "active"}`}
              >
                →
              </button>
            </div>
            <div className="datetime-input-container">
              <input
                type="datetime-local"
                value={dateTimeInputValue}
                onChange={handleDateTimeChange}
                min={formatDateForComparison(dataDateRange.start)}
                max={formatDateForComparison(dataDateRange.end)}
                className="datetime-input"
                disabled={isLoading || (isLiveMode && liveLoading)}
              />
              {liveIndicator}
            </div>
          </div>
        </aside>

        <main className="main">
          <MyMap
            selectedDate={mapSelectedDate}
            viewMode={viewMode}
            zoneViewEnabled={zoneViewEnabled}
            csvDataPath={CSV_DATA_PATH}
            isLiveMode={isLiveMode}
            {...mapDataWithDebug()}
          />
          {errorOverlay}
        </main>
      </div>
    </div>
  );
}

export default App;