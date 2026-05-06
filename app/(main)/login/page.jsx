import Login from "@/components/login/Login"


/**
 * Login page
 * @returns {JSX.Element}
 */
export default async function LoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams
  return <Login initialSearchParams={resolvedSearchParams || {}} />
}
