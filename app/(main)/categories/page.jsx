import { Suspense } from "react"
import Categories from "@/components/categories/Categories"


/**
 * Categories page
 * @returns {JSX.Element}
 */
export default function CategoriesPage() {
  return (
    <Suspense fallback={null}>
      <Categories />
    </Suspense>
  )
}
