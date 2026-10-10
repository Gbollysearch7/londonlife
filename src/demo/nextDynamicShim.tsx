import { Suspense, lazy, type ComponentType, type ReactNode } from "react";

type Loader<P> = () => Promise<{ default: ComponentType<P> } | ComponentType<P>>;

/** Minimal next/dynamic replacement for the standalone test build. */
export default function dynamic<P extends object>(loader: Loader<P>, opts?: { loading?: () => ReactNode; ssr?: boolean }) {
  const Lazy = lazy(async () => {
    const m = await loader();
    return { default: ("default" in m ? m.default : m) as ComponentType<P> };
  });
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={opts?.loading?.() ?? null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
