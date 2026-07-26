import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("vl_state_v1");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.user) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as object)) throw e;
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
