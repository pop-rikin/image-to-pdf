import type { Metadata } from 'next'
import './globals.css'
import { Lexend } from 'next/font/google'

const lexend = Lexend({ 
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-lexend',
})

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${lexend.className} font-light`}>{children}</body>
    </html>
  )
}
