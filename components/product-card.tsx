"use client"

import type React from "react"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"

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

interface ProductCardProps {
  productGroup: ProductGroup
  availableStock: number
  cartQuantity: number
  onAddToCart: (selectedSize: string) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({
  productGroup,
  availableStock,
  cartQuantity,
  onAddToCart,
}) => {
  const [selectedSize, setSelectedSize] = useState<string>("")

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square relative bg-gray-100 dark:bg-gray-800">
        {productGroup.image_url ? (
          <Image
            src={productGroup.image_url || "/placeholder.svg"}
            alt={productGroup.description || "Product"}
            fill
            className="object-cover"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.svg"
            }}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-lg mb-1">📦</div>
              <div className="text-xs">No Image</div>
            </div>
          </div>
        )}
      </div>
      <CardContent className="p-2">
        <div className="space-y-1">
          <div className="flex justify-between items-start gap-1">
            <Badge variant="outline" className="text-xs px-1 py-0 h-4">
              {productGroup.reference}
            </Badge>
            {productGroup.brand && (
              <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                {productGroup.brand}
              </Badge>
            )}
          </div>

          <h3 className="font-medium text-xs line-clamp-2 min-h-[2rem] leading-tight">{productGroup.description}</h3>

          {productGroup.section && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{productGroup.section}</div>
          )}

          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-bold text-green-600 dark:text-green-400">
                ₦{productGroup.wholesale_price?.toLocaleString()}
              </div>
              {productGroup.retail_price && (
                <div className="text-xs text-gray-500 line-through">₦{productGroup.retail_price?.toLocaleString()}</div>
              )}
            </div>
            <div className="text-xs text-right">
              <div
                className={availableStock > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
              >
                {availableStock}
              </div>
              {cartQuantity > 0 && <div className="text-blue-600 dark:text-blue-400 text-xs">Cart: {cartQuantity}</div>}
            </div>
          </div>

          {/* Size Selection */}
          <div className="space-y-1">
            <Select value={selectedSize} onValueChange={setSelectedSize}>
              <SelectTrigger className="w-full h-6 text-xs">
                <SelectValue placeholder="Size..." />
              </SelectTrigger>
              <SelectContent>
                {productGroup.variants.map((variant) => (
                  <SelectItem
                    key={variant.id}
                    value={variant.size || ""}
                    disabled={variant.stock - (variant.reserved_stock || 0) <= 0}
                  >
                    <span className="text-xs">
                      {variant.size} ({variant.stock - (variant.reserved_stock || 0)})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => onAddToCart(selectedSize)}
            disabled={!selectedSize || availableStock === 0}
            className="w-full h-6 text-xs"
            size="sm"
          >
            {selectedSize ? "Add" : "Select Size"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
