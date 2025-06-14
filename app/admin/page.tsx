import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmailDiagnostic } from "@/components/email-diagnostic"

export default function AdminPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>

      <Tabs defaultValue="overview" className="w-[400px]">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="diagnostics">Email Test</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p>Overview content goes here.</p>
        </TabsContent>
        <TabsContent value="products">
          <p>Products content goes here.</p>
        </TabsContent>
        <TabsContent value="orders">
          <p>Orders content goes here.</p>
        </TabsContent>
        <TabsContent value="diagnostics" className="space-y-4">
          <div className="flex justify-center">
            <EmailDiagnostic />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
