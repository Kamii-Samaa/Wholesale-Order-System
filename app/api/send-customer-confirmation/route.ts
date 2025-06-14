import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { order, customer, items } = await request.json()

    // Generate order confirmation email HTML
    const orderItemsHTML = items
      .map(
        (item: any) => `
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

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin: 0;">Order Confirmation</h1>
          <p style="margin: 10px 0 0 0; color: #666;">Thank you for your wholesale order!</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Order Details</h2>
          <p><strong>Order ID:</strong> #${order.id}</p>
          <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
          <p><strong>Status:</strong> <span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PENDING</span></p>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Customer Information</h2>
          <p><strong>Business:</strong> ${customer.business_name || customer.customer_company || "N/A"}</p>
          <p><strong>Contact:</strong> ${customer.contact_name || customer.customer_name}</p>
          <p><strong>Email:</strong> ${customer.email || customer.customer_email}</p>
          <p><strong>Phone:</strong> ${customer.phone || customer.customer_phone || "N/A"}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Order Items</h2>
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
          <div style="text-align: right;">
            <h3 style="margin: 0; color: #059669;">Total Amount: ₦${order.total_amount.toLocaleString()}</h3>
          </div>
        </div>

        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb;">
          <h3 style="margin: 0 0 10px 0; color: #1e40af;">What's Next?</h3>
          <p style="margin: 0; color: #1e40af;">
            We've received your order and will process it shortly. You'll receive another email once your order status changes. 
            If you have any questions, please contact our sales team at kristophardivine@gmail.com.
          </p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
        </div>
      </body>
      </html>
    `

    // Send customer confirmation email
    const customerEmail = customer.email || customer.customer_email
    if (!customerEmail) {
      throw new Error("Customer email is required")
    }

    const { data, error } = await resend.emails.send({
      from: "Wholesale Orders <kristophardivine@gmail.com>",
      to: [customerEmail],
      subject: `Order Confirmation #${order.id} - Thank you for your order!`,
      html: emailHTML,
    })

    if (error) {
      console.error("Resend error:", error)
      throw new Error(`Failed to send email: ${error.message}`)
    }

    console.log("✅ Customer confirmation email sent successfully:", data)

    // Also send notification to admin
    await fetch(`${request.nextUrl.origin}/api/send-order-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, customer, items }),
    })

    return NextResponse.json({ success: true, emailId: data?.id })
  } catch (error: any) {
    console.error("Error sending customer confirmation:", error)
    return NextResponse.json({ error: `Failed to send confirmation: ${error.message}` }, { status: 500 })
  }
}
