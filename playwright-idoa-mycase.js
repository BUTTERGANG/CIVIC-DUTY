/**
 * Focused re-run of IDOA (with domcontentloaded + page-size 100)
 * and MyCase (with search submission to capture API endpoints).
 */
const { chromium } = require('playwright');

function sep(label) {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${label}`);
  console.log('═'.repeat(70));
}

// ─── IDOA ─────────────────────────────────────────────────────────────────────

async function inspectIDOA(browser) {
  sep('IDOA – Current Business Opportunities (domcontentloaded + 100/page)');
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
  const page = await ctx.newPage();

  const apiCalls = [];
  page.on('request', req => {
    const u = req.url();
    if (u.includes('in.gov') && !u.includes('static') && !u.includes('.css') && !u.includes('.js') && !u.includes('.png') && !u.includes('.jpg')) {
      apiCalls.push(`${req.method()} ${u}`);
    }
  });

  // Use domcontentloaded to avoid networkidle timeout
  await page.goto('https://www.in.gov/idoa/procurement/current-business-opportunities/', {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });
  await page.waitForTimeout(6000); // wait for JS table to render

  // Find all tables, focus on the one with bid data
  const tables = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('table')).map((t, i) => {
      const headers = Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim());
      const rowCount = t.querySelectorAll('tbody tr').length;
      return { tableIndex: i, headers, rowCount };
    });
  });
  console.log('Tables found:', JSON.stringify(tables, null, 2));

  // Try to change page size to 100 (look for a rows-per-page selector)
  console.log('\n── Attempting to change page size to 100 ──');
  const pageSizeChanged = await page.evaluate(() => {
    // Look for select elements with numeric options (page size dropdowns)
    const selects = Array.from(document.querySelectorAll('select'));
    for (const sel of selects) {
      const opts = Array.from(sel.options).map(o => o.value);
      if (opts.includes('100') || opts.includes('50') || opts.some(o => /^\d+$/.test(o))) {
        return { found: true, id: sel.id, options: opts };
      }
    }
    // Look for input[type=number] that could be page size
    const nums = Array.from(document.querySelectorAll('input[type=number]')).map(el => ({ id: el.id, value: el.value }));
    return { found: false, numInputs: nums };
  });
  console.log('Page size control:', JSON.stringify(pageSizeChanged, null, 2));

  if (pageSizeChanged.found) {
    const sel = await page.$('select');
    if (sel) {
      try {
        await sel.selectOption('100');
        await page.waitForTimeout(3000);
        console.log('Selected 100 rows per page');
      } catch (e) {
        console.log('Could not select 100:', e.message);
      }
    }
  }

  // Extract full bids table
  console.log('\n── Extracting bids table (all rows) ──');
  const bidTable = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    const target = tables.find(t => {
      const headers = Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim().toLowerCase());
      return headers.some(h => h.includes('event name') || h.includes('event id') || h.includes('agency'));
    });
    if (!target) return { error: 'bids table not found' };

    const headers = Array.from(target.querySelectorAll('th')).map(th => th.innerText.trim());
    const rows = Array.from(target.querySelectorAll('tbody tr')).map(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).map(td => ({
        text: td.innerText.trim().replace(/\s+/g, ' '),
        links: Array.from(td.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }))
      }));
      return cells;
    });
    return { headers, totalRows: rows.length, rows };
  });

  console.log('Headers:', bidTable.headers);
  console.log('Total rows:', bidTable.totalRows);
  console.log('Sample rows (first 3):', JSON.stringify(bidTable.rows?.slice(0, 3), null, 2));

  // Check for pagination controls and page through if needed
  console.log('\n── Pagination check ──');
  const paginationInfo = await page.evaluate(() => {
    // Look for pagination nav, buttons, or text like "Showing 1-50 of 123"
    const text = document.body.innerText;
    const showingMatch = text.match(/showing\s+\d+[–\-]\d+\s+of\s+(\d+)/i);
    const pageButtons = Array.from(document.querySelectorAll('button, a'))
      .filter(el => /next|page\s+\d|^\d+$/.test(el.textContent.trim()))
      .map(el => ({ text: el.textContent.trim(), disabled: el.disabled || el.getAttribute('aria-disabled') }))
      .slice(0, 10);
    return { showingText: showingMatch ? showingMatch[0] : null, pageButtons };
  });
  console.log(JSON.stringify(paginationInfo, null, 2));

  // If pagination exists, click Next and extract remaining rows
  let allRows = bidTable.rows || [];
  let pageNum = 1;
  while (true) {
    const nextBtn = await page.$('button:has-text("Next"), a:has-text("Next"), [aria-label="Next page"]');
    if (!nextBtn) break;
    const isDisabled = await nextBtn.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled'));
    if (isDisabled) break;

    console.log(`\nClicking Next (page ${++pageNum})...`);
    await nextBtn.click();
    await page.waitForTimeout(3000);

    const moreRows = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      const target = tables.find(t => Array.from(t.querySelectorAll('th')).some(th => /event name|event id|agency/i.test(th.innerText)));
      if (!target) return [];
      return Array.from(target.querySelectorAll('tbody tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => ({
          text: td.innerText.trim().replace(/\s+/g, ' '),
          links: Array.from(td.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }))
        }))
      );
    });
    allRows = allRows.concat(moreRows);
    console.log(`Page ${pageNum}: +${moreRows.length} rows (total: ${allRows.length})`);
    if (pageNum > 20) { console.log('Safety stop at 20 pages'); break; }
  }

  console.log(`\n✓ IDOA total rows collected: ${allRows.length}`);
  console.log('API calls observed:', apiCalls.slice(0, 15).join('\n'));

  // Upcoming anticipated bids
  sep('IDOA – Upcoming Anticipated Bids (all rows)');
  await page.goto('https://www.in.gov/idoa/procurement/current-business-opportunities/upcoming-anticipated-bidding-opportunities/', {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });
  await page.waitForTimeout(5000);

  const upcomingTable = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('table')).map(t => {
      const headers = Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim());
      const rows = Array.from(t.querySelectorAll('tbody tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => ({
          text: td.innerText.trim().replace(/\s+/g, ' '),
          links: Array.from(td.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }))
        }))
      );
      return { headers, totalRows: rows.length, rows };
    });
  });
  for (const t of upcomingTable) {
    console.log('Headers:', t.headers);
    console.log('Total rows:', t.totalRows);
    console.log('All rows:', JSON.stringify(t.rows, null, 2));
  }

  await ctx.close();
}

// ─── MyCase ───────────────────────────────────────────────────────────────────

async function inspectMyCase(browser) {
  sep('MyCase – Indiana Courts (submit search, capture API)');
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
  const page = await ctx.newPage();

  const apiCalls = [];
  const jsonResponses = [];

  page.on('request', req => {
    const u = req.url();
    if (u.includes('courts.in.gov') || u.includes('/api') || u.includes('/search') || u.includes('/PublicAccess')) {
      apiCalls.push({ method: req.method(), url: u, postData: req.postData()?.slice(0, 200) || null });
    }
  });
  page.on('response', async res => {
    const u = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json') && (u.includes('courts.in.gov') || u.includes('/api'))) {
      try {
        const body = await res.text();
        jsonResponses.push({ url: u, status: res.status(), body: body.slice(0, 1000) });
      } catch {}
    }
  });

  await page.goto('https://public.courts.in.gov/mycase/#/vw/Search', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Get court dropdown options
  const courtOptions = await page.evaluate(() => {
    const sel = document.querySelector('select');
    return sel ? Array.from(sel.options).map(o => ({ value: o.value, text: o.text })) : [];
  });
  const hamilton = courtOptions.filter(o => /hamilton/i.test(o.text));
  console.log(`Court dropdown has ${courtOptions.length} options`);
  console.log('Hamilton County courts:', JSON.stringify(hamilton, null, 2));

  // Click Name tab and search
  console.log('\n── Clicking Name tab ──');
  const nameTab = await page.$('[role="tab"]:has-text("Name"), button:has-text("Name"), a:has-text("Name")');
  if (nameTab) {
    await nameTab.click();
    await page.waitForTimeout(1500);
    console.log('Clicked Name tab');
  }

  console.log('\n── Filling last name = "Smith" ──');
  const lastInput = await page.$('input[id*="Last" i], input[placeholder*="last" i], input[id*="last" i]');
  if (lastInput) {
    await lastInput.fill('Smith');
    console.log('Filled last name');
  }

  if (hamilton.length > 0) {
    const sel = await page.$('select');
    if (sel) {
      await sel.selectOption({ value: hamilton[0].value });
      console.log('Selected Hamilton County court:', hamilton[0].text);
    }
  }

  console.log('\n── Submitting search ──');
  const searchBtn = await page.$('button[type="submit"], button:has-text("Search"), input[type="submit"]');
  if (searchBtn) {
    await searchBtn.click();
    await page.waitForTimeout(6000);
  }

  console.log('\n── Page text after search ──');
  const resultText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  console.log(resultText.slice(0, 1500));

  console.log('\n── API calls captured ──');
  console.log(JSON.stringify(apiCalls, null, 2));

  console.log('\n── JSON responses ──');
  console.log(JSON.stringify(jsonResponses, null, 2));

  await ctx.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  await inspectIDOA(browser);
  await inspectMyCase(browser);
  await browser.close();
  console.log('\n\nDone.');
}

main().catch(console.error);
