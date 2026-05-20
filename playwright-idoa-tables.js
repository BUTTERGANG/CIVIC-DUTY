const { chromium } = require('playwright');

async function extractTable(page) {
  return page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return null;
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
      const links = Array.from(tr.querySelectorAll('a')).map(a => ({ href: a.href, text: (a.textContent || '').trim() }));
      return { cells, links };
    });
    return { headers, rows: rows.slice(0, 25) };
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const targets = [
    { name: 'Current Business Opportunities', url: 'https://www.in.gov/idoa/procurement/current-business-opportunities/' },
    { name: 'Upcoming Anticipated Bidding Opportunities', url: 'https://www.in.gov/idoa/procurement/current-business-opportunities/upcoming-anticipated-bidding-opportunities/' }
  ];

  for (const t of targets) {
    console.log(`\n=== ${t.name} ===`);
    await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    const title = await page.title();
    console.log('Title:', title);

    const table = await extractTable(page);
    if (!table) {
      console.log('No table found.');
      continue;
    }

    console.log('Headers:', table.headers);
    console.log('Sample rows (first 5):', table.rows.slice(0, 5));
  }

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
