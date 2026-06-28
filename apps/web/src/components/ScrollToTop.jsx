// components/ScrollToTop.js
import { useLayoutEffect } from "react";
import { useLocation } from "react-router";

export function ScrollToTop() {
  const { pathname, state } = useLocation();

  useLayoutEffect(() => {
    if (!state?.scrollTo) {
      window.scrollTo(0, 0);
    }
  }, [pathname, state]);

  return null;
}
