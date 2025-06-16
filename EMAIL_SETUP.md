# Email Setup Instructions

## 1. Create Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

## 2. Get API Key

1. Go to [https://resend.com/api-keys](https://resend.com/api-keys)
2. Click "Create API Key"
3. Name it "Wholesale Order System"
4. Copy the API key (starts with `re_`)

## 3. Add Domain (Optional but Recommended)

1. Go to [https://resend.com/domains](https://resend.com/domains)
2. Add your domain (e.g., `yourdomain.com`)
3. Follow DNS setup instructions
4. Once verified, you can send from `orders@yourdomain.com`

## 4. Environment Variables

Add to your `.env.local` file:

\`\`\`env
# Resend API Key (mandatory for sending emails)
RESEND_API_KEY=re_your_actual_api_key_here

# Application URL (used for links in emails, e.g., to admin panel)
# For local development, usually http://localhost:3000
# For production, your actual deployed application URL
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Email Configuration (optional, but recommended for production)

# The "From" address for emails sent via Resend.
# If not set, API routes will default to "Wholesale System <onboarding@resend.dev>".
# For production, it's highly recommended to use a custom domain verified with Resend (e.g., "noreply@yourdomain.com").
RESEND_FROM_EMAIL="Wholesale System <noreply@yourdomain.com>"

# The email address that receives admin notifications for new orders.
# This is mandatory for admin notifications to be sent.
ADMIN_EMAIL_RECIPIENT="your_admin_email@example.com"
\`\`\`

## 5. Install Dependencies

Run this command to install the Resend package:

\`\`\`bash
npm install resend
\`\`\`

## 6. Test Email Sending

1. Deploy your app or run locally
2. Place a test order
3. Check your email inbox for:
   - Customer confirmation email
   - Admin notification email (to the email address specified in ADMIN_EMAIL_RECIPIENT)

## 7. Email Limits

**Free Plan:**
- 100 emails/day
- 3,000 emails/month

**Paid Plans:**
- Start at $20/month for 50,000 emails
- No daily limits

## 8. Troubleshooting

**Common Issues:**
- Invalid API key: Double-check the key in .env.local
- Domain not verified: Use default resend.dev domain initially
- Rate limits: Upgrade plan if needed

**Check Logs:**
- Look for "✅ Email sent successfully" in console
- Check Resend dashboard for delivery status
