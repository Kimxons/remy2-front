"use client"

import React from 'react';
import './Skeleton.scss';

const Skeleton = ({
  variant = 'text',
  width,
  height,
  className = '',
  count = 1,
  circle = false,
  animation = 'pulse'
}) => {
  const skeletons = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={`skeleton skeleton--${variant} skeleton--${animation} ${circle ? 'skeleton--circle' : ''} ${className}`}
      style={{
        width: width || (variant === 'text' ? '100%' : undefined),
        height: height || (variant === 'text' ? '1em' : undefined),
      }}
    />
  ));

  return count > 1 ? <div className="skeleton-group">{skeletons}</div> : skeletons[0];
};

// Specialized skeleton components
export const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={`skeleton-text-block ${className}`}>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={i === lines - 1 ? '60%' : '100%'}
      />
    ))}
  </div>
);

export const SkeletonCard = ({ className = '' }) => (
  <div className={`skeleton-card ${className}`}>
    <Skeleton variant="rectangular" height="200px" className="skeleton-card__image" />
    <div className="skeleton-card__content">
      <Skeleton variant="text" width="80%" height="24px" />
      <SkeletonText lines={2} />
      <div className="skeleton-card__footer">
        <Skeleton variant="circular" width="40px" height="40px" />
        <Skeleton variant="text" width="120px" />
      </div>
    </div>
  </div>
);

export const SkeletonOfferCard = ({ className = '' }) => (
  <div className={`skeleton-offer-card ${className}`}>
    <div className="skeleton-offer-card__header">
      <div className="skeleton-offer-card__title">
        <Skeleton circle width="40px" height="40px" />
        <Skeleton variant="text" width="150px" height="20px" />
      </div>
      <Skeleton variant="text" width="100px" height="24px" />
    </div>
    <div className="skeleton-offer-card__body">
      <Skeleton variant="text" width="100%" height="28px" />
      <div className="skeleton-offer-card__metrics">
        <Skeleton variant="rectangular" height="80px" />
        <Skeleton variant="rectangular" height="80px" />
      </div>
      <SkeletonText lines={3} />
    </div>
    <div className="skeleton-offer-card__actions">
      <Skeleton variant="rectangular" height="44px" />
      <Skeleton variant="rectangular" height="44px" />
    </div>
  </div>
);

export const SkeletonThread = ({ className = '' }) => (
  <div className={`skeleton-thread ${className}`}>
    <Skeleton circle width="48px" height="48px" />
    <div className="skeleton-thread__content">
      <Skeleton variant="text" width="140px" height="18px" />
      <Skeleton variant="text" width="220px" height="14px" />
    </div>
    <Skeleton variant="text" width="40px" height="14px" />
  </div>
);

export const SkeletonMessage = ({ sent = false, className = '' }) => (
  <div className={`skeleton-message ${sent ? 'skeleton-message--sent' : ''} ${className}`}>
    <Skeleton variant="rectangular" width={sent ? '280px' : '320px'} height="60px" />
  </div>
);

export const SkeletonTable = ({ rows = 5, columns = 4, className = '' }) => (
  <div className={`skeleton-table ${className}`}>
    <div className="skeleton-table__header">
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton key={i} variant="text" height="20px" />
      ))}
    </div>
    {Array.from({ length: rows }, (_, rowIndex) => (
      <div key={rowIndex} className="skeleton-table__row">
        {Array.from({ length: columns }, (_, colIndex) => (
          <Skeleton key={colIndex} variant="text" height="16px" />
        ))}
      </div>
    ))}
  </div>
);

export default Skeleton;
