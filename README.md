# Matchday — World Cup 2026 Fan Jersey Store

A responsive, ready-to-run football jersey storefront. It includes a custom visual storefront, locally bundled jersey illustrations, search and category filters, size selection, a persistent cart, a demo checkout API, newsletter signup, and Docker/Compose files.

> **Brand and payment note:** This is a fan-style demo storefront. It is not affiliated with FIFA or any national football federation and does not represent official/licensed merchandise. Checkout records a demo order only; it does not charge a payment method, send a real shipment, or integrate a payment provider.

## Run with Docker (recommended)

Requirements: Docker Desktop or Docker Engine with the Docker Compose plugin.

```bash
docker compose up --build
```

Open **http://localhost:8080**. The Compose service builds the image `matchday-world-cup-jersey-store:1.0.0`, starts the container `matchday-world-cup-jersey-store`, and stores orders/newsletter subscriptions in the named volume `matchday-world-cup-jersey-store-data`.

To stop the container:

```bash
docker compose down
```

The named volume remains so demo orders and newsletter signups persist after stopping/recreating the container. To delete the volume and all stored demo records too:

```bash
docker compose down --volumes
```

If port 8080 is already being used, choose another host port:

```bash
STORE_PORT=8081 docker compose up --build
```

Then visit **http://localhost:8081**.

## Create and export a portable Docker image

The ZIP includes the Docker build files; a prebuilt image archive is not bundled. To build the image and save it as a transferable `.tar` file, run this from the project folder on a machine with Docker installed:

```bash
./scripts/export-docker-image.sh
```

This creates `matchday-world-cup-jersey-store-image.tar`. Copy it to another Docker host and load it with:

```bash
docker load -i matchday-world-cup-jersey-store-image.tar
docker run --rm -p 8080:8080 matchday-world-cup-jersey-store:1.0.0
```

For persistent records with `docker run`, mount a writable data directory at `/app/data`:

```bash
mkdir -p ./store-data
docker run --rm -p 8080:8080 -v "$(pwd)/store-data:/app/data" matchday-world-cup-jersey-store:1.0.0
```

## Run without Docker

Requirements: Node.js 20 or newer. No third-party npm packages are required.

```bash
npm start
```

Open **http://localhost:8080**. Press `Ctrl+C` to stop the server.

## Included features

- Responsive desktop, tablet, and mobile storefront.
- Twelve country-colour fan jersey designs supplied as local SVG assets.
- Product category tabs, country/product search, price sorting, and rating sorting.
- Size selection, add-to-bag, quantity controls, remove item, and a browser-persisted cart.
- Shipping progress indicator and free shipping on cart subtotals of ₹2,999 or more.
- Checkout form with server-side validation and server-calculated totals.
- Order references saved to `data/orders.json` and newsletter signups to `data/subscribers.json`.
- Health endpoint at `/api/health` and product catalog endpoint at `/api/products`.
- Dockerfile, Docker Compose, health checks, non-root container user, and an image export helper.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Container/service health check |
| `GET` | `/api/products` | Product catalog and shipping rules |
| `POST` | `/api/orders` | Validate and store a demo order |
| `POST` | `/api/newsletter` | Store a newsletter email signup |

Example order request:

```json
{
  "customer": {
    "name": "Demo Customer",
    "email": "customer@example.com",
    "phone": "+91 90000 00000",
    "address": "10 Example Road",
    "city": "Bengaluru",
    "postalCode": "560001"
  },
  "items": [
    { "id": "arg-home-26", "size": "M", "quantity": 1 }
  ]
}
```

## Project structure

```text
world-cup-jersey-store/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── package.json
├── server.js
├── products.json
├── README.md
├── data/
│   ├── orders.json
│   └── subscribers.json
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/          # locally bundled SVGs and favicon
└── scripts/
    └── export-docker-image.sh
```

## Before using for a real store

The included backend is intentionally lightweight and suitable for demos/prototypes. For production, replace JSON-file persistence with a database, add authentication and admin order management, configure HTTPS and a reverse proxy, add rate limiting and operational logging, and integrate a compliant payment provider, tax/shipping rules, privacy policy, and real order/shipping notifications. Do not store card information in this application.
