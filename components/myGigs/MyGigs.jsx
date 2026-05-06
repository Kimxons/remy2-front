import React from "react";
import "./MyGigs.scss";
import { useQuery } from "@tanstack/react-query";
import httpClient from "../../api/httpClient";

const MyGigs = () => {
  const { isLoading, error, data } = useQuery({
    queryKey: ["myGigs"],
    queryFn: () => httpClient.get("/jobs/my").then((res) => res.data),
  });

  return (
    <div className="mygigs-page">
      <h1>My Gigs</h1>
      {isLoading ? (
        "Loading..."
      ) : error ? (
        "Error loading gigs"
      ) : (
        <div className="gigs-list">
          {data.map((gig) => (
            <div className="gig-card" key={gig.id}>
              <h3>{gig.title}</h3>
              <p>{gig.description.substring(0, 80)}...</p>
              <span>${gig.price}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyGigs;
