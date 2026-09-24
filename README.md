# Muhanga Marketplace

A professional e-commerce and home-cleaning REST API platform for Muhanga, Rwanda.

## Project Structure

```
muhanga-marketplace/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js        # PostgreSQL connection pool
│   │   ├── controllers/
│   │   │   └── productController.js
│   │   ├── middleware/            # Auth middleware will go here
│   │   ├── routes/
│   │   │   └── productRoutes.js
│   │   ├── services/
│   │   │   └── productService.js  # SQL queries
│   │   └── server.js              # Express app entry point
│   ├── .env                       # Environment variables (not committed)
│   ├── .gitignore
│   └── package.json
├── database/
│   └── schema.sql                 # Reference copy of the DB schema
├── frontend/                      # To be developed later
└── README.md
```

## Technology Stack

| Layer     | Technology                |
|-----------|---------------------------|
| Runtime   | Node.js                   |
| Framework | Express.js                |
| Database  | PostgreSQL                |
| DB Driver | pg (node-postgres)        |
| Auth      | JSON Web Tokens (JWT)     |
| Security  | bcrypt                    |

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL with the `muhanga_marketplace` database

### Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Edit `.env` and set your PostgreSQL password:
   ```
   DB_PASSWORD=your_actual_postgres_password
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. The API will be available at: `http://localhost:5000`

## API Endpoints

### Week 1 (Current)

| Method | Endpoint       | Description                       |
|--------|----------------|-----------------------------------|
| GET    | `/`            | Health check                      |
| GET    | `/api/products`| Get all available products        |

### Planned (Future Weeks)

| Method | Endpoint                  | Description                    |
|--------|---------------------------|--------------------------------|
| POST   | `/api/auth/register`      | Customer registration          |
| POST   | `/api/auth/login`         | Login                          |
| GET    | `/api/categories`         | List categories                |
| POST   | `/api/cart`               | Add to cart                    |
| POST   | `/api/orders`             | Place order                    |
| GET    | `/api/cleaning-services`  | List cleaning services         |
| POST   | `/api/cleaning-requests`  | Book a cleaning                |

## Database

- Database name: `muhanga_marketplace`
- The database already contains the schema and product catalog.
- The backend only **reads** data at this stage — no writes, no modifications.

## Development Roadmap

| Week | Focus                                  |
|------|----------------------------------------|
| 1    | ✅ Backend foundation + GET /api/products |
| 2    | Authentication (JWT, bcrypt)           |
| 3    | Cart & Orders                          |
| 4    | Payments (MoMo + Cash on Delivery)     |
| 5    | Deliveries & Admin panel               |
| 6    | Cleaning Services                      |
| 7    | Frontend integration                   |
