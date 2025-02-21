import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  port: process.env.PORT,
  apiToken: process.env.ELECTRICITY_API_TOKEN,
  baseUrl: 'https://api.electricitymap.org/v3',
  dataDir: join(__dirname, '../data'),
  dataFile: join(__dirname, '../data/combined_electricity_data.json')
};