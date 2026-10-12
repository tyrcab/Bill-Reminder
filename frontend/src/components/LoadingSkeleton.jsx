import React from 'react';

function LoadingSkeleton() {
  return (
    <div className="skeleton-container">
      {/* Summary cards skeleton */}
      <div className="skeleton-row">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-line short" />
            <div className="skeleton-line medium" />
          </div>
        ))}
      </div>
      {/* Bill cards skeleton */}
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-bill">
            <div className="skeleton-line short" />
            <div className="skeleton-line long" />
            <div className="skeleton-line medium" />
            <div className="skeleton-line short" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default LoadingSkeleton;
