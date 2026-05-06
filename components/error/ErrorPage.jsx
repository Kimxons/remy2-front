// src/pages/error/ErrorPage.jsx
import React from "react";
import Link from "next/link";
import "./ErrorPage.scss";

const ErrorPage = ({ error, statusCode = 404 }) => {
  // Only log if there's an actual error object with content
  if (error && Object.keys(error).length > 0) {
    console.error(error);
  }

  return (
    <div className="error-page">
      <h1>Oops!</h1>
      <p>Sorry, {statusCode === 404 ? 'the page you are looking for does not exist' : 'something went wrong'}.</p>
      {error?.message && (
        <p className="error-details">
          {error.message}
        </p>
      )}
      <Link href="/" className="btn">
        Back to Home
      </Link>
    </div>
  );
};

export default ErrorPage;
