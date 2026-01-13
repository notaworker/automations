
// growatt-login-test.mjs
// Purpose: Log in to Growatt (ShineServer or server.growatt.com), keep session cookies,
// verify that /index returns an authenticated dashboard (not the login page),
// and extract the displayed "Connection Status" value from the dashboard.

import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import tough from 'tough-cookie';
import crypto from 'crypto';
import * as cheerio from 'cheerio';

const GW_SERVER_BASE = process.env.GW_SERVER_BASE || 'https://server.growatt.com';
const USER = process.env.GW_USER;
const PASS = process.env.GW_PASS;
const CAPTCHA = (process.env.GW_VALIDATE_CODE || '').toUpperCase();
// Optional: device serial if you later want to target a specific device view
const DEVICE_SN = process.env.GW_DEVICE_SN || '';

function md5Hex(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

function looksAuthenticated(html) {
  const s = String(html || '');
  const first300 = s.slice(0, 300);
  // If it still looks like the login page, treat as unauthenticated
  if (/data-name="login"|<title>\s*Login\s*<\/title>/i.test(first300)) return { ok: false, first300 };
  return { ok: true, first300 };
}

async function loginOnce(client, { account, password, useMd5, validateCode, isReadPact }) {
  const form = new URLSearchParams();
  form.set('account', account);
  if (useMd5) {
    form.set('password', '');                   // site behavior: blank when sending hash
    form.set('passwordCrc', md5Hex(password));  // MD5 hash of plaintext password
  } else {
    form.set('password', password);             // plaintext fallback when server returns result == 8
    form.set('passwordCrc', '');
  }
  form.set('validateCode', validateCode || ''); // optional 3-char captcha (uppercase)
  form.set('isReadPact', isReadPact ? '1' : '0');

  const res = await client.post('/login', form, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': GW_SERVER_BASE,
      'Referer': `${GW_SERVER_BASE}/login`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01'
    },
    validateStatus: () => true
  });

  let body;
  try { body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data; } catch { body = res.data; }
  return { status: res.status, body };
}

/**
 * Try to extract a "Connection Status" value from dashboard HTML.
 * This attempts multiple DOM patterns:
 *  - A label cell (th/td/div/span) containing "Connection Status" followed by value in the same row or next sibling.
 *  - Adjacent text nodes near elements that match.
 *  - Common variants of the text label to improve resilience.
 */
function extractConnectionStatusFromHtml(html) {
  if (!html) return { found: false, statusText: '', debug: 'No HTML provided' };

  const $ = cheerio.load(html);

  // Labels we’ll try to match (case-insensitive)
  const labelPatterns = [
    /connection\s*status/i,
    /device\s*connection\s*status/i,
    /connection\s*state/i
  ];

  // Helper to get clean text
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  // Strategy 1: Table-like rows where one cell is label, the adjacent cell is value
  const tryTableLike = () => {
    let hit = null;
    $('tr, .row, .flex, .item, li, div').each((_, el) => {
      if (hit) return;
      const $el = $(el);
      const text = clean($el.text());
      if (!text) return;

      const labelMatch = labelPatterns.some((re) => re.test(text));
      if (!labelMatch) return;

      // If this container includes the value, try to isolate by splitting on the label
      // Example: "Connection Status: Online"
      for (const re of labelPatterns) {
        if (re.test(text)) {
          const idx = text.toLowerCase().search(re);
          if (idx >= 0) {
            // Look for separator after label
            const after = clean(text.slice(idx).replace(re, ''));
            const candidate = after.replace(/^[:：-]\s*/, '');
            if (candidate && candidate.length && candidate.length < 100) {
              hit = candidate;
              return;
            }
          }
        }
      }

      // If it’s a structured row (e.g., two cells), try siblings
      // Look for immediate label element and next sibling value
      // This covers patterns like: <td>Connection Status</td><td>Online</td>
      const labelEl = $el.find('*').filter((i, node) => {
        const t = clean($(node).text());
        return labelPatterns.some((re) => re.test(t));
      }).first();

      if (labelEl && labelEl.length) {
        // Prefer the next sibling's text
        const siblingText = clean(labelEl.next().text());
        if (siblingText) {
          hit = siblingText;
          return;
        }
        // Otherwise, check parent siblings (table rows)
        const parent = labelEl.parent();
        if (parent && parent.length) {
          const cells = parent.children();
          let seenLabel = false;
          cells.each((__, cell) => {
            if (hit) return;
            const t = clean($(cell).text());
            if (!seenLabel && labelPatterns.some((re) => re.test(t))) {
              seenLabel = true;
            } else if (seenLabel && t) {
              hit = t;
            }
          });
        }
      }
    });

    if (hit) return { found: true, statusText: hit, source: 'table-like' };
    return { found: false };
  };

  // Strategy 2: Direct label-value pattern with punctuation
  const tryInlineColon = () => {
    // Find any text nodes that look like "Connection Status: Online"
    // We’ll iterate common tags where such text often appears.
    const selectors = ['p', 'span', 'div', 'li', 'td', 'th', 'label'];
    for (const sel of selectors) {
      const nodes = $(sel).toArray();
      for (const n of nodes) {
        const text = clean($(n).text());
        if (!text) continue;
        for (const re of labelPatterns) {
          const m = text.match(new RegExp(`${re.source}\\s*[:：-]\\s*(.+)`, 'i'));
          if (m && m[1]) {
            const candidate = clean(m[1]);
            if (candidate) {
              return { found: true, statusText: candidate, source: 'inline-colon' };
            }
          }
        }
      }
    }
    return { found: false };
  };

  // Strategy 3: Look for data-* attributes or aria labels (defensive)
  const tryAttrs = () => {
    const all = $('*').toArray();
    for (const el of all) {
      const $el = $(el);
      const attrs = el.attribs || {};
      const attrText = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join(' ');
      if (labelPatterns.some((re) => re.test(attrText))) {
        const val = clean($el.text());
        if (val && !labelPatterns.some((re) => re.test(val))) {
          return { found: true, statusText: val, source: 'attr-match' };
        }
      }
    }
    return { found: false };
  };

  const s1 = tryTableLike();
  if (s1.found) return { found: true, statusText: s1.statusText, source: s1.source };

  const s2 = tryInlineColon();
  if (s2.found) return { found: true, statusText: s2.statusText, source: s2.source };

  const s3 = tryAttrs();
  if (s3.found) return { found: true, statusText: s3.statusText, source: s3.source };

  // As a debugging aid, include a short snippet of the HTML around likely labels
  const snippet = (() => {
    let out = '';
    const candidates = $('*:contains("Connection")').slice(0, 5).toArray();
    candidates.forEach((el, i) => {
      const block = cheerio.html(el).replace(/\s+/g, ' ').slice(0, 400);
      out += `\n[${i}] ${block}`;
    });
    return out || '(no nearby Connection text found)';
  })();

  return { found: false, statusText: '', debug: snippet };
}

