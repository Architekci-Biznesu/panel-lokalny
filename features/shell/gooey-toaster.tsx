"use client";

import { useEffect } from "react";
import { mountToaster, unmountToaster } from "gooey-toast";
import "gooey-toast/styles.css";

export function GooeyToaster() {
  useEffect(() => {
    mountToaster({ position: "top-right" });
    return () => {
      unmountToaster();
    };
  }, []);

  return null;
}
