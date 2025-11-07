const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config.json');

const CONFIG = {
    PARENT_URL: config.PARENT_URL,
    CHECK_INTERVAL: config.CHECK_INTERVAL,
};

const axiosInstance = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.danieldeguy.com/collections/montres-occasion-marques'
    },
            timeout: 60000
        });

const WATCH_BRANDS = [
    'Rolex', 'Cartier', 'Omega', 'Patek Philippe', 'Audemars Piguet', 
    'Breitling', 'IWC', 'Tudor', 'Tag Heuer', 'Hublot', 'Panerai',
    'Vacheron Constantin', 'Jaeger-LeCoultre', 'Blancpain', 'A. Lange & Söhne',
    'Franck Muller', 'Richard Mille', 'Bulgari', 'Chopard', 'Piaget',
    'Zenith', 'Girard-Perregaux', 'Montblanc', 'Baume & Mercier'
];

const normalizeUrl = (href) => {
    if (!href) return null;
    return href.startsWith('http') ? href : `https://www.danieldeguy.com${href}`;
};

const extractProductUrls = (html) => {
    const $ = cheerio.load(html);
    const productUrls = new Set();

    $('.grid-product__link').each((index, element) => {
        const href = $(element).attr('href');
        const url = normalizeUrl(href);
        if (url) productUrls.add(url);
    });

    if (productUrls.size === 0) {
        $('.grid-product__content a').each((index, element) => {
            const href = $(element).attr('href');
            if (href && href.includes('/products/')) {
                const url = normalizeUrl(href);
                if (url) productUrls.add(url);
            }
        });
    }

    return Array.from(productUrls);
};

const getNextPageUrl = (html, currentUrl) => {
    const $ = cheerio.load(html);
    const nextPageLink = $('.pagination .next a');
    
    if (nextPageLink.length > 0) {
        const href = nextPageLink.attr('href');
        return href ? normalizeUrl(href) : null;
    }
    
    return null;
};

