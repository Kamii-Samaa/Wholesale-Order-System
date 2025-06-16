import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
  console.error("RESEND_API_KEY is not set. Email functionality will be disabled.");
}
const resend = new Resend(resendApiKey);

// Environment variable for FROM email
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Wholesale System <onboarding@resend.dev>";

if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_FROM_EMAIL) {
  console.warn("Warning: RESEND_FROM_EMAIL environment variable is not set. Using default fallback.");
}

/**
 * @interface OrderItem
 * @description Represents an item in the order.
 * @property {string} description - Description of the item.
 * @property {string} reference - Reference code of the item.
 * @property {string} [size] - Size of the item (optional).
 * @property {number} quantity - Quantity of the item.
 * @property {number} wholesale_price - Wholesale price of the item.
 */
interface OrderItem {
  description: string;
  reference: string;
  size?: string;
  quantity: number;
  wholesale_price: number;
}

/**
 * @interface CustomerDetails
 * @description Represents the customer's details.
 * @property {string} [email] - Customer's primary email.
 * @property {string} [customer_email] - Customer's alternative email.
 * @property {string} [business_name] - Customer's business name.
 * @property {string} [customer_company] - Customer's alternative company name.
 * @property {string} [contact_name] - Customer's primary contact name.
 * @property {string} [customer_name] - Customer's alternative name.
 * @property {string} [phone] - Customer's primary phone number.
 * @property {string} [customer_phone] - Customer's alternative phone number.
 */
interface CustomerDetails {
  email?: string;
  customer_email?: string;
  business_name?: string;
  customer_company?: string;
  contact_name?: string;
  customer_name?: string;
  phone?: string;
  customer_phone?: string;
}

/**
 * @interface OrderDetails
 * @description Represents the order's details.
 * @property {string | number} id - The order ID.
 * @property {string | Date} created_at - The order creation timestamp.
 * @property {number} total_amount - The total amount of the order.
 */
interface OrderDetails {
  id: string | number;
  created_at: string | Date;
  total_amount: number;
}

/**
 * @interface ConfirmationEmailPayload
 * @description Defines the expected payload for the customer confirmation email.
 * @property {OrderDetails} order - Details of the order.
 * @property {CustomerDetails} customer - Details of the customer.
 * @property {OrderItem[]} items - Array of items in the order.
 */
interface ConfirmationEmailPayload {
  order: OrderDetails;
  customer: CustomerDetails;
  items: OrderItem[];
}

/**
 * POST handler for sending customer confirmation emails.
 * @param {NextRequest} request - The incoming Next.js request.
 * @returns {NextResponse} A Next.js response.
 */
