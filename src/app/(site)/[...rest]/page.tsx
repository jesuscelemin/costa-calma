import { notFound } from "next/navigation";

// Not found is the expected outcome here, not a navigation that should render instantly.
export const instant = false;

// Any unknown public URL lands here, so its 404 renders inside the site layout (header and footer)
// instead of the bare root not-found page.
export default function UnknownPage() {
  notFound();
}
