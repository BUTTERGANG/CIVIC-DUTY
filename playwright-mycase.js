const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const url = 'https://public.courts.in.gov/mycase/#/vw/Search';
  console.log('Loading:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const title = await page.title();
  console.log('Title:', title);

  const textSample = await page.evaluate(() => {
    const body = document.body;
    return body ? body.innerText.slice(0, 4000) : '';
  });
  console.log('Text sample:', textSample.replace(/\s+/g, ' ').slice(0, 800));

  const links = await page.evaluate(() => Array.from(document.querySelectorAll('a'))
    .map(a => ({ href: a.href, text: (a.textContent || '').trim() }))
    .filter(a => a.href && !a.href.startsWith('javascript:'))
    .slice(0, 50)
  );
  console.log('Links (first 50):', links);

  // Try to capture network calls to identify API endpoints
  const requests = [];
  page.on('requestfinished', req => {
    const url = req.url();
    if (url.includes('public.courts.in.gov') && (url.includes('/api') || url.includes('Search') || url.includes('case') || url.includes('publicaccess'))) {
      requests.push(url);
    }
  });

  // Trigger some interaction: focus search inputs if present
  await page.waitForTimeout(2000);

  console.log('Captured request URLs (deduped):', Array.from(new Set(requests)).slice(0, 50));

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
