# CLI Commands → API Endpoints

Base URL: `https://api.whales.market` (configurable via `--api-url` or config)

All successful responses wrap data in:
```json
{ "messages": "Success", "data": <payload>, "status_code": 200 }
```
Error responses use:
```json
{ "message": "...", "error": "...", "statusCode": 4xx }
```

---

## Read-only Commands

### tokens

| Command | Method | Endpoint | Required params |
|---------|--------|----------|-----------------|
| `tokens list` | GET | `/v2/tokens` | `type`, `category` |
| `tokens get <symbol>` | GET | `/v2/tokens/detail/:symbol` | — |
| `tokens search <query>` | GET | `/v2/tokens` | `search`, `type`, `category` |
| `tokens highlight` | GET | `/tokens/highlight` | — |
| `tokens stats` | GET | `/tokens/prediction-stats` | — |

**GET /v2/tokens**

Query params:
- `take` (int) — page size
- `page` (int) — page number
- `type` — `pre_market`
- `category` — `pre_market`
- `sort_vol` — `ASC` | `DESC`
- `statuses[]` — `active`, `settling`, `ended`
- `search` — token name or symbol

```
curl "https://api.whales.market/v2/tokens?take=20&page=1&type=pre_market&category=pre_market&sort_vol=DESC&statuses=active&statuses=settling"
```

Response `data`:
```json
{
  "count": 8,
  "list": [
    {
      "id": "f6f3b2c9-1c66-4a1d-8872-5afa1bba8007",
      "created_at": "2025-12-19T04:16:13.673Z",
      "updated_at": "2026-03-06T10:00:00.803Z",
      "address": null,
      "settle_time": null,
      "settle_duration": 14400,
      "pledge_rate": null,
      "status": "active",
      "symbol": "SPACE",
      "name": "Space",
      "icon": "https://cdn.whales.market/icon/...",
      "price": 0,
      "last_price": 0.017872514,
      "coin_gecko_id": null,
      "decimals": null,
      "type": "pre_market",
      "token_id": "8753",
      "waiting_count": 0,
      "category": "pre_market",
      "custom_index": null,
      "pre_token_address": null,
      "price_change": { "h24": 0 },
      "volume": { "h24": 2759, "total_vol": 0 },
      "volume_change": { "h24": 28454.809917492, "total_vol_day30": 0 },
      "settle_type": "system",
      "is_verified": false,
      "is_banned": null,
      "last_trade_type": "buy",
      "chain_id": 666666,
      "network_icon": "https://cdn.whales.market/network-icons/Solana.png",
      "network_name": "Solana",
      "network_url": "",
      "website": "https://into.space/",
      "twitter": "https://x.com/intodotspace",
      "start_time": null,
      "banner_url": "",
      "overview_url": "https://whales.market/blog/what-is-space/",
      "total_supply": "1000000000",
      "circulating_supply": null,
      "priority": 0,
      "metadata": {
        "icon": "", "title": "", "description": "", "background_image": "",
        "cta": { "text": "", "url": "" },
        "status": "inactive", "priority": 0
      },
      "unit": { "prefix_icon": "", "icon": "", "symbol": "" },
      "description": null,
      "tokenomic": { "total_supply": 0, "circulating_supply": 0, "allocation": [] },
      "socials": { "telegram": "", "discord": "", "medium": "", "github": "" },
      "faq": [
        {
          "id": "string",
          "translations": {
            "en": { "question": "string", "answer": "string", "generated_by_ai": true, "generated_at": "ISO date" }
          }
        }
      ]
    }
  ]
}
```

---

**GET /v2/tokens/detail/:symbol**

> ⚠️ Note: `/tokens/:id` returns 404. Use `/v2/tokens/detail/:symbol` instead.

```
curl "https://api.whales.market/v2/tokens/detail/SKATE"
```

Response `data` — same shape as a single item from `/v2/tokens` list, with additional fields:
```json
{
  "id": "48975c09-dfbb-4fd6-ade8-64e7554dee1d",
  "address": "0x61dbbbb552dc893ab3aad09f289f811e67cef285",
  "settle_time": 1749465083,
  "status": "ended",
  "symbol": "SKATE",
  "name": "Skate Chain",
  "last_price": 0.104,
  "chain_id": [1],
  "start_time": 1749465000,
  "token_id": "0x333736320000...",
  "volume": { "h24": 0, "total_vol": 100510.14255392601 }
}
```

