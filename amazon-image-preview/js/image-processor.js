/**
 * Image Processor — White background detection and star rating rendering
 */

const ImageProcessor = {
  /**
   * Generate HTML for star rating display.
   * Supports full, half, and empty stars.
   */
  renderStars(rating) {
    // Round to nearest 0.5 for the graphic (e.g. 4.3 -> 4.5, 4.8 -> 5.0)
    const rounded = Math.round(rating * 2) / 2;
    const fullStars = Math.floor(rounded);
    const hasHalf = rounded - fullStars === 0.5;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    let html = '<span class="stars-inline">';

    const fullStar = `<span class="star-icon"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 0l2.5 5 5.5.8-4 3.9.9 5.3L8 12.5 3.1 15l.9-5.3-4-3.9L5.5 5z" fill="#DE7921"/></svg></span>`;
    const halfStar = `<span class="star-icon"><svg viewBox="0 0 16 16" width="16" height="16"><defs><linearGradient id="half"><stop offset="50%" stop-color="#DE7921"/><stop offset="50%" stop-color="#E3E6E6"/></linearGradient></defs><path d="M8 0l2.5 5 5.5.8-4 3.9.9 5.3L8 12.5 3.1 15l.9-5.3-4-3.9L5.5 5z" fill="url(#half)"/></svg></span>`;
    const emptyStar = `<span class="star-icon"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 0l2.5 5 5.5.8-4 3.9.9 5.3L8 12.5 3.1 15l.9-5.3-4-3.9L5.5 5z" fill="#E3E6E6"/></svg></span>`;

    for (let i = 0; i < fullStars; i++) html += fullStar;
    if (hasHalf) html += halfStar;
    for (let i = 0; i < emptyStars; i++) html += emptyStar;

    html += '</span>';
    return html;
  },

  /**
   * Format a numeric price into Amazon-style HTML.
   * "$9.99" -> <span class="price-symbol">$</span><span class="price-whole">9</span><span class="price-fraction">99</span>
   */
  formatPriceHtml(priceStr) {
    // Handle both "$9.99" string and 9.99 number
    let num;
    if (typeof priceStr === 'string') {
      num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    } else {
      num = priceStr;
    }

    if (isNaN(num) || num <= 0) return '<span class="price-whole">-</span>';

    const whole = Math.floor(num);
    const fraction = Math.round((num - whole) * 100).toString().padStart(2, '0');

    return `<span class="price-symbol">$</span><span class="price-whole">${whole.toLocaleString()}</span><span class="price-fraction">${fraction}</span>`;
  },

  /**
   * Format review count with commas and parentheses.
   */
  formatReviewCount(count) {
    if (!count) return '';
    const num = typeof count === 'string' ? parseInt(count.replace(/,/g, ''), 10) : count;
    if (isNaN(num)) return count;
    return num.toLocaleString();
  },

  /**
   * Trim white borders from an image using Canvas API.
   * Returns a blob URL of the trimmed image.
   */
  trimWhitespace(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;

        // Threshold: pixels with all channels above 235 are considered "white"
        // (matches Sharp trim threshold: 20, i.e. 255-20=235)
        const threshold = 235;

        let top = height, left = width, right = 0, bottom = 0;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

            // If pixel is not near-white and not fully transparent
            if (a > 10 && (r < threshold || g < threshold || b < threshold)) {
              if (x < left) left = x;
              if (x > right) right = x;
              if (y < top) top = y;
              if (y > bottom) bottom = y;
            }
          }
        }

        // If no non-white pixels found, return original
        if (right <= left || bottom <= top) {
          resolve(URL.createObjectURL(file));
          return;
        }

        // Add small padding
        const pad = 2;
        left = Math.max(0, left - pad);
        top = Math.max(0, top - pad);
        right = Math.min(width - 1, right + pad);
        bottom = Math.min(height - 1, bottom + pad);

        const trimW = right - left + 1;
        const trimH = bottom - top + 1;

        const trimCanvas = document.createElement('canvas');
        trimCanvas.width = trimW;
        trimCanvas.height = trimH;
        const trimCtx = trimCanvas.getContext('2d');
        trimCtx.drawImage(img, left, top, trimW, trimH, 0, 0, trimW, trimH);

        trimCanvas.toBlob((blob) => {
          resolve(URL.createObjectURL(blob));
        }, 'image/png');
      };

      img.onerror = () => {
        // On error, just use the original file
        resolve(URL.createObjectURL(file));
      };

      img.src = URL.createObjectURL(file);
    });
  },
};

// Expose globally
window.ImageProcessor = ImageProcessor;
