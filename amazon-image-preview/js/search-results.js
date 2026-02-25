/**
 * Search Results Renderer
 *
 * Renders a faithful Amazon search results page with real competitors
 * and the designer's product inserted at a configurable position.
 *
 * Static version: designer images use blob URLs instead of /uploads/ paths.
 */

const SearchResults = {
  /**
   * Render the full search results view.
   * @param {Object} data - { competitors: [], designerProduct: {}, keyword: string, totalResults: string }
   */
  render(data) {
    const { competitors, designerProduct, keyword, totalResults } = data;
    const container = document.getElementById('search-results-container');
    const searchInput = document.getElementById('amz-search-input');
    const resultsText = document.getElementById('results-count-text');

    // Set search bar text
    searchInput.value = keyword;

    // Set results count
    resultsText.innerHTML = totalResults ||
      `1-48 of over 1,000 results for <span class="results-keyword">"${keyword}"</span>`;

    // Build combined product list: insert designer at their chosen position
    const insertPos = Math.min(designerProduct.position - 1, competitors.length);
    const allProducts = [...competitors];
    allProducts.splice(insertPos, 0, { ...designerProduct, isDesigner: true });

    // Build layout wrapper with sidebar + grid
    const layout = document.createElement('div');
    layout.className = 'search-results-layout';

    // Sidebar (desktop only)
    layout.appendChild(this.renderSidebar(keyword));

    // Main results area
    const main = document.createElement('div');
    main.className = 'search-results-main';

    const grid = document.createElement('div');
    grid.className = 'search-grid';

    allProducts.forEach((product, index) => {
      grid.appendChild(this.renderCard(product, index));
    });

    main.appendChild(grid);
    layout.appendChild(main);

    container.innerHTML = '';
    container.appendChild(layout);
  },

  /**
   * Render Amazon-style left sidebar with filter sections.
   */
  renderSidebar(keyword) {
    const sidebar = document.createElement('div');
    sidebar.className = 'search-sidebar';

    const starsHtml4 = ImageProcessor.renderStars(4);
    const starsHtml3 = ImageProcessor.renderStars(3);
    const starsHtml2 = ImageProcessor.renderStars(2);
    const starsHtml1 = ImageProcessor.renderStars(1);

    sidebar.innerHTML = `
      <div class="sidebar-section">
        <div class="sidebar-heading">Popular Shopping Ideas</div>
        <span class="sidebar-link">Sleep</span>
        <span class="sidebar-link">Pain Relief</span>
        <span class="sidebar-link">Leg Cramps</span>
        <span class="sidebar-link">Pure</span>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-heading">Eligible for Free Shipping</div>
        <label class="sidebar-checkbox"><input type="checkbox">Free Shipping by Amazon</label>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-heading">Delivery Day</div>
        <label class="sidebar-checkbox"><input type="checkbox">Get It by Tomorrow</label>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-heading">Customer Reviews</div>
        <div class="sidebar-stars-row">${starsHtml4} & Up</div>
        <div class="sidebar-stars-row">${starsHtml3} & Up</div>
        <div class="sidebar-stars-row">${starsHtml2} & Up</div>
        <div class="sidebar-stars-row">${starsHtml1} & Up</div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-heading">Price</div>
        <span class="sidebar-price-link">Up to $10</span>
        <span class="sidebar-price-link">$10 to $15</span>
        <span class="sidebar-price-link">$15 to $30</span>
        <span class="sidebar-price-link">$30 & above</span>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-heading">Deals & Discounts</div>
        <span class="sidebar-link">All Discounts</span>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-heading">Skin Type</div>
        <label class="sidebar-checkbox"><input type="checkbox">All</label>
        <label class="sidebar-checkbox"><input type="checkbox">Dry</label>
        <label class="sidebar-checkbox"><input type="checkbox">Normal</label>
        <label class="sidebar-checkbox"><input type="checkbox">Combination</label>
        <label class="sidebar-checkbox"><input type="checkbox">Sensitive</label>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-heading">Volume</div>
        <label class="sidebar-checkbox"><input type="checkbox">Up to 2.9 fl. oz.</label>
        <label class="sidebar-checkbox"><input type="checkbox">3.0 to 5.9 fl. oz.</label>
        <label class="sidebar-checkbox"><input type="checkbox">6.0 to 8.9 fl. oz.</label>
        <label class="sidebar-checkbox"><input type="checkbox">9.0 fl. oz. & above</label>
      </div>
    `;

    return sidebar;
  },

  /**
   * Render a single product card.
   * Designer products use blob URLs (trimmedUrl/originalUrl).
   * Competitor products use imageUrl from the scraper.
   */
  renderCard(product, index) {
    const card = document.createElement('div');
    card.className = 'search-card' + (product.isDesigner ? ' designer-card' : '');

    if (product.isDesigner) {
      card.addEventListener('click', () => {
        window.appShowDetail();
      });
    }

    let html = '';

    // Badge
    if (product.badge) {
      const badgeClass = product.badge === 'Overall Pick' ? 'badge-overall-pick'
        : product.badge === 'Best Seller' ? 'badge-best-seller'
        : 'badge-amazons-choice';
      html += `<div class="card-badge ${badgeClass}">${product.badge}</div>`;
    }

    // Image — use trimmedUrl for designer (blob URL), direct URL for competitors
    const imgSrc = product.isDesigner
      ? product.images[0].trimmedUrl
      : product.imageUrl;

    html += `<div class="card-image-wrap"><img src="${imgSrc}" alt="${this.escHtml(product.title)}" loading="lazy"></div>`;

    // Info wrapper (for mobile layout)
    html += '<div class="card-info">';

    // Title — truncate to 200 chars max (CSS line-clamp handles visual truncation)
    const displayTitle = product.title && product.title.length > 200
      ? product.title.substring(0, 200) + '...'
      : product.title;
    html += `<div class="card-title">${this.escHtml(displayTitle)}</div>`;

    // Rating
    if (product.starRating) {
      const starsHtml = ImageProcessor.renderStars(product.starRating);
      const reviewCount = ImageProcessor.formatReviewCount(product.reviewCount);
      html += `<div class="card-rating-row">
        ${starsHtml}
        <span class="card-review-count">${reviewCount}</span>
      </div>`;
    }

    // Monthly purchases — only show if it's short/valid (not scraped junk)
    if (product.monthlyPurchases && product.monthlyPurchases.length < 60) {
      html += `<div class="card-purchases">${this.escHtml(product.monthlyPurchases)}</div>`;
    }

    // Price
    if (product.price) {
      const priceHtml = ImageProcessor.formatPriceHtml(product.price);
      html += `<div class="card-price">${priceHtml}</div>`;
    }

    // Prime badge + delivery with date
    if (product.isPrime) {
      html += `<div class="card-delivery"><span class="prime-badge-inline"></span></div>`;
    }

    // Delivery date: 2 days from now
    const deliveryDate = this.getDeliveryDate(2);
    html += `<div class="card-delivery-date">FREE delivery <span>${deliveryDate}</span></div>`;

    // Mobile: Add to Cart button (non-functional)
    html += '<div class="card-add-to-cart mobile-only">Add to Cart</div>';

    html += '</div>'; // close card-info

    card.innerHTML = html;
    return card;
  },

  /**
   * Get a formatted delivery date N days from now.
   * Returns e.g. "Mon, Mar 2"
   */
  getDeliveryDate(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  },

  escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
};

window.SearchResults = SearchResults;
