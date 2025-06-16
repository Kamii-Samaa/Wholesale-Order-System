"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert" // Added AlertTitle
import { EnvDiagnostic } from "@/components/env-diagnostic"
import { ThemeToggle } from "@/components/theme-toggle"
// Ensure CustomerInfo is imported from the hook if defined there, or defined locally if not.
// For this task, CustomerInfo from useShoppingCart is used.
import { useShoppingCart, CartItem as HookCartItem, ProductVariant, CustomerInfo as HookCustomerInfo } from "@/lib/hooks/useShoppingCart"
import { useProductFilters, Filters as HookFilters, FilterOptions as HookFilterOptions } from "@/lib/hooks/useProductFilters"

// Keep existing local type definitions if they are more detailed or used by UI components directly
// OR ensure hook types are comprehensive and use them. For this refactor, we'll use hook types where possible.
// The task mentions Product, ProductGroup can remain, CartItem and Filters will be effectively replaced by hook imports.

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
  wholesale_price: number | null // This is group level, variant prices are on Product
  variants: Product[]
}

// CartItem is now imported as HookCartItem from useShoppingCart
// Filters is now imported as HookFilters from useProductFilters

const PRODUCTS_PER_PAGE = 50

// Define Prop Types as requested
// Use HookCustomerInfo for consistency if it's exported from the hook
interface MiniCartProps {
  cart: HookCartItem[];
  customerInfo: HookCustomerInfo; // Using type from hook
  setCustomerInfo: React.Dispatch<React.SetStateAction<HookCustomerInfo>>;
  updateQuantity: (productId: number, newQuantity: number) => void;
  getTotalAmount: () => number;
  submitOrder: () => Promise<void>; // Or appropriate return type
  clearCart: () => void; // Added from useShoppingCart
}

interface FilterContentProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: HookFilters;
  // setFilters: React.Dispatch<React.SetStateAction<HookFilters>>; // Provided by useProductFilters hook directly
  filterOptions: HookFilterOptions;
  toggleFilter: (type: keyof Pick<HookFilters, 'brands' | 'sections' | 'productLines'>, value: string) => void;
  clearFilters: () => void;
  getActiveFiltersCount: () => number;
  updatePriceRange: (min: number, max: number) => void; // Added from useProductFilters hook
  toggleInStockOnly: () => void; // Added from useProductFilters hook
}

/**
 * @component WholesaleOrderSystem
 * @description The main page component for the wholesale ordering system.
 * It handles product display, filtering, cart management, and order submission.
 */
