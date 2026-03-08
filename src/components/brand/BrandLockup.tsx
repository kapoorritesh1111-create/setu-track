import { BRAND } from '../../config/brand';

type Props = {
  className?: string;
  logoClassName?: string;
  taglineClassName?: string;
  descriptionClassName?: string;
  stacked?: boolean;
  showDescription?: boolean;
  href?: string;
  priority?: boolean;
};

export default function BrandLockup({
  className = '',
  logoClassName = '',
  taglineClassName = '',
  descriptionClassName = '',
  stacked = true,
  showDescription = false,
  priority = false,
}: Props) {
  return (
    <div className={`setuBrandLockup ${stacked ? 'setuBrandLockupStacked' : ''} ${className}`.trim()}>
      <picture>
        <source srcSet={BRAND.logo.full} type="image/svg+xml" />
        <img
          className={`setuBrandLogo ${logoClassName}`.trim()}
          src={BRAND.logo.fullPng}
          alt={`${BRAND.name} logo`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
        />
      </picture>
      <div className="setuBrandCopy">
        <p className={`setuBrandTagline ${taglineClassName}`.trim()}>{BRAND.tagline}</p>
        {showDescription ? (
          <p className={`setuBrandDescription ${descriptionClassName}`.trim()}>{BRAND.description}</p>
        ) : null}
      </div>
    </div>
  );
}
