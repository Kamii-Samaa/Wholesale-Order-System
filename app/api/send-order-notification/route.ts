import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { order, customer, items } = await request.json()

    // Generate admin notification email HTML
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

    const adminEmailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Wholesale Order</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="margin: 0;">🚨 NEW WHOLESALE ORDER</h1>
          <p style="margin: 10px 0 0 0;">You have received a new wholesale order that requires processing.</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Order Details</h2>
          <p><strong>Order ID:</strong> #${order.id}</p>
          <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()} at ${new Date(order.created_at).toLocaleTimeString()}</p>
          <p><strong>Status:</strong> <span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PENDING PROCESSING</span></p>
          <p><strong>Total Amount:</strong> <span style="color: #059669; font-size: 18px; font-weight: bold;">₦${order.total_amount.toLocaleString()}</span></p>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Customer Information</h2>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
            <p><strong>Business Name:</strong> ${customer.business_name || customer.customer_company || "N/A"}</p>
            <p><strong>Contact Person:</strong> ${customer.contact_name || customer.customer_name}</p>
            <p><strong>Email:</strong> <a href="mailto:${customer.email || customer.customer_email}" style="color: #2563eb;">${customer.email || customer.customer_email}</a></p>
            <p><strong>Phone:</strong> ${customer.phone || customer.customer_phone || "N/A"}</p>
            ${customer.customer_id ? `<p><strong>Customer ID:</strong> ${customer.customer_id}</p>` : ""}
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
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              View in Admin Panel
            </a>
          </div>
        </div>

        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <h3 style="margin: 0 0 10px 0; color: #92400e;">Action Required</h3>
          <p style="margin: 0; color: #92400e;">
            Please review this order in your admin panel and update the status accordingly. 
            The customer has been sent a confirmation email and is waiting for processing.
          </p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
          <p>This is an automated notification from your wholesale order system.</p>
          <p>&copy; ${new Date().getFullYear()} Wholesale Order System. All rights reserved.</p>
        </div>
      </body>
      </html>
    `

    // Send admin notification email using Resend's sandbox domain
    const { data, error } = await resend.emails.send({
      from: "Wholesale System <onboarding@resend.dev>", // Using Resend's verified sandbox domain
      to: ["kristophardivine@gmail.com"], // Your admin email as recipient
      subject: `🚨 NEW ORDER #${order.id} - ₦${order.total_amount.toLocaleString()} from ${customer.business_name || customer.customer_company || customer.contact_name || customer.customer_name}`,
      html: adminEmailHTML,
    })

    if (error) {
      console.error("Resend error:", error)
      throw new Error(`Failed to send admin notification: ${error.message}`)
    }

    console.log("✅ Admin notification email sent successfully:", data)

    return NextResponse.json({ success: true, emailId: data?.id })
  } catch (error: any) {
    console.error("Error sending order notification:", error)
    return NextResponse.json({ error: `Failed to send notification: ${error.message}` }, { status: 500 })
  }
}
