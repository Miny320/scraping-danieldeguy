# Daniel de Guy Watch Scraper

A Node.js web scraper that extracts watch product data from Daniel de Guy's website using HTTP requests (no browser automation required).

## Features

- **Request-based scraping** - Uses axios for HTTP requests, no browser needed
- **Batch processing** - Processes products in batches of 10 for optimal performance
- **Complete data extraction** - Extracts brand, model, reference number, year, price, condition, images, and more
- **Image deduplication** - Automatically keeps only the largest size for each image
- **Brand detection** - Intelligently detects watch brands from product titles
- **Backend integration** - Optional POST to backend API

## Installation

```bash
npm install
```

## Configuration

Edit `config.json`:

```json
{
    "PARENT_URL": "https://www.danieldeguy.com/collections/montres-occasion-marques",
    "CHECK_INTERVAL": 86400000,
    "BACK_END_URL": "http://localhost:3001/api/v0/watch-bot"
}
```

## Usage

```bash
npm start
```

The scraper will:
1. Extract all product URLs from paginated listing pages
2. Scrape detailed product data for each watch
3. Save results to `watchData.json`
4. Optionally post data to backend if configured

## Output Format

The scraper generates `watchData.json` with the following structure:

```json
[
  {
    "brand": "Cartier",
    "model": "Cartier Tank Must",
    "referenceNumber": "W4TA0016",
    "year": null,
    "price": 5900,
    "currency": "CHF",
    "originalBox": true,
    "originalPaper": true,
    "condition": "worn",
    "location": "Switzerland",
    "images": [
      "https://www.danieldeguy.com/cdn/shop/files/Cartier-02-01_1800x1800.jpg?v=1762519096"
    ],
    "watchUrl": "https://www.danieldeguy.com/collections/montres-occasion-marques/products/cartier-tank-must"
  }
]
```

## Dependencies

- `axios` - HTTP client for making requests
- `cheerio` - Server-side HTML parsing (jQuery-like)

## Notes

- Rate limiting: 2-second delay between batches to avoid overwhelming the server
- Images are automatically deduplicated and sorted by size (largest first)
- The scraper handles pagination automatically
- All temporary files (HTML, page URLs) are excluded from git

## License

ISC

