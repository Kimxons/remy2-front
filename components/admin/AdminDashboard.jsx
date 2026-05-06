"use client"

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import httpClient from "../../api/httpClient";
import "./AdminDashboard.scss";

const AdminDashboard = () => {
  // Local search state
  const [userSearch, setUserSearch] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

  // Fetch users
  const { data: users = [], isLoading: loadingUsers } = useQuery(
    ["users"],
    async () => {
      const res = await httpClient.get("/users/");
      return res.data;
    }
  );

  // Fetch jobs (from orders endpoint)
  const { data: jobs = [], isLoading: loadingJobs } = useQuery(
    ["jobs"],
    async () => {
      const res = await httpClient.get("/orders/jobs/");
      return res.data;
    }
  );

  // Fetch orders (same as jobs - they're the same thing)
  const { data: orders = [], isLoading: loadingOrders } = useQuery(
    ["orders"],
    async () => {
      const res = await httpClient.get("/orders/jobs/");
      return res.data;
    }
  );

  if (loadingUsers || loadingJobs || loadingOrders) {
    return <p>Loading admin data...</p>;
  }

  return (
    <div className="admin-dashboard">
      <h1>🛠️ Admin Dashboard</h1>

      {/* USERS TABLE */}
      <div className="admin-section">
        <h2>Users</h2>
        <input
          type="text"
          placeholder="Search users..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {users
              .filter(
                (u) =>
                  u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
                  u.email.toLowerCase().includes(userSearch.toLowerCase())
              )
              .map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.is_active ? "✅" : "❌"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* JOBS TABLE */}
      <div className="admin-section">
        <h2>Jobs</h2>
        <input
          type="text"
          placeholder="Search jobs..."
          value={jobSearch}
          onChange={(e) => setJobSearch(e.target.value)}
        />
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Employer</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs
              .filter((j) =>
                j.title.toLowerCase().includes(jobSearch.toLowerCase())
              )
              .map((j) => (
                <tr key={j.id}>
                  <td>{j.id}</td>
                  <td>{j.title}</td>
                  <td>{j.employer}</td>
                  <td>{j.status}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ORDERS TABLE */}
      <div className="admin-section">
        <h2>Orders</h2>
        <input
          type="text"
          placeholder="Search orders..."
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
        />
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Job</th>
              <th>Client</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders
              .filter((o) =>
                o.job.toLowerCase().includes(orderSearch.toLowerCase())
              )
              .map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.job}</td>
                  <td>{o.client}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
