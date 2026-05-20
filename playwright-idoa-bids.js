const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const url = 'https://www.in.gov/idoa/procurement/current-business-opportunities/';
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
  );

  const filtered = links.filter(l => /bid|rfp|proposal|solicitation|opportunit|contract|event/i.test(l.text) || /bid|rfp|proposal|solicitation|event/i.test(l.href));

  console.log('Filtered links (first 50):', filtered.slice(0, 50));

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
