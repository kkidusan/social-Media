"use client";

import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaCheck } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";

// Generate a random 6-character video ID
const generateVideoId = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

export default function VideoUploadForm() {
  const { user, loading: authLoading } = useAuth(); // Auth state including customUserId
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    title: "",
    videoUrl: "",
    thumbnailUrl: "",
    videoId: "",
  });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState({});

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login"); // Redirect to login if not authenticated
    }
  }, [user, authLoading, router]);

  // Loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // If not logged in (after auth check), show nothing (or redirect)
  if (!user) {
    return null;
  }

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // Upload video to Cloudinary
  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const newVideoId = generateVideoId();
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (!validTypes.includes(file.type)) {
      setErrors({ videoUrl: "Please upload a valid video file (MP4, WebM, or OGG)" });
      return;
    }

    if (file.size > maxSize) {
      setErrors({ videoUrl: "File size must be less than 100MB" });
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
    formDataUpload.append("folder", "videos");
    formDataUpload.append("resource_type", "video");

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`,
        { method: "POST", body: formDataUpload }
      );

      if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);

      const data = await response.json();
      const thumbnailUrl = data.secure_url.replace('/upload/', '/upload/w_500,h_300,c_fill,q_auto,f_auto/');
      
      setFormData((prev) => ({
        ...prev,
        videoUrl: data.secure_url,
        thumbnailUrl: thumbnailUrl,
        videoId: newVideoId,
      }));
      
      setErrors((prev) => ({ ...prev, videoUrl: "" }));
    } catch (error) {
      console.error("Error uploading video:", error);
      setErrors((prev) => ({ ...prev, videoUrl: error.message || "Failed to upload video" }));
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  // Submit video data to Firestore
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.videoUrl) newErrors.videoUrl = "Video is required";
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);

    try {
      await addDoc(collection(db, "videos"), {
        videoId: formData.videoId,
        title: formData.title,
        videoUrl: formData.videoUrl,
        thumbnailUrl: formData.thumbnailUrl,
        userId: user.userId, // Use userId from context
        customUserId: user.customUserId, // Use customUserId from context
        createdAt: serverTimestamp(),
        views: 0,
        likes: 0,
        comments: [],
        status: "published",
      });

      alert(`Video uploaded successfully! Video ID: ${formData.videoId}`);
      router.push("/up");
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Failed to save video data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 p-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors mb-6"
          disabled={loading}
        >
          <FaArrowLeft className="h-5 w-5" />
          <span className="text-lg font-medium">Back</span>
        </button>

        <div className="bg-white p-8 rounded-2xl shadow-lg">
          <h1 className="text-2xl font-bold text-zinc-800 mb-6">Upload Video</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700">
                Video Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 rounded-md border shadow-sm focus:outline-none focus:ring-2 ${
                  errors.title 
                    ? "border-2 border-red-500 focus:border-red-500 focus:ring-red-500" 
                    : "border-zinc-300 focus:border-blue-500 focus:ring-blue-500"
                }`}
                autoComplete="off"
                disabled={loading}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-500">{errors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700">
                Video File <span className="text-red-500">*</span>
              </label>
              <div className={`mt-1 flex flex-col items-center justify-center w-full px-3 py-6 border-2 border-dashed rounded-md ${
                errors.videoUrl 
                  ? "border-red-500 bg-red-50/50" 
                  : "border-zinc-300 bg-zinc-50 hover:border-zinc-400"
              }`}>
                <div className="text-center">
                  <p className={`mb-2 ${errors.videoUrl ? "text-red-500 font-medium" : "text-zinc-500"}`}>
                    {formData.videoUrl 
                      ? `Video uploaded successfully (ID: ${formData.videoId})`
                      : errors.videoUrl 
                        ? errors.videoUrl
                        : "Click to upload video (MP4, WebM, OGG, max 100MB)"
                    }
                  </p>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                  <input
                    type="file"
                    name="video"
                    accept="video/mp4,video/webm,video/ogg"
                    onChange={handleVideoUpload}
                    className="hidden"
                    id="video-upload"
                    disabled={loading}
                  />
                  <label 
                    htmlFor="video-upload"
                    className={`inline-flex items-center px-4 py-2 rounded-md cursor-pointer ${
                      errors.videoUrl
                        ? "bg-red-500 text-white hover:bg-red-600" 
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {formData.videoUrl ? "Change Video" : "Choose Video"}
                  </label>
                </div>
              </div>
            </div>

            {formData.videoUrl && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2 text-zinc-700">Video Preview</h3>
                <video 
                  src={formData.videoUrl} 
                  controls 
                  className="w-full rounded-lg"
                />
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !formData.videoUrl}
                className="flex items-center justify-center w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {uploadProgress > 0 ? `Uploading... ${uploadProgress}%` : "Saving..."}
                  </>
                ) : (
                  <>
                    <FaCheck className="mr-2" />
                    Submit Video
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}