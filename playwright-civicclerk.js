const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const url = 'https://fishersin.portal.civicclerk.com/';
  console.log('Loading:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const title = await page.title();
  console.log('Title:', title);

  // Extract event cards from the calendar list
  const events = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/event/"]'));
    const seen = new Set();
    const list = [];

    for (const a of anchors) {
      const href = a.href;
      if (!href.includes('/event/')) continue;
      if (seen.has(href)) continue;
      seen.add(href);

      const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;

      list.push({ href, text });
      if (list.length >= 25) break;
    }
    return list;
  });

  console.log('Events (first 25):', events);

  // Visit first event and extract file links
  if (events.length > 0) {
    const eventUrl = events[0].href;
    console.log('\nVisiting event:', eventUrl);
    await page.goto(eventUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const eventTitle = await page.title();
    const eventText = await page.evaluate(() => {
      const body = document.body;
      return body ? body.innerText.slice(0, 2000) : '';
    });

    const fileLinks = await page.evaluate(() => Array.from(document.querySelectorAll('a'))
      .map(a => ({ href: a.href, text: (a.textContent || '').trim() }))
      .filter(a => a.href.includes('api.civicclerk.com/v1/Meetings/GetMeetingFileStream'))
    );

    console.log('Event title:', eventTitle);
    console.log('Event text sample:', eventText.replace(/\s+/g, ' ').slice(0, 600));
    console.log('File links:', fileLinks);
  }

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
