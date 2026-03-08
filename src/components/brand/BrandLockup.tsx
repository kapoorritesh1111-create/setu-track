import { BRAND } from "../../config/brand";

type Props = {
  compact?: boolean;
  className?: string;
  showTagline?: boolean;
  showDescription?: boolean;
  invert?: boolean;
  iconOnly?: boolean;
};

export default function BrandLockup({
  compact = false,
  className = "",
  showTagline = true,
  showDescription = false,
  invert = false,
  iconOnly = false,
}: Props) {
  const imageClass = iconOnly ? "brandMark brandMarkOnly" : compact ? "brandMark" : "brandLogo";

  return (
    <div
      className={["brandLockup", compact ? "brandLockupCompact" : "", invert ? "brandLockupInvert" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {iconOnly ? (
        <img
          className={imageClass}
          src={BRAND.logo.markPng}
          alt={`${BRAND.name} symbol`}
          width={512}
          height={512}
        />
      ) : (
        <picture>
          <source media="(prefers-color-scheme: dark)" srcSet={BRAND.logo.fullDarkPng} />
          <img
            className={imageClass}
            src={BRAND.logo.fullLightPng}
            alt={`${BRAND.name} logo`}
            width={852}
            height={604}
          />
        </picture>
      )}
      {!iconOnly ? (
        <div className="brandLockupCopy">
          {showTagline ? <div className="brandTagline">{BRAND.tagline}</div> : null}
          {showDescription ? <div className="brandDescription">{BRAND.description}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
