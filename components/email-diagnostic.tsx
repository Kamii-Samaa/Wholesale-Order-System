"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Mail, Send } from "lucide-react"

export function EmailDiagnostic() {
  const [isTestingEmail, setIsTestingEmail] = useState(false)
  const [emailResults, setEmailResults] = useState<any>(null)

  const testEmailSending = async () => {
    setIsTestingEmail(true)
    setEmailResults(null)

    try {
      console.log("🧪 Testing email functionality...")

      // Test data
      const testOrder = {
        id: "TEST-" + Date.now(),
        created_at: new Date().toISOString(),
        total_amount: 25000,
        status: "pending",
      }

      const testCustomer = {
        id: "test-customer",
        customer_name: "Test Customer",
        customer_email: "kristophardivine@gmail.com", // Using your email for testing
        customer_company: "Test Company",
        customer_phone: "+234-123-456-7890",
      }

      const testItems = [
        {
          description: "Test Product",
          reference: "TEST-001",
          size: "M",
          quantity: 2,
          wholesale_price: 12500,
        },
      ]

      console.log("📧 Sending test customer confirmation...")

      const customerResponse = await fetch("/api/send-customer-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: testOrder,
          customer: testCustomer,
          items: testItems,
        }),
      })

      const customerResult = await customerResponse.json()

      console.log("📧 Sending test admin notification...")

      const adminResponse = await fetch("/api/send-order-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: testOrder,
          customer: testCustomer,
          items: testItems,
        }),
      })

      const adminResult = await adminResponse.json()

      setEmailResults({
        customerEmail: {
          success: customerResponse.ok,
          result: customerResult,
          status: customerResponse.status,
        },
        adminEmail: {
          success: adminResponse.ok,
          result: adminResult,
          status: adminResponse.status,
        },
      })
    } catch (error: any) {
      console.error("❌ Email test failed:", error)
      setEmailResults({
        error: error.message,
        customerEmail: { success: false, result: { error: error.message } },
        adminEmail: { success: false, result: { error: error.message } },
      })
    } finally {
      setIsTestingEmail(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email System Diagnostic
        </CardTitle>
        <CardDescription>Test the email sending functionality using Resend's sandbox domain</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Using: onboarding@resend.dev (sandbox)</Badge>
          <Badge variant="secondary">No domain verification needed</Badge>
        </div>

        <Button onClick={testEmailSending} disabled={isTestingEmail} className="w-full">
          <Send className="h-4 w-4 mr-2" />
          {isTestingEmail ? "Testing Email System..." : "Test Email Sending"}
        </Button>

        {emailResults && (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Email Result */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {emailResults.customerEmail?.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    Customer Email
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Badge variant={emailResults.customerEmail?.success ? "default" : "destructive"}>
                    Status: {emailResults.customerEmail?.status || "Error"}
                  </Badge>
                  {emailResults.customerEmail?.result?.emailId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Email ID: {emailResults.customerEmail.result.emailId}
                    </p>
                  )}
                  {emailResults.customerEmail?.result?.error && (
                    <p className="text-xs text-red-500 mt-1">Error: {emailResults.customerEmail.result.error}</p>
                  )}
                </CardContent>
              </Card>

              {/* Admin Email Result */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {emailResults.adminEmail?.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    Admin Email
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Badge variant={emailResults.adminEmail?.success ? "default" : "destructive"}>
                    Status: {emailResults.adminEmail?.status || "Error"}
                  </Badge>
                  {emailResults.adminEmail?.result?.emailId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Email ID: {emailResults.adminEmail.result.emailId}
                    </p>
                  )}
                  {emailResults.adminEmail?.result?.error && (
                    <p className="text-xs text-red-500 mt-1">Error: {emailResults.adminEmail.result.error}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Raw Results */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Raw Response Data</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(emailResults, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Fixed:</strong> Now using Resend's sandbox domain (onboarding@resend.dev)
          </p>
          <p>✅ No domain verification required for testing</p>
          <p>✅ Emails will be sent to kristophardivine@gmail.com</p>
          <p>✅ Check your inbox after testing</p>
        </div>
      </CardContent>
    </Card>
  )
}