export async function POST(request: NextRequest) {
  if (!resendApiKey) {
    console.error("Resend API key not configured, cannot send email.");
    return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });
  }
  try {
    const body: ConfirmationEmailPayload = await request.json();
    const { order, customer, items } = body;

    // Basic Payload Validation
    if (!order || !customer || !items) {
      return NextResponse.json({ error: "Missing order, customer, or items data" }, { status: 400 });
    }
    if (!order.id || !order.created_at || order.total_amount === undefined || order.total_amount === null) {
      return NextResponse.json({ error: "Missing essential order details (id, created_at, total_amount)" }, { status: 400 });
    }
    if (!customer.email && !customer.customer_email) {
      return NextResponse.json({ error: "Customer email is required" }, { status: 400 });
    }
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Items must be an array" }, { status: 400 });
    }
    // Optional: check if items array is not empty, depending on business logic.
    // For now, allowing empty items array.

    console.log("📧 Processing customer confirmation email...")
    console.log("Order:", order)
    console.log("Customer:", customer)
    console.log("Items:", items.length)

    // Generate customer confirmation email HTML
    const orderItemsHTML = items
      .map(
        (item: OrderItem) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; text-align: left;">${item.description}</td>
        <td style="padding: 12px; text-align: center;">${item.reference}</td>
        <td style="padding: 12px; text-align: center;">${item.size || "N/A"}</td>
        <td style="padding: 12px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; text-align: right;">₦${item.wholesale_price?.toLocaleString()}</td>
        <td style="padding: 12px; text-align: right;">₦${(item.wholesale_price * item.quantity).toLocaleString()}</td>
      </tr>
    `,
      )
      .join("")

    const customerEmailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #059669; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="margin: 0;">✅ ORDER CONFIRMED</h1>
          <p style="margin: 10px 0 0 0;">Thank you for your wholesale order! We've received your order and will process it shortly.</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Order Details</h2>
          <p><strong>Order ID:</strong> #${order.id}</p>
          <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()} at ${new Date(order.created_at).toLocaleTimeString()}</p>
          <p><strong>Status:</strong> <span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PENDING PROCESSING</span></p>
          <p><strong>Total Amount:</strong> <span style="color: #059669; font-size: 18px; font-weight: bold;">₦${order.total_amount.toLocaleString()}</span></p>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Your Information</h2>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
            <p><strong>Business Name:</strong> ${customer.business_name || customer.customer_company || "N/A"}</p>
            <p><strong>Contact Person:</strong> ${customer.contact_name || customer.customer_name}</p>
            <p><strong>Email:</strong> ${customer.email || customer.customer_email}</p>
            <p><strong>Phone:</strong> ${customer.phone || customer.customer_phone || "N/A"}</p>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Order Items (${items.length} items)</h2>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-weight: 600;">Product</th>
                <th style="padding: 12px; text-align: center; font-weight: 600;">Reference</th>
                <th style="padding: 12px; text-align: center; font-weight: 600;">Size</th>
                <th style="padding: 12px; text-align: center; font-weight: 600;">Qty</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Unit Price</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHTML}
            </tbody>
          </table>
        </div>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <div style="text-align: center;">
            <h3 style="margin: 0 0 15px 0; color: #059669;">Order Total: ₦${order.total_amount.toLocaleString()}</h3>
            <p style="margin: 0; color: #6b7280;">We'll send you updates as your order is processed.</p>
          </div>
        </div>

        <div style="background: #dbeafe; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <h3 style="margin: 0 0 10px 0; color: #1e40af;">What's Next?</h3>
          <p style="margin: 0; color: #1e40af;">
            Your order is now being processed by our team. You'll receive email updates as your order status changes.
            If you have any questions, please contact us.
          </p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
          <p>Thank you for your business!</p>
          <p>&copy; ${new Date().getFullYear()} Wholesale Order System. All rights reserved.</p>
        </div>
      </body>
      </html>
    `

    // Send customer confirmation email
    const recipientEmail = customer.email || customer.customer_email;
    if (!recipientEmail) {
      // This case should ideally be caught by validation, but as a safeguard:
      return NextResponse.json({ error: "Customer email is missing." }, { status: 400 });
    }

    const { data, error: resendError } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [recipientEmail],
      subject: `✅ Order Confirmation #${order.id} - ₦${order.total_amount.toLocaleString()}`,
      html: customerEmailHTML,
    });

    if (resendError) {
      console.error("Resend error:", resendError);
      // It's better to throw and let the catch block handle it for consistent error response
      throw new Error(`Failed to send customer confirmation: ${resendError.message}`);
    }

    console.log("✅ Customer confirmation email sent successfully:", data);

    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (err: any) { // Catching 'any' type as error structure can vary
    console.error("Error sending customer confirmation:", err);
    // Check if it's an error from our explicit validation or a generic server error
    if (err.message.startsWith("Failed to send customer confirmation:") || err.message.startsWith("Email service is not configured")) {
         return NextResponse.json({ error: err.message }, { status: 500 });
    }
    // For payload validation errors, they are returned directly, so this catch is for other errors.
    // If it's a JSON parsing error or other unexpected error:
    return NextResponse.json({ error: `Failed to process request: ${err.message}` }, { status: 500 });
  }
}
