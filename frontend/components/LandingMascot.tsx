"use client";

import { Mascot } from "page-mascot";

export default function LandingMascot() {
  return (
    <Mascot
      directions="/mascots/horse-directions.webp"
      reactions="/mascots/horse-reactions.webp"
      size={62}
      label="Horse Transport mascot"
      className="home-navigation-mascot"
    />
  );
}
