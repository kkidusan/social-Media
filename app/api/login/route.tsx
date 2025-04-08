import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth, signInWithEmailAndPassword, db } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const { email, password, rememberMe = false } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" }, 
        { status: 400 }
      );
    }

    // Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check user role in Firestore
    const [userSnapshot, adminSnapshot] = await Promise.all([
      getDocs(query(collection(db, "useraccount"), where("email", "==", user.email))),
      getDocs(query(collection(db, "admin"), where("email", "==", user.email)))
    ]);

    let role = null;
    if (!userSnapshot.empty) {
      role = "user";
    } else if (!adminSnapshot.empty) {
      role = "admin";
    } else {
      return NextResponse.json(
        { error: "User not authorized" }, 
        { status: 403 }
      );
    }

    // Generate JWT token
    const tokenExpiration = rememberMe ? "30d" : "1h";
    const token = jwt.sign(
      { 
        userId: user.uid, 
        email: user.email, 
        role,
        rememberMe 
      },
      process.env.JWT_SECRET!,
      { expiresIn: tokenExpiration }
    );

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        email: user.email,
        role,
      }
    });

    // Set cookie
    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 60 * 60, // 30 days or 1 hour
      path: "/",
      sameSite: "strict",
    });

    return response;

  } catch (error: any) {
    console.error("Login error:", error);

    const errorMap: Record<string, string> = {
      "auth/invalid-email": "Invalid email address",
      "auth/user-disabled": "Account disabled",
      "auth/user-not-found": "No account found with this email",
      "auth/wrong-password": "Incorrect password",
      "auth/too-many-requests": "Too many attempts, please try again later",
    };

    const status = error.code in errorMap ? 401 : 500;
    const message = errorMap[error.code] || "Login failed. Please try again.";

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}