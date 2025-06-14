"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Search, Plus, Minus, Building2 } from "lucide-react"
import { useParams } from "next/navigation"
import { ProductCard } from "@/components/product-card"

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
  reserved_stock: number
}

interface CartItem extends Product {
  quantity: number
}

interface Customer {
  id: string
  business_name: string
  contact_name: string
  email: string
  phone: string
  created_at: string
}

interface ProductGroup {
  reference: string
  brand: string | null
  section: string | null
  product_line: string | null
  description: string | null
  image_url: string | null
  retail_price: number | null
  wholesale_price: number | null
  variants: Product[]
}

export default function CustomerOrderPage() {
  const params = useParams()
  const customerId = params.customerId as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [showCart, setShowCart] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authForm, setAuthForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
  })

  const supabase = createClient()

  useEffect(() => {
    checkCustomerAuth()
  }, [customerId])

  useEffect(() => {
    if (isAuthenticated) {
      fetchProducts()
      // Set up real-time subscription for stock updates
      const subscription = supabase
        .channel("stock-updates")
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => {
          console.log("Stock update received:", payload)
          fetchProducts()
        })
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [isAuthenticated])

  const checkCustomerAuth = async () => {
    try {
      const { data, error } = await supabase.from("customers").select("*").eq("id", customerId).single()

      if (error && error.code !== "PGRST116") throw error

      if (data) {
        setCustomer(data)
        setIsAuthenticated(true)
      }
    } catch (error) {
      console.error("Error checking customer:", error)
    } finally {
      setLoading(false)
    }
  }

  const authenticateCustomer = async () => {
    if (!authForm.business_name || !authForm.contact_name || !authForm.email) {
      alert("Please fill in all required fields")
      return
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .upsert({
          id: customerId,
          business_name: authForm.business_name,
          contact_name: authForm.contact_name,
          email: authForm.email,
          phone: authForm.phone,
        })
        .select()
        .single()

      if (error) throw error

      setCustomer(data)
      setIsAuthenticated(true)
    } catch (error) {
      console.error("Error authenticating customer:", error)
      alert("Error saving customer information")
    }
  }

  const groupProductsByReference = (products: Product[]): ProductGroup[] => {
    const groupMap = new Map<string, ProductGroup>()

    products.forEach((product) => {
      const key = product.reference
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          reference: product.reference,
          brand: product.brand,
          section: product.section,
          product_line: product.product_line,
          description: product.description,
          image_url: product.image_url,
          retail_price: product.retail_price,
          wholesale_price: product.wholesale_price,
          variants: [],
        })
      }
      groupMap.get(key)!.variants.push(product)
    })

    return Array.from(groupMap.values())
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from("products").select("*, reserved_stock").order("reference")

      if (error) throw error
      setProducts(data || [])

      // Group products by reference
      const groups = groupProductsByReference(data || [])
      setProductGroups(groups)
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }

  const addToCart = async (product: Product) => {
    const availableStock = product.stock - (product.reserved_stock || 0)
    const currentCartQuantity = cart.find((item) => item.id === product.id)?.quantity || 0

    if (currentCartQuantity >= availableStock) {
      alert("Not enough stock available")
      return
    }

    try {
      // Reserve stock in real-time
      const { error } = await supabase
        .from("products")
        .update({
          reserved_stock: (product.reserved_stock || 0) + 1,
        })
        .eq("id", product.id)

      if (error) throw error

      setCart((prev) => {
        const existing = prev.find((item) => item.id === product.id)
        if (existing) {
          return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        }
        return [...prev, { ...product, quantity: 1 }]
      })

      // Refresh products to show updated stock
      fetchProducts()
    } catch (error) {
      console.error("Error reserving stock:", error)
      alert("Error adding item to cart")
    }
  }

  const updateQuantity = async (productId: number, newQuantity: number) => {
    const cartItem = cart.find((item) => item.id === productId)
    if (!cartItem) return

    const quantityDiff = newQuantity - cartItem.quantity

    if (newQuantity === 0) {
      // Remove from cart and unreserve all stock
      try {
        const { error } = await supabase
          .from("products")
          .update({
            reserved_stock: Math.max(0, (cartItem.reserved_stock || 0) - cartItem.quantity),
          })
          .eq("id", productId)

        if (error) throw error

        setCart((prev) => prev.filter((item) => item.id !== productId))
        fetchProducts()
      } catch (error) {
        console.error("Error updating stock:", error)
      }
    } else {
      // Update quantity and adjust reserved stock
      try {
        const product = products.find((p) => p.id === productId)
        if (!product) return

        const newReservedStock = Math.max(0, (product.reserved_stock || 0) + quantityDiff)

        const { error } = await supabase
          .from("products")
          .update({ reserved_stock: newReservedStock })
          .eq("id", productId)

        if (error) throw error

        setCart((prev) => prev.map((item) => (item.id === productId ? { ...item, quantity: newQuantity } : item)))
        fetchProducts()
      } catch (error) {
        console.error("Error updating quantity:", error)
      }
    }
  }

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.wholesale_price || 0) * item.quantity, 0)
  }

  const submitOrder = async () => {
    if (!customer || cart.length === 0) {
      alert("Please add items to cart before submitting")
      return
    }

    try {
      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: customer.id,
          customer_name: customer.contact_name,
          customer_email: customer.email,
          customer_company: customer.business_name,
          customer_phone: customer.phone,
          total_amount: getTotalAmount(),
          status: "pending",
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.wholesale_price,
        total_price: (item.wholesale_price || 0) * item.quantity,
      }))

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems)
      if (itemsError) throw itemsError

      // Convert reserved stock to actual stock reduction
      for (const item of cart) {
        const { error } = await supabase
          .from("products")
          .update({
            stock: Math.max(0, item.stock - item.quantity),
            reserved_stock: Math.max(0, (item.reserved_stock || 0) - item.quantity),
          })
          .eq("id", item.id)

        if (error) throw error
      }

      // Send email notification
      await fetch("/api/send-order-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: orderData,
          customer: customer,
          items: cart,
        }),
      })

      // Send customer confirmation email
      await fetch("/api/send-customer-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: orderData,
          customer: customer,
          items: cart,
        }),
      })

      alert("Order submitted successfully!")
      setCart([])
      fetchProducts()
    } catch (error) {
      console.error("Error submitting order:", error)
      alert("Error submitting order. Please try again.")
    }
  }

  const getAvailableStock = (product: Product) => {
    return Math.max(0, product.stock - (product.reserved_stock || 0))
  }

  const filteredProducts = products.filter(
    (product) =>
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.reference.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredProductGroups = productGroups.filter(
    (group) =>
      group.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.reference.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Information Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Please provide your business information to access the wholesale catalog.
            </p>
            <Input
              placeholder="Business Name *"
              value={authForm.business_name}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, business_name: e.target.value }))}
            />
            <Input
              placeholder="Contact Name *"
              value={authForm.contact_name}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, contact_name: e.target.value }))}
            />
            <Input
              placeholder="Email Address *"
              type="email"
              value={authForm.email}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <Input
              placeholder="Phone Number"
              value={authForm.phone}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
            <Button
              onClick={authenticateCustomer}
              className="w-full"
              disabled={!authForm.business_name || !authForm.contact_name || !authForm.email}
            >
              Access Wholesale Catalog
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Wholesale Catalog</h1>
              <p className="text-sm text-gray-600">Welcome, {customer?.business_name}</p>
            </div>
            <Button onClick={() => setShowCart(!showCart)} className="relative">
              <ShoppingCart className="h-5 w-5 mr-2" />
              Cart ({cart.length})
              {cart.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Products Section */}
          <div className="lg:col-span-3">
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products by name, brand, or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProductGroups.map((productGroup) => (
                <ProductCard
                  key={productGroup.reference}
                  productGroup={productGroup}
                  availableStock={productGroup.variants.reduce((sum, variant) => sum + getAvailableStock(variant), 0)}
                  cartQuantity={productGroup.variants.reduce(
                    (sum, variant) => sum + (cart.find((item) => item.id === variant.id)?.quantity || 0),
                    0,
                  )}
                  onAddToCart={(selectedSize) => {
                    const selectedProduct = productGroup.variants.find((v) => v.size === selectedSize)
                    if (selectedProduct) {
                      addToCart(selectedProduct)
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className={`lg:block ${showCart ? "block" : "hidden"}`}>
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Shopping Cart</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Cart is empty</p>
                ) : (
                  <>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.description}</div>
                            <div className="text-xs text-gray-500">
                              {item.reference} • Size: {item.size}
                            </div>
                            <div className="text-sm font-bold text-green-600">
                              ₦{item.wholesale_price?.toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= getAvailableStock(item)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4">
                      <div className="text-lg font-bold">Total: ₦{getTotalAmount().toLocaleString()}</div>
                    </div>

                    <Button onClick={submitOrder} className="w-full" disabled={cart.length === 0}>
                      Submit Order
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
