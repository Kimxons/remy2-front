"use client"

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import httpClient from "../../api/httpClient";

export default function PostJob() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    budget_amount: "",
    budget_currency: "USD",
  });

  const { mutate, isLoading, error } = useMutation({
    mutationFn: (payload) => httpClient.post("jobs/", payload),
    onSuccess: (res) => router.push(`/jobs/${res.data.id}`),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutate({
      title: form.title,
      description: form.description,
      budget_amount: Number(form.budget_amount),
      budget_currency: form.budget_currency,
    });
  };

  return (
    <div className="postJob">
      <form onSubmit={handleSubmit}>
        <h1>Post a Job</h1>
        <label>Title</label>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <label>Description</label>
        <textarea
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <label>Budget</label>
        <input
          type="number"
          required
          value={form.budget_amount}
          onChange={(e) => setForm({ ...form, budget_amount: e.target.value })}
        />
        <label>Currency</label>
        <select
          value={form.budget_currency}
          onChange={(e) =>
            setForm({ ...form, budget_currency: e.target.value })
          }
        >
          <option>USD</option>
          <option>EUR</option>
          <option>KES</option>
        </select>
        <button disabled={isLoading}>
          {isLoading ? "Saving…" : "Create job"}
        </button>
        {error && <p className="error">Couldn’t create job.</p>}
      </form>
    </div>
  );
}
