'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const FREE_SHIPPING_THRESHOLD = 2999;
const SHIPPING_FEE = 99;
const ALLOWED_SIZES = new Set(['S', 'M', 'L', 'XL', 'XXL']);
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

function ensureDataFile(name, initialValue) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initialValue, null, 2));
  return file;
}
fs.mkdirSync(DATA_DIR, { recursive: true });
const ordersFile = ensureDataFile('orders.json', []);
const subscribersFile = ensureDataFile('subscribers.json', []);
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { console.error(`Could not read ${path.basename(file)}:`, error.message); return fallback; }
}
function writeJson(file, data) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
}
function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}
function readBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}
function cleanString(value, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
function staticFile(req, res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { return sendJson(res, 400, { error: 'Invalid URL path.' }); }
  const normalized = decoded === '/' ? '/index.html' : decoded;
  const target = path.resolve(PUBLIC_DIR, `.${normalized}`);
  if (!target.startsWith(`${PUBLIC_DIR}${path.sep}`) && target !== path.join(PUBLIC_DIR, 'index.html')) {
    return sendJson(res, 403, { error: 'Forbidden.' });
  }
  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) return sendJson(res, 404, { error: 'File not found.' });
    const contentType = MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': target.endsWith('.html') ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(target).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { status: 'ok', service: 'matchday-store', time: new Date().toISOString() });
    }
    if (req.method === 'GET' && pathname === '/api/products') {
      return sendJson(res, 200, { products: catalog, currency: 'INR', freeShippingThreshold: FREE_SHIPPING_THRESHOLD, shippingFee: SHIPPING_FEE });
    }
    if (req.method === 'POST' && pathname === '/api/newsletter') {
      const body = await readBody(req);
      const email = cleanString(body.email, 254).toLowerCase();
      if (!validEmail(email)) return sendJson(res, 400, { error: 'Enter a valid email address.' });
      const subscribers = readJson(subscribersFile, []);
      if (subscribers.some(item => item.email === email)) {
        return sendJson(res, 200, { message: 'You are already on the list.' });
      }
      subscribers.push({ email, subscribedAt: new Date().toISOString() });
      writeJson(subscribersFile, subscribers);
      return sendJson(res, 201, { message: 'You are on the list. Watch your inbox for the next drop.' });
    }
    if (req.method === 'POST' && pathname === '/api/orders') {
      const body = await readBody(req);
      const customer = {
        name: cleanString(body.customer && body.customer.name, 100),
        email: cleanString(body.customer && body.customer.email, 254).toLowerCase(),
        phone: cleanString(body.customer && body.customer.phone, 30),
        address: cleanString(body.customer && body.customer.address, 300),
        city: cleanString(body.customer && body.customer.city, 100),
        postalCode: cleanString(body.customer && body.customer.postalCode, 15)
      };
      if (customer.name.length < 2) return sendJson(res, 400, { error: 'Please enter your full name.' });
      if (!validEmail(customer.email)) return sendJson(res, 400, { error: 'Please enter a valid email address.' });
      if (customer.address.length < 5 || customer.city.length < 2 || customer.postalCode.length < 4) {
        return sendJson(res, 400, { error: 'Please complete your delivery address, city and postal code.' });
      }
      if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 40) {
        return sendJson(res, 400, { error: 'Your cart is empty or contains too many line items.' });
      }
      const items = [];
      for (const item of body.items) {
        const product = catalog.find(p => p.id === item.id);
        const size = cleanString(item.size, 4).toUpperCase();
        const quantity = Number(item.quantity);
        if (!product || !ALLOWED_SIZES.has(size) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
          return sendJson(res, 400, { error: 'A cart item is invalid. Please review your cart and try again.' });
        }
        items.push({ id: product.id, name: product.name, team: product.team, size, quantity, unitPrice: product.price, lineTotal: product.price * quantity });
      }
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
      const order = {
        orderId: `MD-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        status: 'DEMO_ORDER_RECEIVED',
        placedAt: new Date().toISOString(), customer, items,
        subtotal, shipping, total: subtotal + shipping,
        note: 'Demo order only. No payment has been collected.'
      };
      const orders = readJson(ordersFile, []);
      orders.push(order);
      writeJson(ordersFile, orders);
      return sendJson(res, 201, { message: 'Order received successfully.', order: { orderId: order.orderId, status: order.status, subtotal: order.subtotal, shipping: order.shipping, total: order.total, placedAt: order.placedAt, note: order.note } });
    }
    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'API endpoint not found.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' });
    return staticFile(req, res, pathname);
  } catch (error) {
    console.error('Request error:', error);
    if (!res.headersSent) sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Something went wrong. Please try again.' });
    else res.destroy();
  }
});

server.listen(PORT, HOST, () => console.log(`Matchday Store running at http://${HOST}:${PORT}`));
