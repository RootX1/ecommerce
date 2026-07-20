// Table-based HTML email layout (max compatibility across mail clients),
// styled to match the storefront's brand and read like a standard
// WooCommerce order-confirmation email: clear sections, evenly spaced
// rows, one accent color used sparingly.
import type { BacsAccountDetail } from './woocommerce';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatZar(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

const FIELD_LABELS: Record<string, string> = {
  account_name: 'Account name',
  account_number: 'Account number',
  bank_name: 'Bank',
  sort_code: 'Branch code',
  iban: 'IBAN',
  bic: 'SWIFT/BIC',
};

export interface OrderConfirmationEmailInput {
  orderId: number;
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  postcode: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  itemsTotal: number;
  shippingCost: number;
  shippingTitle: string;
  total: number;
  instructions: string;
  accountDetails: BacsAccountDetail[];
}

export function renderOrderConfirmationEmail(order: OrderConfirmationEmailInput): string {
  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eceff2;font-size:14px;color:#16181c;">${escapeHtml(item.name)} &times; ${item.quantity}</td>
        <td style="padding:12px 0;border-bottom:1px solid #eceff2;font-size:14px;color:#16181c;text-align:right;">${formatZar(item.unitPrice * item.quantity)}</td>
      </tr>`
    )
    .join('');

  const accountRows = order.accountDetails
    .flatMap((account) =>
      Object.entries(account)
        .filter(([, value]) => !!value)
        .map(
          ([key, value]) => `
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#5b6068;width:40%;">${FIELD_LABELS[key] ?? key}</td>
          <td style="padding:8px 0;font-size:13px;color:#16181c;font-weight:700;">${escapeHtml(String(value))}</td>
        </tr>`
        )
    )
    .join('');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f2f3f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f3f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#00406d;padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.01em;">ecommercegoods.co.za</span>
                <br />
                <span style="color:#ebdc3a;font-size:13px;font-weight:600;">Personalised Gifts</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 8px;font-size:16px;color:#16181c;">Hi ${escapeHtml(order.firstName)},</p>
                <p style="margin:0 0 24px;font-size:14px;color:#5b6068;">
                  Thanks for your order! Here's a summary of <strong>Order #${order.orderId}</strong>.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                  <tr>
                    <td style="padding:0 0 10px;font-size:12px;font-weight:700;color:#5b6068;text-transform:uppercase;letter-spacing:0.04em;border-bottom:2px solid #eceff2;">Product</td>
                    <td style="padding:0 0 10px;font-size:12px;font-weight:700;color:#5b6068;text-transform:uppercase;letter-spacing:0.04em;border-bottom:2px solid #eceff2;text-align:right;">Total</td>
                  </tr>
                  ${itemRows}
                  <tr>
                    <td style="padding:12px 0 4px;font-size:13px;color:#5b6068;">Subtotal</td>
                    <td style="padding:12px 0 4px;font-size:13px;color:#5b6068;text-align:right;">${formatZar(order.itemsTotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#5b6068;">${escapeHtml(order.shippingTitle)}</td>
                    <td style="padding:4px 0;font-size:13px;color:#5b6068;text-align:right;">${order.shippingCost > 0 ? formatZar(order.shippingCost) : 'Free'}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0 0;font-size:16px;font-weight:800;color:#16181c;border-top:2px solid #16181c;">Total</td>
                    <td style="padding:10px 0 0;font-size:16px;font-weight:800;color:#16181c;text-align:right;border-top:2px solid #16181c;">${formatZar(order.total)}</td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;border-radius:6px;margin-bottom:20px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#5b6068;text-transform:uppercase;letter-spacing:0.04em;">Delivering to</p>
                      <p style="margin:0;font-size:14px;color:#16181c;line-height:1.5;">
                        ${escapeHtml(order.firstName)} ${escapeHtml(order.lastName)}<br />
                        ${escapeHtml(order.address1)}<br />
                        ${escapeHtml(order.city)}, ${escapeHtml(order.postcode)}
                      </p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;border-radius:6px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#5b6068;text-transform:uppercase;letter-spacing:0.04em;">Payment: Direct bank transfer</p>
                      ${order.instructions ? `<p style="margin:0 0 12px;font-size:13px;color:#5b6068;">${escapeHtml(order.instructions)}</p>` : ''}
                      ${accountRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${accountRows}</table>` : ''}
                      <p style="margin:12px 0 0;font-size:13px;color:#16181c;">
                        Please use <strong>"Order #${order.orderId}"</strong> as your payment reference so we can match your transfer.
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:13px;color:#5b6068;">We'll be in touch once your payment is confirmed.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f7f8fa;text-align:center;">
                <p style="margin:0;font-size:12px;color:#8a8f98;">ecommercegoods.co.za · Cape Town, South Africa</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
