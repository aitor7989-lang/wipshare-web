import { Unavailable } from '@/components/Unavailable';

/**
 * Rendered when notFound() fires for /c/[id] - an unknown id or a clip that
 * isn't ready. The calm shared "unavailable" surface, never the framework error.
 * (Expired-but-real clips render <Unavailable> from the page with its default
 * "no longer available" wording.)
 */
export default function ClipNotFound() {
  return (
    <Unavailable
      title="This clip isn’t available"
      sub="The link may be wrong, the clip may still be processing, or it was removed."
    />
  );
}
