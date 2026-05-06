import Orders from "@/components/orders/Orders"


/**
 * Orders page
 * @returns {JSX.Element}
 */
export default async function OrdersPage({ searchParams }) {
  const resolvedSearchParams = await searchParams
  return <Orders initialSearchParams={resolvedSearchParams || {}} />
}
