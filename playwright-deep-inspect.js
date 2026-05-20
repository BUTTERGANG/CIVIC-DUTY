/**
 * Deep inspection of all data sources.
 * Goals:
 *  - CivicClerk: use date-range filter (Jan 4 2023 → today), count all events, check pagination, full field structure, file type labels
 *  - Fishers Bids: dump DOM structure to find correct selectors, check for closed/archived section
 *  - IDOA Current: extract all rows + document links, check pagination, sniff API endpoints
 *  - IDOA Upcoming: extract all 39 rows in full
 *  - MyCase: submit a real search, capture API calls + response shape
 */

const { chromium } = require('playwright');

// ─── helpers ──────────────────────────────────────────────────────────────────

function sep(label) {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${label}`);
  console.log('═'.repeat(70));
}

function sub(label) {
  console.log(`\n── ${label} ──`);
}

// ─── CivicClerk ───────────────────────────────────────────────────────────────

async function inspectCivicClerk(browser) {
  sep('CivicClerk – Fishers Agenda Center');
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
  const page = await ctx.newPage();

  await page.goto('https://fishersin.portal.civicclerk.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // 1. Find all inputs/selects that look like date filters
  sub('Date filter inputs on page');
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, select, button')).map(el => ({
      tag: el.tagName,
      type: el.type || null,
      id: el.id || null,
      name: el.name || null,
      placeholder: el.placeholder || null,
      value: el.value || null,
      label: el.closest('label')?.textContent?.trim() || null,
      ariaLabel: el.getAttribute('aria-label') || null,
      classes: el.className?.slice(0, 60) || null,
    }));
  });
  console.log(JSON.stringify(inputs, null, 2));

  // 2. Dump page text around any "date" or "filter" mentions
  sub('Page text sample (looking for date filter labels)');
  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log(pageText.replace(/\s+/g, ' ').slice(0, 1000));

  // 3. Try to set date range via input interaction
  sub('Attempting to set From Date = 01/04/2023 and To Date = today');
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  let dateSetResult = 'no date inputs found';

  // Look for date inputs by aria-label, placeholder, or label text
  const dateInputs = await page.$$('input[type="date"], input[placeholder*="date" i], input[placeholder*="from" i], input[placeholder*="to" i], input[aria-label*="date" i], input[aria-label*="from" i], input[aria-label*="to" i]');
  if (dateInputs.length >= 1) {
    try {
      await dateInputs[0].fill('01/04/2023');
      if (dateInputs.length >= 2) await dateInputs[1].fill(today);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      dateSetResult = `filled ${dateInputs.length} date input(s)`;
    } catch (e) {
      dateSetResult = `error: ${e.message}`;
    }
  }
  // Also try clicking a "Filter" or "Search" button
  const filterBtn = await page.$('button:has-text("Filter"), button:has-text("Search"), button:has-text("Apply")');
  if (filterBtn) {
    await filterBtn.click();
    await page.waitForTimeout(3000);
    dateSetResult += ' + clicked filter button';
  }
  console.log('Date set result:', dateSetResult);

  // 4. Count all event links
  sub('Total events after date range (counting /event/ links)');
  const eventLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/event/"]'));
    const seen = new Set();
    const list = [];
    for (const a of anchors) {
      const m = a.href.match(/\/event\/(\d+)/);
      if (!m) continue;
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const text = (a.closest('[class]')?.innerText || a.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 150);
      list.push({ id, href: a.href, text });
    }
    return list;
  });
  console.log(`Found ${eventLinks.length} unique event links`);
  console.log('Sample (first 5):', JSON.stringify(eventLinks.slice(0, 5), null, 2));
  console.log('Sample (last 5):', JSON.stringify(eventLinks.slice(-5), null, 2));

  // 5. Check for pagination controls
  sub('Pagination controls');
  const pagination = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .filter(el => /next|prev|page|\d+/i.test(el.textContent) && el.textContent.trim().length < 20)
      .map(el => ({ tag: el.tagName, text: el.textContent.trim(), href: el.href || null, disabled: el.disabled || null }));
    return btns.slice(0, 15);
  });
  console.log(JSON.stringify(pagination, null, 2));

  // 6. Deep-inspect a single event page for full field structure
  sub('Deep inspection of event 1438 (City Council Meeting)');
  await page.goto('https://fishersin.portal.civicclerk.com/event/1438/files', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const eventDetail = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, ' ').trim();
    // Find all links with file info
    const fileLinks = Array.from(document.querySelectorAll('a')).map(a => {
      const label = (a.closest('[class]')?.innerText || a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      return { label, href: a.href };
    }).filter(l => l.href && (l.href.includes('civicclerk') || l.href.includes('pdf') || l.href.includes('fileId') || l.href.includes('blob')));
    return { textSample: text.slice(0, 1500), fileLinks };
  });
  console.log('Event text sample:', eventDetail.textSample.slice(0, 800));
  console.log('\nFile links found:', JSON.stringify(eventDetail.fileLinks, null, 2));

  // 7. Check CivicClerk API directly
  sub('CivicClerk REST API probe');
  const apiRequests = [];
  page.on('request', req => {
    const u = req.url();
    if (u.includes('civicclerk.com') && (u.includes('/v1/') || u.includes('/api/'))) {
      apiRequests.push({ method: req.method(), url: u });
    }
  });
  await page.goto('https://fishersin.portal.civicclerk.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  console.log('CivicClerk API calls observed:', JSON.stringify([...new Set(apiRequests.map(r => `${r.method} ${r.url}`))].slice(0, 20), null, 2));

  await ctx.close();
}

// ─── Fishers Bids ─────────────────────────────────────────────────────────────

async function inspectFishersBids(browser) {
  sep('Fishers Bids & Proposals');
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
  const page = await ctx.newPage();

  await page.goto('https://fishersin.gov/do-business-here/bids-proposals/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 1. Full page text
  sub('Full page text (first 3000 chars)');
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
  console.log(text.slice(0, 3000));

  // 2. All links on the page
  sub('All links on the page');
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .map(a => ({ text: a.innerText?.trim().replace(/\s+/g, ' '), href: a.href }))
      .filter(l => l.text && l.href && !l.href.startsWith('javascript:'))
  );
  console.log(JSON.stringify(links, null, 2));

  // 3. DOM structure around main content
  sub('Main content HTML structure (first 5000 chars of innerHTML)');
  const mainHTML = await page.evaluate(() => {
    const main = document.querySelector('main, article, .main-content, #main, .content, .entry-content, .page-content');
    return main ? main.innerHTML.slice(0, 5000) : document.body.innerHTML.slice(0, 5000);
  });
  console.log(mainHTML);

  // 4. Check for "closed" / "awarded" / "archived" bids section
  sub('Text around "closed" or "awarded" keywords');
  const closedText = await page.evaluate(() => {
    const full = document.body.innerText;
    const idx = full.search(/closed|awarded|archived/i);
    return idx >= 0 ? full.slice(Math.max(0, idx - 100), idx + 500) : 'none found';
  });
  console.log(closedText);

  await ctx.close();
}

// ─── IDOA Current Business Opportunities ──────────────────────────────────────

async function inspectIDOACurrent(browser) {
  sep('IDOA – Current Business Opportunities (full table + API)');
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
  const page = await ctx.newPage();

  // Capture API calls
  const apiCalls = [];
  page.on('request', req => {
    const u = req.url();
    if (!u.includes('in.gov/idoa')) return;
    apiCalls.push(`${req.method()} ${u}`);
  });
  page.on('response', async res => {
    const u = res.url();
    if (!u.includes('in.gov/idoa')) return;
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json')) {
      try {
        const body = await res.text();
        console.log(`JSON response from ${u}:`, body.slice(0, 500));
      } catch {}
    }
  });

  await page.goto('https://www.in.gov/idoa/procurement/current-business-opportunities/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(4000);

  sub('API calls observed on IDOA page');
  console.log([...new Set(apiCalls)].join('\n'));

  // Extract all rows from the bids table (the one with Event Name/Agency/Event ID)
  sub('Full IDOA bids table (all rows)');
  const tableData = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    const target = tables.find(t => {
      const headers = Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase());
      return headers.some(h => h.includes('event name') || h.includes('agency') || h.includes('event id'));
    });
    if (!target) return { error: 'bids table not found', tableCount: tables.length, allHeaders: tables.map(t => Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim())) };

    const headers = Array.from(target.querySelectorAll('th')).map(th => th.textContent.trim());
    const rows = Array.from(target.querySelectorAll('tbody tr')).map(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).map(td => ({
        text: td.innerText.trim(),
        links: Array.from(td.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }))
      }));
      return cells;
    });
    return { headers, totalRows: rows.length, rows };
  });

  console.log(`Headers: ${JSON.stringify(tableData.headers)}`);
  console.log(`Total rows: ${tableData.totalRows}`);
  console.log('First 3 rows:', JSON.stringify(tableData.rows?.slice(0, 3), null, 2));
  console.log('Last 2 rows:', JSON.stringify(tableData.rows?.slice(-2), null, 2));

  // Check pagination
  sub('Pagination on IDOA table');
  const pages = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, [role="button"], .page-item'))
      .filter(el => /next|prev|page|\d+/i.test(el.textContent) && el.textContent.trim().length < 20)
      .map(el => ({ text: el.textContent.trim(), tag: el.tagName, disabled: el.disabled || el.getAttribute('aria-disabled') }))
      .slice(0, 10);
  });
  console.log(JSON.stringify(pages, null, 2));

  await ctx.close();
}

// ─── IDOA Upcoming ────────────────────────────────────────────────────────────

async function inspectIDOAUpcoming(browser) {
  sep('IDOA – Upcoming Anticipated Bids (all rows)');
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
  const page = await ctx.newPage();

  await page.goto('https://www.in.gov/idoa/procurement/current-business-opportunities/upcoming-anticipated-bidding-opportunities/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);

  const tableData = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    return tables.map(t => {
      const headers = Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = Array.from(t.querySelectorAll('tbody tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => ({
          text: td.innerText.trim(),
          links: Array.from(td.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }))
        }))
      );
      return { headers, totalRows: rows.length, rows };
    });
  });

  for (const t of tableData) {
    console.log(`Headers: ${JSON.stringify(t.headers)}`);
    console.log(`Total rows: ${t.totalRows}`);
    console.log('All rows:', JSON.stringify(t.rows, null, 2));
  }

  await ctx.close();
}

// ─── MyCase ───────────────────────────────────────────────────────────────────

async function inspectMyCase(browser) {
  sep('MyCase – Indiana Courts (search submission + API capture)');
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
  const page = await ctx.newPage();

  const apiCalls = [];
  page.on('request', req => {
    const u = req.url();
    if (u.includes('courts.in.gov') || u.includes('mycase') || u.includes('/api') || u.includes('/search') || u.includes('/case')) {
      apiCalls.push({ method: req.method(), url: u, headers: req.headers() });
    }
  });
  const apiResponses = [];
  page.on('response', async res => {
    const u = res.url();
    const ct = res.headers()['content-type'] || '';
    if ((u.includes('courts.in.gov') || u.includes('mycase')) && ct.includes('json')) {
      try {
        const body = await res.text();
        apiResponses.push({ url: u, body: body.slice(0, 1000) });
      } catch {}
    }
  });

  await page.goto('https://public.courts.in.gov/mycase/#/vw/Search', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  sub('All form fields');
  const fields = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
      tag: el.tagName, type: el.type, id: el.id, name: el.name,
      placeholder: el.placeholder, value: el.value,
      label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || null
    }))
  );
  console.log(JSON.stringify(fields, null, 2));

  sub('Available court options in dropdown');
  const courtOptions = await page.evaluate(() => {
    const sel = document.querySelector('select');
    if (!sel) return [];
    return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
  });
  console.log(`${courtOptions.length} court options`);
  const hamilton = courtOptions.filter(o => /hamilton/i.test(o.text));
  console.log('Hamilton County options:', JSON.stringify(hamilton, null, 2));

  // Submit a Name search for Hamilton County
  sub('Submitting Name search: "Smith" in Hamilton County Superior Court');
  try {
    // Click the "Name" tab if present
    const nameTab = await page.$('button:has-text("Name"), a:has-text("Name"), [role="tab"]:has-text("Name")');
    if (nameTab) {
      await nameTab.click();
      await page.waitForTimeout(1500);
    }

    // Find last name input
    const lastNameInput = await page.$('input[placeholder*="last" i], input[id*="last" i], input[id*="Last" i]');
    if (lastNameInput) {
      await lastNameInput.fill('Smith');
    }

    // Select Hamilton county in the court dropdown
    if (hamilton.length > 0) {
      const sel = await page.$('select');
      if (sel) await sel.selectOption({ value: hamilton[0].value });
    }

    // Click search button
    const searchBtn = await page.$('button[type="submit"], button:has-text("Search"), input[type="submit"]');
    if (searchBtn) {
      await searchBtn.click();
      await page.waitForTimeout(5000);
    }

    sub('Page after search submission');
    const resultText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log(resultText.replace(/\s+/g, ' ').slice(0, 1000));

  } catch (e) {
    console.log('Search error:', e.message);
  }

  sub('API calls captured');
  console.log(JSON.stringify([...new Set(apiCalls.map(r => `${r.method} ${r.url}`))], null, 2));

  sub('JSON responses captured');
  console.log(JSON.stringify(apiResponses, null, 2));

  await ctx.close();
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const browser = await chromium.launch({ headless: true });

  await inspectCivicClerk(browser);
  await inspectFishersBids(browser);
  await inspectIDOACurrent(browser);
  await inspectIDOAUpcoming(browser);
  await inspectMyCase(browser);

  await browser.close();
  console.log('\n\nDone.');
}

main().catch(console.error);
