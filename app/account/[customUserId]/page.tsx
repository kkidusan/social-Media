"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useParams } from "next/navigation";

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
}

interface VideoPost {
  id: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  likes: number;
  views: number;
  caption: string;
  customUserId: string;
  isLiked?: boolean;
  highlightStart?: number;
  highlightDuration?: number;
}

interface Follower {
  id: string;
  username: string;
  profilePicture: string;
  firstName: string;
  lastName: string;
}

export default function Profile() {
  const params = useParams();
  const customUserId = params?.customUserId as string;
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoPost | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followers, setFollowers] = useState<Follower[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch user profile
        const userCollectionRef = collection(db, "useraccount");
        const userQuery = query(userCollectionRef, where("customUserId", "==", customUserId));
        const userQuerySnapshot = await getDocs(userQuery);
        
        if (userQuerySnapshot.empty) {
          throw new Error(`User with ID ${customUserId} not found`);
        }

        const userDoc = userQuerySnapshot.docs[0];
        const userData = userDoc.data();

        // Fetch followers count (users following this user)
        const followersQuery = query(
          collection(db, "follows"),
          where("followedCustomUserId", "==", customUserId)
        );
        const followersSnapshot = await getDocs(followersQuery);
        const followersCount = followersSnapshot.size;

        // Fetch following count (users this user is following) using followerEmail
        const followingQuery = query(
          collection(db, "follows"),
          where("followerEmail", "==", userData.email)
        );
        const followingSnapshot = await getDocs(followingQuery);
        const followingCount = followingSnapshot.size;

        const fetchedProfile: UserProfile = {
          id: customUserId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          isActive: userData.isActive !== undefined ? userData.isActive : true,
          username: userData.username || customUserId,
          profilePicture: userData.profilePicture || `https://i.pravatar.cc/150?u=${customUserId}`,
          bio: userData.bio || "",
          followers: followersCount,
          following: followingCount,
          totalLikes: userData.totalLikes || 0,
          isFollowing: userData.isFollowing || false,
        };

        // Fetch videos
        const videosCollectionRef = collection(db, "videos");
        const videosQuery = query(videosCollectionRef, where("customUserId", "==", customUserId));
        const videosQuerySnapshot = await getDocs(videosQuery);
        
        const fetchedVideos: VideoPost[] = videosQuerySnapshot.docs.map(doc => ({
          id: doc.id,
          videoId: doc.data().videoId,
          videoUrl: doc.data().videoUrl,
          thumbnailUrl: doc.data().thumbnailUrl || "",
          likes: doc.data().likes || 0,
          views: doc.data().views || 0,
          caption: doc.data().caption || "",
          customUserId: doc.data().customUserId,
          isLiked: false,
          highlightStart: doc.data().highlightStart || 2,
          highlightDuration: doc.data().highlightDuration || 5,
        }));

        const calculatedTotalLikes = fetchedVideos.reduce((sum, video) => sum + video.likes, 0);
        
        setProfile({
          ...fetchedProfile,
          totalLikes: calculatedTotalLikes
        });
        
        setVideos(fetchedVideos);

      } catch (err: any) {
        setError(err.message || "Failed to load data");
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [customUserId]);

  const fetchFollowers = async () => {
    try {
      const followersQuery = query(
        collection(db, "follows"),
        where("followedCustomUserId", "==", customUserId)
      );
      const followersSnapshot = await getDocs(followersQuery);
      
      const followerIds = followersSnapshot.docs.map(doc => doc.data().followerId);
      
      const followerProfiles: Follower[] = [];
      for (const followerId of followerIds) {
        const userQuery = query(
          collection(db, "useraccount"),
          where("customUserId", "==", followerId)
        );
        const userSnapshot = await getDocs(userQuery);
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          followerProfiles.push({
            id: followerId,
            username: userData.username || followerId,
            profilePicture: userData.profilePicture || `https://i.pravatar.cc/150?u=${followerId}`,
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
          });
        }
      }
      
      setFollowers(followerProfiles);
      setShowFollowersModal(true);
    } catch (err) {
      console.error("Error fetching followers:", err);
    }
  };

  useEffect(() => {
    if (videos.length > 0 && !isLoading) {
      videos.forEach(video => {
        const videoElement = videoRefs.current[video.videoId];
        if (videoElement) {
          const startTime = video.highlightStart || 2;
          const duration = video.highlightDuration || 5;

          videoElement.currentTime = startTime;
          videoElement.play().catch(e => console.log("Autoplay prevented:", e));

          const timeout = setTimeout(() => {
            videoElement.pause();
            videoElement.currentTime = startTime;
          }, duration * 1000);

          return () => clearTimeout(timeout);
        }
      });
    }
  }, [videos, isLoading]);

  const handleFollow = async () => {
    if (!profile) return;
    
    try {
      const userDocRef = doc(db, "useraccount", profile.id);
      await updateDoc(userDocRef, {
        isFollowing: !profile.isFollowing,
        followers: profile.isFollowing ? profile.followers - 1 : profile.followers + 1,
      });

      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          isFollowing: !prev.isFollowing,
          followers: prev.isFollowing ? prev.followers - 1 : prev.followers + 1,
        };
      });
    } catch (err) {
      console.error("Error updating follow status:", err);
    }
  };

  const handleLike = async (videoId: string) => {
    try {
      const videoDocRef = doc(db, "videos", videoId);
      const videoDoc = await getDoc(videoDocRef);
      
      if (!videoDoc.exists()) {
        throw new Error("Video document does not exist");
      }

      const videoIndex = videos.findIndex(v => v.videoId === videoId);
      if (videoIndex === -1) {
        throw new Error("Video not found in local state");
      }

      const isLiked = !videos[videoIndex].isLiked;
      
      await updateDoc(videoDocRef, {
        likes: isLiked ? videos[videoIndex].likes + 1 : videos[videoIndex].likes - 1,
      });
      
      setVideos(prev =>
        prev.map(video =>
          video.videoId === videoId
            ? {
                ...video,
                likes: isLiked ? video.likes + 1 : video.likes - 1,
                isLiked: isLiked,
              }
            : video
        )
      );

      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          totalLikes: isLiked 
            ? (prev.totalLikes || 0) + 1 
            : (prev.totalLikes || 0) - 1
        };
      });
    } catch (err) {
      console.error("Error updating like status:", err);
    }
  };

  const handleVideoPlay = async (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (video) {
      Object.keys(videoRefs.current).forEach(key => {
        if (key !== videoId && videoRefs.current[key]) {
          videoRefs.current[key]?.pause();
        }
      });
      
      setActiveVideo(videoId);
      
      try {
        const videoDocRef = doc(db, "videos", videoId);
        const videoDoc = await getDoc(videoDocRef);
        
        if (!videoDoc.exists()) {
          throw new Error("Video document does not exist");
        }

        const currentViews = videoDoc.data()?.views || 0;
        await updateDoc(videoDocRef, {
          views: currentViews + 1,
        });
        
        setVideos(prev =>
          prev.map(video =>
            video.videoId === videoId ? { ...video, views: video.views + 1 } : video
          )
        );
      } catch (err) {
        console.error("Error updating view count:", err);
      }
    }
  };

  const openVideoModal = (video: VideoPost) => {
    setSelectedVideo(video);
    setShowVideoModal(true);
  };

  const closeVideoModal = () => {
    setShowVideoModal(false);
    setActiveVideo(null);
  };

  const closeFollowersModal = () => {
    setShowFollowersModal(false);
    setFollowers([]);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading profile...</div>
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Profile not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Profile Header */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-pink-500">
            <img
              src={profile.profilePicture}
              alt={`${profile.username}'s profile`}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex-1">
            <h1 className="text-xl font-bold">@{profile.username}</h1>
            <p className="text-gray-400 text-sm">
              {profile.firstName} {profile.lastName}
            </p>
            <p className="text-gray-500 text-sm mt-1">{profile.email}</p>
            
            <div className="flex gap-4 mt-2">
              <button
                onClick={handleFollow}
                className={`px-4 py-1 rounded-full font-medium text-sm ${
                  profile.isFollowing
                    ? "bg-gray-800 text-white border border-gray-600"
                    : "bg-pink-600 text-white"
                }`}
              >
                {profile.isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <p className="text-gray-300">{profile.bio || "No bio yet"}</p>
        </div>
        
        <div className="flex justify-between mt-6 pb-4 border-b border-gray-800">
          <div className="text-center">
            <span className="font-bold">{formatNumber(videos.length)}</span>
            <span className="text-gray-400 ml-1">videos</span>
          </div>
          <div className="text-center">
            <button 
              onClick={fetchFollowers}
              className="focus:outline-none hover:text-pink-500 transition-colors"
            >
              <span className="font-bold">{formatNumber(profile.followers || 0)}</span>
              <span className="text-gray-400 ml-1">followers</span>
            </button>
          </div>
          <div className="text-center">
            <span className="font-bold">{formatNumber(profile.following || 0)}</span>
            <span className="text-gray-400 ml-1">following</span>
          </div>
          <div className="text-center">
            <span className="font-bold">{formatNumber(profile.totalLikes || 0)}</span>
            <span className="text-gray-400 ml-1">likes</span>
          </div>
        </div>
      </div>
      
      {/* Videos Grid */}
      <div className="pb-20">
        {videos.length > 0 ? (
          <div className="grid grid-cols-3 gap-0.5 px-0.5">
            {videos.map(video => (
              <div
                key={video.videoId}
                className="relative aspect-[9/16] bg-gray-900 cursor-pointer"
                onClick={() => openVideoModal(video)}
              >
                <video
                  ref={el => (videoRefs.current[video.videoId] = el)}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  loop
                  poster={video.thumbnailUrl}
                >
                  <source src={video.videoUrl} type="video/mp4" />
                </video>
                
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="flex items-center">
                    <svg
                      className="h-3 w-3 text-white mr-1"
                      fill={video.isLiked ? "#ec4899" : "none"}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    <span className="text-white text-xs">{formatNumber(video.likes)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p>No videos yet</p>
          </div>
        )}
      </div>

      {/* Video Modal */}
      {showVideoModal && selectedVideo && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <button
            onClick={closeVideoModal}
            className="absolute top-4 left-4 z-10 text-white p-2"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          
          <div className="flex-1 relative">
            <video
              ref={el => (videoRefs.current[selectedVideo.videoId] = el)}
              className="w-full h-full object-contain"
              autoPlay
              loop
              playsInline
              controls
              onPlay={() => handleVideoPlay(selectedVideo.videoId)}
            >
              <source src={selectedVideo.videoUrl} type="video/mp4" />
            </video>
            
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center mb-2">
                <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                  <img
                    src={profile.profilePicture}
                    alt={`${profile.username}'s profile`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-white font-medium">@{profile.username}</p>
                </div>
              </div>
              <p className="text-white text-sm">{selectedVideo.caption}</p>
            </div>
            
            <div className="absolute right-4 bottom-20 flex flex-col items-center gap-5">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => handleLike(selectedVideo.videoId)}
                  className="flex flex-col items-center"
                >
                  <svg
                    className="h-8 w-8"
                    fill={selectedVideo.isLiked ? "#ec4899" : "none"}
                    viewBox="0 0 24 24"
                    stroke={selectedVideo.isLiked ? "#ec4899" : "white"}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </button>
                <span className="text-white text-xs mt-1">
                  {formatNumber(selectedVideo.likes)}
                </span>
              </div>
              
              <div className="flex flex-col items-center">
                <button className="flex flex-col items-center">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="white"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </button>
                <span className="text-white text-xs mt-1">Comments</span>
              </div>
              
              <div className="flex flex-col items-center">
                <button className="flex flex-col items-center">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="white"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </button>
                <span className="text-white text-xs mt-1">Share</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Followers Modal */}
      {showFollowersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Followers</h2>
              <button
                onClick={closeFollowersModal}
                className="text-white p-2 hover:text-gray-300"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            
            {followers.length > 0 ? (
              <div className="space-y-4">
                {followers.map(follower => (
                  <div
                    key={follower.id}
                    className="flex items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all duration-200"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden mr-3 border-2 border-pink-500">
                      <img
                        src={follower.profilePicture}
                        alt={`${follower.username}'s profile`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">@{follower.username}</p>
                      <p className="text-gray-400 text-sm">
                        {follower.firstName} {follower.lastName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center">No followers yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}