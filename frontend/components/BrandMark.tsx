import Image from "next/image";

export default function BrandMark({ className = "customer-brand-mark" }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <Image
        className="customer-brand-logo"
        src="/logo.png"
        alt=""
        width={500}
        height={500}
        sizes="44px"
        priority
      />
    </span>
  );
}
