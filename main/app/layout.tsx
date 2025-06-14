import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wholesale Order System',
  description: 'Created by Kamii Samaaa',
  generator: 'Kamii Samaaa',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
