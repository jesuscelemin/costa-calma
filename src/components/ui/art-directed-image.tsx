import { getImageProps, type ImageProps } from "next/image";

import { MOBILE_QUERY } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

type ArtDirectedImageProps = Omit<React.ComponentProps<"picture">, "children"> & {
  /** Public paths of the landscape and the portrait image. */
  desktop: string;
  mobile: string;
  /** For the image people see first (the LCP): fetched right away at high priority, not lazily. */
  eager?: boolean;
};

/**
 * A decorative image that fills its positioned parent, landscape on desktop and portrait on phones
 * (`<picture>`, so each screen downloads only its own). `next/image`'s `preload` would preload
 * only one of the two, so the LCP image is marked `eager` instead.
 */
export function ArtDirectedImage({
  desktop,
  mobile,
  eager,
  className,
  ...props
}: ArtDirectedImageProps) {
  const common: Omit<ImageProps, "src"> = {
    alt: "",
    fill: true,
    sizes: "100vw",
    loading: eager ? "eager" : "lazy",
    fetchPriority: eager ? "high" : undefined,
  };
  const {
    props: { srcSet: mobileSrcSet },
  } = getImageProps({ ...common, src: mobile });
  const { props: image } = getImageProps({ ...common, src: desktop });

  return (
    <picture {...props} className={cn("absolute inset-0", className)}>
      <source media={MOBILE_QUERY} srcSet={mobileSrcSet} />
      <img {...image} alt="" className="object-cover" />
    </picture>
  );
}
