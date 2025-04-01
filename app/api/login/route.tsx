// pages/api/login.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth, signInWithEmailAndPassword, db } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  // Basic validation
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    // Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check user role in Firestore
    const ownerRef = collection(db, "owner");
    const ownerQuery = query(ownerRef, where("email", "==", user.email));
    const ownerSnapshot = await getDocs(ownerQuery);

    const adminRef = collection(db, "admin");
    const adminQuery = query(adminRef, where("email", "==", user.email));
    const adminSnapshot = await getDocs(adminQuery);

    let role = null;
    if (!ownerSnapshot.empty) {
      role = "owner";
    } else if (!adminSnapshot.empty) {
      role = "admin";
    } else {
      return NextResponse.json({ error: "User not authorized" }, { status: 403 });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.uid, email: user.email, role },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    // Set JWT in cookie
    const response = NextResponse.json({
      message: "Login successful",
      role,
      email: user.email,
    });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600, // 1 hour
      path: "/",
      sameSite: "strict",
    });

    return response;
  } catch (error: any) {
    console.error("Login Error:", error);

    const errorMap: { [key: string]: string } = {
      "auth/user-not-found": "No user found with this email",
      "auth/wrong-password": "Incorrect password",
      "auth/invalid-email": "Invalid email address",
      "auth/too-many-requests": "Too many attempts, try again later",
    };

    const errorMessage = errorMap[error.code] || "Login failed";
    return NextResponse.json({ error: errorMessage }, { status: 401 });
  }
}