const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const url = 'https://fishersin.gov/do-business-here/bids-proposals/';
  console.log('Loading:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const title = await page.title();
  console.log('Title:', title);

  // Try to extract open bids list items by finding likely headings and nearby links
  const bids = await page.evaluate(() => {
    const results = [];
    const sections = Array.from(document.querySelectorAll('h2, h3, h4'));

    const normalize = s => (s || '').replace(/\s+/g, ' ').trim();

    for (const h of sections) {
      const text = normalize(h.textContent);
      if (!text) continue;
      if (!/open bids|open bid|open contracts|open bids and contracts/i.test(text)) continue;

      // Look for links under the section container
      const container = h.closest('section') || h.parentElement;
      if (!container) continue;

      const links = Array.from(container.querySelectorAll('a'))
        .map(a => ({ href: a.href, text: normalize(a.textContent) }))
        .filter(a => a.href && a.text);

      // Try to find closing date text near links
      for (const l of links) {
        const item = { title: l.text, href: l.href, closing: null };
        // search for closing date in container text
        const ctext = normalize(container.textContent);
        const match = ctext.match(/Closing date:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*(AM|PM))/i);
        if (match) item.closing = match[1];
        results.push(item);
      }
    }

    // Fallback: collect links that look like bid/contract PDFs
    if (results.length === 0) {
      const allLinks = Array.from(document.querySelectorAll('a'))
        .map(a => ({ href: a.href, text: normalize(a.textContent) }))
        .filter(a => a.href && a.text);
      const filtered = allLinks.filter(l => /bid|rfp|proposal|contract|request/i.test(l.text) || /\.pdf$/i.test(l.href));
      return filtered.slice(0, 30);
    }

    return results.slice(0, 30);
  });

  console.log('Bids (first 30):', bids);

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
