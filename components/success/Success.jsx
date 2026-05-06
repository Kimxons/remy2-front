"use client"

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import httpClient from "../../api/httpClient";

const Success = () => {
  const { search } = usePathname();
  const router = useRouter();
  const params = new URLSearchParams(search);
  const payment_intent = params.get("payment_intent");

  useEffect(() => {
    const makeRequest = async () => {
      try {
        await httpClient.put("/orders", { payment_intent });
        setTimeout(() => {
          router.push("/orders");
        }, 5000);
      } catch (err) {
        console.log(err);
      }
    };

    makeRequest();
  }, []);

  return (
    <div>
      Payment successful. You are being redirected to the orders page. Please do
      not close the page
    </div>
  );
};

export default Success;
