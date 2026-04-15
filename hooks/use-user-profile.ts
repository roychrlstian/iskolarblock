import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface UserProfile {
  name: string;
  email: string;
  profilePicture: string | null;
}

export function useUserProfile(user: SupabaseUser | null) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.email) return;

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("User")
          .select("name, email, profilePicture")
          .eq("email", user.email.toLowerCase().trim())
          .maybeSingle();

        if (error) {
          console.error("Error fetching user profile:", error);
          return;
        }

        if (data) {
          setUserProfile({
            name: data.name || user.email.split("@")[0],
            email: data.email,
            profilePicture: data.profilePicture || null,
          });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    void fetchUserProfile();

    const handleProfileUpdate = () => {
      void fetchUserProfile();
    };

    window.addEventListener("userProfileUpdated", handleProfileUpdate);

    return () => {
      window.removeEventListener("userProfileUpdated", handleProfileUpdate);
    };
  }, [user?.email]);

  const getUserInitial = (): string => {
    if (userProfile?.name) return userProfile.name.charAt(0);
    if (user?.email) return user.email.charAt(0);
    return "A";
  };

  const getUserName = (): string => {
    if (userProfile?.name) return userProfile.name;
    if (user?.email) return user.email.split("@")[0];
    return "Administrator";
  };

  return { userProfile, getUserInitial, getUserName };
}
