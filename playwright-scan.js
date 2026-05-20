const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const targets = [
    { name: 'Fishers Bids', url: 'https://fishersin.gov/do-business-here/bids-proposals/' },
    { name: 'CivicClerk Portal', url: 'https://fishersin.portal.civicclerk.com/' },
    { name: 'CivicClerk Agenda Example', url: 'https://fishersin.portal.civicclerk.com/event/1438/files/agenda/2483' },
    { name: 'Doxpop API Index', url: 'https://api.doxpop.com/index.html' },
    { name: 'Doxpop Court', url: 'https://www.doxpop.com/prod/court/' },
  ];

  for (const t of targets) {
    console.log(`\n=== ${t.name} ===`);
    await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const title = await page.title();
    console.log('Title:', title);

    const textSample = await page.evaluate(() => {
      const body = document.body;
      return body ? body.innerText.slice(0, 2000) : '';
    });
    console.log('Text sample:', textSample.replace(/\s+/g, ' ').slice(0, 600));

    const links = await page.evaluate(() => Array.from(document.querySelectorAll('a'))
      .map(a => ({ href: a.href, text: (a.textContent || '').trim() }))
      .filter(a => a.href && !a.href.startsWith('javascript:'))
      .slice(0, 50)
    );
    console.log('Links (first 50):', links);
  }

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
