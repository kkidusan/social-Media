// components/VideoUpload.tsx
"use client";

import { useState, useRef } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export default function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.includes("video")) {
        setError("Please select a video file");
        return;
      }
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError("File size should be less than 100MB");
        return;
      }
      setFile(selectedFile);
      setError("");
    }
  };

  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
    formData.append("folder", "shortMovie");
    formData.append("resource_type", "video");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`,
      {
        method: "POST",
        body: formData,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to upload to Cloudinary");
    }

    return await response.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) {
      setError("Please select a file and log in.");
      return;
    }

    setIsUploading(true);
    setError("");
    setSuccess("");
    setProgress(0);

    try {
      // Upload to Cloudinary
      const cloudinaryResponse = await uploadToCloudinary(file);
      const videoUrl = cloudinaryResponse.secure_url;
      const publicId = cloudinaryResponse.public_id;

      // Create video data for Firestore
      const videoData = {
        title,
        description,
        videoUrl,
        publicId,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || "Anonymous",
        createdAt: serverTimestamp(),
        views: 0,
        likes: 0,
        likesByUsers: [],
        comments: [],
      };

      // Use publicId as the document ID in Firestore
      const videoRef = doc(db, "videos", publicId);
      await setDoc(videoRef, videoData);

      setSuccess("Video uploaded successfully!");
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setProgress(0);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload video. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Upload Video</h2>
      {!user && <p className="text-red-500 mb-4">Please log in to upload videos.</p>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="video">
            Video File
          </label>
          <input
            id="video"
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="w-full p-2 border rounded"
            disabled={!user || isUploading}
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={!user || isUploading}
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded"
            rows={3}
            disabled={!user || isUploading}
          />
        </div>

        {error && <div className="mb-4 text-red-500">{error}</div>}
        {success && <div className="mb-4 text-green-500">{success}</div>}

        <button
          type="submit"
          disabled={!user || isUploading}
          className={`w-full py-2 px-4 rounded text-white ${
            isUploading || !user ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
          } transition`}
        >
          {isUploading ? `Uploading... ${progress}%` : "Upload Video"}
        </button>

        {isUploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}