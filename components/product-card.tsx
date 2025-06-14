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
    <Card className="overflow-hidden">
      <div className="aspect-square relative bg-gray-100">
        {productGroup.image_url ? (
          <Image
            src={productGroup.image_url || "/placeholder.svg"}
            alt={productGroup.description || "Product"}
            fill
            className="object-cover"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.svg"
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <Badge variant="outline">{productGroup.reference}</Badge>
            {productGroup.brand && <Badge variant="secondary">{productGroup.brand}</Badge>}
          </div>
          <h3 className="font-medium text-sm line-clamp-2">{productGroup.description}</h3>
          <div className="text-xs text-gray-500">
            {productGroup.section} • {productGroup.product_line}
          </div>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-lg font-bold text-green-600">₦{productGroup.wholesale_price?.toLocaleString()}</div>
              {productGroup.retail_price && (
                <div className="text-xs text-gray-500 line-through">₦{productGroup.retail_price?.toLocaleString()}</div>
              )}
            </div>
            <div className="text-xs">
              <div>Total Stock: {availableStock}</div>
              {cartQuantity > 0 && <div className="text-blue-600">In Cart: {cartQuantity}</div>}
            </div>
          </div>

          {/* Size Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Select Size:</label>
            <Select value={selectedSize} onValueChange={setSelectedSize}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose size..." />
              </SelectTrigger>
              <SelectContent>
                {productGroup.variants.map((variant) => (
                  <SelectItem
                    key={variant.id}
                    value={variant.size || ""}
                    disabled={variant.stock - (variant.reserved_stock || 0) <= 0}
                  >
                    {variant.size} ({variant.stock - (variant.reserved_stock || 0)} available)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => onAddToCart(selectedSize)} disabled={!selectedSize} className="w-full" size="sm">
            {selectedSize ? "Add to Cart" : "Select Size"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