async function main() {
  if (!USER || !PASS) {
    console.error('Missing GW_USER or GW_PASS env vars');
    process.exit(2);
  }

  const jar = new tough.CookieJar();
  const client = wrapper(axios.create({
    baseURL: GW_SERVER_BASE,
    jar,
    withCredentials: true,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    validateStatus: () => true
  }));

  // Preflight GET to establish cookies
  let res = await client.get('/login', { headers: { Referer: GW_SERVER_BASE + '/' } });
  console.log(`GET ${GW_SERVER_BASE}/login → ${res.status}`);

  // 1) Try MD5-first (default page behavior)
  let { body } = await loginOnce(client, {
    account: USER,
    password: PASS,
    useMd5: true,
    validateCode: CAPTCHA,
    isReadPact: true // pre-acknowledge privacy policy
  });
  console.log('POST /login (MD5) →', body?.result);

  // 2) Handle server result codes
  if (body?.result === 8) {
    // Server says MD5 mismatch → retry with plaintext
    ({ body } = await loginOnce(client, {
      account: USER,
      password: PASS,
      useMd5: false,
      validateCode: CAPTCHA,
      isReadPact: true
    }));
    console.log('POST /login (plaintext retry) →', body?.result);
  } else if (body?.result === -4) {
    // Privacy policy prompt; attempt to mark accepted then retry
    try {
      await client.post('/login/updateProtocolStatusByUser', new URLSearchParams({ accountName: USER }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      ({ body } = await loginOnce(client, {
        account: USER,
        password: PASS,
        useMd5: true,
        validateCode: CAPTCHA,
        isReadPact: true
      }));
      console.log('POST /login (after privacy accept) →', body?.result);
    } catch (e) {
      console.warn('Privacy acceptance call failed:', e?.message || e);
    }
  } else if (body?.result === -1) {
    console.error('❌ Server requires verification code (captcha). Provide GW_VALIDATE_CODE (3 chars, uppercase).');
    process.exit(2);
  } else if (body?.result === -2) {
    console.error('❌ Username or password error (server may now require captcha).');
    process.exit(2);
  } else if (body?.result === 3 || body?.result === '3') {
    console.error('❌ Region selection flow detected. Use the correct regional base URL for your account.');
    process.exit(2);
  }

  // 3) Verify session by fetching /index
  res = await client.get('/index', { headers: { Referer: `${GW_SERVER_BASE}/login` } });
  console.log(`GET ${GW_SERVER_BASE}/index → ${res.status}`);

  const { ok, first300 } = looksAuthenticated(res.data);
  if (!ok) {
    console.error('❌ Login did not validate. Still seeing login page.');
    console.info(`ℹ️ First 300 chars: ${first300}`);
    process.exit(2);
  }

  console.log('✅ Logged in. Session appears valid.');

  // 4) Extract "Connection Status" from the dashboard HTML
  try {
    const html = typeof res.data === 'string' ? res.data : String(res.data || '');
    const got = extractConnectionStatusFromHtml(html);
    if (got.found) {
      console.log(`🔌 Connection Status: ${got.statusText}`);
    } else {
      console.warn('⚠️ Could not find "Connection Status" on the dashboard.');
      if (got.debug) {
        console.warn('🔎 Nearby HTML snippets to help refine selector:', got.debug);
      }
      // Non-fatal by default; if you want the workflow to fail when not found, uncomment:
      // process.exit(2);
    }
  } catch (e) {
    console.error('❌ Error extracting Connection Status:', e?.message || e);
    // process.exit(2); // keep optional
  }

  // Keep a small snippet for debugging context (optional)
  console.log('— First 300 chars of /index —');
  console.log(first300);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
