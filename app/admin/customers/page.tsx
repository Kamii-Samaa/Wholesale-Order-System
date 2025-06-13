"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Copy, ExternalLink, Plus } from "lucide-react"

interface Customer {
  id: string
  business_name: string
  contact_name: string
  email: string
  phone: string
  created_at: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [newCustomerId, setNewCustomerId] = useState("")

  const supabase = createClient()

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateCustomerLink = () => {
    if (!newCustomerId.trim()) {
      alert("Please enter a customer ID")
      return
    }

    const link = `${window.location.origin}/customer/${newCustomerId}`
    navigator.clipboard.writeText(link)
    alert(`Customer link copied to clipboard: ${link}`)
    setNewCustomerId("")
  }

  const copyCustomerLink = (customerId: string) => {
    const link = `${window.location.origin}/customer/${customerId}`
    navigator.clipboard.writeText(link)
    alert("Customer link copied to clipboard!")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading customers...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
            <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900 underline">
              ← Back to Admin
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Generate New Customer Link */}
          <Card>
            <CardHeader>
              <CardTitle>Generate Customer Link</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  placeholder="Enter unique customer ID (e.g., customer-123, abc-corp)"
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={generateCustomerLink}>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Link
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Create a unique link for each wholesale customer. They'll need to provide their business information
                when first accessing the link.
              </p>
            </CardContent>
          </Card>

          {/* Existing Customers */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Customers ({customers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer ID</TableHead>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.id}</TableCell>
                      <TableCell>{customer.business_name}</TableCell>
                      <TableCell>{customer.contact_name}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>{new Date(customer.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyCustomerLink(customer.id)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/customer/${customer.id}`, "_blank")}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