export default function WholesaleOrderSystem() {
  const [products, setProducts] = useState<Product[]>([])
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([])
  const [filteredGroups, setFilteredGroups] = useState<ProductGroup[]>([])
  const [paginatedGroups, setPaginatedGroups] = useState<ProductGroup[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const [customerInfo, setCustomerInfo] = useState<HookCustomerInfo>({ // Using type from hook
    name: "",
    email: "",
    company: "",
    phone: "",
  })
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);


  // Initialize hooks
  const {
    cart,
    // setCart: setCartHook, // Not used directly now
    addToCart: addToCartHook,
    updateQuantity: updateQuantityHook,
    getTotalAmount: getTotalAmountHook,
    clearCart,
    submitOrderToSupabase // Added this function from the hook
  } = useShoppingCart();

  const {
    filters,
    setFilters: setFiltersHook, // Renaming to avoid conflict
    filterOptions,
    setFilterOptions: setFilterOptionsHook,
    toggleFilter: toggleFilterHook,
    clearFilters: clearFiltersHook,
    getActiveFiltersCount: getActiveFiltersCountHook,
    updatePriceRange,
    toggleInStockOnly
  } = useProductFilters();


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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]) // fetchProducts is stable due to useCallback or being defined outside

  /**
   * @function getAvailableStock
   * @description Calculates the available stock for a product variant.
   * @param {Product} variant - The product variant.
   * @returns {number} The available stock.
   */
  const getAvailableStock = useCallback((variant: Product) => {
    return Math.max(0, variant.stock - (variant.reserved_stock || 0));
  }, []);

  // applyFilters is now a callback, depends on filters from the hook
  const applyFilters = useCallback(() => {
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
      // Use group.wholesale_price which is ProductGroup level, or iterate variants if needed
      const price = group.wholesale_price || 0
      return price >= filters.priceRange.min && price <= filters.priceRange.max
    })

    // Stock filter
    if (filters.inStockOnly) {
      filtered = filtered.filter((group) => group.variants.some((variant) => getAvailableStock(variant) > 0))
    }

    setFilteredGroups(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [productGroups, searchTerm, filters, getAvailableStock]);


  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const applyPagination = useCallback(() => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    setPaginatedGroups(filteredGroups.slice(startIndex, endIndex));
  }, [filteredGroups, currentPage]);

  useEffect(() => {
    applyPagination()
  }, [applyPagination]) // filteredGroups and currentPage are dependencies of applyPagination

  /**
   * @function fetchProducts
   * @description Fetches products from the Supabase database, groups them, and extracts filter options.
   * Handles loading states and errors.
   */
  const fetchProducts = useCallback(async () => {
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

      // Extract filter options and set them in the hook
      extractAndSetFilterOptions(data || [])
    } catch (err: any) {
      console.error("Error fetching products:", err)
      setError(`Failed to load products: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [supabase, setProducts, setProductGroups, setFilterOptionsHook, setFiltersHook, setError, setLoading]); // Added dependencies

  /**
   * @function groupProductsByReference
   * @description Groups an array of products by their reference property.
   * Each group contains variants of the same product.
   * @param {Product[]} productsArray - The array of products to group.
   * @returns {ProductGroup[]} An array of product groups.
   */
  const groupProductsByReference = (productsArray: Product[]): ProductGroup[] => {
    const groupMap = new Map<string, ProductGroup>()

    productsArray.forEach((product) => {
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

  /**
   * @function extractAndSetFilterOptions
   * @description Extracts available filter options (brands, sections, product lines, price range)
   * from the fetched products and updates the filter state using hooks.
   * @param {Product[]} fetchedProds - The array of fetched products.
   */
  const extractAndSetFilterOptions = useCallback((fetchedProds: Product[]) => {
    const brands = [...new Set(fetchedProds.map((p) => p.brand).filter(Boolean))] as string[]
    const sections = [...new Set(fetchedProds.map((p) => p.section).filter(Boolean))] as string[]
    const productLines = [...new Set(fetchedProducts.map((p) => p.product_line).filter(Boolean))] as string[]

    const prices = fetchedProducts.map((p) => p.wholesale_price).filter(Boolean) as number[]
    // Handle case where prices array might be empty
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 1000000;

    const newFilterOptions: HookFilterOptions = {
      brands: brands.sort(),
      sections: sections.sort(),
      productLines: productLines.sort(),
      priceRange: { min: minPrice, max: maxPrice },
    };
    setFilterOptionsHook(newFilterOptions);

    // Initialize filter price range using setFiltersHook from the hook
    setFiltersHook((prev) => ({ // This setFiltersHook is from useProductFilters
      ...prev,
      priceRange: { min: minPrice, max: maxPrice },
    }));
  }, [setFilterOptionsHook, setFiltersHook]); // Added dependencies

  const totalPages = Math.ceil(filteredGroups.length / PRODUCTS_PER_PAGE)

  /**
   * @function handleAddToCart
   * @description Bridge function to handle adding products to the cart.
   * It finds the correct product variant and calls the `addToCartHook` from `useShoppingCart`.
   * Sets notifications for errors or success.
   * @param {ProductGroup} productGroup - The product group containing the variant to add.
   * @param {string} selectedSize - The size of the variant to add.
   * @param {number} quantity - The quantity to add.
   */
  const handleAddToCart = (productGroup: ProductGroup, selectedSize: string, quantity: number) => {
    const variant = productGroup.variants.find((v) => v.size === selectedSize);
    if (!variant) {
      setNotification({ type: 'error', message: 'Selected product variant not found.' });
      return;
    }

    const variantForCart: ProductVariant = {
        id: variant.id,
        reference: variant.reference,
        size: variant.size || "",
        description: variant.description || "",
        wholesale_price: variant.wholesale_price || 0,
        stock: variant.stock,
        reserved_stock: variant.reserved_stock
    };

    const result = addToCartHook(variantForCart, quantity);
    if (!result.success && result.message) {
      setNotification({ type: 'error', message: result.message });
    } else if (result.success) {
      // Optionally, show a success message for adding to cart
      // setNotification({ type: 'success', message: `${variant.description || 'Item'} added to cart.`});
      // Auto-clear this type of notification after a short delay
      // setTimeout(() => setNotification(null), 3000);
    }
  };

  /**
   * @function submitOrder
   * @description Orchestrates the order submission process.
   * It calls the `submitOrderToSupabase` hook function, then handles email notifications.
   * Sets notifications for various stages and outcomes.
   */
  const submitOrder = async () => {
    // Validation is now primarily in the hook, but initial check for supabase client can remain.
    if (!supabase) {
      setNotification({ type: 'error', message: 'Database connection not available. Please try again later.' });
      return;
    }

    // Call the hook's submission function
    const submissionResult = await submitOrderToSupabase(supabase, customerInfo);

    if (!submissionResult.success || !submissionResult.orderData) {
      setNotification({ type: 'error', message: submissionResult.message || "An unknown error occurred while submitting the order." });
      return;
    }

    // If Supabase submission is successful, proceed with email notifications
    try {
      const { orderData } = submissionResult;

      // Send customer confirmation email
      const emailResponse = await fetch("/api/send-customer-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: orderData,
          customer: customerInfo, // Send the full customerInfo from page state
          items: cart.map((item) => ({ // Map cart items for email
            description: item.description,
            reference: item.reference,
            size: item.size,
            quantity: item.quantity,
            wholesale_price: item.wholesale_price,
          })),
        }),
      });

      if (!emailResponse.ok) {
        // Log the error and inform user, but order is still submitted
        console.error("Failed to send customer confirmation email:", await emailResponse.text());
        setNotification({ type: 'error', message: 'Order submitted, but failed to send confirmation email. Please contact support if you do not receive it shortly.' });
      } else {
        setNotification({ type: 'success', message: 'Order submitted successfully! A confirmation email has been sent.' });
      }

      // Also attempt to send admin notification (could be done in parallel or sequentially)
       await fetch("/api/send-order-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: orderData,
          customer: customerInfo,
          items: cart.map(item => ({
            description: item.description,
            reference: item.reference,
            size: item.size,
            quantity: item.quantity,
            wholesale_price: item.wholesale_price,
          })),
        }),
      });
      // Not handling admin notification failure explicitly to the user here, assumed to be an internal process.

      clearCart();
      setCustomerInfo({ name: "", email: "", company: "", phone: "" }); // Reset customer info
      setShowMobileCart(false);
      fetchProducts(); // Refresh product stock

    } catch (apiError: any) {
      // This catch is for errors during the fetch calls for emails or other post-Supabase logic
      console.error("Error during post-order processing (e.g., sending emails):", apiError);
      setNotification({ type: 'error', message: `Order submitted, but encountered an issue with post-order processing: ${apiError.message}` });
    }
  };

  // getAvailableStock is wrapped in useCallback above.
  // getActiveFiltersCount is from useProductFilters hook (getActiveFiltersCountHook)

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative"> {/* Added relative for potential fixed alert positioning context */}
      {/* Notification Area */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 w-full max-w-sm">
          <Alert variant={notification.type === 'error' ? 'destructive' : 'default'} className="shadow-lg">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>{notification.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
            <AlertDescription>
              {notification.message}
            </AlertDescription>
            <button
              onClick={() => setNotification(null)}
              className="absolute top-2 right-2 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </Alert>
        </div>
      )}

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
                    {getActiveFiltersCountHook() > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {getActiveFiltersCountHook()}
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
                      filters={filters} // from hook
                      // setFilters is managed by hook, specific setters like updatePriceRange, toggleInStockOnly are passed
                      filterOptions={filterOptions} // from hook
                      toggleFilter={toggleFilterHook} // from hook
                      clearFilters={clearFiltersHook} // from hook
                      getActiveFiltersCount={getActiveFiltersCountHook} // from hook
                      updatePriceRange={updatePriceRange} // from hook
                      toggleInStockOnly={toggleInStockOnly} // from hook
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
                      cart={cart} // from hook
                      customerInfo={customerInfo}
                      setCustomerInfo={setCustomerInfo}
                      updateQuantity={updateQuantityHook} // from hook
                      getTotalAmount={getTotalAmountHook} // from hook
                      submitOrder={submitOrder}
                      clearCart={clearCart} // from hook
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
                      cart={cart} // from hook
          customerInfo={customerInfo}
          setCustomerInfo={setCustomerInfo}
                      updateQuantity={updateQuantityHook} // from hook
                      getTotalAmount={getTotalAmountHook} // from hook
          submitOrder={submitOrder}
                      clearCart={clearCart} // from hook
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
                    {getActiveFiltersCountHook() > 0 && <Badge variant="secondary">{getActiveFiltersCountHook()}</Badge>}
                  </CardTitle>
                  {getActiveFiltersCountHook() > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFiltersHook}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <FilterContent
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  filters={filters} // from hook
                  // setFilters is managed by hook
                  filterOptions={filterOptions} // from hook
                  toggleFilter={toggleFilterHook} // from hook
                  clearFilters={clearFiltersHook} // from hook
                  getActiveFiltersCount={getActiveFiltersCountHook} // from hook
                  updatePriceRange={updatePriceRange} // from hook
                  toggleInStockOnly={toggleInStockOnly} // from hook
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
                  <Button onClick={clearFiltersHook}>Clear Filters</Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                  {paginatedGroups.map((group) => (
                    <ProductCard key={group.reference} group={group} onAddToCart={handleAddToCart} cart={cart} />
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
  // setFilters, // Not passed directly, use specific setters from hook
  filterOptions,
  toggleFilter,
  clearFilters,
  getActiveFiltersCount,
  updatePriceRange,
  toggleInStockOnly,
}: FilterContentProps) {
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
            onCheckedChange={toggleInStockOnly} // Use specific handler from hook
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
              value={filters.priceRange.min === filterOptions.priceRange.min ? "" : filters.priceRange.min}
              onChange={(e) => {
                const newMin = Number(e.target.value) || filterOptions.priceRange.min;
                updatePriceRange(newMin, filters.priceRange.max);
              }}
            />
            <Input
              type="number"
              placeholder="Max Price"
              value={filters.priceRange.max === filterOptions.priceRange.max ? "" : filters.priceRange.max}
              onChange={(e) => {
                const newMax = Number(e.target.value) || filterOptions.priceRange.max;
                updatePriceRange(filters.priceRange.min, newMax);
              }}
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
  group: ProductGroup;
  onAddToCart: (group: ProductGroup, size: string, quantity: number) => void;
  cart: HookCartItem[];
}) {
  const [selectedSize, setSelectedSize] = useState<string>("")
  const [quantity, setQuantity] = useState(1) // Represents the actual numeric quantity
  const [quantityInput, setQuantityInput] = useState("1") // Represents the string value in the input field
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

  const currentMaxStockForProductCard = selectedVariant ? getAvailableStock(selectedVariant) : getTotalStock();

  const handleQuantityInputChange = (value: string) => {
    const currentMax = selectedVariant ? getAvailableStock(selectedVariant) : getTotalStock();
    if (value === "") {
        setQuantityInput(""); // Allow clearing for re-entry
        setQuantity(1); // Default numeric quantity to 1 if input is cleared
        return;
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) { // If not a number, don't change input, effectively ignoring non-numeric input
        setQuantityInput(quantity.toString()); // Keep input as last valid quantity string
        return;
    }
    if (num <= 0) { // If zero or negative
        setQuantityInput("1");
        setQuantity(1);
    } else if (num > currentMax) {
        setQuantityInput(currentMax.toString());
        setQuantity(currentMax);
    } else {
        setQuantityInput(value); // Store the raw string value if it's a valid number in range
        setQuantity(num);
    }
  }

  const handleQuantityBlur = () => {
    const currentMax = selectedVariant ? getAvailableStock(selectedVariant) : getTotalStock();
    let currentVal = parseInt(quantityInput, 10);

    if (isNaN(currentVal) || quantityInput === "" || currentVal <= 0) { // If input was empty or invalid
        currentVal = 1;
    }

    if (currentVal > currentMax) {
        currentVal = currentMax;
    }
    setQuantity(currentVal);
    setQuantityInput(currentVal.toString());
  }

  const handleAddToCart = () => {
    const targetSize = hasMultipleSizes ? selectedSize : singleVariant?.size || ""
    onAddToCart(group, targetSize, quantity)
    setQuantity(1) // Reset quantity after adding
    setQuantityInput("1")
  }

  // const maxQuantity = selectedVariant ? getAvailableStock(selectedVariant) : getTotalStock();
  // Replaced direct use of maxQuantity with currentMaxStockForProductCard where appropriate for clarity

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
          {(selectedSize || !hasMultipleSizes) && currentMaxStockForProductCard > 0 && (
            <div className="space-y-1">
              <Label htmlFor={`quantity-input-${group.reference}`} className="text-xs font-medium text-gray-900 dark:text-gray-100">Quantity:</Label>
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
                  id={`quantity-input-${group.reference}`}
                  value={quantityInput}
                  onChange={(e) => handleQuantityInputChange(e.target.value)}
                  onBlur={handleQuantityBlur}
                  className="h-8 text-center text-sm flex-1 min-w-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  min="1"
                  max={currentMaxStockForProductCard}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newQty = Math.min(currentMaxStockForProductCard, quantity + 1)
                    setQuantity(newQty)
                    setQuantityInput(newQty.toString())
                  }}
                  className="h-8 w-8 p-0 flex-shrink-0"
                  disabled={quantity >= currentMaxStockForProductCard}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Max: {currentMaxStockForProductCard} units</div>
            </div>
          )}

          <Button
            onClick={handleAddToCart}
            disabled={
              (hasMultipleSizes && !selectedSize) ||
              currentMaxStockForProductCard === 0 ||
              (!hasMultipleSizes && !singleVariant) ||
              quantity === 0 ||
              quantity > currentMaxStockForProductCard
            }
            className="w-full h-8 text-xs"
            size="sm"
          >
            {hasMultipleSizes && !selectedSize
              ? "Select Size"
              : currentMaxStockForProductCard === 0
                ? "Out of Stock"
                : `Add ${quantity} to Cart`}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function MiniCart({ // Props are now correctly typed via MiniCartProps
  cart,
  customerInfo,
  setCustomerInfo,
  updateQuantity,
  getTotalAmount,
  submitOrder,
  clearCart,
}: MiniCartProps) {
  const [quantityInputs, setQuantityInputs] = useState<{ [key: number]: string }>({})
  const [isEmailInvalid, setIsEmailInvalid] = useState(false);

  /**
   * Handles changes to quantity inputs within the MiniCart.
   * @param {number} productId - The ID of the product being changed.
   * @param {string} value - The new string value from the input.
   * @param {number} maxStock - The maximum available stock for this item.
   */
  const handleMiniCartQuantityInputChange = (productId: number, value: string, maxStock: number) => {
    if (value === "") {
      setQuantityInputs((prev) => ({ ...prev, [productId]: "" }));
      return;
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return;
    }
    if (num <= 0) {
      setQuantityInputs((prev) => ({ ...prev, [productId]: "1" }));
    } else if (num > maxStock) {
      setQuantityInputs((prev) => ({ ...prev, [productId]: maxStock.toString() }));
    } else {
      setQuantityInputs((prev) => ({ ...prev, [productId]: value }));
    }
  };

  /**
   * Handles the blur event for quantity inputs in the MiniCart.
   * Validates the quantity and updates the cart.
   * @param {number} productId - The ID of the product.
   * @param {number} currentQuantityInCart - The current quantity of the item in the cart.
   * @param {number} maxStock - The maximum available stock for this item.
   */
  const handleMiniCartQuantityBlur = (productId: number, currentQuantityInCart: number, maxStock: number) => {
    const inputValue = quantityInputs[productId];
    let finalQuantity: number;

    if (inputValue === undefined || inputValue === null || inputValue.trim() === "") {
      finalQuantity = Math.max(1, Math.min(currentQuantityInCart, maxStock));
    } else {
      const numValue = parseInt(inputValue, 10);
      if (isNaN(numValue) || numValue <= 0) {
        finalQuantity = 1;
      } else if (numValue > maxStock) {
        finalQuantity = maxStock;
      } else {
        finalQuantity = numValue;
      }
    }
    updateQuantity(productId, finalQuantity);
    setQuantityInputs((prev) => ({ ...prev, [productId]: finalQuantity.toString() }));
  };

  /**
   * Handles changes to the customer email input. Validates format.
   * @param {string} email - The current value of the email input.
   */
  const handleEmailChange = (email: string) => {
    setCustomerInfo((prev: HookCustomerInfo) => ({ ...prev, email: email }));
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email === "" || emailRegex.test(email)) {
      setIsEmailInvalid(false);
    } else {
      setIsEmailInvalid(true);
    }
  };

  /**
   * Handles the blur event for the customer email input. Validates format.
   * @param {string} email - The current value of the email input.
   */
  const handleEmailBlur = (email: string) => {
    if (email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setIsEmailInvalid(true);
    } else {
      setIsEmailInvalid(false);
    }
  };

  /**
   * Wraps the submitOrder call to include local validation like email format check.
   */
  const localSubmitOrder = () => {
    if (isEmailInvalid) {
       // This assumes `setNotification` is passed down or available via context
       // As it's not directly passed, this example relies on visual cue from isEmailInvalid
       // Or, you can pass setNotification to MiniCart if preferred.
       alert("Invalid email format. Please correct it before submitting."); // Placeholder if setNotification not available
       return;
    }
    submitOrder();
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
                          onChange={(e) => handleMiniCartQuantityInputChange(item.productId, e.target.value, item.stock)}
                          onBlur={() => handleMiniCartQuantityBlur(item.productId, item.quantity, item.stock)}
                          className="h-8 w-16 text-center text-sm"
                          min="1" // HTML5 min attribute
                          max={item.stock} // HTML5 max attribute
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
              onChange={(e) => setCustomerInfo((prev) => ({ ...prev, name: e.target.value }))}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Email *"
              type="email"
              value={customerInfo.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={(e) => handleEmailBlur(e.target.value)}
              className={`h-9 text-sm ${isEmailInvalid ? 'border-red-500' : ''}`}
            />
            {isEmailInvalid && <p className="text-xs text-red-500">Invalid email format.</p>}
            <Input
              placeholder="Company Name"
              value={customerInfo.company}
              onChange={(e) => setCustomerInfo((prev) => ({ ...prev, company: e.target.value }))}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Phone Number"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo((prev) => ({ ...prev, phone: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>

          <Button
            onClick={localSubmitOrder} // Use local wrapper for submit
            className="w-full h-10"
            disabled={!customerInfo.name || !customerInfo.email || cart.length === 0 || isEmailInvalid}
          >
            Submit Order
          </Button>
        </div>
      )}
    </div>
  )
}
