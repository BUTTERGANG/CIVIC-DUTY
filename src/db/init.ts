import { pool } from './index';
import fs from 'fs';
import path from 'path';

async function initDB() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  try {
    console.log('Running schema initialization...');
    await pool.query(schema);
    console.log('Database schema created successfully.');
  } catch (error) {
    console.error('Failed to create database schema:', error);
  } finally {
    await pool.end();
  }
}

initDB();
