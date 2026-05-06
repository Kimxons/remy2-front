"use client"

import React, { useEffect, useState } from "react";
import httpClient from "../../api/httpClient";
import moment from "moment";
import "./Payments.scss";

const Payments = () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await httpClient.get(`/payments/${currentUser.username}`);
        setPayments(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, [currentUser]);

  if (loading) return <div>Loading payments...</div>;

  return (
    <div className="payments">
      <h1>Payment History</h1>
      {payments.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.method}</td>
                <td>${p.amount}</td>
                <td>{p.status}</td>
                <td>{p.reference}</td>
                <td>{moment(p.date).format("LL")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No payments found.</p>
      )}
    </div>
  );
};

export default Payments;
