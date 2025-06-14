"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Menu,
  AlertCircle,
} from "lucide-react"
import Image from "next/image"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { EnvDiagnostic } from "@/components/env-diagnostic"
import { ThemeToggle } from "@/components/theme-toggle"

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

interface CartItem {
  productId: number
  reference: string
  size: string
  description: string
  wholesale_price: number
  quantity: number
  stock: number
}

interface Filters {
  brands: string[]
  sections: string[]
  productLines: string[]
  priceRange: { min: number; max: number }
  inStockOnly: boolean
}

const PRODUCTS_PER_PAGE = 50

export default function WholesaleOrderSystem() {
  const [products, setProducts] = useState<Product[]>([])
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([])
  const [filteredGroups, setFilteredGroups] = useState<ProductGroup[]>([])
  const [paginatedGroups, setPaginatedGroups] = useState<ProductGroup[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
  })

  // Filter states
  const [filters, setFilters] = useState<Filters>({
    brands: [],
    sections: [],
    productLines: [],
    priceRange: { min: 0, max: 0 },
    inStockOnly: false,
  })

  // Available filter options
  const [filterOptions, setFilterOptions] = useState({
    brands: [] as string[],
    sections: [] as string[],
    productLines: [] as string[],
    priceRange: { min: 0, max: 1000000 },
  })

  const [supabase, setSupabase] = useState<any>(null)

  useEffect(() => {
    // Initialize Supabase client with error handling
    try {
      const client = createClient()
      setSupabase(client)
      setError(null)
    } catch (err: any) {
      console.error("Supabase initialization error:", err)
      setError(err.message)
      setShowDiagnostic(true)
      setLoading(false)
      return
    }
  }, [])

  useEffect(() => {
    if (supabase) {
      fetchProducts()
    }
  }, [supabase])

  useEffect(() => {
    applyFilters()
  }, [productGroups, searchTerm, filters])

  useEffect(() => {
    applyPagination()
  }, [filteredGroups, currentPage])

  const fetchProducts = async () => {
    if (!supabase) return

    try {
      setError(null)
      const { data, error: fetchError } = await supabase.from("products").select("*").order("reference")

      if (fetchError) {
        console.error("Database error:", fetchError)
        throw new Error(`Database error: ${fetchError.message}`)
      }

      setProducts(data || [])

      // Group products by reference
      const groups = groupProductsByReference(data || [])
      setProductGroups(groups)

      // Extract filter options
      extractFilterOptions(data || [])
    } catch (err: any) {
      console.error("Error fetching products:", err)
      setError(`Failed to load products: ${err.message}`)
    } finally {
      setLoading(false)
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

  const extractFilterOptions = (products: Product[]) => {
    const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))] as string[]
    const sections = [...new Set(products.map((p) => p.section).filter(Boolean))] as string[]
    const productLines = [...new Set(products.map((p) => p.product_line).filter(Boolean))] as string[]

    const prices = products.map((p) => p.wholesale_price).filter(Boolean) as number[]
    const minPrice = Math.min(...prices, 0)
    const maxPrice = Math.max(...prices, 1000000)

    setFilterOptions({
      brands: brands.sort(),
      sections: sections.sort(),
      productLines: productLines.sort(),
      priceRange: { min: minPrice, max: maxPrice },
    })

    // Initialize filter price range
    setFilters((prev) => ({
      ...prev,
      priceRange: { min: minPrice, max: maxPrice },
    }))
  }

  const applyFilters = () => {
    let filtered = productGroups

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (group) =>
          group.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.section?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.product_line?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Brand filter
    if (filters.brands.length > 0) {
      filtered = filtered.filter((group) => group.brand && filters.brands.includes(group.brand))
    }

    // Section filter
    if (filters.sections.length > 0) {
      filtered = filtered.filter((group) => group.section && filters.sections.includes(group.section))
    }

    // Product line filter
    if (filters.productLines.length > 0) {
      filtered = filtered.filter((group) => group.product_line && filters.productLines.includes(group.product_line))
    }

    // Price filter
    filtered = filtered.filter((group) => {
      const price = group.wholesale_price || 0
      return price >= filters.priceRange.min && price <= filters.priceRange.max
    })

    // Stock filter
    if (filters.inStockOnly) {
      filtered = filtered.filter((group) => group.variants.some((variant) => getAvailableStock(variant) > 0))
    }

    setFilteredGroups(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }

  const applyPagination = () => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE
    const endIndex = startIndex + PRODUCTS_PER_PAGE
    setPaginatedGroups(filteredGroups.slice(startIndex, endIndex))
  }

  const totalPages = Math.ceil(filteredGroups.length / PRODUCTS_PER_PAGE)

  const toggleFilter = (type: keyof Filters, value: string) => {
    setFilters((prev) => {
      const currentArray = prev[type] as string[]
      const newArray = currentArray.includes(value)
        ? currentArray.filter((item) => item !== value)
        : [...currentArray, value]

      return { ...prev, [type]: newArray }
    })
  }

  const clearFilters = () => {
    setFilters({
      brands: [],
      sections: [],
      productLines: [],
      priceRange: filterOptions.priceRange,
      inStockOnly: false,
    })
  }

  const addToCart = (productGroup: ProductGroup, selectedSize: string, quantity: number) => {
    const variant = productGroup.variants.find((v) => v.size === selectedSize)
    if (!variant) {
      alert("Please select a valid size")
      return
    }

    const availableStock = variant.stock - (variant.reserved_stock || 0)
    const currentCartQuantity = cart.find((item) => item.productId === variant.id)?.quantity || 0

    if (currentCartQuantity + quantity > availableStock) {
      alert(`Not enough stock available. Only ${availableStock - currentCartQuantity} units remaining.`)
      return
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === variant.id)
      if (existing) {
        return prev.map((item) =>
          item.productId === variant.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, availableStock) }
            : item,
        )
      }
      return [
        ...prev,
        {
          productId: variant.id,
          reference: variant.reference,
          size: variant.size || "",
          description: variant.description || "",
          wholesale_price: variant.wholesale_price || 0,
          quantity: quantity,
          stock: variant.stock,
        },
      ]
    })
  }

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity === 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId))
    } else {
      setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, quantity: newQuantity } : item)))
    }
  }

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.wholesale_price * item.quantity, 0)
  }

  const submitOrder = async () => {
    if (!customerInfo.name || !customerInfo.email || cart.length === 0) {
      alert("Please fill in customer information and add items to cart")
      return
    }

    if (!supabase) {
      alert("Database connection not available")
      return
    }

    try {
      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerInfo.name,
          customer_email: customerInfo.email,
          customer_company: customerInfo.company,
          customer_phone: customerInfo.phone,
          total_amount: getTotalAmount(),
          status: "pending",
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.wholesale_price,
        total_price: item.wholesale_price * item.quantity,
      }))

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems)

      if (itemsError) throw itemsError

      // Send customer confirmation email
      await fetch("/api/send-customer-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: orderData,
          customer: {
            customer_name: customerInfo.name,
            customer_email: customerInfo.email,
            customer_company: customerInfo.company,
            customer_phone: customerInfo.phone,
          },
          items: cart.map((item) => ({
            description: item.description,
            reference: item.reference,
            size: item.size,
            quantity: item.quantity,
            wholesale_price: item.wholesale_price,
          })),
        }),
      })

      alert("Order submitted successfully!")
      setCart([])
      setCustomerInfo({ name: "", email: "", company: "", phone: "" })
      setShowMobileCart(false)
      fetchProducts() // Refresh products to show updated stock
    } catch (error) {
      console.error("Error submitting order:", error)
      alert("Error submitting order. Please try again.")
    }
  }

  const getAvailableStock = (variant: Product) => {
    return Math.max(0, variant.stock - (variant.reserved_stock || 0))
  }

  const getActiveFiltersCount = () => {
    return filters.brands.length + filters.sections.length + filters.productLines.length + (filters.inStockOnly ? 1 : 0)
  }

  // Show error state if Supabase initialization failed
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {showDiagnostic && <EnvDiagnostic />}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Configuration Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>

              <div className="space-y-3">
                <h3 className="font-medium">Quick Fixes:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                  <li>
                    Check if your <code className="bg-gray-100 px-1 rounded">.env.local</code> file exists
                  </li>
                  <li>
                    Verify your Supabase URL starts with <code className="bg-gray-100 px-1 rounded">https://</code>
                  </li>
                  <li>Ensure no extra spaces or quotes in environment variables</li>
                  <li>Restart your development server after making changes</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => window.location.reload()} className="flex-1">
                  Retry Connection
                </Button>
                <Button variant="outline" onClick={() => setShowDiagnostic(!showDiagnostic)} className="flex-1">
                  {showDiagnostic ? "Hide" : "Show"} Diagnostic
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading products...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">Wholesale Portal</h1>

              {/* Mobile Filter Button */}
              <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <Menu className="h-4 w-4 mr-2" />
                    Filters
                    {getActiveFiltersCount() > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {getActiveFiltersCount()}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterContent
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                      filters={filters}
                      setFilters={setFilters}
                      filterOptions={filterOptions}
                      toggleFilter={toggleFilter}
                      clearFilters={clearFilters}
                      getActiveFiltersCount={getActiveFiltersCount}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />

              {/* Cart Button */}
              <Button onClick={() => setShowMobileCart(true)} className="relative">
                <ShoppingCart className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Cart</span> ({cart.length})
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </Badge>
                )}
              </Button>

              {/* Cart Sheet */}
              <Sheet open={showMobileCart} onOpenChange={setShowMobileCart}>
                <SheetContent side="right" className="w-full sm:w-96">
                  <SheetHeader>
                    <SheetTitle>Shopping Cart ({cart.length})</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <MiniCart
                      cart={cart}
                      customerInfo={customerInfo}
                      setCustomerInfo={setCustomerInfo}
                      updateQuantity={updateQuantity}
                      getTotalAmount={getTotalAmount}
                      submitOrder={submitOrder}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Sticky Cart */}
      <div className="hidden xl:block fixed top-20 right-4 w-80 z-30">
        <MiniCart
          cart={cart}
          customerInfo={customerInfo}
          setCustomerInfo={setCustomerInfo}
          updateQuantity={updateQuantity}
          getTotalAmount={getTotalAmount}
          submitOrder={submitOrder}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        {/* Welcome Notice */}
        <div className="mb-6">
          <Card>
            <CardContent className="p-4 lg:p-6">
              <h2 className="text-lg lg:text-xl font-semibold mb-2">Welcome to Our Wholesale Portal</h2>
              <p className="text-gray-600 text-sm lg:text-base mb-4">
                Browse our complete product catalog with advanced filtering and search capabilities.
              </p>
              <div className="bg-blue-50 p-3 lg:p-4 rounded-lg">
                <p className="text-xs lg:text-sm text-blue-800">
                  <strong>For Wholesale Customers:</strong> If you have a unique customer link, please use that for
                  real-time inventory updates and personalized ordering experience.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                    {getActiveFiltersCount() > 0 && <Badge variant="secondary">{getActiveFiltersCount()}</Badge>}
                  </CardTitle>
                  {getActiveFiltersCount() > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <FilterContent
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  filters={filters}
                  setFilters={setFilters}
                  filterOptions={filterOptions}
                  toggleFilter={toggleFilter}
                  clearFilters={clearFilters}
                  getActiveFiltersCount={getActiveFiltersCount}
                />
              </CardContent>
            </Card>
          </div>

          {/* Products Section */}
          <div className="lg:col-span-3 xl:pr-84">
            {/* Mobile Search Bar */}
            <div className="lg:hidden mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Results Header */}
            <div className="mb-4 lg:mb-6">
              <div className="flex justify-between items-center">
                <h2 className="text-base lg:text-lg font-semibold">
                  Products ({filteredGroups.length})
                  {filteredGroups.length > PRODUCTS_PER_PAGE && (
                    <span className="text-xs lg:text-sm text-gray-500 ml-2 block lg:inline">
                      Showing {(currentPage - 1) * PRODUCTS_PER_PAGE + 1}-
                      {Math.min(currentPage * PRODUCTS_PER_PAGE, filteredGroups.length)}
                    </span>
                  )}
                </h2>
              </div>
            </div>

            {/* Products Grid */}
            {productGroups.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <h3 className="text-lg font-medium mb-2">No Products Available</h3>
                  <p className="text-gray-600 mb-4">
                    Products haven't been imported yet. Please use the admin panel to import your product catalog.
                  </p>
                  <Button asChild>
                    <a href="/admin">Go to Admin Panel</a>
                  </Button>
                </CardContent>
              </Card>
            ) : filteredGroups.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <h3 className="text-lg font-medium mb-2">No Products Found</h3>
                  <p className="text-gray-600 mb-4">Try adjusting your search terms or filters to find products.</p>
                  <Button onClick={clearFilters}>Clear Filters</Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                  {paginatedGroups.map((group) => (
                    <ProductCard key={group.reference} group={group} onAddToCart={addToCart} cart={cart} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 lg:mt-8 flex justify-center items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterContent({
  searchTerm,
  setSearchTerm,
  filters,
  setFilters,
  filterOptions,
  toggleFilter,
  clearFilters,
  getActiveFiltersCount,
}: any) {
  return (
    <div className="space-y-6">
      {/* Search - Desktop only (mobile has it in main area) */}
      <div className="hidden lg:block">
        <Label className="text-sm font-medium mb-2 block">Search</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stock Filter */}
      <div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="inStock"
            checked={filters.inStockOnly}
            onCheckedChange={(checked) => setFilters((prev: any) => ({ ...prev, inStockOnly: !!checked }))}
          />
          <Label htmlFor="inStock" className="text-sm">
            In Stock Only
          </Label>
        </div>
      </div>

      {/* Brand Filter */}
      {filterOptions.brands.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">Brands</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {filterOptions.brands.map((brand: string) => (
              <div key={brand} className="flex items-center space-x-2">
                <Checkbox
                  id={`brand-${brand}`}
                  checked={filters.brands.includes(brand)}
                  onCheckedChange={() => toggleFilter("brands", brand)}
                />
                <Label htmlFor={`brand-${brand}`} className="text-sm">
                  {brand}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section Filter */}
      {filterOptions.sections.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">Sections</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {filterOptions.sections.map((section: string) => (
              <div key={section} className="flex items-center space-x-2">
                <Checkbox
                  id={`section-${section}`}
                  checked={filters.sections.includes(section)}
                  onCheckedChange={() => toggleFilter("sections", section)}
                />
                <Label htmlFor={`section-${section}`} className="text-sm">
                  {section}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Line Filter */}
      {filterOptions.productLines.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">Product Lines</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {filterOptions.productLines.map((line: string) => (
              <div key={line} className="flex items-center space-x-2">
                <Checkbox
                  id={`line-${line}`}
                  checked={filters.productLines.includes(line)}
                  onCheckedChange={() => toggleFilter("productLines", line)}
                />
                <Label htmlFor={`line-${line}`} className="text-sm">
                  {line}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Range */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Price Range</Label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min Price"
              value={filters.priceRange.min === 0 ? "" : filters.priceRange.min}
              onChange={(e) =>
                setFilters((prev: any) => ({
                  ...prev,
                  priceRange: { ...prev.priceRange, min: Number(e.target.value) || 0 },
                }))
              }
            />
            <Input
              type="number"
              placeholder="Max Price"
              value={filters.priceRange.max === 1000000 ? "" : filters.priceRange.max}
              onChange={(e) =>
                setFilters((prev: any) => ({
                  ...prev,
                  priceRange: { ...prev.priceRange, max: Number(e.target.value) || 1000000 },
                }))
              }
            />
          </div>
          <div className="text-xs text-gray-500">
            ₦{filters.priceRange.min.toLocaleString()} - ₦{filters.priceRange.max.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductCard({
  group,
  onAddToCart,
  cart,
}: {
  group: ProductGroup
  onAddToCart: (group: ProductGroup, size: string, quantity: number) => void
  cart: CartItem[]
}) {
  const [selectedSize, setSelectedSize] = useState<string>("")
  const [quantity, setQuantity] = useState(1)
  const [quantityInput, setQuantityInput] = useState("1")
  const [imageError, setImageError] = useState(false)

  const getAvailableStock = (variant: Product) => {
    return Math.max(0, variant.stock - (variant.reserved_stock || 0))
  }

  const getTotalStock = () => {
    return group.variants.reduce((sum, variant) => sum + getAvailableStock(variant), 0)
  }

  const getCartQuantity = () => {
    return cart.filter((item) => item.reference === group.reference).reduce((sum, item) => sum + item.quantity, 0)
  }

  const selectedVariant = group.variants.find((v) => v.size === selectedSize)
  const hasMultipleSizes = group.variants.length > 1
  const singleVariant = group.variants[0]

  // Auto-select size if only one variant
  useEffect(() => {
    if (!hasMultipleSizes && singleVariant) {
      setSelectedSize(singleVariant.size || "")
    }
  }, [hasMultipleSizes, singleVariant])

  const handleQuantityInputChange = (value: string) => {
    setQuantityInput(value)
    const numValue = Number.parseInt(value) || 0
    if (numValue > 0) {
      setQuantity(numValue)
    }
  }

  const handleQuantityBlur = () => {
    const numValue = Number.parseInt(quantityInput) || 1
    const maxQuantity = selectedVariant ? getAvailableStock(selectedVariant) : getTotalStock()
    const finalQuantity = Math.max(1, Math.min(numValue, maxQuantity))
    setQuantity(finalQuantity)
    setQuantityInput(finalQuantity.toString())
  }

  const handleAddToCart = () => {
    const targetSize = hasMultipleSizes ? selectedSize : singleVariant?.size || ""
    onAddToCart(group, targetSize, quantity)
    setQuantity(1) // Reset quantity after adding
    setQuantityInput("1")
  }

  const maxQuantity = selectedVariant ? getAvailableStock(selectedVariant) : getTotalStock()

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square relative bg-gray-100">
        {group.image_url && !imageError ? (
          <Image
            src={group.image_url || "/placeholder.svg"}
            alt={group.description || "Product"}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-xl lg:text-2xl mb-1">📦</div>
              <div className="text-xs">No Image</div>
            </div>
          </div>
        )}
        {getTotalStock() === 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <Badge variant="destructive" className="text-xs">
              Out of Stock
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex justify-between items-start gap-2">
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {group.reference}
            </Badge>
            {group.brand && (
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {group.brand}
              </Badge>
            )}
          </div>

          <h3 className="font-medium text-xs lg:text-sm line-clamp-2 min-h-[2rem]">{group.description}</h3>

          <div className="text-xs text-gray-500">{group.section && <div>Section: {group.section}</div>}</div>

          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm lg:text-base font-bold text-green-600">
                ₦{group.wholesale_price?.toLocaleString()}
              </div>
              {group.retail_price && (
                <div className="text-xs text-gray-500 line-through">₦{group.retail_price?.toLocaleString()}</div>
              )}
            </div>
            <div className="text-xs text-right">
              <div
                className={
                  getTotalStock() > 0
                    ? "text-green-600 dark:text-green-400 font-bold text-sm lg:text-base"
                    : "text-red-600 dark:text-red-400 font-bold text-sm lg:text-base"
                }
              >
                Stock: {getTotalStock()}
              </div>
              {getCartQuantity() > 0 && (
                <div className="text-blue-600 dark:text-blue-400 font-semibold text-xs lg:text-sm">
                  In Cart: {getCartQuantity()}
                </div>
              )}
            </div>
          </div>

          {/* Size Selection - Only show if multiple sizes */}
          {hasMultipleSizes && (
            <div className="space-y-1">
              <Label className="text-xs font-medium">Size:</Label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Choose size..." />
                </SelectTrigger>
                <SelectContent>
                  {group.variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.size || ""} disabled={getAvailableStock(variant) === 0}>
                      {variant.size} ({getAvailableStock(variant)} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quantity Selection - Show when size is selected or single variant */}
          {(selectedSize || !hasMultipleSizes) && maxQuantity > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-900 dark:text-gray-100">Quantity:</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newQty = Math.max(1, quantity - 1)
                    setQuantity(newQty)
                    setQuantityInput(newQty.toString())
                  }}
                  className="h-8 w-8 p-0 flex-shrink-0"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  value={quantityInput}
                  onChange={(e) => handleQuantityInputChange(e.target.value)}
                  onBlur={handleQuantityBlur}
                  className="h-8 text-center text-sm flex-1 min-w-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  min="1"
                  max={maxQuantity}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newQty = Math.min(maxQuantity, quantity + 1)
                    setQuantity(newQty)
                    setQuantityInput(newQty.toString())
                  }}
                  className="h-8 w-8 p-0 flex-shrink-0"
                  disabled={quantity >= maxQuantity}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Max: {maxQuantity} units</div>
            </div>
          )}

          <Button
            onClick={handleAddToCart}
            disabled={
              (hasMultipleSizes && !selectedSize) ||
              maxQuantity === 0 ||
              (!hasMultipleSizes && !singleVariant) ||
              quantity === 0 ||
              quantity > maxQuantity
            }
            className="w-full h-8 text-xs"
            size="sm"
          >
            {hasMultipleSizes && !selectedSize
              ? "Select Size"
              : maxQuantity === 0
                ? "Out of Stock"
                : `Add ${quantity} to Cart`}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function MiniCart({
  cart,
  customerInfo,
  setCustomerInfo,
  updateQuantity,
  getTotalAmount,
  submitOrder,
}: {
  cart: CartItem[]
  customerInfo: any
  setCustomerInfo: any
  updateQuantity: (id: number, quantity: number) => void
  getTotalAmount: () => number
  submitOrder: () => void
}) {
  const [quantityInputs, setQuantityInputs] = useState<{ [key: number]: string }>({})

  const handleQuantityInputChange = (productId: number, value: string) => {
    setQuantityInputs((prev) => ({ ...prev, [productId]: value }))
  }

  const handleQuantityBlur = (productId: number, maxStock: number) => {
    const inputValue = quantityInputs[productId]
    const numValue = Number.parseInt(inputValue) || 1
    const finalQuantity = Math.max(1, Math.min(numValue, maxStock))
    updateQuantity(productId, finalQuantity)
    setQuantityInputs((prev) => ({ ...prev, [productId]: finalQuantity.toString() }))
  }

  return (
    <div className="h-full max-h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-4">
        {cart.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-sm">Cart is empty</p>
        ) : (
          <>
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.productId} className="border rounded-lg p-3">
                  <div className="space-y-2">
                    <div>
                      <div className="font-medium text-sm line-clamp-2">{item.description}</div>
                      <div className="text-xs text-gray-500">
                        {item.reference} • {item.size}
                      </div>
                      <div className="font-bold text-green-600 text-sm">₦{item.wholesale_price.toLocaleString()}</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          value={quantityInputs[item.productId] ?? item.quantity.toString()}
                          onChange={(e) => handleQuantityInputChange(item.productId, e.target.value)}
                          onBlur={() => handleQuantityBlur(item.productId, item.stock)}
                          className="h-8 w-16 text-center text-sm"
                          min="1"
                          max={item.stock}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.productId, Math.min(item.stock, item.quantity + 1))}
                          className="h-8 w-8 p-0"
                          disabled={item.quantity >= item.stock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-sm font-medium">
                        ₦{(item.wholesale_price * item.quantity).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="text-lg font-bold">Total: ₦{getTotalAmount().toLocaleString()}</div>
            </div>
          </>
        )}
      </div>

      {cart.length > 0 && (
        <div className="border-t pt-4 space-y-3">
          <h4 className="font-medium text-sm">Customer Information</h4>
          <div className="space-y-2">
            <Input
              placeholder="Full Name *"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo((prev: any) => ({ ...prev, name: e.target.value }))}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Email *"
              type="email"
              value={customerInfo.email}
              onChange={(e) => setCustomerInfo((prev: any) => ({ ...prev, email: e.target.value }))}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Company Name"
              value={customerInfo.company}
              onChange={(e) => setCustomerInfo((prev: any) => ({ ...prev, company: e.target.value }))}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Phone Number"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo((prev: any) => ({ ...prev, phone: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>

          <Button
            onClick={submitOrder}
            className="w-full h-10"
            disabled={!customerInfo.name || !customerInfo.email || cart.length === 0}
          >
            Submit Order
          </Button>
        </div>
      )}
    </div>
  )
}
