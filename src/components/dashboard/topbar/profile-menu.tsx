import * as React from "react";
import { ProfileMenu as UbhonaProfileMenu } from "../../ui/profile-menu";
import type { RestaurantProfile } from "../../../lib/restaurant";

export function ProfileMenu({
  profile,
  logoUrl,
  onLogout,
  compact = true,
}: {
  profile: RestaurantProfile | null;
  logoUrl?: string;
  onLogout: () => void;
  compact?: boolean;
}) {
  return <UbhonaProfileMenu profile={profile} logoUrl={logoUrl} onLogout={onLogout} compact={compact} />;
}
