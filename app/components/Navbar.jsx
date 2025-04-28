"use client";

import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const { user, loading, logout, checkAuth } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const checkIfMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true);
    }
  }, [pathname, isMobile]);

  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.style.marginLeft = isCollapsed ? '4rem' : '16rem';
    }
  }, [isCollapsed]);

  useEffect(() => {
    checkAuth();
  }, [pathname, checkAuth]);

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  const handleLogout = async () => {
    try {
      await logout();
      if (isMobile) {
        setIsCollapsed(true);
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="fixed top-0 left-0 h-full w-16 bg-gradient-to-b from-blue-600 to-purple-600 shadow-xl z-50 flex flex-col items-center py-4">
        <div className="animate-pulse h-10 w-10 rounded-full bg-blue-400 mb-8"></div>
      </div>
    );
  }

  return (
    <>
      {isMobile && (
        <button
          className="fixed top-4 left-4 z-50 p-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg md:hidden transition-all duration-300"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={!isCollapsed ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
            />
          </svg>
        </button>
      )}

      <div
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-blue-600 to-purple-600 shadow-xl z-40 transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-16" : "w-64"
        } ${isMobile && isCollapsed ? "-translate-x-full" : "translate-x-0"}`}
      >
        <div className="h-full flex flex-col items-center py-8 overflow-hidden relative">
          <Link
            href="/"
            className={`text-white mb-12 transition-all duration-300 ${
              isCollapsed ? "text-xl" : "text-2xl font-bold"
            }`}
          >
            {isCollapsed ? "F" : "Funny"}
          </Link>

          {!isMobile && (
            <button
              onClick={toggleSidebar}
              className="absolute top-6 right-4 bg-white p-1 rounded-full shadow-md hover:scale-110 transition-transform"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
                />
              </svg>
            </button>
          )}

          <div className="w-full flex flex-col items-start space-y-6 px-4">
            {user ? (
              <>
                <SidebarLink
                  href="/"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6-10h6"
                      />
                    </svg>
                  }
                  text="Home"
                  isCollapsed={isCollapsed}
                />
                <SidebarLink
                  href="/likes"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  }
                  text="Likes"
                  isCollapsed={isCollapsed}
                />
                <SidebarLink
                  href="/profile"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  }
                  text="Profile"
                  isCollapsed={isCollapsed}
                />
                <SidebarLink
                  href="/upload"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                  }
                  text="Upload"
                  isCollapsed={isCollapsed}
                />
                <SidebarLink
                  href="/friends"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  }
                  text="Friends"
                  isCollapsed={isCollapsed}
                />
                <button
                  onClick={handleLogout}
                  className="flex items-center text-white hover:text-gray-200 transition-colors group w-full"
                >
                  <span className="p-2 bg-blue-700 rounded-lg group-hover:bg-blue-800 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  </span>
                  <span
                    className={`ml-4 transition-all duration-300 ${
                      isCollapsed ? "opacity-0 w-0" : "opacity-100"
                    }`}
                  >
                    Logout
                  </span>
                </button>
              </>
            ) : (
              <>
                <SidebarLink
                  href="/login"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                      />
                    </svg>
                  }
                  text="Login"
                  isCollapsed={isCollapsed}
                />
                <SidebarLink
                  href="/signup"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                  }
                  text="Signup"
                  isCollapsed={isCollapsed}
                />
              </>
            )}
          </div>

          {user && !isCollapsed && (
            <div className="mt-auto px-4 py-4 bg-blue-700 bg-opacity-30 rounded-lg mx-2 w-full">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-blue-600 font-bold">
                  {user.firstName ? user.firstName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div className="ml-3 overflow-hidden">
                  <p className="text-white font-medium truncate">
                    {user.firstName || user.email.split('@')[0]}
                  </p>
                  <p className="text-blue-200 text-xs truncate">
                    {user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user.email}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SidebarLink({ href, icon, text, isCollapsed }) {
  return (
    <Link
      href={href}
      className="flex items-center text-white hover:text-gray-200 transition-colors group w-full"
    >
      <span className="p-2 bg-blue-700 rounded-lg group-hover:bg-blue-800 transition-colors">
        {icon}
      </span>
      <span
        className={`ml-4 transition-all duration-300 whitespace-nowrap ${
          isCollapsed ? "opacity-0 w-0" : "opacity-100"
        }`}
      >
        {text}
      </span>
    </Link>
  );
}