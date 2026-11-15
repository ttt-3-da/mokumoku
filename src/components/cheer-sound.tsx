"use client";

import { useEffect } from "react";
import { playSound, useMuted } from "@/lib/sound";

/** 表示されたときに一度だけ、お祝いの音を鳴らす（ミュート中は鳴らさない） */
export function CheerSound() {
  const [muted] = useMuted();
  useEffect(() => {
    if (muted) return;
    return playSound("cheer", 0.2);
  }, [muted]);
  return null;
}
