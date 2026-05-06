"use client"

import Navbar from "@/components/navbar/Navbar"
import Footer from "@/components/footer/Footer"

/**
 * Main layout for authenticated and public pages
 * Wraps content with Navbar and Footer
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function MainLayout({ children }) {
  return (
    <div className="app">
      <Navbar />
      <div className="content">
        {children}
      </div>
      <Footer />
    </div>
  )
}
