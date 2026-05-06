import React from "react";
import { useQuery } from "@tanstack/react-query";
import httpClient from "../../api/httpClient";
import Link from "next/link";
import "./Jobs.scss";

export default function Jobs() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => httpClient.get("jobs/").then((r) => r.data),
  });

  if (isLoading) return "loading";
  if (error) return "error";

  return (
    <div className="jobs">
      <h1>Jobs</h1>
      <div className="grid">
        {data?.map((job) => job.id ? (
          <Link href={`/jobs/${job.id}`} className="card" key={job.id}>
            <h3>{job.title}</h3>
            <p>{job.description?.slice(0, 120)}{job.description?.length > 120 ? "…" : ""}</p>
            <div className="meta">
              <span>Budget: {job.budget_currency} {job.budget_amount}</span>
            </div>
          </Link>
        ) : null)}
      </div>
    </div>
  );
}
