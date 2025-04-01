// pages/api/upload-video.js
import { v2 as cloudinary } from "cloudinary";
import { db } from "../../lib/firebase";
import { collection, addDoc } from "firebase/firestore";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const file = req.body; // FormData is handled by middleware or parsing library if needed

    // Upload to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(file, {
      resource_type: "video",
      folder: "videos", // Optional: organize in Cloudinary
    });

    const { secure_url: url, public_id } = uploadResponse;

    // Save metadata to Firestore
    const videoData = {
      url,
      public_id,
      uploadedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "videos"), videoData);

    return res.status(200).json({
      url,
      public_id,
      firestoreId: docRef.id,
    });
  } catch (error) {
    console.error("Error uploading video:", error);
    return res.status(500).json({ error: "Failed to upload video" });
  }
}

// Disable Next.js body parser to handle multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};