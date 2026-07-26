import { useEffect, useState } from "react";

const KEY = "vl_shop_name";

export function getShopName(fallback = "VoiceLedger") {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(KEY) || fallback;
}

export function setShopName(name: string) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, name);
  window.dispatchEvent(new Event("vl-shop-name"));
}

export function useShopName(fallback = "VoiceLedger") {
  const [name, setName] = useState(fallback);
  useEffect(() => {
    const sync = () => setName(getShopName(fallback));
    sync();
    window.addEventListener("vl-shop-name", sync);
    return () => window.removeEventListener("vl-shop-name", sync);
  }, [fallback]);
  return name;
}
