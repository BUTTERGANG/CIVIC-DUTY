// src/scrapers/utils.ts
import { chromium, Browser, Page } from 'playwright';
import { execFileSync } from 'child_process';

export interface Scraper {
  module: string;
  run(): Promise<void>;
}

/**
 * Locate a Chromium to drive. Playwright's own download works locally and in
 * Docker, but not on Replit, where browsers come from Nix at a hashed store
 * path that can't be hardcoded. Resolve it from PATH there instead.
 * Returns undefined to mean "use Playwright's bundled browser".
 */
function resolveChromiumPath(): string | undefined {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicit) return explicit;

  // Only go looking when we've been told not to use the bundled download.
  if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD !== '1') return undefined;

  for (const candidate of ['chromium', 'chromium-browser', 'google-chrome']) {
    try {
      const found = execFileSync('which', [candidate], { encoding: 'utf8' }).trim();
      if (found) return found;
    } catch {
      // not on PATH; try the next candidate
    }
  }
  return undefined;
}

const chromiumPath = resolveChromiumPath();

export async function withBrowser<T>(action: (page: Page) => Promise<T>): Promise<T> {
  const browser: Browser = await chromium.launch({
    headless: true,
    ...(chromiumPath ? { executablePath: chromiumPath } : {}),
  });
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
