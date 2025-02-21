// src/hooks/useElectricityData.js
import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export const useElectricityData = () => {
  const [data, setData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/electricity-data`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const result = await response.json();
      
      // Set latest data
      setData({
        carbonIntensity: result.latest.carbonIntensity,
        datetime: result.latest.power.datetime,
        updatedAt: result.latest.power.updatedAt,
        zone: 'IL',
        powerData: result.latest.power
      });

      // Process historical data
      const processedHistoricalData = result.history.map(entry => ({
        date: new Date(entry.datetime),
        'Datetime (UTC)': entry.datetime,
        'Country': 'Israel',
        'Zone Name': 'Israel',
        'Zone Id': 'IL',
        'Carbon Intensity gCO₂eq/kWh (direct)': entry.powerData?.production?.coal || 0,
        'Carbon Intensity gCO₂eq/kWh (LCA)': entry.powerData?.consumption?.coal || 0,
        'Low Carbon Percentage': entry.percentages?.fossilFree || 0,
        'Renewable Percentage': entry.percentages?.renewable || 0,
        directIntensity: entry.powerData?.production?.coal || 0,
        lcaIntensity: entry.powerData?.consumption?.coal || 0,
        powerBreakdown: entry.powerData
      }));

      setHistoricalData(processedHistoricalData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  return {
    data,
    historicalData,
    error,
    isLoading,
    refetch: fetchData
  };
};

export default useElectricityData;