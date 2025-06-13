"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, RefreshCw } from "lucide-react"
import * as XLSX from "xlsx"
import { createClient } from "@/lib/supabase"

interface ImportData {
  headers: string[]
  rows: string[][]
  preview: string[][]
}

interface ColumnMapping {
  [key: string]: string
}

interface ImportResult {
  success: number
  updated: number
  skipped: number
  merged: number
  errors: string[]
}

interface ProductVariant {
  reference: string
  size: string
  stock: number
  bar_code?: string
  brand?: string
  section?: string
  product_line?: string
  description?: string
  retail_price?: number
  wholesale_price?: number
  image_url?: string
}

const REQUIRED_FIELDS = [
  { key: "reference", label: "Reference *", required: true },
  { key: "size", label: "Size *", required: true },
  { key: "brand", label: "Brand", required: false },
  { key: "section", label: "Section", required: false },
  { key: "product_line", label: "Product Line", required: false },
  { key: "description", label: "Description", required: false },
  { key: "bar_code", label: "Bar Code", required: false },
  { key: "retail_price", label: "Retail Price", required: false },
  { key: "wholesale_price", label: "Wholesale Price", required: false },
  { key: "stock", label: "Stock", required: false },
  { key: "image_url", label: "Image URL", required: false },
]

export default function EnhancedImport({ onImportComplete }: { onImportComplete: () => void }) {
  const [importData, setImportData] = useState<ImportData | null>(null)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error" | "info" | null; message: string }>({
    type: null,
    message: "",
  })
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [updateMode, setUpdateMode] = useState<"skip" | "update">("update")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result

        let workbook: XLSX.WorkBook
        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          workbook = XLSX.read(data, { type: "array" })
        } else {
          // Handle CSV
          const text = e.target?.result as string
          workbook = XLSX.read(text, { type: "string" })
        }

        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]

        if (jsonData.length < 2) {
          setImportStatus({ type: "error", message: "File must contain at least a header row and one data row" })
          return
        }

        const headers = jsonData[0].map((h) => String(h).trim())
        const rows = jsonData.slice(1).filter((row) => row.some((cell) => cell !== undefined && cell !== ""))
        const preview = rows.slice(0, 5) // Show first 5 rows for preview

        setImportData({ headers, rows, preview })
        setImportStatus({ type: "info", message: `File loaded successfully. Found ${rows.length} data rows.` })

        // Auto-map columns based on common names
        const autoMapping: ColumnMapping = {}
        headers.forEach((header, index) => {
          const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "")

          REQUIRED_FIELDS.forEach((field) => {
            const normalizedField = field.key.toLowerCase().replace(/[^a-z0-9]/g, "")
            if (
              normalizedHeader.includes(normalizedField) ||
              normalizedHeader === normalizedField ||
              (field.key === "product_line" &&
                (normalizedHeader.includes("productline") || normalizedHeader.includes("line"))) ||
              (field.key === "bar_code" && normalizedHeader.includes("barcode")) ||
              (field.key === "retail_price" &&
                (normalizedHeader.includes("retailprice") || normalizedHeader.includes("retail"))) ||
              (field.key === "wholesale_price" &&
                (normalizedHeader.includes("wholesaleprice") || normalizedHeader.includes("wholesale"))) ||
              (field.key === "image_url" && (normalizedHeader.includes("image") || normalizedHeader.includes("url")))
            ) {
              autoMapping[field.key] = header
            }
          })
        })

        setColumnMapping(autoMapping)
      } catch (error) {
        console.error("Error parsing file:", error)
        setImportStatus({ type: "error", message: "Error parsing file. Please check the file format." })
      }
    }

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file)
    }
  }

  const processImport = async () => {
    if (!importData) return

    // Validate required mappings
    const missingRequired = REQUIRED_FIELDS.filter((field) => field.required && !columnMapping[field.key])
    if (missingRequired.length > 0) {
      setImportStatus({
        type: "error",
        message: `Please map required fields: ${missingRequired.map((f) => f.label).join(", ")}`,
      })
      return
    }

    setIsImporting(true)
    setImportStatus({ type: "info", message: "Processing import..." })

    try {
      const variants: ProductVariant[] = []
      const errors = []
      let successCount = 0
      let updatedCount = 0
      let skippedCount = 0
      let mergedCount = 0

      // Get existing products for duplicate checking
      const { data: existingProducts } = await supabase
        .from("products")
        .select("reference, size, id, stock, wholesale_price, retail_price, bar_code")

      const existingProductsMap = new Map(
        existingProducts?.map((p) => [`${p.reference.toLowerCase()}_${(p.size || "").toLowerCase()}`, p]) || [],
      )

      // Group by barcode to handle barcode duplicates
      const barcodeGroups = new Map<string, ProductVariant[]>()

      // Parse all rows first
      for (let i = 0; i < importData.rows.length; i++) {
        try {
          const row = importData.rows[i]
          const variant: ProductVariant = {
            reference: "",
            size: "",
            stock: 0,
          }

          // Map columns to variant fields
          REQUIRED_FIELDS.forEach((field) => {
            const columnHeader = columnMapping[field.key]
            if (columnHeader) {
              const columnIndex = importData.headers.indexOf(columnHeader)
              if (columnIndex !== -1) {
                const value = row[columnIndex]?.toString().trim()

                switch (field.key) {
                  case "reference":
                    variant.reference = value || ""
                    break
                  case "size":
                    variant.size = value || ""
                    break
                  case "retail_price":
                  case "wholesale_price":
                    if (value) {
                      const cleanValue = value.replace(/[₦,\s]/g, "").replace(/[^\d.-]/g, "")
                      const numericValue = Number.parseFloat(cleanValue)
                      variant[field.key] = isNaN(numericValue) ? undefined : numericValue
                    }
                    break
                  case "stock":
                    if (value) {
                      const numericValue = Number.parseInt(value.replace(/[^\d]/g, ""))
                      variant.stock = isNaN(numericValue) ? 0 : numericValue
                    }
                    break
                  case "bar_code":
                    variant.bar_code = value || undefined
                    break
                  default:
                    ;(variant as any)[field.key] = value || undefined
                }
              }
            }
          })

          if (!variant.reference) {
            errors.push(`Row ${i + 2}: Missing reference`)
            continue
          }

          if (!variant.size) {
            errors.push(`Row ${i + 2}: Missing size`)
            continue
          }

          // Group by barcode if it exists
          if (variant.bar_code) {
            if (!barcodeGroups.has(variant.bar_code)) {
              barcodeGroups.set(variant.bar_code, [])
            }
            barcodeGroups.get(variant.bar_code)!.push(variant)
          } else {
            variants.push(variant)
          }
        } catch (error) {
          errors.push(`Row ${i + 2}: ${error}`)
        }
      }

      // Process barcode groups (sum up stock for same barcodes)
      for (const [barcode, groupVariants] of barcodeGroups) {
        if (groupVariants.length === 1) {
          variants.push(groupVariants[0])
        } else {
          // Merge variants with same barcode
          const mergedVariant = { ...groupVariants[0] }
          mergedVariant.stock = groupVariants.reduce((sum, v) => sum + v.stock, 0)
          variants.push(mergedVariant)
          mergedCount += groupVariants.length - 1
        }
      }

      // Process variants
      const productsToInsert = []
      const productsToUpdate = []

      for (const variant of variants) {
        const key = `${variant.reference.toLowerCase()}_${variant.size.toLowerCase()}`
        const existingProduct = existingProductsMap.get(key)

        if (existingProduct) {
          if (updateMode === "skip") {
            skippedCount++
            continue
          } else {
            // Update mode - check if values have changed
            const hasChanges =
              variant.stock !== existingProduct.stock ||
              (variant.wholesale_price !== undefined && variant.wholesale_price !== existingProduct.wholesale_price) ||
              (variant.retail_price !== undefined && variant.retail_price !== existingProduct.retail_price)

            if (hasChanges) {
              productsToUpdate.push({
                id: existingProduct.id,
                ...variant,
              })
            } else {
              skippedCount++
            }
          }
        } else {
          productsToInsert.push(variant)
        }
      }

      // Insert new products in batches
      if (productsToInsert.length > 0) {
        const batchSize = 100
        for (let i = 0; i < productsToInsert.length; i += batchSize) {
          const batch = productsToInsert.slice(i, i + batchSize)
          const { error } = await supabase.from("products").insert(batch)
          if (error) throw error
          successCount += batch.length
        }
      }

      // Update existing products
      for (const product of productsToUpdate) {
        const { id, ...updateData } = product
        const { error } = await supabase.from("products").update(updateData).eq("id", id)
        if (error) throw error
        updatedCount++
      }

      const result: ImportResult = {
        success: successCount,
        updated: updatedCount,
        skipped: skippedCount,
        merged: mergedCount,
        errors,
      }

      setImportResult(result)

      if (errors.length === 0) {
        setImportStatus({
          type: "success",
          message: `Import completed! ${successCount} new, ${updatedCount} updated, ${skippedCount} skipped, ${mergedCount} merged by barcode.`,
        })
      } else {
        setImportStatus({
          type: "error",
          message: `Import completed with ${errors.length} errors. Check the results below.`,
        })
      }

      onImportComplete()
    } catch (error: any) {
      console.error("Error importing products:", error)
      setImportStatus({ type: "error", message: `Import failed: ${error.message}` })
    } finally {
      setIsImporting(false)
    }
  }

  const resetImport = () => {
    setImportData(null)
    setColumnMapping({})
    setImportStatus({ type: null, message: "" })
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Upload File</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload Excel/CSV File
              </Button>
            </div>

            {importStatus.type && (
              <Alert
                className={
                  importStatus.type === "error"
                    ? "border-red-500"
                    : importStatus.type === "success"
                      ? "border-green-500"
                      : "border-blue-500"
                }
              >
                <AlertDescription>{importStatus.message}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Column Mapping */}
      {importData && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Map Columns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Product Variants:</strong> Products with the same reference but different sizes will be
                  treated as variants. If the same barcode appears multiple times, their stock will be summed together.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REQUIRED_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <Select
                      value={columnMapping[field.key] || ""}
                      onValueChange={(value) => setColumnMapping((prev) => ({ ...prev, [field.key]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_mapped">-- Not mapped --</SelectItem>
                        {importData.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duplicate Handling</label>
                <Select value={updateMode} onValueChange={(value: "skip" | "update") => setUpdateMode(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip existing variants</SelectItem>
                    <SelectItem value="update">Update existing variants</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {updateMode === "skip"
                    ? "Product variants with existing reference+size will be skipped"
                    : "Product variants with existing reference+size will be updated if values changed"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {importData && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Preview Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {REQUIRED_FIELDS.filter((f) => columnMapping[f.key]).map((field) => (
                      <TableHead key={field.key}>{field.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.preview.map((row, index) => (
                    <TableRow key={index}>
                      {REQUIRED_FIELDS.filter((f) => columnMapping[f.key]).map((field) => {
                        const columnIndex = importData.headers.indexOf(columnMapping[field.key])
                        return <TableCell key={field.key}>{row[columnIndex] || "-"}</TableCell>
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Showing first 5 rows. Total rows to import: {importData.rows.length}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Import Actions */}
      {importData && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Import</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={processImport}
                disabled={isImporting || !columnMapping.reference || !columnMapping.size}
                className="flex-1"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Start Import
                  </>
                )}
              </Button>
              <Button onClick={resetImport} variant="outline">
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                  <div className="text-sm text-gray-600">New Variants</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{importResult.updated}</div>
                  <div className="text-sm text-gray-600">Updated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{importResult.skipped}</div>
                  <div className="text-sm text-gray-600">Skipped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{importResult.merged}</div>
                  <div className="text-sm text-gray-600">Merged by Barcode</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2">Errors ({importResult.errors.length})</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.errors.slice(0, 10).map((error, index) => (
                      <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </div>
                    ))}
                    {importResult.errors.length > 10 && (
                      <div className="text-sm text-gray-500">... and {importResult.errors.length - 10} more errors</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample Data */}
      <Card>
        <CardHeader>
          <CardTitle>Sample CSV Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 p-4 rounded text-sm font-mono whitespace-pre">
            {`reference,brand,section,product_line,description,size,bar_code,retail_price,wholesale_price,stock,image_url
10734703,Puma,Footwear,Teamsport,ULTRA MATCH FG/AG Ultra Blue-PUMA White,10,4065454906205,74400,55800,2,
10734703,Puma,Footwear,Teamsport,ULTRA MATCH FG/AG Ultra Blue-PUMA White,10.5,4065454906212,74400,55800,1,
10734703,Puma,Footwear,Teamsport,ULTRA MATCH FG/AG Ultra Blue-PUMA White,11,4065454906229,74400,55800,3,`}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Notice how the same reference (10734703) appears with different sizes. These will be treated as variants of
            the same product.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
