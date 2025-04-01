// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, updateDoc, getDocs, query, where, onSnapshot, doc, getDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD4s3o3r0xlIGiVUGNHVL3EQhNUrf8rzN4",
  authDomain: "social-media-a73e9.firebaseapp.com",
  projectId: "social-media-a73e9",
  storageBucket: "social-media-a73e9.firebasestorage.app",
  messagingSenderId: "301566166085",
  appId: "1:301566166085:web:7b060e589608e006504f2c",
  measurementId: "G-X45YVM1GX4"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export {
  firebaseApp,
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  db,
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  serverTimestamp,
};