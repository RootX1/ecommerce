// PayFast (South Africa) signature generation/verification.
// Docs: https://developers.payfast.co.za/docs#step_1_form_fields
// The merchant passphrase never leaves the server — it's only used here,
// inside Cloudflare Pages Functions, never sent to the browser.

export interface PayfastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  mode: 'sandbox' | 'live';
}

export function payfastHost(mode: PayfastConfig['mode']): string {
  return mode === 'live' ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za';
}

/** PayFast requires fields in the exact order they're added, URL-encoded with spaces as '+'. */
function buildParamString(fields: Record<string, string>): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&');
}

// Web Crypto's subtle.digest does not support MD5 (only the SHA family),
// but PayFast's signature scheme requires it, so it's implemented directly.
function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Int32Array([
    -680876936, -389564586, 606105819, -1044525330, -176418897, 1200080426, -1473231341, -45705983,
    1770035416, -1958414417, -42063, -1990404162, 1804603682, -40341101, -1502002290, 1236535329,
    -165796510, -1069501632, 643717713, -373897302, -701558691, 38016083, -660478335, -405537848,
    568446438, -1019803690, -187363961, 1163531501, -1444681467, -51403784, 1735328473, -1926607734,
    -378558, -2022574463, 1839030562, -35309556, -1530992060, 1272893353, -155497632, -1094730640,
    681279174, -358537222, -722521979, 76029189, -640364487, -421815835, 530742520, -995338651,
    -198630844, 1126891415, -1416354905, -57434055, 1700485571, -1894986606, -1051523, -2054922799,
    1873313359, -30611744, -1560198380, 1309151649, -145523070, -1120210379, 718787259, -343485551,
  ]);

  const words = new Int32Array(padded.buffer);
  for (let chunk = 0; chunk < words.length; chunk += 16) {
    let [a, b, c, d] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d;
      d = c;
      c = b;
      const sum = (a + f + K[i] + words[chunk + g]) | 0;
      const rot = (sum << S[i]) | (sum >>> (32 - S[i]));
      b = (b + rot) | 0;
      a = tmp;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  const toHex = (n: number) => {
    const bytes4 = new Uint8Array(new Int32Array([n]).buffer);
    return Array.from(bytes4).map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
}

export function generatePayfastSignature(fields: Record<string, string>, passphrase: string): string {
  let paramString = buildParamString(fields);
  if (passphrase) {
    paramString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }
  return md5(paramString);
}

export interface PayfastOrderRequest {
  orderId: string;
  amount: number;
  itemName: string;
  buyerEmail: string;
  buyerFirstName?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

/** Builds the full field set + signature for a PayFast payment redirect form. */
export function buildPayfastPaymentFields(
  config: PayfastConfig,
  order: PayfastOrderRequest
): Record<string, string> {
  const fields: Record<string, string> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: order.returnUrl,
    cancel_url: order.cancelUrl,
    notify_url: order.notifyUrl,
    name_first: order.buyerFirstName ?? '',
    email_address: order.buyerEmail,
    m_payment_id: order.orderId,
    amount: order.amount.toFixed(2),
    item_name: order.itemName,
  };
  const signature = generatePayfastSignature(fields, config.passphrase);
  return { ...fields, signature };
}

/** Verifies an incoming ITN (Instant Transaction Notification) webhook payload. */
export function verifyPayfastItnSignature(payload: Record<string, string>, passphrase: string): boolean {
  const { signature, ...rest } = payload;
  const expected = generatePayfastSignature(rest, passphrase);
  return expected === signature;
}

/** PayFast ITN must be confirmed by calling back to PayFast's validate endpoint. */
export async function confirmPayfastItn(
  mode: PayfastConfig['mode'],
  rawBody: string
): Promise<boolean> {
  const res = await fetch(`${payfastHost(mode)}/eng/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: rawBody,
  });
  const text = await res.text();
  return text.trim() === 'VALID';
}

/** PayFast ITN requests only ever originate from these IP ranges. */
const PAYFAST_IP_HOSTS = ['www.payfast.co.za', 'sandbox.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'];

export async function isPayfastSourceIp(ip: string): Promise<boolean> {
  for (const host of PAYFAST_IP_HOSTS) {
    try {
      const res = await fetch(`https://dns.google/resolve?name=${host}&type=A`);
      const data = (await res.json()) as { Answer?: { data: string }[] };
      if (data.Answer?.some((a) => a.data === ip)) return true;
    } catch {
      // DNS lookup failure shouldn't block the whole check across all hosts
    }
  }
  return false;
}
