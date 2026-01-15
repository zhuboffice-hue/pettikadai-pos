
"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            toast.success("Login successful!");
            router.push('/dashboard');
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
            <div className="card w-full max-w-sm shadow-xl bg-base-100">
                <div className="card-body text-center">
                    <h2 className="card-title justify-center text-2xl font-bold mb-2">
                        Pettikadai POS
                    </h2>
                    <p className="text-sm opacity-70 mb-6">Ultra-fast billing for Kirana Stores</p>

                    <button
                        onClick={handleGoogleLogin}
                        className="btn btn-outline btn-lg w-full flex items-center gap-2"
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <>
                                <FcGoogle className="w-6 h-6" />
                                Sign in with Google
                            </>
                        )}
                    </button>

                    <div className="mt-4 text-xs opacity-50">
                        By signing in, you start your 14-day free trial.
                    </div>
                </div>
            </div>
        </div>
    );
}