const extractProductData = async (productUrl) => {
    try {
        const response = await axiosInstance.get(productUrl);
        const $ = cheerio.load(response.data);

            const result = {
                brand: '',
                model: '',
                referenceNumber: '',
                year: null,
                price: 0,
                currency: 'CHF',
            originalBox: null,
            originalPaper: null,
            condition: null,
                location: 'Switzerland',
                images: [],
            watchUrl: productUrl
        };

        // Extract title/model
        const titleElement = $('.product-single__title');
        if (titleElement.length > 0) {
            result.model = titleElement.text().trim();
        }

        // Extract vendor (only if not store name)
        const vendorElement = $('.product-single__vendor');
        if (vendorElement.length > 0) {
            const vendor = vendorElement.text().trim();
            if (vendor && !vendor.toLowerCase().includes('daniel') && !vendor.toLowerCase().includes('guy')) {
                result.brand = vendor;
            }
            }

            // Extract price
        const priceElement = $('.product-single__meta .product__price, .product__price');
        if (priceElement.length > 0) {
            const priceText = priceElement.first().text().trim();
                const currencyMatch = priceText.match(/([A-Z]{3})/);
                if (currencyMatch) {
                    result.currency = currencyMatch[1];
                }
                const priceMatch = priceText.match(/([\d,\.]+)/);
                if (priceMatch) {
                    result.price = parseFloat(priceMatch[1].replace(/,/g, ''));
                }
            }

        // Extract description details
        const descriptionElement = $('.product-single__description');
        if (descriptionElement.length > 0) {
            const descriptionLines = [];
            descriptionElement.find('p').each((index, p) => {
                const text = $(p).text().trim();
                if (text) descriptionLines.push(text);
            });
            
            if (descriptionLines.length === 0) {
                const descriptionText = descriptionElement.text().trim();
                descriptionLines.push(...descriptionText.split('\n').map(line => line.trim()).filter(line => line));
            }

                descriptionLines.forEach(line => {
                const lineLower = line.toLowerCase();
                
                // Extract reference number
                if (!result.referenceNumber) {
                    const refMatch = line.match(/(?:Ref(?:erence|érence)?\.?|Référence)\s*[:#-]?\s*([A-Z0-9\-]+)/i);
                    if (refMatch) {
                        result.referenceNumber = refMatch[1].trim();
                    } else {
                        const refMatch2 = line.match(/Ref(?:erence|érence)?\s+([A-Z0-9\-]+)/i);
                        if (refMatch2) {
                            result.referenceNumber = refMatch2[1].trim();
                        }
                    }
                }

                // Extract year
                if (!result.year) {
                    const yearMatch = line.match(/(?:New|Year|Nouveau|Annee|Année)[^\d]*(\d{4})/i);
                    if (yearMatch) {
                        const year = parseInt(yearMatch[1]);
                        if (!isNaN(year) && year >= 1900 && year <= 2100) {
                            result.year = year;
                        }
                    } else {
                        const standaloneYear = line.match(/(\d{4})/);
                        if (standaloneYear) {
                            const year = parseInt(standaloneYear[1]);
                            if (!isNaN(year) && year >= 1900 && year <= 2100) {
                                result.year = year;
                            }
                            }
                        }
                    }

                    // Extract condition
                if (!result.condition) {
                    const yearPatternMatch = line.match(/(?:New|Nouveau)\s+\d{4}/i);
                    
                    if (lineLower.includes('never worn') || lineLower.includes('unworn')) {
                        result.condition = 'unworn';
                    } else if (!yearPatternMatch) {
                        if (lineLower.includes('new') || lineLower.includes('neuve')) {
                            if (!line.match(/new\s+\d{4}/i) && !line.match(/neuve\s+\d{4}/i)) {
                                result.condition = 'unworn';
                            }
                        }
                    }
                    
                    if (lineLower.includes('very good') || lineLower.includes('très bon') || 
                        lineLower.includes('occasion') || lineLower.includes('used') ||
                        lineLower.includes('porté') || lineLower.includes('worn')) {
                        result.condition = 'worn';
                    }
                    }

                // Extract box and papers
                    if (lineLower.includes('full set')) {
                        result.originalBox = true;
                        result.originalPaper = true;
                    }
                    if (lineLower.includes('box') || lineLower.includes('boîte')) {
                        result.originalBox = true;
                    }
                    if (lineLower.includes('paper') || lineLower.includes('certificate') || 
                        lineLower.includes('papier') || lineLower.includes('certificat') ||
                        lineLower.includes('card') || lineLower.includes('carte')) {
                        result.originalPaper = true;
                    }
                });
            }

        // Check title for condition
        if (!result.condition && result.model) {
                const titleLower = result.model.toLowerCase();
                if ((titleLower.includes('new') || titleLower.includes('neuve')) && 
                    !titleLower.match(/new\s+\d{4}/) && !titleLower.match(/neuve\s+\d{4}/)) {
                    result.condition = 'unworn';
                }
            }

        // Extract images
        $('img[data-photoswipe-src]').each((index, img) => {
            let imgSrc = $(img).attr('data-photoswipe-src');
                            if (imgSrc) {
                imgSrc = imgSrc.startsWith('//') ? `https:${imgSrc}` : 
                        imgSrc.startsWith('/') ? `https://www.danieldeguy.com${imgSrc}` : imgSrc;
                if (imgSrc.startsWith('http') && !result.images.includes(imgSrc)) {
                                    result.images.push(imgSrc);
                                }
                            }
                        });
                        
        if (result.images.length === 0) {
            $('meta[property="og:image"]').each((index, meta) => {
                let imgSrc = $(meta).attr('content');
                if (imgSrc) {
                    imgSrc = imgSrc.startsWith('//') ? `https:${imgSrc}` :
                            imgSrc.startsWith('/') ? `https://www.danieldeguy.com${imgSrc}` :
                            imgSrc.startsWith('http://') ? imgSrc.replace('http://', 'https://') : imgSrc;
                    if (imgSrc.startsWith('http') && !result.images.includes(imgSrc)) {
                        result.images.push(imgSrc);
                    }
                }
            });
        }

            if (result.images.length === 0) {
            $('.product__photos img, .product-single__photos img, .product-image-main img').each((index, img) => {
                let imgSrc = $(img).attr('data-photoswipe-src') || 
                            $(img).attr('data-src') || 
                            $(img).attr('src') ||
                            $(img).attr('data-zoom');
                
                if (imgSrc) {
                    if (imgSrc.includes('{width}')) {
                        imgSrc = imgSrc.replace('{width}', '1800');
                    }
                    imgSrc = imgSrc.startsWith('//') ? `https:${imgSrc}` :
                            imgSrc.startsWith('/') ? `https://www.danieldeguy.com${imgSrc}` : imgSrc;
                    if (imgSrc.startsWith('http') && !imgSrc.startsWith('data:') && !result.images.includes(imgSrc)) {
                        result.images.push(imgSrc);
                    }
                }
            });
        }

        // Extract brand from model if not available
        if (!result.brand && result.model) {
            for (const brand of WATCH_BRANDS) {
                if (result.model.toLowerCase().includes(brand.toLowerCase())) {
                    result.brand = brand;
                    break;
                }
            }
            if (!result.brand) {
                const modelParts = result.model.split(' ');
            if (modelParts.length > 0) {
                    result.brand = modelParts[0];
                }
            }
        }

        // Deduplicate images (keep largest size)
        if (result.images.length > 0) {
            const imageMap = new Map();
            result.images.forEach(url => {
                const urlWithoutQuery = url.split('?')[0];
                const baseMatch = urlWithoutQuery.match(/^(.+?)(_\d+x\d+)?\.(jpg|jpeg|png|webp)$/i);
                
                if (baseMatch) {
                    const baseFilename = baseMatch[1];
                    const sizeMatch = urlWithoutQuery.match(/_(\d+)x\d+/);
                    const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
                    const queryParams = url.includes('?') ? url.substring(url.indexOf('?')) : '';
                    const fullUrl = baseMatch[1] + (sizeMatch ? sizeMatch[0] : '') + '.' + baseMatch[3] + queryParams;
                    
                    if (!imageMap.has(baseFilename) || imageMap.get(baseFilename).size < size) {
                        imageMap.set(baseFilename, { url: fullUrl, size });
                    }
                } else {
                    if (!imageMap.has(url)) {
                        imageMap.set(url, { url, size: 0 });
                    }
                }
            });
            
            result.images = Array.from(imageMap.values())
                .sort((a, b) => b.size - a.size)
                .map(item => item.url);
        }

        return result;

    } catch (error) {
        console.error(`Error fetching product ${productUrl}:`, error.message);
        return null;
    }
};

const getAllProductUrls = async () => {
    console.log('=== Starting Product URL Extraction ===\n');

    const allProductUrls = [];
        let currentPage = 1;
        let currentUrl = CONFIG.PARENT_URL;

    while (true) {
        console.log(`Processing Page ${currentPage}: ${currentUrl}`);

        try {
            const response = await axiosInstance.get(currentUrl);
            const html = response.data;
            const pageUrls = extractProductUrls(html);
            allProductUrls.push(...pageUrls);
            console.log(`Found ${pageUrls.length} product URLs`);

            const nextPageUrl = getNextPageUrl(html, currentUrl);
            
            if (nextPageUrl && nextPageUrl !== currentUrl) {
                currentUrl = nextPageUrl;
                currentPage++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                break;
            }

        } catch (error) {
            console.error(`Error processing page ${currentPage}:`, error.message);
            break;
        }
    }

    const uniqueUrls = [...new Set(allProductUrls)];
    console.log(`\n✓ Total unique product URLs: ${uniqueUrls.length}\n`);

    return uniqueUrls;
};

const scrapeAllProducts = async () => {
    console.log('=== Starting Product Data Extraction ===\n');

    const productUrls = await getAllProductUrls();

    if (productUrls.length === 0) {
        console.log('No product URLs found. Exiting.');
        return [];
    }

    console.log(`=== Extracting Data from ${productUrls.length} Products ===\n`);

    const watchData = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < productUrls.length; i += BATCH_SIZE) {
        const batch = productUrls.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(productUrls.length / BATCH_SIZE);

        console.log(`[Batch ${batchNumber}/${totalBatches}] Processing ${batch.length} products...`);

        const batchPromises = batch.map(async (url, index) => {
            const globalIndex = i + index + 1;
            const productData = await extractProductData(url);

            if (productData) {
                console.log(`  [${globalIndex}/${productUrls.length}] ✓ ${productData.brand} ${productData.model}`);
                return {
                    brand: productData.brand,
                    model: productData.model,
                    referenceNumber: productData.referenceNumber,
                    year: productData.year,
                    price: productData.price,
                    currency: productData.currency,
                    originalBox: productData.originalBox,
                    originalPaper: productData.originalPaper,
                    condition: productData.condition,
                    location: productData.location,
                    images: productData.images,
                    watchUrl: productData.watchUrl
                };
            } else {
                console.log(`  [${globalIndex}/${productUrls.length}] ✗ Failed to extract data`);
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => {
            if (result) watchData.push(result);
        });

        console.log(`  ✓ Batch ${batchNumber} completed (${batchResults.filter(r => r !== null).length}/${batch.length} successful)\n`);

        if (i + BATCH_SIZE < productUrls.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    fs.writeFileSync('watchData.json', JSON.stringify(watchData, null, 2), 'utf-8');
    console.log(`✓ Watch data saved to watchData.json (${watchData.length} watches)`);

        if (config.BACK_END_URL) {
            try {
            await axios.post(config.BACK_END_URL, {
                    parentUrl: config.PARENT_URL,
                    watchData: watchData
                });
                console.log('✓ Watch data posted successfully to backend');
            } catch (error) {
                console.log('⚠ Failed to post to backend:', error.message);
            }
        }

        return watchData;
};

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
});

console.log('=== Daniel de Guy Watch Scraper ===\n');
scrapeAllProducts().then((watchData) => {
    console.log('\n=== Scraping Complete ===');
    console.log(`Total watches scraped: ${watchData.length}`);
    process.exit(0);
}).catch(error => {
    console.error('\n=== Scraping Failed ===', error);
    process.exit(1);
});
