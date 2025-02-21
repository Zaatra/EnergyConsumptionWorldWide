import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { ElectricityService } from './services/electricityService.js';
import process from 'process';

const app = express();
const electricityService = new ElectricityService();

app.use(cors());
app.use(express.json());

// Fetch and save data periodically (5 minutes)
const UPDATE_INTERVAL = 5 * 60 * 1000;

async function updateData() {
  try {
    const data = await electricityService.fetchAllData();
    await electricityService.saveData(data);
  } catch (error) {
    console.info('Error updating data:', error);
  }
}

// API Routes
app.get('/api/electricity-data', async (_req, res) => {
  try {
    const data = await electricityService.loadData();
    if (!data) {
      const newData = await electricityService.fetchAllData();
      await electricityService.saveData(newData);
      res.json(newData);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.info('Failed to fetch data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/electricity-data/latest', async (_req, res) => {
  try {
    const data = await electricityService.loadData();
    res.json(data?.latest || null);
  } catch (error) {
    console.info('Failed to fetch latest data:', error);
    res.status(500).json({ error: 'Failed to fetch latest data' });
  }
});

// Initialize server
const init = async () => {
  try {
    await updateData();
    setInterval(updateData, UPDATE_INTERVAL);
    
    app.listen(config.port, () => {
      console.info(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.info('Failed to initialize server:', error);
    process.exit(1);
  }
};

init();
