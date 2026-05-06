import PasswordSetup from "@/components/password-setup/PasswordSetup"

/**
 * Password setup confirmation page.
 * Expects uid/token in query params from secure email link.
 * @returns {JSX.Element}
 */
export default async function PasswordSetupPage({ searchParams }) {
  const resolvedSearchParams = await searchParams
  return <PasswordSetup initialSearchParams={resolvedSearchParams || {}} />
}
