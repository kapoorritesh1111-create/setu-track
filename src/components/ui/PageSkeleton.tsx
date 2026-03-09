"use client";

export default function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="setuPageSkeleton">
      <div className="setuPageSkeletonHero" />
      <div className="setuPageSkeletonGrid">
        <div className="setuPageSkeletonCard" />
        <div className="setuPageSkeletonCard" />
        <div className="setuPageSkeletonCard" />
        <div className="setuPageSkeletonCard" />
      </div>
      <div className="setuPageSkeletonTable">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="setuPageSkeletonRow" key={index} />
        ))}
      </div>
    </div>
  );
}
