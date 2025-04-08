"use client";

import { useState, useEffect, useRef } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  username?: string;
  profilePicture?: string;
  bio?: string;
  followers?: number;
  following?: number;
  totalLikes?: number;
  isFollowing?: boolean;
  customUserId: string;
  videoUrl?: string;
  thumbnailUrl?: string;
}

export default function UserList() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({}); // Refs for video elements
  const router = useRouter();

  useEffect(() => {
    const fetchUsersAndVideos = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all users from useraccount collection
        const userCollectionRef = collection(db, "useraccount");
        const userQuerySnapshot = await getDocs(userCollectionRef);

        if (userQuerySnapshot.empty) {
          setUsers([]);
          setError("No users found in the useraccount collection");
          return;
        }

        const fetchedUsers: UserProfile[] = [];
        for (const doc of userQuerySnapshot.docs) {
          const data = doc.data();
          const user: UserProfile = {
            id: doc.id,
            email: data.email || "",
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            isActive: data.isActive !== undefined ? data.isActive : true,
            username: data.username || "",
            profilePicture:
              data.profilePicture || `https://i.pravatar.cc/150?u=${doc.id}`,
            bio: data.bio || "",
            followers: data.followers || 0,
            following: data.following || 0,
            totalLikes: data.totalLikes || 0,
            isFollowing: data.isFollowing || false,
            customUserId: data.customUserId || doc.id,
            videoUrl: "",
            thumbnailUrl: "",
          };

          // Fetch one video for this user from videos collection
          const videosQuery = query(
            collection(db, "videos"),
            where("customUserId", "==", user.customUserId)
          );
          const videosSnapshot = await getDocs(videosQuery);

          if (!videosSnapshot.empty) {
            const videoData = videosSnapshot.docs[0].data();
            user.videoUrl = videoData.videoUrl || "";
            user.thumbnailUrl = videoData.thumbnailUrl || "";
          }

          fetchedUsers.push(user);
        }

        setUsers(fetchedUsers);
      } catch (err: any) {
        setError(err.message || "Failed to fetch users or videos");
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsersAndVideos();
  }, []);

  useEffect(() => {
    // Set initial video frame as background
    users.forEach((user) => {
      const video = videoRefs.current[user.id];
      if (video && user.videoUrl) {
        video.currentTime = 1; // Set to 1 second as default frame
        video.pause(); // Ensure it’s paused initially
      }
    });
  }, [users]);

  const handleMouseEnter = (userId: string) => {
    const video = videoRefs.current[userId];
    if (video) {
      video.play().catch((e) => console.log("Play prevented:", e));
    }
  };

  const handleMouseLeave = (userId: string) => {
    const video = videoRefs.current[userId];
    if (video) {
      video.pause();
      video.currentTime = 1; // Reset to 1 second for a consistent "thumbnail" effect
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading friends...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-2xl font-bold text-center mb-6">Friends</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/account/${user.customUserId}`}
            passHref
            legacyBehavior // For compatibility with older Next.js versions if needed
          >
            <a
              className="relative rounded-xl shadow-lg overflow-hidden aspect-[9/16] flex flex-col justify-end transition-all duration-200 hover:shadow-2xl"
              onMouseEnter={() => handleMouseEnter(user.id)}
              onMouseLeave={() => handleMouseLeave(user.id)}
              style={{
                background: user.videoUrl
                  ? "black" // Black background while video loads
                  : "linear-gradient(to bottom, #1f2937, #111827)", // Default gradient if no video
              }}
            >
              {/* Video Background */}
              {user.videoUrl && (
                <video
                  ref={(el) => (videoRefs.current[user.id] = el)}
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                  loop
                  muted
                  playsInline
                >
                  <source src={user.videoUrl} type="video/mp4" />
                </video>
              )}

              {/* Overlay Content */}
              <div className="relative z-10 p-3 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white mr-2">
                    <img
                      src={user.profilePicture}
                      alt={`${user.firstName} ${user.lastName}'s profile`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                   
                    <p className="text-xs text-gray-300">
                      {user.firstName} {user.lastName}
                    </p>
                  </div>
                </div>
              </div>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}