---

**GET /tokens/highlight**

```
curl "https://api.whales.market/tokens/highlight"
```

Response `data`: `[]` (array of highlighted token objects, same shape as `/v2/tokens` list item)

---

**GET /tokens/prediction-stats**

```
curl "https://api.whales.market/tokens/prediction-stats"
```

Response `data`:
```json
[
  {
    "token_id": "badde4db-c4db-4dc6-8580-bc9fed2f1a53",
    "symbol": "LIT",
    "name": "Lighter",
    "prediction_stats": {
      "count_predict_chart": 1689,
      "count_view_polymarket": 85,
      "count_view_insight": 0,
      "count_view_predict_link": 0
    }
  }
]
```

---

### offers

| Command | Method | Endpoint | Required params |
|---------|--------|----------|-----------------|
| `offers list` | GET | `/transactions/offers` | `symbol` |
| `offers my` | GET | `/transactions/offers-by-address/:address` | — |
| `offers get <id>` | GET | `/transactions/offers/:id` | — |

**GET /transactions/offers**

> ⚠️ `symbol` is required. Without it the API returns 400.

Query params:
- `symbol` (string, required) — token symbol, e.g. `SPACE`
- `take` (int) — page size
- `page` (int) — page number
- `status` — `open` | `close` | `cancel`
- `offer_type` — `buy` | `sell`

```
curl "https://api.whales.market/transactions/offers?symbol=SPACE&take=20&page=1"
```

Response `data`:
```json
{
  "count": 0,
  "list": [ /* offer objects */ ],
  "total_tokens": [
    {
      "status": "ended",
      "symbol": "Meteora",
      "name": "Meteora",
      "icon": "https://cdn.whales.market/icon/...",
      "id": "2a1473e2-ce46-45d0-81d8-767de6fba14b",
      "address": null,
      "total": 348
    }
  ]
}
```

---

**GET /transactions/offers/:id**

```
curl "https://api.whales.market/transactions/offers/6e9d7cd2-5664-43c3-b82e-b951a3643285"
```

Response `data`:
```json
{
  "id": "6e9d7cd2-5664-43c3-b82e-b951a3643285",
  "created_at": "2024-12-18T23:13:01.769Z",
  "updated_at": "2025-10-08T04:42:41.886Z",
  "deleted_at": null,
  "network_id": "9a161bb2-ffff-4c89-8f20-13360e90bb45",
  "offer_index": 629125,
  "tx_hash": "4mKnUYz8Z7RVHi3eWt...",
  "log_index": 0,
  "block_number": null,
  "offer_type": "sell",
  "token_id": "2a1473e2-ce46-45d0-81d8-767de6fba14b",
  "total_amount": 5000,
  "price": 0.000019459,
  "value": 0.097295,
  "ex_token_id": "1c070fa7-67a9-4020-aef6-e080ef267b2b",
  "collateral": 0.097295,
  "status": "close",
  "filled_amount": 5000,
  "offer_by": "6e1bcd94-1a0b-4552-bd64-2437ed4255fe",
  "full_match": false,
  "exit_position_index": null,
  "by_exit_position_order_index": null,
  "is_exit_position_order": null,
  "description": "",
  "duration": null,
  "deadline": null,
  "is_free": false,
  "is_exit_position": false,
  "custom_index": null,
  "contract_address": "stPdYNaJNsV3ytS9Xtx4GXXXRcVqVS6x66ZFa26K39S",
  "token": { /* token object (same shape as /v2/tokens list item) */ }
}
```

Offer `status` values: `open` | `close` | `cancel`

---

**GET /transactions/offers-by-address/:address**

```
curl "https://api.whales.market/transactions/offers-by-address/YOUR_WALLET_ADDRESS"
```

Response `data`: same shape as `GET /transactions/offers`

---

### orders

| Command | Method | Endpoint | Required params |
|---------|--------|----------|-----------------|
| `orders list` | GET | `/transactions/orders` | `symbol` |
| `orders my` | GET | `/transactions/orders-by-address/:address` | — |
| `orders by-offer <id>` | GET | `/transactions/orders-by-offer/:address` | — |

> ⚠️ `GET /transactions/orders/:id` returns 404. Fetch a specific order via `orders list` with filters.

**GET /transactions/orders**

