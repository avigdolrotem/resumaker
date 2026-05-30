#!/usr/bin/env python3
"""
Extract the Better Auth verify-email URL from a guerrillamail (or
similarly-shaped) email JSON dump.

Usage:
    python3 scripts/dev/extract-verify-url.py <email.json>

Used during the 2026-05-28 Phase B real-test-send verification — when
QA'ing the email flow against prod, you pull the message body from
a throwaway inbox API and need to feed the verify link to the
sign-in flow. This is the bare-minimum extractor (regex + HTML
unescape) so we don't have to copy-paste from JSON every time.

The email body in the source dump is HTML-escaped, so the unescape
step matters (`&amp;` in the URL would otherwise 404).
"""
import html
import json
import re
import sys

if len(sys.argv) != 2:
    print('usage: extract-verify-url.py <email.json>', file=sys.stderr)
    sys.exit(1)

data = json.load(open(sys.argv[1]))
body = data.get('mail_body', '') or ''
m = re.search(r'https://resumaker\.co\.il/api/auth/verify-email[^"<>\s\\]+', body)
print(html.unescape(m.group(0)) if m else 'NONE')
