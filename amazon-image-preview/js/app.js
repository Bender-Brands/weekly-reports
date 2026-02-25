/**
 * App Controller — SPA State Machine (Static / GitHub Pages Version)
 *
 * States: input -> loading -> search -> detail
 * Mode: desktop | mobile (toggle)
 *
 * Key differences from server version:
 * - Image processing done client-side via Canvas API (no Express/Sharp)
 * - Apify scraping called directly from browser (no proxy server)
 * - API token stored in localStorage
 */

const APIFY_BASE = 'https://api.apify.com/v2';
const WEB_SCRAPER_ACTOR = 'apify/web-scraper';
const RUN_TIMEOUT_MS = 3 * 60 * 1000;
const POLL_INTERVAL_MS = 5000;
const MAX_RETRIES = 2;

const App = {
  state: {
    view: 'input',
    mode: 'desktop',
    competitors: [],
    designerProduct: null,
    processedImages: [], // { originalUrl, trimmedUrl } blob URLs
    selectedFiles: [],
    keyword: '',
    totalResults: '',
    // Modal state
    modalFiles: [],
  },

  init() {
    this.setupDropZone();
    this.setupFileInput();
    this.updateSubmitButton();
    this.setupModal();
    this.loadSavedToken();
  },

  // ============ TOKEN MANAGEMENT ============

  loadSavedToken() {
    const saved = localStorage.getItem('apify_token');
    if (saved) {
      document.getElementById('apify-token').value = saved;
    }
  },

  saveToken(token) {
    localStorage.setItem('apify_token', token);
  },

  getToken() {
    return document.getElementById('apify-token').value.trim();
  },

  // ============ VIEW MANAGEMENT ============

  setView(view) {
    this.state.view = view;
    document.body.className = `view-${view} mode-${this.state.mode}`;

    // Show/hide back button
    const backBtn = document.getElementById('btn-back');
    if (view === 'search' || view === 'detail') {
      backBtn.classList.remove('hidden');
    } else {
      backBtn.classList.add('hidden');
    }

    // Show/hide update images button
    const updateBtn = document.getElementById('btn-update-images');
    if ((view === 'search' || view === 'detail') && this.state.designerProduct) {
      updateBtn.classList.remove('hidden');
    } else {
      updateBtn.classList.add('hidden');
    }
  },

  setMode(mode) {
    this.state.mode = mode;
    document.body.className = `view-${this.state.view} mode-${mode}`;

    // Update toggle buttons
    document.getElementById('btn-desktop').classList.toggle('active', mode === 'desktop');
    document.getElementById('btn-mobile').classList.toggle('active', mode === 'mobile');
  },

  goBack() {
    if (this.state.view === 'detail') {
      this.setView('search');
    } else if (this.state.view === 'search') {
      this.setView('input');
    }
  },

  // ============ FILE HANDLING ============

  setupDropZone() {
    const zone = document.getElementById('drop-zone');

    zone.addEventListener('click', (e) => {
      if (e.target.closest('.browse-link')) return;
      document.getElementById('image-input').click();
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
      );
      this.addFiles(files);
    });
  },

  setupFileInput() {
    document.getElementById('image-input').addEventListener('change', (e) => {
      this.addFiles(Array.from(e.target.files));
      e.target.value = '';
    });
  },

  addFiles(files) {
    const remaining = 9 - this.state.selectedFiles.length;
    const toAdd = files.slice(0, remaining);
    this.state.selectedFiles.push(...toAdd);
    this.renderImagePreviews();
    this.updateSubmitButton();
  },

  removeFile(index) {
    this.state.selectedFiles.splice(index, 1);
    this.renderImagePreviews();
    this.updateSubmitButton();
  },

  renderImagePreviews() {
    const container = document.getElementById('image-previews');
    container.innerHTML = '';

    this.state.selectedFiles.forEach((file, i) => {
      const item = document.createElement('div');
      item.className = 'image-preview-item';

      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      item.appendChild(img);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '\u00D7';
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFile(i);
      });
      item.appendChild(removeBtn);

      if (i === 0) {
        const label = document.createElement('div');
        label.className = 'img-label';
        label.textContent = 'MAIN';
        item.appendChild(label);
      }

      container.appendChild(item);
    });
  },

  updateSubmitButton() {
    const btn = document.getElementById('submit-btn');
    const token = document.getElementById('apify-token').value.trim();
    const keyword = document.getElementById('keyword').value.trim();
    const title = document.getElementById('product-title').value.trim();
    const price = document.getElementById('product-price').value;
    const hasImages = this.state.selectedFiles.length > 0;

    btn.disabled = !(token && keyword && title && price && hasImages);
  },

  // ============ CLIENT-SIDE IMAGE PROCESSING ============

  async processImages(files) {
    const results = [];
    for (const file of files) {
      const originalUrl = URL.createObjectURL(file);
      const trimmedUrl = await ImageProcessor.trimWhitespace(file);
      results.push({ originalUrl, trimmedUrl });
    }
    return results;
  },

  // ============ APIFY SCRAPING (direct from browser) ============

  async scrapeAmazon(keyword, apiToken) {
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;

    const PAGE_FUNCTION = `
      async function pageFunction(context) {
        var $ = context.jQuery;
        var log = context.log;

        var found = false;
        for (var wait = 0; wait < 30; wait++) {
          if ($('[data-component-type="s-search-result"]').length > 0) { found = true; break; }
          if ($('[data-asin]').length > 3) { found = true; break; }
          if ($('.s-result-item').length > 0) { found = true; break; }
          await new Promise(function(r) { setTimeout(r, 500); });
        }

        if (!found) {
          return { results: [], totalResults: '' };
        }

        var results = [];
        var position = 0;

        var resultEls = $('[data-component-type="s-search-result"]');
        if (resultEls.length === 0) {
          resultEls = $('[data-asin]').filter(function() {
            var asin = $(this).attr('data-asin');
            return asin && asin.length >= 5 && $(this).find('img').length > 0;
          });
        }

        resultEls.each(function () {
          var el = $(this);

          var isSponsored = false;
          el.find('span').each(function() {
            var t = $(this).text().trim().toLowerCase();
            if (t === 'sponsored') isSponsored = true;
          });
          if (isSponsored) return;

          var asin = el.attr('data-asin');
          if (!asin || asin.length < 5) return;

          position++;
          if (position > 12) return false;

          var title = '';
          var titleSelectors = ['h2 a span', 'h2 span.a-text-normal', 'h2 span', '.a-link-normal .a-text-normal', 'h2'];
          for (var si = 0; si < titleSelectors.length; si++) {
            title = el.find(titleSelectors[si]).first().text().trim();
            if (title) break;
          }
          if (!title) return;

          var price = '';
          var priceValue = 0;
          var offscreenEls = el.find('.a-price .a-offscreen');
          for (var pi = 0; pi < offscreenEls.length; pi++) {
            var pt = $(offscreenEls[pi]).text().trim();
            var pm = pt.match(/^\\$(\\d[\\d,]*)\\.(\\d{2})$/);
            if (pm) {
              price = '$' + pm[1].replace(/,/g, '') + '.' + pm[2];
              priceValue = parseFloat(pm[1].replace(/,/g, '') + '.' + pm[2]);
              break;
            }
          }

          var starRating = 0;
          var ratingText = el.find('[class*="a-icon-star"] .a-icon-alt, .a-icon-alt').first().text();
          var ratingMatch = ratingText.match(/([\\d.]+)\\s+out/);
          if (ratingMatch) starRating = parseFloat(ratingMatch[1]);

          var reviewCount = '';
          el.find('a[href*="customerReviews"] span, a[href*="reviews"] span, .a-size-base').each(function() {
            var t = $(this).text().trim();
            if (t.length < 15 && /^[\\(]?[\\d,.]+[K]?[\\)]?$/.test(t)) {
              reviewCount = t.replace(/[()]/g, '');
              return false;
            }
          });

          var imageUrl = el.find('img.s-image').attr('src') || el.find('img[data-image-latency]').attr('src') || '';

          var hasPrimeText = el.html() || '';
          var isPrime = el.find('[class*="prime"], .a-icon-prime').length > 0 || hasPrimeText.includes('a-icon-prime');

          var deliveryText = '';
          el.find('.a-text-bold').each(function() {
            var t = $(this).text().trim();
            if (t.match(/delivery|arrives|get it/i)) { deliveryText = t; return false; }
          });

          var monthlyPurchases = '';
          el.find('span.a-size-base').each(function() {
            var t = $(this).text().trim();
            if (t.length < 50 && t.toLowerCase().includes('bought in past')) {
              monthlyPurchases = t;
              return false;
            }
          });

          var badge = null;
          var fullText = el.text();
          if (fullText.includes('Overall Pick')) badge = 'Overall Pick';
          else if (fullText.includes('Best Seller')) badge = 'Best Seller';
          else if (fullText.includes("Amazon's Choice")) badge = "Amazon's Choice";

          results.push({
            asin: asin, title: title, price: price, priceValue: priceValue,
            starRating: starRating, reviewCount: reviewCount, imageUrl: imageUrl,
            isPrime: isPrime, deliveryText: deliveryText, monthlyPurchases: monthlyPurchases,
            badge: badge, position: position
          });
        });

        var totalResults = $('h1 .a-color-state, .a-section h1, [data-component-type="s-result-info-bar"]').first().text().trim();
        return { results: results, totalResults: totalResults || '' };
      }
    `;

    const input = {
      startUrls: [{ url: searchUrl }],
      pageFunction: PAGE_FUNCTION,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
      maxConcurrency: 1,
      maxRequestRetries: 3,
      pageLoadTimeoutSecs: 60,
      runMode: 'PRODUCTION',
    };

    let lastError = '';

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        // Start the Apify run
        const runResponse = await fetch(
          `${APIFY_BASE}/acts/${encodeURIComponent(WEB_SCRAPER_ACTOR)}/runs?token=${apiToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );

        if (!runResponse.ok) {
          const errText = await runResponse.text();
          lastError = `Apify run start failed (${runResponse.status}): ${errText}`;
          continue;
        }

        const runData = await runResponse.json();
        const runId = runData.data?.id;
        if (!runId) {
          lastError = 'Apify run returned no ID';
          continue;
        }

        // Poll for completion
        const deadline = Date.now() + RUN_TIMEOUT_MS;
        let status = '';

        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

          const statusResponse = await fetch(
            `${APIFY_BASE}/actor-runs/${runId}?token=${apiToken}`
          );
          if (!statusResponse.ok) continue;

          const statusData = await statusResponse.json();
          status = statusData.data?.status ?? '';

          if (status === 'SUCCEEDED') break;
          if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
            lastError = `Apify run ${status}`;
            break;
          }
        }

        if (status !== 'SUCCEEDED') {
          if (!lastError) lastError = 'Apify run timed out';
          continue;
        }

        // Fetch results from dataset
        const datasetId = runData.data?.defaultDatasetId;
        if (!datasetId) {
          lastError = 'No dataset ID';
          continue;
        }

        const dataResponse = await fetch(
          `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiToken}`
        );
        if (!dataResponse.ok) {
          lastError = `Failed to fetch results (${dataResponse.status})`;
          continue;
        }

        const rawItems = await dataResponse.json();

        // Handle Apify #error dataset format
        if (rawItems.length > 0 && rawItems[0]?.['#error']) {
          lastError = 'Proxy or navigation error';
          continue;
        }

        const pageResult = rawItems[0];
        if (!pageResult?.results?.length) {
          lastError = 'No results extracted from Amazon search page';
          continue;
        }

        // Take top 10 with valid data
        const competitors = pageResult.results
          .filter(r => r.title && r.imageUrl)
          .slice(0, 10);

        return {
          success: true,
          competitors,
          keyword,
          totalResults: pageResult.totalResults || `Results for "${keyword}"`,
        };
      } catch (err) {
        lastError = err.message;
      }

      // Wait before retry
      if (attempt <= MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    return { success: false, competitors: [], keyword, totalResults: '', error: lastError };
  },

  // ============ FORM SUBMISSION ============

  async submit(e) {
    e.preventDefault();

    const apiToken = this.getToken();
    const keyword = document.getElementById('keyword').value.trim();
    const title = document.getElementById('product-title').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    const starRating = parseFloat(document.getElementById('star-rating').value) || 4.3;
    const reviewCount = parseInt(document.getElementById('review-count').value) || 127;
    const position = parseInt(document.getElementById('position').value) || 4;

    if (!apiToken || !keyword || !title || !price || this.state.selectedFiles.length === 0) return;

    // Save token for future use
    this.saveToken(apiToken);

    this.setView('loading');
    const statusEl = document.getElementById('loading-status');
    statusEl.textContent = 'Processing images...';

    try {
      // Step 1: Process images client-side (Canvas trim)
      this.state.processedImages = await this.processImages(this.state.selectedFiles);

      statusEl.textContent = 'Scraping Amazon search results... (30-60 seconds)';

      // Step 2: Scrape Amazon via Apify API directly
      const scrapeData = await this.scrapeAmazon(keyword, apiToken);

      if (!scrapeData.success) {
        throw new Error(scrapeData.error || 'Scrape failed');
      }

      // Store data
      this.state.competitors = scrapeData.competitors;
      this.state.keyword = keyword;
      this.state.totalResults = scrapeData.totalResults;

      this.state.designerProduct = {
        title,
        price: `$${price.toFixed(2)}`,
        priceValue: price,
        starRating,
        reviewCount: reviewCount.toString(),
        images: this.state.processedImages,
        isPrime: true,
        deliveryText: '',
        monthlyPurchases: '',
        badge: null,
        position,
        isDesigner: true,
      };

      // Render search results
      SearchResults.render({
        competitors: this.state.competitors,
        designerProduct: this.state.designerProduct,
        keyword: this.state.keyword,
        totalResults: scrapeData.totalResults,
      });

      this.setView('search');
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}. Check console for details.`;
      console.error('Preview error:', err);
      setTimeout(() => {
        if (this.state.view === 'loading') {
          statusEl.innerHTML += '<br><br><button onclick="window.appSetView(\'input\')" style="padding:8px 20px;background:#ffd814;border:1px solid #fcd200;border-radius:8px;cursor:pointer;font-size:14px;">Try Again</button>';
        }
      }, 1000);
    }
  },

  // ============ IMAGE UPDATE MODAL ============

  setupModal() {
    const zone = document.getElementById('modal-drop-zone');
    const input = document.getElementById('modal-image-input');
    const overlay = document.getElementById('image-modal-overlay');

    zone.addEventListener('click', (e) => {
      if (e.target.closest('.browse-link')) return;
      input.click();
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
      );
      this.addModalFiles(files);
    });

    input.addEventListener('change', (e) => {
      this.addModalFiles(Array.from(e.target.files));
      e.target.value = '';
    });

    // Close on overlay click (outside modal)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeImageModal();
    });
  },

  addModalFiles(files) {
    const remaining = 9 - this.state.modalFiles.length;
    const toAdd = files.slice(0, remaining);
    this.state.modalFiles.push(...toAdd);
    this.renderModalPreviews();
    this.updateModalSubmitButton();
  },

  removeModalFile(index) {
    this.state.modalFiles.splice(index, 1);
    this.renderModalPreviews();
    this.updateModalSubmitButton();
  },

  renderModalPreviews() {
    const container = document.getElementById('modal-image-previews');
    container.innerHTML = '';

    this.state.modalFiles.forEach((file, i) => {
      const item = document.createElement('div');
      item.className = 'image-preview-item';

      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      item.appendChild(img);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '\u00D7';
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeModalFile(i);
      });
      item.appendChild(removeBtn);

      if (i === 0) {
        const label = document.createElement('div');
        label.className = 'img-label';
        label.textContent = 'MAIN';
        item.appendChild(label);
      }

      container.appendChild(item);
    });
  },

  updateModalSubmitButton() {
    const btn = document.getElementById('modal-submit-btn');
    btn.disabled = this.state.modalFiles.length === 0;
  },

  openImageModal() {
    this.state.modalFiles = [];
    this.renderModalPreviews();
    this.updateModalSubmitButton();
    document.getElementById('image-modal-overlay').classList.remove('hidden');
  },

  closeImageModal() {
    document.getElementById('image-modal-overlay').classList.add('hidden');
    this.state.modalFiles = [];
  },

  async submitImageUpdate() {
    if (this.state.modalFiles.length === 0) return;

    const submitBtn = document.getElementById('modal-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
      // Process images client-side
      const newImages = await this.processImages(this.state.modalFiles);

      // Update designer product images
      this.state.processedImages = newImages;
      this.state.designerProduct.images = newImages;

      // Re-render search results with new images, same competitors
      SearchResults.render({
        competitors: this.state.competitors,
        designerProduct: this.state.designerProduct,
        keyword: this.state.keyword,
        totalResults: this.state.totalResults,
      });

      // If currently on PDP, re-render that too
      if (this.state.view === 'detail') {
        ProductDetail.render(this.state.designerProduct);
      }

      this.closeImageModal();
    } catch (err) {
      console.error('Image update error:', err);
      submitBtn.textContent = 'Processing failed — try again';
      submitBtn.disabled = false;
      return;
    }

    submitBtn.textContent = 'Update Images';
    submitBtn.disabled = false;
  },

  showDetail() {
    if (!this.state.designerProduct) return;
    ProductDetail.render(this.state.designerProduct);
    this.setView('detail');
  },
};

// ============ GLOBAL BINDINGS ============

window.appSubmit = (e) => App.submit(e);
window.appSetMode = (mode) => App.setMode(mode);
window.appGoBack = () => App.goBack();
window.appShowDetail = () => App.showDetail();
window.appSetView = (view) => App.setView(view);
window.appOpenImageModal = () => App.openImageModal();
window.appCloseImageModal = () => App.closeImageModal();
window.appSubmitImageUpdate = () => App.submitImageUpdate();

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Live validation on form fields
  ['apify-token', 'keyword', 'product-title', 'product-price'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => App.updateSubmitButton());
  });
});
