"use client";

export default function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="setuPageSkeletonTable">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="setuPageSkeletonRow" key={index} />
      ))}
    </div>
  );
}
