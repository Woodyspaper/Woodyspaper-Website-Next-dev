---
name: Catalog filter data
description: Accuracy and privacy constraints for provider-derived storefront filters.
---

Use public structured attributes and selectable product options for filters. Do not expose provider-hidden supplier metadata or invent size values from product names.

**Why:** The connected catalog includes hidden operational fields, and sizes are not consistently supplied as structured data. Guessing dimensions would make filtering misleading.

**How to apply:** Missing attributes should be clearly unavailable until populated upstream. Filter the full catalog before paging so counts and results are not limited to the current visible page.
