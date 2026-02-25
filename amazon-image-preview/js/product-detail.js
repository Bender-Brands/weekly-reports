/**
 * Product Detail Page Renderer
 *
 * Renders a faithful Amazon PDP with image stack navigation:
 * - Desktop: vertical thumbnail strip + large main image
 * - Mobile: swipeable horizontal carousel with dot indicators
 *
 * Static version: uses blob URLs (originalUrl) instead of /uploads/ paths.
 */

const ProductDetail = {
  currentSlide: 0,
  totalSlides: 0,
  isDragging: false,
  startX: 0,
  currentX: 0,

  /**
   * Render the product detail page for the designer's product.
   * @param {Object} product - { title, price, starRating, reviewCount, images: [{originalUrl, trimmedUrl}] }
   */
  render(product) {
    this.currentSlide = 0;
    this.totalSlides = product.images.length;

    this.renderDesktop(product);
    this.renderMobile(product);
  },

  renderDesktop(product) {
    const thumbsContainer = document.getElementById('pdp-thumbnails');
    const mainImage = document.getElementById('pdp-main-image');
    const title = document.getElementById('pdp-title');
    const ratingNum = document.getElementById('pdp-rating-num');
    const stars = document.getElementById('pdp-stars');
    const reviewCount = document.getElementById('pdp-review-count');
    const purchases = document.getElementById('pdp-purchases');
    const price = document.getElementById('pdp-price');

    // Title
    title.textContent = product.title;

    // Rating
    ratingNum.textContent = product.starRating.toFixed(1);
    stars.innerHTML = ImageProcessor.renderStars(product.starRating);
    reviewCount.textContent = `${ImageProcessor.formatReviewCount(product.reviewCount)} ratings`;

    // Purchases
    purchases.textContent = '';

    // Price
    price.innerHTML = ImageProcessor.formatPriceHtml(product.price);

    // Thumbnails
    thumbsContainer.innerHTML = '';
    product.images.forEach((img, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'pdp-thumb' + (i === 0 ? ' active' : '');
      thumb.innerHTML = `<img src="${img.originalUrl}" alt="Image ${i + 1}">`;
      thumb.addEventListener('mouseenter', () => {
        this.setDesktopImage(product, i);
      });
      thumb.addEventListener('click', () => {
        this.setDesktopImage(product, i);
      });
      thumbsContainer.appendChild(thumb);
    });

    // Main image
    mainImage.src = product.images[0].originalUrl;
  },

  setDesktopImage(product, index) {
    const mainImage = document.getElementById('pdp-main-image');
    mainImage.src = product.images[index].originalUrl;

    // Update active thumbnail
    const thumbs = document.querySelectorAll('.pdp-thumb');
    thumbs.forEach((t, i) => {
      t.classList.toggle('active', i === index);
    });
  },

  renderMobile(product) {
    const title = document.getElementById('pdp-mobile-title');
    const ratingNum = document.getElementById('pdp-mobile-rating-num');
    const stars = document.getElementById('pdp-mobile-stars');
    const reviewCount = document.getElementById('pdp-mobile-review-count');
    const purchases = document.getElementById('pdp-mobile-purchases');
    const price = document.getElementById('pdp-mobile-price');
    const track = document.getElementById('pdp-carousel-track');
    const dotsContainer = document.getElementById('pdp-carousel-dots');

    // Info
    title.textContent = product.title;
    ratingNum.textContent = product.starRating.toFixed(1);
    stars.innerHTML = ImageProcessor.renderStars(product.starRating);
    reviewCount.textContent = `(${ImageProcessor.formatReviewCount(product.reviewCount)})`;
    purchases.textContent = '';
    price.innerHTML = ImageProcessor.formatPriceHtml(product.price);

    // Carousel slides
    track.innerHTML = '';
    product.images.forEach((img) => {
      const slide = document.createElement('div');
      slide.className = 'pdp-carousel-slide';
      slide.innerHTML = `<img src="${img.originalUrl}" alt="Product">`;
      track.appendChild(slide);
    });

    // Dots
    dotsContainer.innerHTML = '';
    product.images.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'pdp-carousel-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => this.goToSlide(i));
      dotsContainer.appendChild(dot);
    });

    // Reset position
    this.currentSlide = 0;
    track.style.transform = 'translateX(0)';

    // Touch/swipe handling
    this.setupCarouselSwipe();
  },

  setupCarouselSwipe() {
    const track = document.getElementById('pdp-carousel-track');
    if (!track) return;

    // Remove old listeners by replacing node
    const newTrack = track.cloneNode(true);
    track.parentNode.replaceChild(newTrack, track);

    // Re-bind dot click listeners
    const dots = document.querySelectorAll('#pdp-carousel-dots .pdp-carousel-dot');
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => this.goToSlide(i));
    });

    newTrack.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.startX = e.clientX;
      newTrack.style.transition = 'none';
      newTrack.setPointerCapture(e.pointerId);
    });

    newTrack.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      this.currentX = e.clientX;
      const diff = this.currentX - this.startX;
      newTrack.style.transform = `translateX(calc(-${this.currentSlide * 100}% + ${diff}px))`;
    });

    newTrack.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      const diff = e.clientX - this.startX;

      if (Math.abs(diff) > 50) {
        if (diff > 0 && this.currentSlide > 0) {
          this.currentSlide--;
        } else if (diff < 0 && this.currentSlide < this.totalSlides - 1) {
          this.currentSlide++;
        }
      }

      newTrack.style.transition = 'transform 0.3s ease';
      newTrack.style.transform = `translateX(-${this.currentSlide * 100}%)`;
      this.updateDots();
    });

    newTrack.addEventListener('pointercancel', () => {
      this.isDragging = false;
      newTrack.style.transition = 'transform 0.3s ease';
      newTrack.style.transform = `translateX(-${this.currentSlide * 100}%)`;
    });
  },

  goToSlide(index) {
    this.currentSlide = index;
    const track = document.getElementById('pdp-carousel-track');
    if (track) {
      track.style.transition = 'transform 0.3s ease';
      track.style.transform = `translateX(-${index * 100}%)`;
    }
    this.updateDots();
  },

  updateDots() {
    const dots = document.querySelectorAll('#pdp-carousel-dots .pdp-carousel-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === this.currentSlide);
    });
  },
};

window.ProductDetail = ProductDetail;
