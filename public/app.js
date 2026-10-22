'use strict';

(() => {
  const CURRENCY = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const FLAGS = {
    Argentina: '🇦🇷', Brazil: '🇧🇷', France: '🇫🇷', Japan: '🇯🇵', Mexico: '🇲🇽',
    Portugal: '🇵🇹', USA: '🇺🇸', Germany: '🇩🇪', Spain: '🇪🇸', Netherlands: '🇳🇱',
    Morocco: '🇲🇦', England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
  };
  const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
  const state = { products: [], category: 'All', search: '', sort: 'featured', cart: [], shippingFee: 99, freeShippingThreshold: 2999, busy: false };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const els = {
    grid: $('#productGrid'), empty: $('#emptyState'), allCount: $('#allCount'), resultsNote: $('#resultsNote'),
    cartCount: $('#cartCount'), drawerCount: $('#drawerCount'), overlay: $('#overlay'), drawer: $('#cartDrawer'),
    cartItems: $('#cartItems'), drawerFooter: $('#drawerFooter'), shippingMessage: $('#shippingMessage'),
    shippingAmount: $('#shippingProgressAmount'), progressBar: $('#progressBar'), subtotal: $('#cartSubtotal'),
    shipping: $('#cartShipping'), total: $('#cartTotal'), checkoutTotal: $('#checkoutTotal'), checkoutModal: $('#checkoutModal'),
    checkoutForm: $('#checkoutForm'), checkoutError: $('#checkoutError'), placeOrder: $('#placeOrderButton'),
    orderSuccess: $('#orderSuccess'), successMessage: $('#successMessage'), successOrderId: $('#successOrderId'), toast: $('#toast'),
    search: $('#productSearch'), clearSearch: $('#clearSearch'), searchBox: $('#searchBox'), newsletterForm: $('#newsletterForm'),
    newsletterMessage: $('#newsletterMessage')
  };
  let toastTimer;

  function money(value) { return CURRENCY.format(Number(value) || 0); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
  }
  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem('matchday-cart') || '[]');
      if (Array.isArray(saved)) {
        state.cart = saved.filter(item => state.products.some(p => p.id === item.id) && SIZES.includes(item.size) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 10);
      }
    } catch { state.cart = []; }
  }
  function saveCart() {
    try { localStorage.setItem('matchday-cart', JSON.stringify(state.cart)); } catch { /* Storage can be unavailable in private browsing. */ }
  }
  function filteredProducts() {
    const query = state.search.trim().toLowerCase();
    let list = state.products.filter(product => {
      const categoryMatch = state.category === 'All' || product.category === state.category;
      const queryMatch = !query || `${product.name} ${product.team} ${product.edition} ${product.description}`.toLowerCase().includes(query);
      return categoryMatch && queryMatch;
    });
    if (state.sort === 'price-low') list = [...list].sort((a, b) => a.price - b.price);
    else if (state.sort === 'price-high') list = [...list].sort((a, b) => b.price - a.price);
    else if (state.sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);
    else list = [...list].sort((a, b) => Number(b.featured) - Number(a.featured) || state.products.indexOf(a) - state.products.indexOf(b));
    return list;
  }
  function renderProducts() {
    const list = filteredProducts();
    els.allCount.textContent = state.products.length;
    els.resultsNote.textContent = `Showing ${list.length} ${list.length === 1 ? 'jersey' : 'jerseys'}${state.category !== 'All' ? ` · ${state.category.toLowerCase()} kits` : ''}${state.search ? ` · matching “${state.search}”` : ''}`;
    els.grid.innerHTML = list.map((p, index) => {
      const badgeClass = /LIMITED|NEW|HOST/.test(p.badge) ? 'badge-orange' : '';
      return `<article class="product-card" data-product-id="${escapeHtml(p.id)}">
        <div class="product-art">
          <span class="product-badge ${badgeClass}">${escapeHtml(p.badge)}</span>
          <button type="button" class="quick-view" data-quick-view="${escapeHtml(p.id)}" aria-label="View details for ${escapeHtml(p.name)}" title="Product details">↗</button>
          <img src="${escapeHtml(p.image)}" alt="Illustrated ${escapeHtml(p.team)}-inspired fan jersey" loading="${index > 3 ? 'lazy' : 'eager'}" width="320" height="350">
        </div>
        <div class="product-info">
          <div class="product-team-row"><div class="product-team"><span class="country-flag" aria-hidden="true">${FLAGS[p.team] || '⚽'}</span><span>${escapeHtml(p.team)}</span></div><div class="product-rating"><span>★</span> ${Number(p.rating).toFixed(1)} (${escapeHtml(p.reviews)})</div></div>
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          <div class="product-edition">${escapeHtml(p.edition)} · Fan edition</div>
          <div class="product-price-row"><strong class="product-price">${money(p.price)}</strong>${p.compareAt > p.price ? `<span class="product-compare">${money(p.compareAt)}</span>` : ''}</div>
          <div class="product-bottom"><label class="sr-only" for="size-${escapeHtml(p.id)}">Select size for ${escapeHtml(p.team)}</label><select class="size-select" id="size-${escapeHtml(p.id)}" data-size-select="${escapeHtml(p.id)}" aria-label="Select size for ${escapeHtml(p.team)}">${SIZES.map(size => `<option value="${size}" ${size === 'M' ? 'selected' : ''}>Size: ${size}</option>`).join('')}</select><button class="add-button" type="button" data-add="${escapeHtml(p.id)}"><span>+</span> ADD TO BAG</button></div>
          <div class="color-swatches" aria-label="Jersey colour palette">${(p.colors || []).map(color => `<span class="color-swatch" style="background:${escapeHtml(color)}" title="Colour detail"></span>`).join('')}</div>
        </div>
      </article>`;
    }).join('');
    els.empty.hidden = list.length > 0;
    els.grid.hidden = list.length === 0;
  }
  function cartSummary() {
    const quantity = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.cart.reduce((sum, item) => {
      const product = state.products.find(p => p.id === item.id);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
    const shipping = subtotal === 0 || subtotal >= state.freeShippingThreshold ? 0 : state.shippingFee;
    return { quantity, subtotal, shipping, total: subtotal + shipping };
  }
  function renderCart() {
    const summary = cartSummary();
    els.cartCount.textContent = summary.quantity > 99 ? '99+' : String(summary.quantity);
    els.drawerCount.textContent = `(${summary.quantity})`;
    const remaining = Math.max(0, state.freeShippingThreshold - summary.subtotal);
    els.shippingMessage.textContent = summary.subtotal === 0 ? 'Add jerseys to unlock free shipping.' : remaining === 0 ? 'You unlocked free shipping. Nice pick!' : `You're ${money(remaining)} away from free shipping.`;
    els.shippingAmount.textContent = remaining === 0 ? 'UNLOCKED' : money(state.freeShippingThreshold);
    els.progressBar.style.width = `${Math.min(100, (summary.subtotal / state.freeShippingThreshold) * 100)}%`;
    if (!state.cart.length) {
      els.cartItems.innerHTML = `<div class="cart-empty"><span class="empty-bag-icon">□</span><h3>Your bag is waiting.</h3><p>Pick the colours you'll be cheering in.</p><button class="button button-dark" id="continueShopping" type="button">Explore jerseys</button></div>`;
      els.drawerFooter.hidden = true;
      $('#continueShopping', els.cartItems).addEventListener('click', closeCart);
      return;
    }
    els.cartItems.innerHTML = state.cart.map(item => {
      const p = state.products.find(product => product.id === item.id);
      if (!p) return '';
      return `<article class="cart-line"><div class="cart-line-image"><img src="${escapeHtml(p.image)}" alt="" loading="lazy"></div><div class="cart-line-details"><div class="cart-line-team">${FLAGS[p.team] || '⚽'} ${escapeHtml(p.team.toUpperCase())}</div><div class="cart-line-name">${escapeHtml(p.name)}</div><div class="cart-line-meta">Size ${escapeHtml(item.size)} · ${money(p.price)} each</div><div class="qty-control" aria-label="Quantity for ${escapeHtml(p.name)}"><button type="button" data-qty="${escapeHtml(item.id)}|${item.size}|-1" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-qty="${escapeHtml(item.id)}|${item.size}|1" aria-label="Increase quantity" ${item.quantity >= 10 ? 'disabled' : ''}>+</button></div></div><div><div class="cart-line-price">${money(p.price * item.quantity)}</div><button class="cart-remove" type="button" data-remove="${escapeHtml(item.id)}|${item.size}">Remove</button></div></article>`;
    }).join('');
    els.drawerFooter.hidden = false;
    els.subtotal.textContent = money(summary.subtotal);
    els.shipping.textContent = summary.shipping === 0 ? 'FREE' : money(summary.shipping);
    els.total.textContent = money(summary.total);
    els.checkoutTotal.textContent = money(summary.total);
  }
  function addToCart(productId, size) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    const current = state.cart.find(item => item.id === productId && item.size === size);
    if (current) {
      if (current.quantity >= 10) return showToast('Maximum quantity is 10 per size.');
      current.quantity += 1;
    } else state.cart.push({ id: productId, size, quantity: 1 });
    saveCart(); renderCart();
    const button = $(`[data-add="${CSS.escape(productId)}"]`);
    if (button) {
      const oldContent = button.innerHTML;
      button.classList.add('added'); button.innerHTML = '<span>✓</span> ADDED';
      setTimeout(() => { if (button.isConnected) { button.classList.remove('added'); button.innerHTML = oldContent; } }, 850);
    }
    showToast(`${product.team} jersey added to your bag.`);
  }
  function openCart() {
    els.overlay.hidden = false;
    els.drawer.classList.add('open');
    els.drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    $('#closeCart').focus();
  }
  function closeCart() {
    els.drawer.classList.remove('open');
    els.drawer.setAttribute('aria-hidden', 'true');
    els.overlay.hidden = true;
    document.body.classList.remove('no-scroll');
  }
  function openCheckout() {
    if (!state.cart.length) return showToast('Your bag is empty. Add a jersey first.');
    closeCart();
    els.checkoutModal.hidden = false;
    els.checkoutForm.hidden = false;
    els.orderSuccess.hidden = true;
    els.checkoutError.hidden = true;
    els.checkoutTotal.textContent = money(cartSummary().total);
    document.body.classList.add('no-scroll');
    setTimeout(() => $('input[name="name"]', els.checkoutForm).focus(), 20);
  }
  function closeCheckout() {
    els.checkoutModal.hidden = true;
    document.body.classList.remove('no-scroll');
  }
  async function loadProducts() {
    try {
      const response = await fetch('/api/products', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Store service did not respond.');
      const data = await response.json();
      if (!Array.isArray(data.products)) throw new Error('Product list was unavailable.');
      state.products = data.products;
      state.shippingFee = Number(data.shippingFee) || 99;
      state.freeShippingThreshold = Number(data.freeShippingThreshold) || 2999;
      loadCart(); renderProducts(); renderCart();
    } catch (error) {
      els.grid.innerHTML = `<div class="loading-state"><strong>Store connection unavailable.</strong><br>Start the site with <code>npm start</code> or <code>docker compose up --build</code>, then refresh this page.</div>`;
      els.allCount.textContent = '—';
      console.error(error);
    }
  }

  els.grid.addEventListener('click', event => {
    const addButton = event.target.closest('[data-add]');
    if (addButton) {
      const id = addButton.getAttribute('data-add');
      const select = $(`[data-size-select="${CSS.escape(id)}"]`);
      addToCart(id, select ? select.value : 'M');
      return;
    }
    const quickView = event.target.closest('[data-quick-view]');
    if (quickView) {
      const product = state.products.find(p => p.id === quickView.getAttribute('data-quick-view'));
      if (product) showToast(`${product.team}: ${product.description}`);
    }
  });
  $$('.category-tab').forEach(button => button.addEventListener('click', () => {
    state.category = button.dataset.category || 'All';
    $$('.category-tab').forEach(tab => { const selected = tab === button; tab.classList.toggle('selected', selected); tab.setAttribute('aria-pressed', String(selected)); });
    renderProducts();
  }));
  let searchDebounce;
  els.search.addEventListener('input', () => {
    state.search = els.search.value;
    els.clearSearch.hidden = !state.search;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(renderProducts, 90);
  });
  els.clearSearch.addEventListener('click', () => { els.search.value = ''; state.search = ''; els.clearSearch.hidden = true; renderProducts(); els.search.focus(); });
  $('#sortSelect').addEventListener('change', event => { state.sort = event.target.value; renderProducts(); });
  $('#resetFilters').addEventListener('click', () => {
    state.category = 'All'; state.search = ''; state.sort = 'featured';
    els.search.value = ''; els.clearSearch.hidden = true; $('#sortSelect').value = 'featured';
    $$('.category-tab').forEach(tab => { const selected = tab.dataset.category === 'All'; tab.classList.toggle('selected', selected); tab.setAttribute('aria-pressed', String(selected)); });
    renderProducts();
  });
  $('#openCart').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  els.overlay.addEventListener('click', closeCart);
  $('#checkoutButton').addEventListener('click', openCheckout);
  $('#closeCheckout').addEventListener('click', closeCheckout);
  $('#finishOrder').addEventListener('click', () => { closeCheckout(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#searchToggle').addEventListener('click', () => { $('#shop').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => els.search.focus(), 450); });
  $('#menuToggle').addEventListener('click', () => {
    const nav = $('#mainNav');
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    $('#menuToggle').setAttribute('aria-expanded', String(open));
    $('#menuToggle').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  $$('.main-nav a').forEach(link => link.addEventListener('click', () => {
    $('#mainNav').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false'); $('#menuToggle').setAttribute('aria-label', 'Open navigation');
  }));
  els.cartItems.addEventListener('click', event => {
    const qtyButton = event.target.closest('[data-qty]');
    const removeButton = event.target.closest('[data-remove]');
    if (qtyButton) {
      const [id, size, deltaText] = qtyButton.dataset.qty.split('|');
      const item = state.cart.find(cartItem => cartItem.id === id && cartItem.size === size);
      const delta = Number(deltaText);
      if (!item) return;
      if (item.quantity + delta < 1) state.cart = state.cart.filter(cartItem => !(cartItem.id === id && cartItem.size === size));
      else item.quantity = Math.min(10, item.quantity + delta);
      saveCart(); renderCart();
    } else if (removeButton) {
      const [id, size] = removeButton.dataset.remove.split('|');
      state.cart = state.cart.filter(item => !(item.id === id && item.size === size));
      saveCart(); renderCart(); showToast('Item removed from your bag.');
    }
  });
  els.checkoutForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.busy) return;
    const formData = new FormData(els.checkoutForm);
    const customer = {
      name: String(formData.get('name') || '').trim(), email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(), address: String(formData.get('address') || '').trim(),
      city: String(formData.get('city') || '').trim(), postalCode: String(formData.get('postalCode') || '').trim()
    };
    state.busy = true; els.placeOrder.disabled = true; els.placeOrder.innerHTML = 'SENDING ORDER…'; els.checkoutError.hidden = true;
    try {
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ customer, items: state.cart })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Your order could not be placed.');
      els.checkoutForm.hidden = true; els.orderSuccess.hidden = false;
      els.successOrderId.textContent = result.order.orderId;
      els.successMessage.textContent = `${result.message} Total: ${money(result.order.total)}. No payment was collected.`;
      state.cart = []; saveCart(); renderCart();
    } catch (error) {
      els.checkoutError.textContent = error.message || 'Could not reach the store service. Please try again.';
      els.checkoutError.hidden = false;
    } finally {
      state.busy = false; els.placeOrder.disabled = false; els.placeOrder.innerHTML = 'Place demo order <span aria-hidden="true">↗</span>';
    }
  });
  els.newsletterForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('button[type="submit"]', els.newsletterForm);
    const email = $('#newsletterEmail').value.trim();
    button.disabled = true; button.textContent = 'ADDING…';
    els.newsletterMessage.className = 'form-message';
    try {
      const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not join the list.');
      els.newsletterMessage.textContent = result.message;
      els.newsletterMessage.classList.add('success');
      els.newsletterForm.reset();
    } catch (error) {
      els.newsletterMessage.textContent = error.message || 'Could not reach the store service. Try again.';
      els.newsletterMessage.classList.add('error');
    } finally { button.disabled = false; button.innerHTML = 'JOIN THE SQUAD <span aria-hidden="true">↗</span>'; }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!els.checkoutModal.hidden) closeCheckout();
      if (els.drawer.classList.contains('open')) closeCart();
      $('#mainNav').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false');
    }
  });
  loadProducts();
})();
