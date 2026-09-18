const cartCount = document.querySelector('.cart-count');
let count = Number(cartCount?.textContent || 0);

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

function renderProductCard(product) {
  const image = product.image || product.thumbnail || product.images?.[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80';
  const price = Number(product.price || 0);
  const oldPrice = Number(product.oldPrice || product.originalPrice || product.price || 0);
  const name = product.name || product.title || 'Product Name';

  return `
    <article class="product-card">
      <img src="${image}" alt="${name}" />
      <div class="product-body">
        <span class="product-tag">${product.category || 'Featured'}</span>
        <h3>${name}</h3>
        <p>${product.description || 'High quality item for your daily needs.'}</p>
        <div class="product-meta">
          <div>
            <strong>${currencyFormatter.format(price)}</strong>
            <small>${oldPrice > price ? currencyFormatter.format(oldPrice) : ''}</small>
          </div>
          <button class="add-to-cart btn btn-primary small-btn">Add to Cart</button>
        </div>
      </div>
    </article>
  `;
}

function renderSingleProduct(product) {
  const container = document.getElementById('single-product');
  if (!container) return;

  const image = product.image || product.thumbnail || product.images?.[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80';
  const price = Number(product.price || 0);
  const oldPrice = Number(product.oldPrice || product.originalPrice || product.price || 0);
  const name = product.name || product.title || 'Product Name';

  container.innerHTML = `
    <article class="single-product-card">
      <img src="${image}" alt="${name}" />
      <div class="single-product-body">
        <span class="product-tag">${product.category || 'Featured'}</span>
        <h3>${name}</h3>
        <p class="single-product-description">${product.description || 'High quality item for your daily needs.'}</p>
        <div class="product-meta">
          <div>
            <strong>${currencyFormatter.format(price)}</strong>
            <small>${oldPrice > price ? currencyFormatter.format(oldPrice) : ''}</small>
          </div>
          <button class="add-to-cart btn btn-primary small-btn">Add to Cart</button>
        </div>
      </div>
    </article>
  `;

  bindCartButtons();
}

function bindCartButtons() {
  document.querySelectorAll('.add-to-cart').forEach((button) => {
    button.onclick = () => {
      count += 1;
      if (cartCount) {
        cartCount.textContent = count;
      }

      const oldText = button.textContent;
      button.textContent = 'Added';
      button.classList.remove('btn-primary');
      button.classList.add('added-btn');

      setTimeout(() => {
        button.textContent = oldText;
        button.classList.remove('added-btn');
        button.classList.add('btn-primary');
      }, 900);
    };
  });
}

async function loadSingleProduct(productId = 1) {
  const singleProductContainer = document.getElementById('single-product');
  if (!singleProductContainer) return;

  try {
    const response = await fetch(`https://dummyjson.com/products/${productId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch single product');
    }

    const product = await response.json();
    renderSingleProduct(product);
  } catch (error) {
    console.error('Error loading single product:', error);
    singleProductContainer.innerHTML = '<p class="empty-state">Unable to load product details right now.</p>';
  }
}

async function loadProducts(query = 'phone', skip = 0, limit = 12) {
  const productGrids = document.querySelectorAll('.product-grid');
  if (!productGrids.length) return;

  try {
    const endpoint = query.trim()
      ? `https://dummyjson.com/products/search?q=${encodeURIComponent(query.trim())}&limit=${limit}&skip=${skip}`
      : `https://dummyjson.com/products?limit=${limit}&skip=${skip}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }

    const data = await response.json();
    const products = Array.isArray(data.products) ? data.products : [];

    productGrids.forEach((grid) => {
      const finalLimit = Number(grid.dataset.limit || limit);
      const items = finalLimit > 0 ? products.slice(0, finalLimit) : products;
      grid.innerHTML = items.length
        ? items.map(renderProductCard).join('')
        : '<p class="empty-state">Product not found.</p>';
    });

    bindCartButtons();
  } catch (error) {
    console.error('Error loading products:', error);
    productGrids.forEach((grid) => {
      grid.innerHTML = '<p class="empty-state">Unable to load products right now.</p>';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadProducts('', 0, 12);
  loadSingleProduct(1);

  const searchInput = document.querySelector('.search-box input');
  let searchTimer;
  searchInput?.addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadProducts(event.target.value, 0, 12), 300);
  });
});
