const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
  const page = await ctx.newPage();

  const apiCalls = [];
  const jsonResponses = [];
  page.on('request', req => {
    const u = req.url();
    if (!u.includes('.css') && !u.includes('.js') && !u.includes('.png') && !u.includes('.jpg') && !u.includes('google') && !u.includes('font')) {
      apiCalls.push(`${req.method()} ${u}`);
    }
  });
  page.on('response', async res => {
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json')) {
      try { jsonResponses.push({ url: res.url(), status: res.status(), body: (await res.text()).slice(0, 800) }); } catch {}
    }
  });

  console.log('=== Landing page ===');
  await page.goto('https://www.indianabids.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  console.log('Title:', await page.title());
  console.log('Page text:', (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 2000));

  console.log('\n=== All links ===');
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .map(a => ({ text: a.innerText.trim().replace(/\s+/g, ' ').slice(0, 60), href: a.href }))
      .filter(l => l.text && l.href && !l.href.startsWith('javascript:'))
  );
  console.log(JSON.stringify(links, null, 2));

  console.log('\n=== Forms / search inputs ===');
  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
      tag: el.tagName, type: el.type, name: el.name, id: el.id, placeholder: el.placeholder, value: el.value
    }))
  );
  console.log(JSON.stringify(inputs, null, 2));

  console.log('\n=== Tables ===');
  const tables = await page.evaluate(() =>
    Array.from(document.querySelectorAll('table')).map((t, i) => ({
      index: i,
      headers: Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim()),
      rowCount: t.querySelectorAll('tbody tr').length,
      sampleRows: Array.from(t.querySelectorAll('tbody tr')).slice(0, 3).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim().slice(0, 80))
      )
    }))
  );
  console.log(JSON.stringify(tables, null, 2));

  // Try searching for Fishers bids
  console.log('\n=== Attempting search for "Fishers" ===');
  const searchInput = await page.$('input[type="search"], input[type="text"], input[placeholder*="search" i], input[placeholder*="keyword" i]');
  if (searchInput) {
    await searchInput.fill('Fishers');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);
    console.log('Search submitted');

    const resultText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    console.log('Results text:', resultText.slice(0, 2000));

    const resultTables = await page.evaluate(() =>
      Array.from(document.querySelectorAll('table')).map((t, i) => ({
        index: i,
        headers: Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim()),
        rowCount: t.querySelectorAll('tbody tr').length,
        sampleRows: Array.from(t.querySelectorAll('tbody tr')).slice(0, 5).map(tr =>
          Array.from(tr.querySelectorAll('td')).map(td => ({ text: td.innerText.trim().slice(0, 80), link: td.querySelector('a')?.href }))
        )
      }))
    );
    console.log('Result tables:', JSON.stringify(resultTables, null, 2));
  } else {
    console.log('No search input found on landing page');
  }

  console.log('\n=== API calls observed ===');
  console.log([...new Set(apiCalls)].slice(0, 30).join('\n'));

  console.log('\n=== JSON responses ===');
  console.log(JSON.stringify(jsonResponses, null, 2));

  await browser.close();
}

run().catch(console.error);
