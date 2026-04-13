import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "EtherCraft",
  description: "A Complete RPG Strategic Board Card Game Project",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className='antialiased h-screen w-screen flex justify-center items-center'>
        {children}
      </body>
    </html>
  )
}