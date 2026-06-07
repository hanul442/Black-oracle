import Parser from 'rss-parser';

async function testRSS() {
  const parser = new Parser();
  const url = 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml';
  try {
    const fetched = await parser.parseURL(url);
    console.log(`Fetched ${fetched.items.length} from NYT`);
  } catch (e) {
    console.error('Failed to parse:', e);
  }
}
testRSS();
