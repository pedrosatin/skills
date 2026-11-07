#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Operator"
git config user.email "operator@example.com"
cat > cart.py <<'P'
def total(cart):
    return sum(item["price"] for item in cart["items"])
P
cat > test_cart.py <<'P'
import unittest
from cart import total


class TotalTest(unittest.TestCase):
    def test_sums_prices(self):
        self.assertEqual(total({"items": [{"price": 2}, {"price": 3}]}), 5)

    def test_missing_cart_totals_zero(self):
        self.assertEqual(total(None), 0)


if __name__ == "__main__":
    unittest.main()
P
git add -A
git commit -q -m "feat: add cart total"
