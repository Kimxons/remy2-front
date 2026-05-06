"use client"

import React, { useState } from "react";
import httpClient from "../../api/httpClient";
import { CreditCard, ShieldCheck, Loader2, Mail } from "lucide-react"; 

const CheckoutForm = ({ jobId, amountUSD, sessionKey }) => { // sessionKey added as prop
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState(""); // New state for guest email

  const handleCardPayment = async (e) => {
    e.preventDefault();
    
    // Validation: Ensure email is provided for guests
    if (!email) {
      setError("Please enter an email address for your receipt.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Updated Endpoint to /payments/initialize/
      // 2. Included session_key in params for guest verification
      const res = await httpClient.post("/payments/initialize/", {
        job_id: jobId,
        client_email: email, // Sending the email captured in the form
      }, {
        params: sessionKey ? { session_key: sessionKey } : {}
      });

      // 3. Match your backend response key: 'authorization_url'
      if (res.data.authorization_url) {
        window.location.href = res.data.authorization_url;
      } else {
        throw new Error("Could not generate payment link.");
      }
    } catch (err) {
      console.error("Payment Error:", err);
      const errMsg = err.response?.data?.error || "Unable to connect to the payment gateway.";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card-checkout-container">
      <div className="payment-card shadow-lg border rounded-xl p-8 bg-white max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-2 text-gray-800">Secure Checkout</h2>
        <p className="text-gray-500 mb-6 text-sm">
          You are paying for Job #{jobId.substring(0, 8)}...
        </p>

        {/* Guest Email Input Field */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Receipt To:
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
        </div>

        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg mb-6">
          <span className="text-gray-600">Total Amount:</span>
          <span className="text-2xl font-bold text-blue-600">${amountUSD}</span>
        </div>

        <button
          onClick={handleCardPayment}
          disabled={isLoading}
          className="w-full bg-black text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              <CreditCard size={20} />
              Pay with Card
            </>
          )}
        </button>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
          <ShieldCheck size={14} />
          <span>Secured by Paystack. Encrypted Card Processing.</span>
        </div>

        {error && (
          <p className="mt-4 text-red-500 text-center text-sm bg-red-50 p-2 rounded border border-red-100">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default CheckoutForm;