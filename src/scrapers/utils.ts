// src/scrapers/utils.ts
import { chromium, Browser, Page } from 'playwright';

export interface Scraper {
  module: string;
  run(): Promise<void>;
}

export async function withBrowser<T>(action: (page: Page) => Promise<T>): Promise<T> {
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    return await action(page);
  } finally {
    await browser.close();
  }
}

// Haversine distance in miles
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the Earth in miles
  const rlat1 = lat1 * (Math.PI / 180);
  const rlat2 = lat2 * (Math.PI / 180);
  const difflat = rlat2 - rlat1;
  const difflon = (lon2 - lon1) * (Math.PI / 180);

  const d = 2 * R * Math.asin(Math.sqrt(Math.sin(difflat / 2) * Math.sin(difflat / 2) + Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(difflon / 2) * Math.sin(difflon / 2)));
  return d;
}
