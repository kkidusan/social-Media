"use client";

import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState, useRef, useCallback } from "react";
import { db } from "../firebase";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, onSnapshot } from "firebase/firestore";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [videos, setVideos] = useState([]);
  const [likedVideos, setLikedVideos] = useState([]);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [formData, setFormData] = useState({
    userName: "",
    firstName: "",
    lastName: "",
    bio: "",
    profileImageUrl: ""
  });
  const [formErrors, setFormErrors] = useState({
    userName: "",
    bio: ""
  });
  const [profileImage, setProfileImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("videos");
  const videoRefs = useRef({});

  const calculateTotalLikes = useCallback((videosArray) => {
    return videosArray.reduce((total, video) => total + (video.likes || 0), 0);
  }, []);

  useEffect(() => {
    if (!user?.userId) return;

    const fetchInitialData = async () => {
      try {
        // One-time fetch for profile data
        const userDocRef = doc(db, "useraccount", user.userId);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          const initialProfile = {
            ...data,
            id: user.userId,
            email: data.email,
            isFollowing: data.isFollowing || false,
            followers: data.followers || 0,
            following: data.following || 0
          };
          setProfileData(initialProfile);
          setFormData({
            userName: data.userName || "",
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            bio: data.bio || "",
            profileImageUrl: data.profileImageUrl || ""
          });
          setProfileImage(data.profileImageUrl);
        } else {
          throw new Error("Profile not found");
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error('Failed to load profile data');
      }
    };

    fetchInitialData();

    // Real-time listener for videos
    const videosQuery = query(
      collection(db, "videos"),
      where("customUserId", "==", user.customUserId || "")
    );
    const unsubscribeVideos = onSnapshot(videosQuery, (snapshot) => {
      const videosData = snapshot.docs.map(doc => ({
        videoId: doc.id,
        ...doc.data(),
        isLiked: doc.data().likedBy?.includes(user.userId) || false + false
      }));
      setVideos(videosData);
    }, (error) => {
      console.error("Videos listener error:", error);
      toast.error('Failed to load videos');
    });

    // Real-time listener for liked videos
    const likedVideosQuery = query(
      collection(db, "videos"),
      where("likedBy", "array-contains", user.userId)
    );
    const unsubscribeLikedVideos = onSnapshot(likedVideosQuery, (snapshot) => {
      const likedVideosData = snapshot.docs.map(doc => ({
        videoId: doc.id,
        ...doc.data(),
        isLiked: true
      }));
      setLikedVideos(likedVideosData);
    }, (error) => {
      console.error("Liked videos listener error:", error);
      toast.error('Failed to load liked videos');
    });

    return () => {
      unsubscribeVideos();
      unsubscribeLikedVideos();
    };
  }, [user]);

  const handleImageUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) {
      toast.error('No file selected');
      return;
    }

    const file = e.target.files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 2 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPEG, PNG, WebP)');
      return;
    }

    if (file.size > maxSize) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => setPreviewImage(event.target?.result);
    reader.readAsDataURL(file);

    setIsUploading(true);
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
      formDataUpload.append("folder", `profile_images/${user.userId}`);

      if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || !process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) {
        throw new Error('Cloudinary configuration is missing');
      }

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formDataUpload
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Upload failed');

      const userDocRef = doc(db, "useraccount", user.userId);
      await updateDoc(userDocRef, {
        profileImageUrl: data.secure_url,
        updatedAt: new Date().toISOString()
      });

      setProfileData(prev => ({ ...prev, profileImageUrl: data.secure_url }));
      setFormData(prev => ({ ...prev, profileImageUrl: data.secure_url }));
      setPreviewImage(null);
      toast.success('Profile picture updated successfully!');
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFollow = useCallback(async () => {
    if (!profileData || !user) return;
    
    try {
      const userDocRef = doc(db, "useraccount", profileData.id);
      const currentUserId = user.userId;
      const newFollowStatus = !profileData.isFollowing;
      
      await updateDoc(userDocRef, {
        isFollowing: newFollowStatus,
        followers: newFollowStatus ? profileData.followers + 1 : Math.max(profileData.followers - 1, 0),
        updatedAt: new Date().toISOString()
      });

      setProfileData(prev => ({
        ...prev,
        isFollowing: newFollowStatus,
        followers: newFollowStatus ? prev.followers + 1 : Math.max(prev.followers - 1, 0)
      }));

      toast.success(newFollowStatus ? "Followed successfully!" : "Unfollowed successfully!");
    } catch (err) {
      console.error("Error updating follow status:", err);
      toast.error("Failed to update follow status");
    }
  }, [profileData, user]);

  const handleLike = useCallback(async (videoId) => {
    try {
      const videoDocRef = doc(db, "videos", videoId);
      const currentUserId = user.userId;
      const video = videos.find(v => v.videoId === videoId);
      if (!video) return;

      const isLiked = !video.isLiked;
      const likedByUpdate = isLiked
        ? [...(video.likedBy || []), currentUserId]
        : (video.likedBy || []).filter(id => id !== currentUserId);

      await updateDoc(videoDocRef, {
        likes: isLiked ? video.likes + 1 : Math.max(video.likes - 1, 0),
        likedBy: likedByUpdate,
        updatedAt: new Date().toISOString()
      });

      toast.success(isLiked ? "Video liked!" : "Like removed");
    } catch (err) {
      console.error("Error updating like status:", err);
      toast.error("Failed to update like status");
    }
  }, [videos, user]);

  const handleVideoClick = useCallback((videoId) => {
    const videoElement = videoRefs.current[videoId];
    if (!videoElement) return;

    if (playingVideoId === videoId) {
      videoElement.pause();
      setPlayingVideoId(null);
    } else {
      Object.values(videoRefs.current).forEach(video => video?.pause());
      videoElement.currentTime = 0;
      videoElement.play().catch(err => console.error("Playback failed:", err));
      setPlayingVideoId(videoId);
    }
  }, [playingVideoId]);

  const handleMouseEnter = useCallback((videoId) => {
    const videoElement = videoRefs.current[videoId];
    if (videoElement && playingVideoId !== videoId) {
      videoElement.currentTime = 0;
      videoElement.play().catch(() => {});
    }
  }, [playingVideoId]);

  const handleMouseLeave = useCallback((videoId) => {
    const videoElement = videoRefs.current[videoId];
    if (videoElement && playingVideoId !== videoId) {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  }, [playingVideoId]);

  const handleEditToggle = useCallback(() => {
    setIsEditing(!isEditing);
    setFormErrors({ userName: "", bio: "" });
  }, [isEditing]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    
    if (name === "userName" && value.length > 15) {
      setFormErrors(prev => ({ ...prev, userName: "Max 15 characters" }));
      return;
    }
    
    if (name === "bio" && value.length > 150) {
      setFormErrors(prev => ({ ...prev, bio: "Max 150 characters" }));
      return;
    }
    
    setFormErrors(prev => ({ ...prev, [name]: "" }));
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.userName.trim()) newErrors.userName = "Username is required";
    if (formData.userName.length > 15) newErrors.userName = "Max 15 characters";
    if (formData.bio.length > 150) newErrors.bio = "Max 150 characters";
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      toast.error('Please fix errors before saving');
      return;
    }

    try {
      const userDocRef = doc(db, "useraccount", user.userId);
      await updateDoc(userDocRef, {
        ...formData,
        updatedAt: new Date().toISOString()
      });

      setProfileData(prev => ({ ...prev, ...formData }));
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error('Failed to update profile');
    }
  }, [formData, user, validateForm]);

  const triggerFileInput = useCallback(() => fileInputRef.current?.click(), []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-black text-white gap-4">
        <h2 className="text-2xl font-bold">Please log in to view your profile</h2>
        <a href="/login" className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full font-semibold hover:from-pink-700 hover:to-purple-700">
          Go to Login
        </a>
      </div>
    );
  }

  const stats = {
    following: profileData?.following || 0,
    followers: profileData?.followers || 0,
    likes: calculateTotalLikes(videos),
    videos: videos.length || 0
  };

  const renderFollowButton = () => {
    if (!user || !profileData || user.userId === profileData.id) return null;
    
    return (
      <button
        onClick={handleFollow}
        className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
          profileData.isFollowing
            ? 'bg-gray-800 hover:bg-gray-700 text-white'
            : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white'
        }`}
      >
        {profileData.isFollowing ? 'Following' : 'Follow'}
      </button>
    );
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const renderVideos = (videosToRender) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {videosToRender.map((video) => (
        <div
          key={video.videoId}
          className="relative rounded-xl overflow-hidden aspect-[9/16] cursor-pointer hover:shadow-xl transition-all group"
          onClick={() => handleVideoClick(video.videoId)}
          onMouseEnter={() => handleMouseEnter(video.videoId)}
          onMouseLeave={() => handleMouseLeave(video.videoId)}
        >
          <video
            ref={(el) => (videoRefs.current[video.videoId] = el)}
            src={`${video.videoUrl}?q=80`}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            muted
            playsInline
            loop
            preload="metadata"
          />
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70">
            <p className="text-white text-xs font-semibold truncate">{video.title || "Untitled"}</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {playingVideoId === video.videoId ? (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 4h3v12H5zm7 0h3v12h-3z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l13.5-7.94a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLike(video.videoId);
            }}
            className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
          >
            <svg
              className={`w-6 h-6 ${video.isLiked ? 'text-red-500 fill-current' : 'text-white fill-transparent'}`}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
          <div className="absolute bottom-2 right-2 text-white text-xs font-bold flex items-center">
            <svg className="w-3 h-3 mr-1 fill-current" viewBox="0 0 20 20">
              <path d="M10 3.22l-.61-.6a5.5 5.5 0 0 0-7.78 7.77L10 18.78l8.39-8.4a5.5 5.5 0 0 0-7.78-7.77l-.61.61z" />
            </svg>
            {formatNumber(video.likes || 0)}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <ToastContainer position="top-center" autoClose={3000} theme="dark" />
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />

      {isEditing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-700 animate-fade-in">
            <div className="bg-gradient-to-r from-pink-600 to-purple-600 p-4">
              <h2 className="text-xl font-bold text-white">Edit Profile</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">@</span>
                  <input
                    type="text"
                    name="userName"
                    value={formData.userName}
                    onChange={handleInputChange}
                    className="w-full bg-gray-800 rounded-lg pl-8 pr-4 py-2 text-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  />
                </div>
                {formErrors.userName && <p className="text-red-400 text-xs mt-1">{formErrors.userName}</p>}
                <span className={`text-xs mt-1 block text-right ${formData.userName.length > 15 ? 'text-red-400' : 'text-gray-400'}`}>
                  {formData.userName.length}/15
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  rows={3}
                />
                {formErrors.bio && <p className="text-red-400 text-xs mt-1">{formErrors.bio}</p>}
                <span className={`text-xs mt-1 block text-right ${formData.bio.length > 150 ? 'text-red-400' : 'text-gray-400'}`}>
                  {formData.bio.length}/150
                </span>
              </div>
            </div>

            <div className="bg-gray-800 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto pt-6 px-4">
        <div className="flex flex-row items-start gap-6 mb-6">
          <div className="relative flex-shrink-0">
            <div className="w-32 h-32 rounded-full border-4 border-white/20 overflow-hidden shadow-lg">
              {previewImage ? (
                <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
              ) : profileImage ? (
                <img
                  src={`${profileImage}?w=200&h=200&c=fill&q=80`}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => setProfileImage(null)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-4xl font-bold">
                  {profileData?.firstName?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {user.userId === profileData?.id && (
              <button
                onClick={triggerFileInput}
                className="absolute bottom-0 right-0 bg-gray-900 p-2 rounded-full border-2 border-white/20 hover:bg-gray-800 transition-colors"
                disabled={isUploading}
              >
                {isUploading ? (
                  <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {profileData?.firstName || "User"} {profileData?.lastName || ""}
            </h1>
            <p className="text-gray-400 text-sm mt-1">@{profileData?.userName || user.email.split("@")[0]}</p>
            {profileData?.bio && <p className="text-sm mt-2 max-w-md">{profileData.bio}</p>}
            
            <div className="flex gap-6 mt-4">
              <div className="text-center">
                <p className="font-bold">{formatNumber(stats.videos)}</p>
                <p className="text-xs text-gray-400">Videos</p>
              </div>
              <div className="text-center">
                <p className="font-bold">{formatNumber(stats.following)}</p>
                <p className="text-xs text-gray-400">Following</p>
              </div>
              <div className="text-center">
                <p className="font-bold">{formatNumber(stats.followers)}</p>
                <p className="text-xs text-gray-400">Followers</p>
              </div>
              <div className="text-center">
                <p className="font-bold">{formatNumber(stats.likes)}</p>
                <p className="text-xs text-gray-400">Likes</p>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              {user.userId === profileData?.id ? (
                <>
                  <button
                    onClick={handleEditToggle}
                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-full text-sm font-medium transition-colors"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={logout}
                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-full text-sm font-medium transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                renderFollowButton()
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-gray-800 flex justify-center gap-12 mb-4">
          <button
            onClick={() => setActiveTab("videos")}
            className={`pb-2 font-semibold transition-colors ${activeTab === "videos" ? "border-b-2 border-white" : "text-gray-400 hover:text-white"}`}
          >
            Videos
          </button>
          <button
            onClick={() => setActiveTab("liked")}
            className={`pb-2 font-semibold transition-colors ${activeTab === "liked" ? "border-b-2 border-white" : "text-gray-400 hover:text-white"}`}
          >
            Liked
          </button>
        </div>

        {activeTab === "videos" ? (
          videos.length > 0 ? (
            renderVideos(videos)
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-400">No videos yet</p>
              {user.userId === profileData?.id && (
                <button className="mt-4 px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full text-sm font-medium hover:from-pink-700 hover:to-purple-700 transition-colors">
                  Upload Video
                </button>
              )}
            </div>
          )
        ) : activeTab === "liked" ? (
          likedVideos.length > 0 ? (
            renderVideos(likedVideos)
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-400">No liked videos yet</p>
            </div>
          )
        ) : null}
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}