"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaHeart, FaComment, FaShare, FaMusic } from "react-icons/fa";
import { IoIosArrowDown, IoIosArrowUp } from "react-icons/io";
import { MdMoreVert } from "react-icons/md";

export default function TikTokFeed() {
  const videoWidth = 250;
  const videoHeight = 620.22;

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [videoStates, setVideoStates] = useState({});
  const [likedVideos, setLikedVideos] = useState(new Set());
  const [cardPositions, setCardPositions] = useState({});
  const [lastClickTime, setLastClickTime] = useState(0);
  const videoRefs = useRef([]);
  const containerRef = useRef(null);
  const userInteracted = useRef(false);
  const centerPlayTimeout = useRef(null);

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "videos"), orderBy("createdAt", "desc"), limit(15));
      const querySnapshot = await getDocs(q);
      const videosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || null
      }));
      
      const initialStates = {};
      videosData.forEach((_, index) => {
        initialStates[index] = {
          isPlaying: false,
          isMuted: true,
          isLoading: true,
          showControls: false,
          attemptedAutoplay: false,
          showCard: false,
          showHeartAnimation: false,
          showCenterPlay: false
        };
      });
      
      setVideos(videosData);
      setVideoStates(initialStates);
    } catch (err) {
      console.error("Error fetching videos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    if (videos.length > 0 && videoRefs.current[0]) {
      const video = videoRefs.current[0];
      video.play()
        .then(() => {
          setVideoStates(prev => ({
            ...prev,
            0: {
              ...prev[0],
              isPlaying: true,
              showControls: false
            }
          }));
        })
        .catch(e => {
          console.log("Initial autoplay failed:", e);
          setVideoStates(prev => ({
            ...prev,
            0: {
              ...prev[0],
              isPlaying: false,
              showControls: true
            }
          }));
        });
    }
  }, [videos.length]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || videos.length === 0) return;

    const container = containerRef.current;
    const containerTop = container.getBoundingClientRect().top;
    const scrollPosition = window.scrollY - containerTop;
    const newIndex = Math.min(
      videos.length - 1,
      Math.max(0, Math.floor(scrollPosition / (videoHeight + 16)))
    );

    if (newIndex !== currentVideoIndex) {
      if (videoRefs.current[currentVideoIndex]) {
        videoRefs.current[currentVideoIndex].pause();
        setVideoStates(prev => ({
          ...prev,
          [currentVideoIndex]: {
            ...prev[currentVideoIndex],
            isPlaying: false,
            showControls: !userInteracted.current,
            showCard: false,
            showCenterPlay: false
          }
        }));
      }
      
      if (videoRefs.current[newIndex]) {
        const video = videoRefs.current[newIndex];
        
        if (userInteracted.current) {
          video.muted = false;
          video.play()
            .then(() => {
              setVideoStates(prev => ({
                ...prev,
                [newIndex]: {
                  ...prev[newIndex],
                  isPlaying: true,
                  isMuted: false,
                  showControls: false,
                  showCenterPlay: false
                }
              }));
            })
            .catch(e => {
              console.log("Play with sound failed:", e);
              setVideoStates(prev => ({
                ...prev,
                [newIndex]: {
                  ...prev[newIndex],
                  isPlaying: false,
                  showControls: true
                }
              }));
            });
        } else {
          video.muted = true;
          video.play()
            .then(() => {
              setVideoStates(prev => ({
                ...prev,
                [newIndex]: {
                  ...prev[newIndex],
                  isPlaying: true,
                  isMuted: true,
                  showControls: false,
                  attemptedAutoplay: true,
                  showCenterPlay: false
                }
              }));
            })
            .catch(e => {
              console.log("Muted autoplay failed:", e);
              setVideoStates(prev => ({
                ...prev,
                [newIndex]: {
                  ...prev[newIndex],
                  isPlaying: false,
                  showControls: true,
                  attemptedAutoplay: true
                }
              }));
            });
        }
      }
      
      setCurrentVideoIndex(newIndex);
    }
  }, [videos, currentVideoIndex, videoHeight]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleFirstInteraction = useCallback(() => {
    if (!userInteracted.current) {
      userInteracted.current = true;
      
      if (videoRefs.current[currentVideoIndex]) {
        const video = videoRefs.current[currentVideoIndex];
        video.muted = false;
        
        video.play()
          .then(() => {
            setVideoStates(prev => ({
              ...prev,
              [currentVideoIndex]: {
                ...prev[currentVideoIndex],
                isPlaying: true,
                isMuted: false,
                showControls: false,
                showCenterPlay: false
              }
            }));
          })
          .catch(e => {
            console.log("Play after interaction failed:", e);
            setVideoStates(prev => ({
              ...prev,
              [currentVideoIndex]: {
                ...prev[currentVideoIndex],
                isPlaying: false,
                showControls: true
              }
            }));
          });
      }
    }
  }, [currentVideoIndex]);

  const togglePlayPause = useCallback((index, event) => {
    const now = Date.now();
    const isDoubleClick = now - lastClickTime < 300;
    
    if (isDoubleClick) {
      handleLike(videos[index].id);
      return;
    }
    
    setLastClickTime(now);
    
    if (videoRefs.current[index]) {
      const video = videoRefs.current[index];
      
      if (videoStates[index]?.isPlaying) {
        video.pause();
        setVideoStates(prev => ({
          ...prev,
          [index]: {
            ...prev[index],
            isPlaying: false,
            showCenterPlay: true,
            showControls: false
          }
        }));
        
        if (centerPlayTimeout.current) {
          clearTimeout(centerPlayTimeout.current);
        }
        centerPlayTimeout.current = setTimeout(() => {
          setVideoStates(prev => ({
            ...prev,
            [index]: {
              ...prev[index],
              showCenterPlay: false
            }
          }));
        }, 2000);
      } else {
        handleFirstInteraction();
        video.play()
          .then(() => {
            setVideoStates(prev => ({
              ...prev,
              [index]: {
                ...prev[index],
                isPlaying: true,
                showCenterPlay: false,
                showControls: false
              }
            }));
          })
          .catch(e => {
            console.log("Play failed:", e);
            setVideoStates(prev => ({
              ...prev,
              [index]: {
                ...prev[index],
                isPlaying: false,
                showControls: true
              }
            }));
          });
      }
    }
  }, [videoStates, handleFirstInteraction, lastClickTime, videos]);

  const toggleMute = useCallback((index) => {
    handleFirstInteraction();
    
    if (videoRefs.current[index]) {
      const video = videoRefs.current[index];
      const willBeMuted = !video.muted;
      
      video.muted = willBeMuted;
      setVideoStates(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          isMuted: willBeMuted
        }
      }));
      
      if (!willBeMuted && !videoStates[index]?.isPlaying) {
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
    }
  }, [videoStates, handleFirstInteraction]);

  const handleLike = useCallback((videoId) => {
    setLikedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
        const videoIndex = videos.findIndex(v => v.id === videoId);
        if (videoIndex !== -1) {
          setVideoStates(prevStates => ({
            ...prevStates,
            [videoIndex]: {
              ...prevStates[videoIndex],
              showHeartAnimation: true
            }
          }));
          
          setTimeout(() => {
            setVideoStates(prevStates => ({
              ...prevStates,
              [videoIndex]: {
                ...prevStates[videoIndex],
                showHeartAnimation: false
              }
            }));
          }, 1000);
        }
      }
      return newSet;
    });
  }, [videos]);

  const calculateSideSpacing = () => {
    if (typeof window === 'undefined') return 0;
    const windowWidth = window.innerWidth;
    return Math.max(0, (windowWidth - (videoWidth + 60)) / 2); // Adjusted for controls width
  };

  const [sideSpacing, setSideSpacing] = useState(calculateSideSpacing());

  useEffect(() => {
    const handleResize = () => {
      setSideSpacing(calculateSideSpacing());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (centerPlayTimeout.current) {
        clearTimeout(centerPlayTimeout.current);
      }
    };
  }, []);

  if (loading && videos.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black" onClick={handleFirstInteraction}>
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-3 bg-gradient-to-b from-black/80 to-transparent">
        <button className="text-white">
          <IoIosArrowDown className="text-xl" />
        </button>
        <h1 className="text-lg font-bold text-white">ShortClips</h1>
        <button className="text-white">
          <MdMoreVert className="text-xl" />
        </button>
      </header>

      <div 
        ref={containerRef}
        className="pt-12 pb-4"
        style={{
          paddingLeft: `${sideSpacing}px`,
          paddingRight: `${sideSpacing}px`
        }}
      >
        {videos.map((video, index) => (
          <div 
            key={video.id} 
            className="flex mb-4"
          >
            {/* Video Container */}
            <div 
              className="relative overflow-hidden rounded-lg shadow-lg group"
              style={{
                width: `${videoWidth}px`,
                height: `${videoHeight}px`
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  togglePlayPause(index, e);
                }
              }}
            >
              <video
                ref={el => videoRefs.current[index] = el}
                src={video.videoUrl}
                className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                loop
                muted={videoStates[index]?.isMuted ?? true}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause(index, e);
                }}
                playsInline
                preload="auto"
                poster={video.thumbnailUrl}
                onLoadedData={() => {
                  setVideoStates(prev => ({
                    ...prev,
                    [index]: {
                      ...prev[index],
                      isLoading: false
                    }
                  }));
                }}
              />

              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent"></div>

              {videoStates[index]?.showHeartAnimation && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="animate-ping absolute">
                    <FaHeart className="text-6xl text-pink-500 opacity-75" />
                  </div>
                  <FaHeart className="text-5xl text-pink-500" />
                </div>
              )}

              {videoStates[index]?.showCard && (
                <div
                  className="absolute bg-white/90 p-4 rounded-lg shadow-lg z-20"
                  style={{
                    left: `${Math.min(Math.max(10, cardPositions[index]?.x - 50), videoWidth - 110)}px`,
                    top: `${Math.min(Math.max(10, cardPositions[index]?.y - 50), videoHeight - 110)}px`,
                    width: '100px',
                    height: '100px'
                  }}
                >
                  <p className="text-black text-sm">Video Card</p>
                  <p className="text-black text-xs">
                    {videoStates[index]?.isPlaying ? "Playing" : "Paused"}
                  </p>
                </div>
              )}

              {videoStates[index]?.showCenterPlay && (
                <div 
                  className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayPause(index, e);
                  }}
                >
                  <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center animate-pulse">
                    <FaPlay className="text-2xl text-white" />
                  </div>
                </div>
              )}

              <div className="relative z-10 h-full flex flex-col justify-end p-3 text-white pointer-events-none">
                <div className="pr-12">
                  <div className="flex items-center mb-1">
                    <h3 className="font-bold text-xs">@{video.user?.username || "user"}</h3>
                  </div>
                  <p className="text-xs mb-1 line-clamp-2">{video.description || "Check out this video!"}</p>
                  <div className="flex items-center">
                    <FaMusic className="mr-1 text-xs" />
                    <span className="text-xs font-semibold">{video.song || "Original Sound"}</span>
                  </div>
                </div>
              </div>

              {(videoStates[index]?.showControls || !videoStates[index]?.isPlaying) && !videoStates[index]?.isLoading && (
                <div 
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                    videoStates[index]?.showControls ? 'bg-black/30 opacity-100' : 'opacity-0'
                  }`}
                >
                  <button 
                    className="p-3 rounded-full bg-black/50 backdrop-blur-sm hover:bg-pink-500/70 transition-all duration-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayPause(index, e);
                    }}
                  >
                    {videoStates[index]?.isPlaying ? (
                      <FaPause className="text-xl text-white" />
                    ) : (
                      <FaPlay className="text-xl text-white" />
                    )}
                  </button>
                </div>
              )}

              {videoStates[index]?.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500"></div>
                </div>
              )}

              <button 
                className="absolute top-2 right-2 z-20 p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-pink-500/70 transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute(index);
                }}
              >
                {videoStates[index]?.isMuted ? (
                  <FaVolumeMute className="text-sm text-white" />
                ) : (
                  <FaVolumeUp className="text-sm text-white" />
                )}
              </button>
            </div>

            {/* Controls Container */}
            <div 
              className="flex flex-col items-center justify-end w-14 ml-4 pb-16 text-white pointer-events-auto"
              style={{ height: `${videoHeight}px` }}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full border border-pink-500 overflow-hidden mb-1">
                    <img 
                      src={video.user?.avatar || "/default-avatar.jpg"} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <button 
                    className="p-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(video.id);
                    }}
                  >
                    <FaHeart className={`text-xl ${likedVideos.has(video.id) ? 'text-pink-500 fill-pink-500' : 'text-white'}`} />
                  </button>
                  <span className="text-xs font-semibold mt-1">
                    {(video.likes || 0) + (likedVideos.has(video.id) ? 1 : 0)}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <button 
                    className="p-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FaComment className="text-xl text-white" />
                  </button>
                  <span className="text-xs font-semibold mt-1">{video.comments?.length || 0}</span>
                </div>

                <div className="flex flex-col items-center">
                  <button 
                    className="p-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FaShare className="text-xl text-white" />
                  </button>
                </div>

                <div className="w-7 h-7 rounded-full border border-white flex items-center justify-center animate-spin-slow">
                  <FaMusic className="text-xs text-white" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {currentVideoIndex < videos.length - 1 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 animate-bounce">
          <IoIosArrowUp className="text-xl text-white/80" />
        </div>
      )}

      {loading && videos.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-pink-500"></div>
        </div>
      )}
    </div>
  );
}