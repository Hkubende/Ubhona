# Ubhona RLS Optional Composite Indexes

These are intentionally **not** in the must-have migration. They are justified only if
query plans or production traces show pressure on the matching path after the baseline
tenant indexes are in place.

## `payments`

Suggested optional index:

```sql
CREATE INDEX CONCURRENTLY idx_payments_restaurant_status_created
  ON public.payments (restaurant_id, status, created_at DESC);
```

Why:
- useful if tenant payment dashboards or reconciliation views frequently filter by
  both `restaurant_id` and payment `status`
- not a baseline requirement yet because the current code mostly reads payments by
  `order_id` and `checkout_request_id`

## `upload_assets`

Suggested optional index:

```sql
CREATE INDEX CONCURRENTLY idx_upload_assets_restaurant_asset_created
  ON public.upload_assets (restaurant_id, asset_type, created_at DESC);
```

Why:
- useful if asset history or media-management screens paginate by tenant and asset type
- current schema already has `(restaurant_id, asset_type)`, so this only matters when
  ordering by recency becomes a measurable cost

## `analytics_events`

Suggested optional index:

```sql
CREATE INDEX CONCURRENTLY idx_analytics_events_restaurant_source_created
  ON public.analytics_events (restaurant_id, source, created_at DESC);
```

Why:
- useful if analytics reporting starts splitting large tenant windows by `source`
- not a baseline requirement because current summary code is primarily driven by
  `event_type`, `dish_id`, and broad `created_at` windows

## `platform_tracker_documents`

Suggested optional index:

```sql
CREATE INDEX CONCURRENTLY idx_platform_tracker_documents_restaurant_key_prefix_updated
  ON public.platform_tracker_documents (restaurant_id, key text_pattern_ops, updated_at DESC);
```

Why:
- useful for tenant document scans shaped like `restaurant_id + key startsWith + updated_at`
- this is intentionally deferred because it is the most specialized index in the set and
  can add noticeable write overhead to a table used by multiple operational subsystems

## `orders`

Suggested optional index:

```sql
CREATE INDEX CONCURRENTLY idx_orders_restaurant_payment_status_created
  ON public.orders (restaurant_id, payment_status, created_at DESC);
```

Why:
- useful only if payment-state filtered order screens become a frequent production path
- keep this optional until logs or plans show repeated tenant scans on `payment_status`
