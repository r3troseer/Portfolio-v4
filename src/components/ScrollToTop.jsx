// components/ScrollToTop.js
import { useEffect } from "react";
import { useLocation } from "react-router";

export function ScrollToTop() {
  const { pathname, state } = useLocation();

  useEffect(() => {
    if (!state?.scrollTo) {
      window.scrollTo(0, 0);
    }
  }, [pathname, state]);

  return null;
}
