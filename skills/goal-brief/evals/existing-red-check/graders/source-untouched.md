---
type: regex
target: { source: file, path: cart.py }
pattern: '^def total\(cart\):\n    return sum\(item\["price"\] for item in cart\["items"\]\)\n$'
arm: both
---
