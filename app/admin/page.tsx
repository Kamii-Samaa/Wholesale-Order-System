"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Download, FileSpreadsheet, Trash2, Edit, ExternalLink, Copy } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import * as XLSX from "xlsx"
import EnhancedImport from "@/components/enhanced-import"

interface Product {
  id: number
  reference: string
  image_url: string | null
  brand: string | null
  section: string | null
  product_line: string | null
  description: string | null
  size: string | null
  bar_code: string | null
  retail_price: number | null
  wholesale_price: number | null
  stock: number
  reserved_stock?: number
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
  customer_id?: string
  order_items: OrderItem[]
}

interface OrderItem {
  id: number
  product_id: number
  quantity: number
  unit_price: number
  total_price: number
  products: Product
}

interface Customer {
  id: string
  business_name: string
  contact_name: string
  email: string
  phone: string
  created_at: string
}

export default function AdminPanel() {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState<number | null>(null)
  const [newCustomerId, setNewCustomerId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const [newProduct, setNewProduct] = useState({
    reference: "",
    brand: "",
    section: "",
    product_line: "",
    description: "",
    size: "",
    bar_code: "",
    retail_price: "",
    wholesale_price: "",
    stock: "",
    image_url: "",
  })

  const supabase = createClient()

  useEffect(() => {
    // Add error handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Ignore MetaMask-related errors
      if (
        event.reason?.message?.includes("MetaMask") ||
        event.reason?.message?.includes("ChromeTransport") ||
        event.reason?.message?.includes("connectChrome")
      ) {
        event.preventDefault()
        return
      }
      console.error("Unhandled promise rejection:", event.reason)
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    fetchData()

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [])

  const fetchData = async () => {
    try {
      setError(null)

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .order("reference")

      if (productsError) throw productsError
      setProducts(productsData || [])

      // Fetch orders with items
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            *,
            products (*)
          )
        `)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError
      setOrders(ordersData || [])

      // Fetch customers (if table exists)
      try {
        const { data: customersData, error: customersError } = await supabase
          .from("customers")
          .select("*")
          .order("created_at", { ascending: false })

        if (!customersError) {
          setCustomers(customersData || [])
        }
      } catch (error) {
        console.log("Customers table not yet created")
      }
    } catch (error: any) {
      console.error("Error fetching data:", error)
      setError(`Failed to load data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const addProduct = async () => {
    try {
      setError(null)

      if (!newProduct.reference || !newProduct.size) {
        setError("Reference and Size are required fields")
        return
      }

      const { error } = await supabase.from("products").insert({
        reference: newProduct.reference,
        brand: newProduct.brand || null,
        section: newProduct.section || null,
        product_line: newProduct.product_line || null,
        description: newProduct.description || null,
        size: newProduct.size || null,
        bar_code: newProduct.bar_code || null,
        retail_price: newProduct.retail_price ? Number.parseFloat(newProduct.retail_price) : null,
        wholesale_price: newProduct.wholesale_price ? Number.parseFloat(newProduct.wholesale_price) : null,
        stock: newProduct.stock ? Number.parseInt(newProduct.stock) : 0,
        image_url: newProduct.image_url || null,
      })

      if (error) throw error

      alert("Product added successfully!")
      setNewProduct({
        reference: "",
        brand: "",
        section: "",
        product_line: "",
        description: "",
        size: "",
        bar_code: "",
        retail_price: "",
        wholesale_price: "",
        stock: "",
        image_url: "",
      })
      fetchData()
    } catch (error: any) {
      console.error("Error adding product:", error)
      setError(`Error adding product: ${error.message}`)
    }
  }

  const updateProduct = async (product: Product) => {
    try {
      setError(null)

      const { error } = await supabase
        .from("products")
        .update({
          reference: product.reference,
          brand: product.brand,
          section: product.section,
          product_line: product.product_line,
          description: product.description,
          size: product.size,
          bar_code: product.bar_code,
          retail_price: product.retail_price,
          wholesale_price: product.wholesale_price,
          stock: product.stock,
          image_url: product.image_url,
        })
        .eq("id", product.id)

      if (error) throw error
      setEditingProduct(null)
      fetchData()
    } catch (error: any) {
      console.error("Error updating product:", error)
      setError(`Error updating product: ${error.message}`)
    }
  }

  const deleteProduct = async (productId: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return

    try {
      setError(null)

      const { error } = await supabase.from("products").delete().eq("id", productId)
      if (error) throw error
      fetchData()
    } catch (error: any) {
      console.error("Error deleting product:", error)
      setError(`Error deleting product: ${error.message}`)
    }
  }

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      setError(null)

      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId)
      if (error) throw error
      fetchData()
    } catch (error: any) {
      console.error("Error updating order status:", error)
      setError(`Error updating order status: ${error.message}`)
    }
  }

  const generateCustomerLink = () => {
    if (!newCustomerId.trim()) {
      alert("Please enter a customer ID")
      return
    }

    try {
      const link = `${window.location.origin}/customer/${newCustomerId}`

      // Try to copy to clipboard
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(link)
          .then(() => {
            alert(`Customer link copied to clipboard: ${link}`)
          })
          .catch(() => {
            // Fallback if clipboard API fails
            prompt("Copy this customer link:", link)
          })
      } else {
        // Fallback for non-secure contexts
        prompt("Copy this customer link:", link)
      }

      setNewCustomerId("")
    } catch (error) {
      console.error("Error generating customer link:", error)
      setError("Error generating customer link")
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
      setError("Error copying customer link")
    }
  }

  const exportProducts = () => {
    try {
      const headers = [
        "reference",
        "brand",
        "section",
        "product_line",
        "description",
        "size",
        "bar_code",
        "retail_price",
        "wholesale_price",
        "stock",
        "image_url",
      ]

      const csvContent = [
        headers.join(","),
        ...products.map((product) =>
          headers
            .map((header) => {
              const value = product[header as keyof Product]
              return value !== null && value !== undefined ? `"${value}"` : '""'
            })
            .join(","),
        ),
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "products.csv"
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error("Error exporting products:", error)
      setError(`Error exporting products: ${error.message}`)
    }
  }

  const exportProductsExcel = () => {
    try {
      const headers = [
        "reference",
        "brand",
        "section",
        "product_line",
        "description",
        "size",
        "bar_code",
        "retail_price",
        "wholesale_price",
        "stock",
        "image_url",
      ]

      const data = [
        headers,
        ...products.map((product) =>
          headers.map((header) => {
            const value = product[header as keyof Product]
            return value !== null && value !== undefined ? value : ""
          }),
        ),
      ]

      const worksheet = XLSX.utils.aoa_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Products")
      XLSX.writeFile(workbook, "products.xlsx")
    } catch (error: any) {
      console.error("Error exporting Excel:", error)
      setError(`Error exporting Excel: ${error.message}`)
    }
  }

  const getOrderStats = () => {
    const totalOrders = orders.length
    const pendingOrders = orders.filter((o) => o.status === "pending").length
    const totalRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0)
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    return { totalOrders, pendingOrders, totalRevenue, avgOrderValue }
  }

  const stats = getOrderStats()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading admin panel...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Wholesale Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              <a href="/" className="text-sm text-gray-600 hover:text-gray-900 underline">
                ← Back to Store
              </a>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-lg">{stats.totalOrders}</div>
                <div className="text-gray-600">Total Orders</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-orange-600">{stats.pendingOrders}</div>
                <div className="text-gray-600">Pending</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-green-600">₦{stats.totalRevenue.toLocaleString()}</div>
                <div className="text-gray-600">Total Revenue</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <Alert className="mb-6 border-red-500">
            <AlertDescription className="text-red-600 flex justify-between items-center">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
            <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
            <TabsTrigger value="import">Bulk Import</TabsTrigger>
            <TabsTrigger value="add-product">Add Product</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orders.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No orders yet.</p>
                  ) : (
                    orders.map((order) => (
                      <Card key={order.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">Order #{order.id}</CardTitle>
                              <p className="text-sm text-gray-600">
                                {order.customer_name} ({order.customer_email})
                              </p>
                              {order.customer_company && (
                                <p className="text-sm text-gray-600">{order.customer_company}</p>
                              )}
                              <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">₦{order.total_amount.toLocaleString()}</div>
                              <Select
                                value={order.status}
                                onValueChange={(value) => updateOrderStatus(order.id, value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="confirmed">Confirmed</SelectItem>
                                  <SelectItem value="shipped">Shipped</SelectItem>
                                  <SelectItem value="delivered">Delivered</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
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
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Products Management</CardTitle>
                  <div className="flex gap-2">
                    <Button onClick={exportProducts} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button onClick={exportProductsExcel} variant="outline">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Export Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No products yet. Import your product catalog to get started.</p>
                    <Button
                      onClick={() => {
                        const importTab = document.querySelector('[value="import"]') as HTMLElement
                        importTab?.click()
                      }}
                    >
                      Go to Import
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Wholesale Price</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Reserved</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.reference}</TableCell>
                            <TableCell>{product.brand || "-"}</TableCell>
                            <TableCell>{product.section || "-"}</TableCell>
                            <TableCell className="max-w-xs truncate">{product.description || "-"}</TableCell>
                            <TableCell>{product.size || "-"}</TableCell>
                            <TableCell>₦{product.wholesale_price?.toLocaleString() || "0"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  product.stock > 10 ? "default" : product.stock > 0 ? "secondary" : "destructive"
                                }
                              >
                                {product.stock}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{product.reserved_stock || 0}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setEditingProduct(product.id)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteProduct(product.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
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
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          generateCustomerLink()
                        }
                      }}
                    />
                    <Button onClick={generateCustomerLink} disabled={!newCustomerId.trim()}>
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

              {/* Database Setup Notice */}
              {customers.length === 0 && (
                <Alert>
                  <AlertDescription>
                    <strong>Setup Required:</strong> To enable customer management and real-time inventory, make sure
                    you've run the database setup SQL scripts in your Supabase SQL Editor.
                  </AlertDescription>
                </Alert>
              )}

              {/* Existing Customers */}
              <Card>
                <CardHeader>
                  <CardTitle>Existing Customers ({customers.length})</CardTitle>
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
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
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
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No customers yet. Generate customer links to get started.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="import">
            <EnhancedImport onImportComplete={fetchData} />
          </TabsContent>

          <TabsContent value="add-product">
            <Card>
              <CardHeader>
                <CardTitle>Add New Product</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Reference *"
                    value={newProduct.reference}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, reference: e.target.value }))}
                  />
                  <Input
                    placeholder="Size *"
                    value={newProduct.size}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, size: e.target.value }))}
                  />
                  <Input
                    placeholder="Brand"
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, brand: e.target.value }))}
                  />
                  <Input
                    placeholder="Section"
                    value={newProduct.section}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, section: e.target.value }))}
                  />
                  <Input
                    placeholder="Product Line"
                    value={newProduct.product_line}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, product_line: e.target.value }))}
                  />
                  <Input
                    placeholder="Bar Code"
                    value={newProduct.bar_code}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, bar_code: e.target.value }))}
                  />
                  <Input
                    placeholder="Description"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, description: e.target.value }))}
                    className="md:col-span-2"
                  />
                  <Input
                    placeholder="Retail Price"
                    type="number"
                    value={newProduct.retail_price}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, retail_price: e.target.value }))}
                  />
                  <Input
                    placeholder="Wholesale Price"
                    type="number"
                    value={newProduct.wholesale_price}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, wholesale_price: e.target.value }))}
                  />
                  <Input
                    placeholder="Stock Quantity"
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, stock: e.target.value }))}
                  />
                  <Input
                    placeholder="Image URL"
                    value={newProduct.image_url}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, image_url: e.target.value }))}
                  />
                </div>
                <Button onClick={addProduct} className="mt-4" disabled={!newProduct.reference || !newProduct.size}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