> ⚠️ `symbol` is required. Without it the API returns 400.

Query params: same as `/transactions/offers` above.

```
curl "https://api.whales.market/transactions/orders?symbol=SKATE&take=20&page=1"
```

Response `data`:
```json
{
  "count": 3,
  "list": [
    {
      "id": "3ee97d22-e4fd-4594-9570-48c9bf8281c6",
      "created_at": "2024-12-18T23:47:01.344Z",
      "updated_at": "2025-10-22T05:11:30.681Z",
      "deleted_at": null,
      "network_id": "9a161bb2-ffff-4c89-8f20-13360e90bb45",
      "user_settle_order_id": null,
      "order_index": 712932,
      "tx_hash": "2J2ob7pRF2LWv5JxZaAWZjkL6HCi...",
      "log_index": 0,
      "block_number": null,
      "amount": 2500,
      "type": "buy",
      "order_by": "91685181-ef8d-490f-b0b0-232e00922178",
      "exit_position_index_order": null,
      "exit_position_index_offer": null,
      "buyer_id": "91685181-ef8d-490f-b0b0-232e00922178",
      "seller_id": "6e1bcd94-1a0b-4552-bd64-2437ed4255fe",
      "referrer_buyer_id": null,
      "referrer_seller_id": null,
      "status": "cancel",
      "status_exit_position_order": null,
      "status_exit_position_offer": null,
      "price_settle": null,
      "offer_id": "6e9d7cd2-5664-43c3-b82e-b951a3643285",
      "is_free": false,
      "is_exit_position": false,
      "order_index_original": null,
      "new_collateral": null,
      "pnl_exit_position_usd": null,
      "pnl_exit_position": null,
      "exit_tx_hash": null,
      "buyer_fee_percentage": null,
      "seller_fee_percentage": null,
      "custom_index": null,
      "valid_price": true,
      "contract_address": "stPdYNaJNsV3ytS9Xtx4GXXXRcVqVS6x66ZFa26K39S"
    }
  ]
}
```

Order `status` values: `open` | `settle_filled` | `settle_cancelled` | `cancel`

---

**GET /transactions/orders-by-address/:address**

```
curl "https://api.whales.market/transactions/orders-by-address/YOUR_WALLET_ADDRESS"
```

Response `data`: same shape as `GET /transactions/orders`

---

**GET /transactions/orders-by-offer/:address**

> ⚠️ Accepts the on-chain offer contract address (not the UUID). Returns 404 if user/address is not found.

```
curl "https://api.whales.market/transactions/orders-by-offer/ON_CHAIN_OFFER_ADDRESS"
```

Response `data`: same shape as `GET /transactions/orders`

---

### book

| Command | Method | Endpoint | Required params |
|---------|--------|----------|-----------------|
| `book <symbol>` | GET | `/v2/offers` | `token_symbol` |

> ⚠️ The `symbol` query param is not accepted. Use `token_symbol` (token name/symbol) for the market token.

Query params:
- `token_symbol` (string, required) — e.g. `SPACE`
- `take` (int)
- `page` (int)
- `offer_type` — `buy` | `sell`
- `status` — `open` | `close` | `cancel`

```
curl "https://api.whales.market/v2/offers?token_symbol=SPACE&take=20&page=1"
```

Response `data`:
```json
{
  "count": 0,
  "list": [ /* offer objects, same shape as /transactions/offers/:id */ ],
  "is_limit": true,
  "price_min": null,
  "price_max": null,
  "total_size": 0
}
```

---

### orderbook

| Command | Method | Endpoint | Required params |
|---------|--------|----------|-----------------|
| `orderbook snapshot` | GET | `/order-books/snapshot` | — |
| `orderbook positions` | GET | `/order-books/position/:telegramId` | — |
| `orderbook pairs` | GET | `/order-books/pairs/:telegramId` | — |
| `orderbook filled <id>` | GET | `/order-books/filled/:id` | — |

**GET /order-books/snapshot**

```
curl "https://api.whales.market/order-books/snapshot"
```

Response `data`: `[]` (array of order book snapshot objects)

---

**GET /order-books/position/:telegramId**, **GET /order-books/pairs/:telegramId**, **GET /order-books/filled/:id**

Require authenticated Telegram ID or internal order book ID. Schema TBD.

---

### referral

All referral endpoints require a wallet address path parameter.

