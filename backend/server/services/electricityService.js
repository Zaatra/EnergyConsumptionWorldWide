import axios from 'axios';
import { promises as fs } from 'fs';
import { config } from '../config.js';

export class ElectricityService {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      headers: { 'auth-token': config.apiToken }
    });
  }

  async fetchAllData() {
    try {
      const [
        currentPowerBreakdown,
        powerBreakdownHistory,
        carbonIntensityHistory,
        carbonIntensityLatest
      ] = await Promise.all([
        this.axiosInstance.get('/power-breakdown/latest?zone=IL'),
        this.axiosInstance.get('/power-breakdown/history?zone=IL'),
        this.axiosInstance.get('/carbon-intensity/history?zone=IL'),
        this.axiosInstance.get('/carbon-intensity/latest?zone=IL')
      ]);

      return this.combineData(
        currentPowerBreakdown.data,
        powerBreakdownHistory.data,
        carbonIntensityHistory.data,
        carbonIntensityLatest.data
      );
    } catch (error) {
      console.info('Error fetching data:', error);
      throw error;
    }
  }

  combineData(current, powerHistory, carbonHistory, carbonLatest) {
    const combinedDataMap = new Map();

    // Add power breakdown history
    powerHistory.history.forEach(entry => {
      combinedDataMap.set(entry.datetime, {
        datetime: entry.datetime,
        updatedAt: entry.updatedAt,
        createdAt: entry.createdAt,
        powerData: {
          consumption: entry.powerConsumptionBreakdown,
          production: entry.powerProductionBreakdown,
          imports: entry.powerImportBreakdown,
          exports: entry.powerExportBreakdown,
          totals: {
            consumption: entry.powerConsumptionTotal,
            production: entry.powerProductionTotal,
            imports: entry.powerImportTotal,
            exports: entry.powerExportTotal
          }
        },
        percentages: {
          fossilFree: entry.fossilFreePercentage,
          renewable: entry.renewablePercentage
        }
      });
    });

    // Add carbon intensity data
    carbonHistory.history.forEach(entry => {
      const existingEntry = combinedDataMap.get(entry.datetime) || {};
      combinedDataMap.set(entry.datetime, {
        ...existingEntry,
        carbonIntensity: entry.carbonIntensity
      });
    });

    return {
      latest: {
        power: current,
        carbonIntensity: carbonLatest
      },
      history: Array.from(combinedDataMap.values())
        .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
    };
  }

  async saveData(data) {
    try {
      await fs.mkdir(config.dataDir, { recursive: true });
      await fs.writeFile(
        config.dataFile,
        JSON.stringify(data, null, 2)
      );
      console.info('Data saved successfully');
    } catch (error) {
      console.info('Error saving data:', error);
      throw error;
    }
  }

  async loadData() {
    try {
      const data = await fs.readFile(config.dataFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.info('Error loading data:', error);
      return null;
    }
  }
}

