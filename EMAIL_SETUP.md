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
RESEND_API_KEY=re_your_actual_api_key_here
NEXT_PUBLIC_APP_URL=https://your-domain.com
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
   - Admin notification email (to kristophardivine@gmail.com)

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
