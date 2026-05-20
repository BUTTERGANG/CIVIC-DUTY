const { chromium } = require('playwright');

const SOURCES = [
  {
    name: 'CivicClerk – Fishers Agenda Center',
    url: 'https://fishersin.portal.civicclerk.com/',
    extract: async (page) => {
      await page.waitForTimeout(4000);
      const events = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('[class*="event"], [class*="meeting"], [class*="card"], li'));
        const results = [];
        for (const el of cards) {
          const text = el.innerText?.trim();
          const link = el.querySelector('a')?.href;
          if (text && text.length > 10 && link && link.includes('fishersin')) {
            results.push({ text: text.slice(0, 120), link });
          }
        }
        return results.slice(0, 5);
      });
      return events;
    }
  },
  {
    name: 'CivicClerk – Event Files (event 1438)',
    url: 'https://fishersin.portal.civicclerk.com/event/1438/files',
    extract: async (page) => {
      await page.waitForTimeout(4000);
      const files = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="civicclerk"], a[href*="fileId"], a[href*="pdf"], a[href*="PDF"]'));
        return links.map(a => ({ text: a.innerText?.trim(), href: a.href })).slice(0, 8);
      });
      return files;
    }
  },
  {
    name: 'Fishers Bids & Proposals',
    url: 'https://fishersin.gov/do-business-here/bids-proposals/',
    extract: async (page) => {
      await page.waitForTimeout(3000);
      const bids = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('h2, h3, h4, li, .bid, [class*="bid"]'));
        const results = [];
        for (const el of items) {
          const text = el.innerText?.trim();
          const link = el.querySelector('a')?.href || el.closest('a')?.href;
          if (text && text.length > 5 && text.length < 200) {
            results.push({ text: text.slice(0, 120), link: link || null });
          }
        }
        return results.slice(0, 8);
      });
      return bids;
    }
  },
  {
    name: 'IDOA – Current Business Opportunities',
    url: 'https://www.in.gov/idoa/procurement/current-business-opportunities/',
    extract: async (page) => {
      await page.waitForTimeout(5000);
      // Try to find any table or list with bid data
      const data = await page.evaluate(() => {
        // Check all tables
        const tables = Array.from(document.querySelectorAll('table'));
        const tableData = tables.map(t => ({
          headers: Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim()),
          rowCount: t.querySelectorAll('tbody tr').length,
          sampleRow: Array.from(t.querySelectorAll('tbody tr')[0]?.querySelectorAll('td') || []).map(td => td.innerText.trim().slice(0, 80))
        }));

        // Also check for iframes
        const iframes = Array.from(document.querySelectorAll('iframe')).map(f => f.src);

        // Links that look like solicitations
        const solLinks = Array.from(document.querySelectorAll('a[href*="solicit"], a[href*="bid"], a[href*="rfp"], a[href*="proc"]'))
          .map(a => ({ text: a.innerText.trim().slice(0, 80), href: a.href })).slice(0, 5);

        return { tableData, iframes, solLinks };
      });
      return data;
    }
  },
  {
    name: 'IDOA – Upcoming Anticipated Bids',
    url: 'https://www.in.gov/idoa/procurement/current-business-opportunities/upcoming-anticipated-bidding-opportunities/',
    extract: async (page) => {
      await page.waitForTimeout(4000);
      const data = await page.evaluate(() => {
        const tables = Array.from(document.querySelectorAll('table'));
        return tables.map(t => ({
          headers: Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim()),
          rowCount: t.querySelectorAll('tbody tr').length,
          rows: Array.from(t.querySelectorAll('tbody tr')).slice(0, 3).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim().slice(0, 80))
          )
        }));
      });
      return data;
    }
  },
  {
    name: 'MyCase – Indiana Courts Search',
    url: 'https://public.courts.in.gov/mycase/#/vw/Search',
    extract: async (page) => {
      await page.waitForTimeout(5000);
      // Capture network requests to find API endpoints
      const apiCalls = [];
      page.on('request', req => {
        const url = req.url();
        if (url.includes('api') || url.includes('/v1') || url.includes('/search') || url.includes('.json')) {
          apiCalls.push({ method: req.method(), url });
        }
      });
      // Get visible form fields
      const fields = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select'));
        return inputs.map(el => ({ tag: el.tagName, type: el.type, name: el.name, placeholder: el.placeholder, id: el.id })).slice(0, 10);
      });
      await page.waitForTimeout(2000);
      return { fields, apiCalls: apiCalls.slice(0, 10) };
    }
  },
];

async function verifySource(browser, source) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SOURCE: ${source.name}`);
  console.log(`URL:    ${source.url}`);
  console.log('='.repeat(60));

  try {
    const response = await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = response?.status();
    const title = await page.title();
    console.log(`HTTP status: ${status}`);
    console.log(`Page title:  ${title}`);

    const data = await source.extract(page);
    console.log('Extracted data:');
    console.log(JSON.stringify(data, null, 2));

    const result = { source: source.name, url: source.url, status, title, data, error: null };
    return result;
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
    return { source: source.name, url: source.url, status: null, title: null, data: null, error: err.message };
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const source of SOURCES) {
    const result = await verifySource(browser, source);
    results.push(result);
  }

  await browser.close();

  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    const ok = !r.error && r.status && r.status < 400;
    const dataCount = Array.isArray(r.data) ? r.data.length : (r.data ? Object.keys(r.data).length : 0);
    console.log(`${ok ? '✓' : '✗'} ${r.source} — HTTP ${r.status ?? 'ERR'} — ${ok ? `${dataCount} items extracted` : r.error}`);
  }
}

main().catch(console.error);
