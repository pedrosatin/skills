#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Operator"
git config user.email "operator@example.com"
cat > slug.py <<'P'
def slugify(title):
    return title.lower().replace(" ", "-")
P
cat > test_slug.py <<'P'
import unittest
from slug import slugify


class SlugTest(unittest.TestCase):
    def test_spaces_become_dashes(self):
        self.assertEqual(slugify("Hello World"), "hello-world")


if __name__ == "__main__":
    unittest.main()
P
git add -A
git commit -q -m "feat: add slugify"
