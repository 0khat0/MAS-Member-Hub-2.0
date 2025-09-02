import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circle' | 'card' | 'button' | 'qr';
  width?: string | number;
  height?: string | number;
  lines?: number; // For text variant
}

export default function Skeleton({ 
  className = '', 
  variant = 'text', 
  width, 
  height, 
  lines = 1 
}: SkeletonProps) {
  const baseClasses = 'skeleton';
  
  const variantClasses = {
    text: 'skeleton-text',
    circle: 'skeleton-circle',
    card: 'skeleton-card',
    button: 'skeleton-text',
    qr: 'skeleton-card aspect-square'
  };

  const defaultSizes = {
    text: { width: '100%', height: '1rem' },
    circle: { width: '2.5rem', height: '2.5rem' },
    card: { width: '100%', height: '8rem' },
    button: { width: '8rem', height: '2.5rem' },
    qr: { width: '12rem', height: '12rem' }
  };

  const finalWidth = width || defaultSizes[variant].width;
  const finalHeight = height || defaultSizes[variant].height;

  const style = {
    width: typeof finalWidth === 'number' ? `${finalWidth}px` : finalWidth,
    height: typeof finalHeight === 'number' ? `${finalHeight}px` : finalHeight,
  };

  // For text variant with multiple lines
  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={`${baseClasses} ${variantClasses[variant]}`}
            style={{
              ...style,
              width: i === lines - 1 ? '75%' : style.width // Last line is shorter
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-label="Loading..."
      role="status"
    />
  );
}

// Preset skeleton components for common use cases
export function SkeletonQRCode({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <Skeleton variant="qr" className="mx-auto" />
      <Skeleton variant="text" width="8rem" height="1.25rem" />
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-card p-6 space-y-4 ${className}`}>
      <div className="flex items-center space-x-4">
        <Skeleton variant="circle" width="3rem" height="3rem" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" height="1.25rem" />
          <Skeleton variant="text" width="60%" height="1rem" />
        </div>
      </div>
      <Skeleton variant="text" lines={3} />
      <div className="flex space-x-3">
        <Skeleton variant="button" />
        <Skeleton variant="button" width="6rem" />
      </div>
    </div>
  );
}

export function SkeletonStats({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* QR Code Skeleton */}
      <SkeletonQRCode />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-card p-4 text-center space-y-2">
            <Skeleton variant="text" height="2rem" />
            <Skeleton variant="text" width="60%" height="1rem" />
          </div>
        ))}
      </div>
      
      {/* Chart Skeleton */}
      <div className="skeleton-card p-6 space-y-4">
        <Skeleton variant="text" height="1.5rem" width="50%" />
        <div className="h-48 flex items-end space-x-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton 
              key={i} 
              variant="card" 
              className="flex-1" 
              height={`${Math.random() * 120 + 60}px`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonProfile({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-4">
        <Skeleton variant="circle" width="5rem" height="5rem" className="mx-auto" />
        <Skeleton variant="text" height="1.5rem" width="12rem" className="mx-auto" />
        <Skeleton variant="text" height="1rem" width="8rem" className="mx-auto" />
      </div>
      
      {/* Quick Actions */}
      <div className="flex space-x-3">
        <Skeleton variant="button" className="flex-1" />
        <Skeleton variant="button" className="flex-1" />
      </div>
      
      {/* Content Cards */}
      {[1, 2].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
