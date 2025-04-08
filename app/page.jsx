"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  doc, 
  updateDoc, 
  increment,
  onSnapshot,
  addDoc,
  serverTimestamp,
  where,
  deleteDoc
} from "firebase/firestore";
import { 
  FaPlay, 
  FaPause, 
  FaVolumeUp, 
  FaVolumeMute, 
  FaHeart, 
  FaComment, 
  FaShare, 
  FaMusic, 
  FaTimes,
  FaPaperPlane,
  FaSpinner
} from "react-icons/fa";
import { IoIosArrowDown } from "react-icons/io";
import { useAuth } from "./contexts/AuthContext";
import Link from "next/link";

export default function TikTokFeed() {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [videoStates, setVideoStates] = useState({});
  const [likedVideos, setLikedVideos] = useState(new Set());
  const [following, setFollowing] = useState(new Set());
  const [showMessageCard, setShowMessageCard] = useState(false);
  const [currentMessageVideoId, setCurrentMessageVideoId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const videoRefs = useRef([]);
  const containerRef = useRef(null);
  const messageCardRef = useRef(null);
  const messagesEndRef = useRef(null);
  const userInteracted = useRef(false);
  const lastClickTime = useRef(0);
  const lastScrollTime = useRef(0);

  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  }, []);

  const hasLiked = useCallback((videoId) => {
    return likedVideos.has(videoId);
  }, [likedVideos]);

  const isFollowing = useCallback((userId) => {
    return following.has(userId);
  }, [following]);

  const handleFirstInteraction = useCallback(() => {
    if (!userInteracted.current) {
      userInteracted.current = true;
      const video = videoRefs.current[currentVideoIndex];
      if (video) {
        video.muted = false;
        video.play()
          .then(() => {
            setVideoStates(prev => ({
              ...prev,
              [currentVideoIndex]: {
                ...prev[currentVideoIndex],
                isPlaying: true,
                isMuted: false,
                showControls: false
              }
            }));
          })
          .catch(e => console.log("Play after interaction failed:", e));
      }
    }
  }, [currentVideoIndex]);

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      const videosQuery = query(collection(db, "videos"), orderBy("createdAt", "desc"), limit(15));
      const querySnapshot = await getDocs(videosQuery);
      
      const videosData = await Promise.all(querySnapshot.docs.map(async (doc) => {
        const messagesRef = collection(db, "videos", doc.id, "messages");
        const messagesSnapshot = await getDocs(messagesRef);
        
        // Fetch user profile data based on customUserId
        let profileImageUrl = "/default-avatar.jpg";
        const customUserId = doc.data().customUserId || "defaultCustomId";
        try {
          const usersQuery = query(
            collection(db, "useraccount"),
            where("customUserId", "==", customUserId)
          );
          const usersSnapshot = await getDocs(usersQuery);
          if (!usersSnapshot.empty) {
            const userData = usersSnapshot.docs[0].data();
            profileImageUrl = userData.profileImageUrl || "/default-avatar.jpg";
          }
        } catch (error) {
          console.error(`Error fetching profile for ${customUserId}:`, error);
        }

        return {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || null,
          likes: doc.data().likes || 0,
          comments: messagesSnapshot.size || 0,
          customUserId: customUserId,
          profileImageUrl: profileImageUrl
        };
      }));

      const initialStates = {};
      videosData.forEach((_, index) => {
        initialStates[index] = {
          isPlaying: false,
          isMuted: true,
          isLoading: true,
          showControls: false,
          showHeartAnimation: false,
          showCenterPlay: false,
          transition: 'none',
          showPlayPauseIndicator: false,
          isLiking: false
        };
      });

      setVideos(videosData);
      setVideoStates(initialStates);
      
      videosData.forEach(video => {
        const videoRef = doc(db, "videos", video.id);
        const unsubscribeLikes = onSnapshot(videoRef, (doc) => {
          if (doc.exists()) {
            const updatedData = doc.data();
            setVideos(prevVideos => 
              prevVideos.map(v => 
                v.id === doc.id ? { 
                  ...v, 
                  likes: updatedData.likes || 0,
                  comments: v.comments,
                  customUserId: updatedData.customUserId || v.customUserId
                } : v
              )
            );
          }
        });

        const messagesRef = collection(db, "videos", video.id, "messages");
        const unsubscribeComments = onSnapshot(messagesRef, (snapshot) => {
          setVideos(prevVideos => 
            prevVideos.map(v => 
              v.id === video.id ? { ...v, comments: snapshot.size } : v
            )
          );
        });
        
        return () => {
          unsubscribeLikes();
          unsubscribeComments();
        };
      });
    } catch (err) {
      console.error("Error fetching videos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const fetchMessages = useCallback(async (videoId) => {
    try {
      const messagesRef = collection(db, "videos", videoId, "messages");
      const q = query(messagesRef, orderBy("timestamp", "asc"));
      const querySnapshot = await getDocs(q);
      const messagesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      setMessages(messagesData);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, []);

  useEffect(() => {
    if (!currentMessageVideoId) return;

    const messagesRef = collection(db, "videos", currentMessageVideoId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, [currentMessageVideoId]);

  const toggleMessageCard = useCallback((videoId) => {
    if (showMessageCard && currentMessageVideoId === videoId) {
      setShowMessageCard(false);
      setCurrentMessageVideoId(null);
    } else {
      setShowMessageCard(true);
      setCurrentMessageVideoId(videoId);
      fetchMessages(videoId);
    }
  }, [showMessageCard, currentMessageVideoId, fetchMessages]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !currentMessageVideoId || sendingMessage) return;
    
    if (!user) {
      showToast("Please log in to comment");
      return;
    }

    try {
      setSendingMessage(true);
      const messagesRef = collection(db, "videos", currentMessageVideoId, "messages");
      
      const messageData = {
        text: newMessage,
        userId: user.uid,
        senderId: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        avatar: user.photoURL || "/default-avatar.jpg",
        timestamp: serverTimestamp(),
        isVerified: true
      };

      Object.keys(messageData).forEach(key => {
        if (messageData[key] === undefined) {
          messageData[key] = null;
        }
      });

      await addDoc(messagesRef, messageData);

      setNewMessage("");
      showToast("Comment sent successfully!");
    } catch (err) {
      console.error("Error sending message:", err);
      showToast("Failed to send comment");
    } finally {
      setSendingMessage(false);
    }
  }, [newMessage, currentMessageVideoId, sendingMessage, user, showToast]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (videos.length > 0 && videoRefs.current[0]) {
      const video = videoRefs.current[0];
      video.play()
        .then(() => {
          setVideoStates(prev => ({
            ...prev,
            0: { ...prev[0], isPlaying: true, showControls: false }
          }));
        })
        .catch(e => {
          console.log("Initial autoplay failed:", e);
          setVideoStates(prev => ({
            ...prev,
            0: { ...prev[0], isPlaying: false, showControls: true }
          }));
        });
    }
  }, [videos.length]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || videos.length === 0) return;

    const now = Date.now();
    if (now - lastScrollTime.current < 100) return;
    lastScrollTime.current = now;

    const scrollPosition = window.scrollY;
    const windowHeight = window.innerHeight;
    const newIndex = Math.min(
      videos.length - 1,
      Math.max(0, Math.round(scrollPosition / windowHeight))
    );

    if (newIndex !== currentVideoIndex) {
      if (videoRefs.current[currentVideoIndex]) {
        videoRefs.current[currentVideoIndex].pause();
        setVideoStates(prev => ({
          ...prev,
          [currentVideoIndex]: {
            ...prev[currentVideoIndex],
            isPlaying: false,
            showControls: true,
            transition: newIndex > currentVideoIndex ? 'slide-up-exit' : 'slide-down-exit'
          }
        }));
      }

      if (videoRefs.current[newIndex]) {
        const video = videoRefs.current[newIndex];
        video.muted = !userInteracted.current;
        video.currentTime = 0;
        video.play()
          .then(() => {
            setVideoStates(prev => ({
              ...prev,
              [newIndex]: {
                ...prev[newIndex],
                isPlaying: true,
                isMuted: !userInteracted.current,
                showControls: false,
                transition: newIndex > currentVideoIndex ? 'slide-up-enter' : 'slide-down-enter'
              }
            }));
          })
          .catch(e => {
            console.log("Autoplay failed:", e);
            setVideoStates(prev => ({
              ...prev,
              [newIndex]: {
                ...prev[newIndex],
                isPlaying: false,
                showControls: true
              }
            }));
          });
      }

      setCurrentVideoIndex(newIndex);
      window.scrollTo({
        top: newIndex * windowHeight,
        behavior: 'smooth'
      });
    }
  }, [videos, currentVideoIndex]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (messageCardRef.current && !messageCardRef.current.contains(event.target)) {
        setShowMessageCard(false);
        setCurrentMessageVideoId(null);
      }
    };

    if (showMessageCard) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMessageCard]);

  const handleLike = useCallback(async (videoId, videoIndex) => {
    try {
      const alreadyLiked = hasLiked(videoId);
      
      setVideoStates(prev => ({
        ...prev,
        [videoIndex]: { 
          ...prev[videoIndex], 
          showHeartAnimation: !alreadyLiked,
          isLiking: true 
        }
      }));
      
      const videoRef = doc(db, "videos", videoId);
      
      if (alreadyLiked) {
        await updateDoc(videoRef, {
          likes: increment(-1)
        });
        setLikedVideos(prev => {
          const newSet = new Set(prev);
          newSet.delete(videoId);
          return newSet;
        });
      } else {
        await updateDoc(videoRef, {
          likes: increment(1)
        });
        setLikedVideos(prev => {
          const newSet = new Set(prev);
          newSet.add(videoId);
          return newSet;
        });
      }

      setTimeout(() => {
        setVideoStates(prev => ({
          ...prev,
          [videoIndex]: { 
            ...prev[videoIndex], 
            showHeartAnimation: false,
            isLiking: false 
          }
        }));
      }, 1000);
      
    } catch (error) {
      console.error("Error updating like:", error);
      setVideoStates(prev => ({
        ...prev,
        [videoIndex]: { 
          ...prev[videoIndex], 
          showHeartAnimation: false,
          isLiking: false 
        }
      }));
    }
  }, [hasLiked]);

  const handleFollow = useCallback(async (customUserId) => {
    if (!user || !user.email) {
      showToast("Please log in to follow");
      return;
    }

    if (!customUserId) {
      showToast("Invalid user to follow");
      return;
    }

    try {
      const followsRef = collection(db, "follows");
      const followQuery = query(
        followsRef,
        where("followedCustomUserId", "==", customUserId),
        where("followerEmail", "==", user.email)
      );
      
      const querySnapshot = await getDocs(followQuery);
      const isCurrentlyFollowing = !querySnapshot.empty;

      if (isCurrentlyFollowing) {
        const followDoc = querySnapshot.docs[0];
        await deleteDoc(doc(db, "follows", followDoc.id));
        
        setFollowing(prev => {
          const newSet = new Set(prev);
          newSet.delete(customUserId);
          return newSet;
        });
        showToast("Unfollowed user");
      } else {
        if (!querySnapshot.empty) {
          showToast("Already following this user");
          return;
        }

        const followData = {
          followedCustomUserId: customUserId,
          followerEmail: user.email,
          timestamp: serverTimestamp()
        };

        await addDoc(followsRef, followData);
        
        setFollowing(prev => {
          const newSet = new Set(prev);
          newSet.add(customUserId);
          return newSet;
        });
        showToast("Followed user");
      }
    } catch (error) {
      console.error("Error handling follow:", error);
      showToast("Failed to process follow request");
    }
  }, [user, showToast]);

  useEffect(() => {
    if (!user || !user.email) return;

    const fetchFollowing = async () => {
      try {
        const followsRef = collection(db, "follows");
        const q = query(followsRef, where("followerEmail", "==", user.email));
        const querySnapshot = await getDocs(q);
        
        const followingSet = new Set();
        querySnapshot.forEach(doc => {
          followingSet.add(doc.data().followedCustomUserId);
        });
        
        setFollowing(followingSet);
      } catch (error) {
        console.error("Error fetching following list:", error);
      }
    };

    fetchFollowing();
  }, [user]);

  const togglePlayPause = useCallback((index, event) => {
    const now = Date.now();
    const isDoubleClick = now - lastClickTime.current < 300;

    if (isDoubleClick) {
      handleLike(videos[index].id, index);
      return;
    }

    lastClickTime.current = now;
    const video = videoRefs.current[index];
    if (!video) return;

    setVideoStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        showPlayPauseIndicator: true
      }
    }));

    setTimeout(() => {
      setVideoStates(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          showPlayPauseIndicator: false
        }
      }));
    }, 1000);

    if (videoStates[index]?.isPlaying) {
      video.pause();
      setVideoStates(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          isPlaying: false,
          showControls: true
        }
      }));
    } else {
      handleFirstInteraction();
      video.play()
        .then(() => {
          setVideoStates(prev => ({
            ...prev,
            [index]: {
              ...prev[index],
              isPlaying: true,
              showControls: false
            }
          }));
        })
        .catch(e => console.log("Play failed:", e));
    }
  }, [videoStates, handleFirstInteraction, videos, handleLike]);

  const toggleMute = useCallback((index) => {
    handleFirstInteraction();
    const video = videoRefs.current[index];
    if (video) {
      video.muted = !video.muted;
      setVideoStates(prev => ({
        ...prev,
        [index]: { ...prev[index], isMuted: video.muted }
      }));
    }
  }, [handleFirstInteraction]);

  if (loading && videos.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      onClick={handleFirstInteraction}
      style={{ height: `${videos.length * 100}vh` }}
    >
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .slide-up-enter {
          transform: translateY(100%);
          opacity: 0;
        }
        .slide-up-enter-active {
          transform: translateY(0);
          opacity: 1;
          transition: transform 0.4s ease-out, opacity 0.4s ease-out;
        }
        .slide-up-exit {
          transform: translateY(0);
          opacity: 1;
        }
        .slide-up-exit-active {
          transform: translateY(-100%);
          opacity: 0;
          transition: transform 0.4s ease-out, opacity 0.4s ease-out;
        }
        .slide-down-enter {
          transform: translateY(-100%);
          opacity: 0;
        }
        .slide-down-enter-active {
          transform: translateY(0);
          opacity: 1;
          transition: transform 0.4s ease-out, opacity 0.4s ease-out;
        }
        .slide-down-exit {
          transform: translateY(0);
          opacity: 1;
        }
        .slide-down-exit-active {
          transform: translateY(100%);
          opacity: 0;
          transition: transform 0.4s ease-out, opacity 0.4s ease-out;
        }
        @media (min-width: 640px) {
          .video-content {
            max-width: 450px;
          }
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .message-card {
          transition: transform 0.3s ease-out;
        }
        .message-card-enter {
          transform: translateX(100%);
        }
        .message-card-enter-active {
          transform: translateX(0);
        }
        .message-card-exit {
          transform: translateX(100%);
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        .verified-badge {
          position: absolute;
          bottom: -1px;
          right: -1px;
          background-color: #EC4899;
          color: white;
          font-size: 0.6rem;
          border-radius: 9999px;
          width: 1.25rem;
          height: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid black;
        }
      `}</style>

      {videos.map((video, index) => (
        <div
          key={video.id}
          className="w-full h-screen snap-start flex justify-center items-center relative"
        >
          <div className="flex w-full h-full ml-7 max-w-4xl">
            <div
              className={`video-content relative flex-1 h-full transition-all duration-300
                ${videoStates[index]?.transition === 'slide-up-enter' ? 'slide-up-enter-active' :
                  videoStates[index]?.transition === 'slide-up-exit' ? 'slide-up-exit-active' :
                  videoStates[index]?.transition === 'slide-down-enter' ? 'slide-down-enter-active' :
                  videoStates[index]?.transition === 'slide-down-exit' ? 'slide-down-exit-active' : ''}`}
              onClick={(e) => togglePlayPause(index, e)}
            >
              <video
                ref={el => videoRefs.current[index] = el}
                src={video.videoUrl}
                className="w-full h-full object-cover"
                loop
                muted={videoStates[index]?.isMuted ?? true}
                playsInline
                preload="auto"
                poster={video.thumbnailUrl}
                onLoadedData={() => {
                  setVideoStates(prev => ({
                    ...prev,
                    [index]: { ...prev[index], isLoading: false }
                  }));
                }}
              />

              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>

              {videoStates[index]?.showHeartAnimation && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="animate-ping absolute">
                    <FaHeart className="text-6xl text-pink-500 opacity-75" />
                  </div>
                  <FaHeart className="text-5xl text-pink-500 animate-bounce" />
                </div>
              )}

              {videoStates[index]?.showPlayPauseIndicator && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center animate-fade">
                    {videoStates[index]?.isPlaying ? (
                      <FaPause className="text-2xl text-white" />
                    ) : (
                      <FaPlay className="text-2xl text-white" />
                    )}
                  </div>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 z-10 p-4 text-white pointer-events-none">
                <div className="flex flex-col space-y-1">
                  <h3 className="font-bold text-sm">@{video.user?.username || "user"}</h3>
                  <p className="text-xs line-clamp-2">{video.description || "Check out this video!"}</p>
                  <div className="flex items-center">
                    <FaMusic className="mr-1 text-xs" />
                    <span className="text-xs font-semibold truncate">{video.song || "Original Sound"}</span>
                  </div>
                </div>
              </div>

              {videoStates[index]?.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500"></div>
                </div>
              )}

              <div className="absolute top-4 right-4 z-20">
                <button
                  className="flex items-center justify-center p-2 rounded-full bg-black/50 hover:bg-pink-500/70 transition-all pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute(index);
                  }}
                >
                  {videoStates[index]?.isMuted ? (
                    <FaVolumeMute className="text-lg text-white" />
                  ) : (
                    <FaVolumeUp className="text-lg text-white" />
                  )}
                </button>
              </div>
            </div>

            <div className="hidden md:flex flex-col items-center justify-end h-full w-16 px-2 pb-20 pt-8 z-20">
              <div className="flex flex-col items-center space-y-6">
                <div className="flex flex-col items-center">
                  <Link href={`/account/${video.customUserId}`} passHref>
                    <div className="w-12 h-12 rounded-full border-2 border-pink-500 overflow-hidden cursor-pointer">
                      <img
                        src={video.profileImageUrl || "/default-avatar.jpg"}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => e.target.src = "/default-avatar.jpg"}
                      />
                    </div>
                  </Link>
                  {user && (
                    <button
                      className={`-mt-4 ml-3 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold transition-colors ${
                        isFollowing(video.customUserId)
                          ? 'bg-gray-500'
                          : 'bg-pink-500 hover:bg-pink-600'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollow(video.customUserId);
                      }}
                    >
                      {isFollowing(video.customUserId) ? '✓' : '+'}
                    </button>
                  )}
                </div>

                <div className="flex flex-col items-center">
                  <button
                    className={`flex items-center justify-center p-2 rounded-full transition-colors ${videoStates[index]?.isLiking ? 'opacity-50' : 'hover:bg-pink-500/30'} bg-black/50`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(video.id, index);
                    }}
                    disabled={videoStates[index]?.isLiking}
                  >
                    <FaHeart
                      className={`text-2xl ${hasLiked(video.id) ? 'text-pink-500 fill-pink-500' : 'text-white'}`}
                    />
                  </button>
                  <span className="text-xs font-semibold mt-1 text-white">
                    {video.likes || 0}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <button 
                    className="flex items-center justify-center p-2 rounded-full bg-black/50 hover:bg-blue-500/30 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMessageCard(video.id);
                    }}
                  >
                    <FaComment className="text-2xl text-white" />
                  </button>
                  <span className="text-xs font-semibold mt-1 text-white">
                    {video.comments || 0}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <button 
                    className="flex items-center justify-center p-2 rounded-full bg-black/50 hover:bg-green-500/30 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FaShare className="text-2xl text-white" />
                  </button>
                </div>

                <div className="flex items-center justify-center w-8 h-8 rounded-full border border-white animate-spin-slow">
                  <FaMusic className="text-sm text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="md:hidden absolute right-4 bottom-20 mt-8 z-20">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex flex-col items-center">
                <Link href={`/account/${video.customUserId}`} passHref>
                  <div className="w-12 h-12 rounded-full border-2 border-pink-500 overflow-hidden cursor-pointer">
                    <img
                      src={video.profileImageUrl || "/default-avatar.jpg"}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={(e) => e.target.src = "/default-avatar.jpg"}
                    />
                  </div>
                </Link>
                {user && (
                  <button
                    className={`mt-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold transition-colors ${
                      isFollowing(video.customUserId)
                        ? 'bg-gray-500'
                        : 'bg-pink-500 hover:bg-pink-600'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFollow(video.customUserId);
                    }}
                  >
                    {isFollowing(video.customUserId) ? '✓' : '+'}
                  </button>
                )}
              </div>

              <div className="flex flex-col items-center">
                <button
                  className={`flex items-center justify-center p-2 rounded-full transition-colors ${videoStates[index]?.isLiking ? 'opacity-50' : 'hover:bg-pink-500/30'} bg-black/50`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike(video.id, index);
                  }}
                  disabled={videoStates[index]?.isLiking}
                >
                  <FaHeart
                    className={`text-2xl ${hasLiked(video.id) ? 'text-pink-500 fill-pink-500' : 'text-white'}`}
                  />
                </button>
                <span className="text-xs font-semibold mt-1 text-white">
                  {video.likes || 0}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <button 
                  className="flex items-center justify-center p-2 rounded-full bg-black/50 hover:bg-blue-500/30 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMessageCard(video.id);
                  }}
                >
                  <FaComment className="text-2xl text-white" />
                </button>
                <span className="text-xs font-semibold mt-1 text-white">
                  {video.comments || 0}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <button 
                  className="flex items-center justify-center p-2 rounded-full bg-black/50 hover:bg-green-500/30 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FaShare className="text-2xl text-white" />
                </button>
              </div>

              <div className="flex items-center justify-center w-8 h-8 rounded-full border border-white animate-spin-slow">
                <FaMusic className="text-sm text-white" />
              </div>
            </div>
          </div>
        </div>
      ))}

      {showMessageCard && (
        <div 
          ref={messageCardRef}
          className="fixed inset-y-0 right-0 w-full max-w-md bg-black/90 z-30 backdrop-blur-md message-card"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Comments ({messages.length})</h3>
              <button 
                onClick={() => {
                  setShowMessageCard(false);
                  setCurrentMessageVideoId(null);
                }}
                className="p-2 rounded-full hover:bg-gray-800"
              >
                <FaTimes className="text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {messages.length > 0 ? (
                messages.map((message) => {
                  const displayName = message.displayName || message.email?.split('@')[0] || "user";
                  
                  return (
                    <div key={message.id} className="flex items-start space-x-3 mb-4">
                      <div className="flex-shrink-0 relative">
                        <img
                          src={message.avatar || "/default-avatar.jpg"}
                          alt={displayName}
                          className="w-10 h-10 rounded-full object-cover border border-gray-600"
                          onError={(e) => {
                            e.currentTarget.src = "/default-avatar.jpg";
                          }}
                        />
                        {message.isVerified && user && message.senderId === user.uid && (
                          <div className="verified-badge">
                            ✓
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline space-x-2">
                          <span className="font-bold text-white text-sm">
                            {displayName}
                          </span>
                        </div>
                        <p className="text-white text-sm mt-1 break-words">{message.text}</p>
                        <div className="flex items-center mt-1 space-x-3">
                          <span className="text-gray-400 text-xs">
                            {message.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button className="text-xs text-gray-400 hover:text-white">
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-64">
                  <FaComment className="text-4xl text-gray-600 mb-4" />
                  <p className="text-gray-400">No comments yet</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-800">
              <div className="flex items-center space-x-3">
                <img
                  src={user?.photoURL || "/default-avatar.jpg"}
                  alt={user?.displayName || user?.email?.split('@')[0] || "user"}
                  className="w-10 h-10 rounded-full object-cover border border-gray-600"
                  onError={(e) => {
                    e.currentTarget.src = "/default-avatar.jpg";
                  }}
                />
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a comment..."
                    className="w-full bg-gray-800 text-white rounded-full px-4 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full ${
                      newMessage.trim() 
                        ? 'text-pink-500 hover:text-pink-400' 
                        : 'text-gray-500 cursor-not-allowed'
                    } transition-colors`}
                  >
                    {sendingMessage ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaPaperPlane />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-pink-500 text-white px-6 py-3 rounded-lg z-50 animate-fade-in shadow-lg font-medium">
          {toast.message}
        </div>
      )}

      {currentVideoIndex < videos.length - 1 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 animate-bounce pointer-events-none">
          <IoIosArrowDown className="text-2xl text-white/80" />
        </div>
      )}
    </div>
  );
} 