| Command | Method | Endpoint |
|---------|--------|----------|
| `referral summary` | GET | `/referral/my-campaigns/:address/summary` |
| `referral campaigns` | GET | `/referral/my-campaigns/:address` |
| `referral earnings` | GET | `/referral/my-campaigns/:address/performance` |
| `referral transactions` | GET | `/referral/my-campaigns/:address/transactions` |

```
curl "https://api.whales.market/referral/my-campaigns/YOUR_WALLET_ADDRESS/summary"
```

Response schemas require a wallet with referral activity. Shape TBD.

---

### networks & status

**GET /network-chains**

```
curl "https://api.whales.market/network-chains"
```

Response `data`: array of network objects:
```json
[
  {
    "id": "f95b8e3f-c745-45cf-b4d5-226f580f676f",
    "created_at": "2024-01-16T17:42:00.226Z",
    "updated_at": "2026-03-06T10:07:00.258Z",
    "deleted_at": null,
    "name": "BNB",
    "chain_id": 56,
    "is_mainnet": true,
    "url": "https://...rpc-url.../",
    "explorerUrl": "https://bscscan.com",
    "icon": "https://cdn.whales.market/network-icons/BNBChain.png",
    "is_healthy": true,
    "is_priority": false,
    "has_active_tokens": true,
    "total_volume": 1318569.7427477243
  }
]
```

---

## Trading Commands (Solana)

### offers create

| Step | Method | Endpoint |
|------|--------|----------|
| 1. Resolve token | GET | `/v2/tokens/detail/:symbol` |
| 2. Resolve collateral token | GET | `/v2/tokens?type=currency&symbol=USDC&chain_id=666666&take=5&page=1` |
| 3. Build tx | POST | `/v2/build-offer` |
| 4. Submit signed tx | POST | `/rpc-transactions/send-transaction` |

### offers fill

| Step | Method | Endpoint |
|------|--------|----------|
| 1. Get offer | GET | `/transactions/offers/:id` |
| 2. Build tx | POST | `/v2/build-fill-offer` |
| 3. Submit | POST | `/rpc-transactions/send-transaction` |

### offers cancel

| Step | Method | Endpoint |
|------|--------|----------|
| 1. Build tx | POST | `/v2/build-close-offer` |
| 2. Submit | POST | `/rpc-transactions/send-transaction` |

### orders settle

| Step | Method | Endpoint |
|------|--------|----------|
| 1. Build tx | POST | `/v2/settle-order/:orderId` |
| 2. Submit | POST | `/rpc-transactions/send-transaction` |

### orders claim-collateral

| Step | Method | Endpoint |
|------|--------|----------|
| 1. Build tx | POST | `/v2/build-close-order` |
| 2. Submit | POST | `/rpc-transactions/send-transaction` |

---

## POST Body Schemas

### POST /v2/build-offer
```json
{
  "token_id": "uuid",
  "amount": 100,
  "value": 50,
  "ex_token_id": "uuid",
  "offer_type": "buy",
  "full_match": false,
  "address": "YOUR_WALLET_ADDRESS"
}
```

### POST /v2/build-fill-offer
```json
{
  "offer_id": "uuid",
  "amount": 100,
  "address": "YOUR_WALLET_ADDRESS"
}
```

### POST /v2/build-close-offer
```json
{
  "offer_id": "uuid",
  "address": "YOUR_WALLET_ADDRESS"
}
```

### POST /v2/build-close-order
```json
{
  "order_id": "uuid",
  "address": "YOUR_WALLET_ADDRESS"
}
```

### POST /rpc-transactions/send-transaction
```json
{
  "data": "base64_serialized_signed_transaction"
}
```

---

## Known API Quirks

| Endpoint | Issue |
|----------|-------|
| `GET /tokens/:id` | Always returns 404. Use `GET /v2/tokens/detail/:symbol` instead. |
| `GET /transactions/orders/:id` | Always returns 404. Fetch orders via list + filter. |
| `GET /transactions/offers` | Requires `symbol` query param — returns 400 without it. |
| `GET /transactions/orders` | Requires `symbol` query param — returns 400 without it. |
| `GET /v2/offers` | Requires `token_symbol` param (not `symbol`). |
| `GET /transactions/orders-by-offer/:address` | Requires the on-chain offer address, not the UUID. Returns "User not found" otherwise. |
