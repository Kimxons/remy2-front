import ForgotPassword from "@/components/forgot-password/ForgotPassword"

/**
 * Forgot password page.
 * Sends setup/reset email to account owner.
 * @returns {JSX.Element}
 */
export default async function ForgotPasswordPage({ searchParams }) {
  const resolvedSearchParams = await searchParams
  const initialEmail =
    typeof resolvedSearchParams?.email === "string" ? resolvedSearchParams.email : ""

  return <ForgotPassword initialEmail={initialEmail} />
}
