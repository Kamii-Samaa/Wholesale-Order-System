"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExternalLink, Copy, Package, User } from "lucide-react"

interface Customer {
  id: string
  business_name: string
  contact_name: string
  email: string
  phone: string
  created_at: string
}

interface Order {
  id: number
  customer_name: string
  customer_email: string
  customer_company: string | null
  customer_phone: string | null
  total_amount: number
  status: string
  created_at: string
  order_items: OrderItem[]
}

interface OrderItem {
  id: number
  product_id: number
  quantity: number
  unit_price: number
  total_price: number
  products: {
    reference: string
    description: string
    size: string
  }
}

export default function CustomerManagementPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerOrders, setCustomerOrders] = useState<{ [key: string]: Order[] }>({})
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false })

      if (customersError) throw customersError
      setCustomers(customersData || [])

      // Fetch orders for each customer
      const ordersMap: { [key: string]: Order[] } = {}
      for (const customer of customersData || []) {
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select(`
            *,
            order_items (
              *,
              products (reference, description, size)
            )
          `)
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })

        if (!ordersError) {
          ordersMap[customer.id] = ordersData || []
        }
      }
      setCustomerOrders(ordersMap)
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setLoading(false)
    }
  }

  const copyCustomerLink = (customerId: string) => {
    try {
      const link = `${window.location.origin}/customer/${customerId}`

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(link)
          .then(() => {
            alert("Customer link copied to clipboard!")
          })
          .catch(() => {
            prompt("Copy this customer link:", link)
          })
      } else {
        prompt("Copy this customer link:", link)
      }
    } catch (error) {
      console.error("Error copying customer link:", error)
    }
  }

  const getCustomerStats = (customerId: string) => {
    const orders = customerOrders[customerId] || []
    const totalOrders = orders.length
    const totalSpent = orders.reduce((sum, order) => sum + order.total_amount, 0)
    const pendingOrders = orders.filter((o) => o.status === "pending").length

    return { totalOrders, totalSpent, pendingOrders }
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
            <div className="flex items-center gap-4">
              <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900 underline">
                ← Back to Admin
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Customer Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>All Customers ({customers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {customers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer ID</TableHead>
                        <TableHead>Business Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead>Total Spent</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => {
                        const stats = getCustomerStats(customer.id)
                        return (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.id}</TableCell>
                            <TableCell>{customer.business_name}</TableCell>
                            <TableCell>{customer.contact_name}</TableCell>
                            <TableCell>{customer.email}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{stats.totalOrders}</Badge>
                                {stats.pendingOrders > 0 && (
                                  <Badge variant="secondary">{stats.pendingOrders} pending</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-green-600">₦{stats.totalSpent.toLocaleString()}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => copyCustomerLink(customer.id)}>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy Link
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(`/customer/${customer.id}`, "_blank")}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setSelectedCustomer(customer.id)}>
                                  <Package className="h-3 w-3 mr-1" />
                                  Orders
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-gray-500 text-center py-8">No customers yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <div className="space-y-6">
              {selectedCustomer ? (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>
                        Orders for {customers.find((c) => c.id === selectedCustomer)?.business_name}
                      </CardTitle>
                      <Button variant="outline" onClick={() => setSelectedCustomer(null)}>
                        Back to All Customers
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {customerOrders[selectedCustomer]?.length > 0 ? (
                      <div className="space-y-4">
                        {customerOrders[selectedCustomer].map((order) => (
                          <Card key={order.id}>
                            <CardHeader>
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-lg">Order #{order.id}</CardTitle>
                                  <p className="text-sm text-gray-500">
                                    {new Date(order.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">₦{order.total_amount.toLocaleString()}</div>
                                  <Badge
                                    variant={
                                      order.status === "pending"
                                        ? "secondary"
                                        : order.status === "confirmed"
                                          ? "default"
                                          : "outline"
                                    }
                                  >
                                    {order.status.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Unit Price</TableHead>
                                    <TableHead>Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {order.order_items.map((item) => (
                                    <TableRow key={item.id}>
                                      <TableCell>
                                        <div>
                                          <div className="font-medium">{item.products.description}</div>
                                          <div className="text-sm text-gray-500">
                                            {item.products.reference} • Size: {item.products.size}
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell>{item.quantity}</TableCell>
                                      <TableCell>₦{item.unit_price.toLocaleString()}</TableCell>
                                      <TableCell>₦{item.total_price.toLocaleString()}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No orders for this customer yet.</p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Select a Customer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {customers.map((customer) => {
                        const stats = getCustomerStats(customer.id)
                        return (
                          <Card
                            key={customer.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setSelectedCustomer(customer.id)}
                          >
                            <CardContent className="p-4">
                              <h3 className="font-medium">{customer.business_name}</h3>
                              <p className="text-sm text-gray-500">{customer.contact_name}</p>
                              <div className="mt-2 flex justify-between text-sm">
                                <span>{stats.totalOrders} orders</span>
                                <span className="font-medium text-green-600">₦{stats.totalSpent.toLocaleString()}</span>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
