"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"

export function EnvDiagnostic() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const resendKey = process.env.RESEND_API_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const checkUrl = (url: string | undefined) => {
    if (!url) return { status: "missing", message: "Not set" }
    try {
      new URL(url)
      return { status: "valid", message: "Valid URL" }
    } catch {
      return { status: "invalid", message: "Invalid URL format" }
    }
  }

  const checkKey = (key: string | undefined, name: string) => {
    if (!key) return { status: "missing", message: "Not set" }
    if (key.length < 10) return { status: "invalid", message: "Too short" }
    return { status: "valid", message: "Present" }
  }

  const urlCheck = checkUrl(supabaseUrl)
  const keyCheck = checkKey(supabaseKey, "Supabase Key")
  const resendCheck = checkKey(resendKey, "Resend Key")
  const appUrlCheck = checkUrl(appUrl)

  const getIcon = (status: string) => {
    switch (status) {
      case "valid":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "invalid":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "missing":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case "valid":
        return "default"
      case "invalid":
        return "destructive"
      case "missing":
        return "secondary"
      default:
        return "outline"
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Environment Variables Diagnostic</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getIcon(urlCheck.status)}
              <span className="text-sm">NEXT_PUBLIC_SUPABASE_URL</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getBadgeVariant(urlCheck.status)}>{urlCheck.message}</Badge>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                {supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : "undefined"}
              </code>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getIcon(keyCheck.status)}
              <span className="text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getBadgeVariant(keyCheck.status)}>{keyCheck.message}</Badge>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                {supabaseKey ? `${supabaseKey.substring(0, 20)}...` : "undefined"}
              </code>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getIcon(resendCheck.status)}
              <span className="text-sm">RESEND_API_KEY</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getBadgeVariant(resendCheck.status)}>{resendCheck.message}</Badge>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                {resendKey ? `${resendKey.substring(0, 10)}...` : "undefined"}
              </code>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getIcon(appUrlCheck.status)}
              <span className="text-sm">NEXT_PUBLIC_APP_URL</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getBadgeVariant(appUrlCheck.status)}>{appUrlCheck.message}</Badge>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">{appUrl || "undefined"}</code>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Your existing Supabase project and data are safe. This diagnostic helps identify
            configuration issues without affecting your database.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
