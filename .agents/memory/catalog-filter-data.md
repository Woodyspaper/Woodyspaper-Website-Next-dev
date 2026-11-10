---
name: Catalog filter data
description: Accuracy and privacy constraints for provider-derived storefront filters.
---

Use public structured attributes and selectable product options for filters. Do not expose provider-hidden supplier metadata. The user explicitly requested size filtering from product names when structured size data is absent.

**Why:** The connected catalog includes hidden operational fields, but many product names contain explicit dimensions even when structured size is absent.

**How to apply:** Prefer structured size values; otherwise extract explicit dimensions from the name, not SKU digits, weights, or pack counts. Hide unavailable filters. Filter the full catalog before paging so counts and results are not limited to the current visible page.
