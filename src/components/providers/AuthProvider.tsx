"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "react-hot-toast";

interface UserData {
    role: 'superadmin' | 'shop-admin' | 'shop-user' | 'user';
    shopId: string;
    shopName?: string;
    name?: string;
    email?: string;
    isApproved: boolean; // True for permanent access
    trialEndsAt?: number; // For 'user' role
    createdAt: number;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    isTrialExpired: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    isTrialExpired: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isTrialExpired, setIsTrialExpired] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                try {
                    const userRef = doc(db, "users", firebaseUser.uid);
                    const userDoc = await getDoc(userRef);

                    if (userDoc.exists()) {
                        const data = userDoc.data() as UserData;
                        setUserData(data);
                        checkTrialStatus(data);
                    } else {
                        // Check for Invite
                        const email = firebaseUser.email;
                        let newUserData: UserData;

                        if (email) {
                            const inviteRef = doc(db, "invites", email);
                            const inviteDoc = await getDoc(inviteRef);

                            if (inviteDoc.exists()) {
                                const inviteData = inviteDoc.data();
                                newUserData = {
                                    role: inviteData.role,
                                    shopId: inviteData.shopId,
                                    name: firebaseUser.displayName || inviteData.name || "Shop User",
                                    email: email,
                                    isApproved: true, // Invited users are auto-approved
                                    createdAt: Date.now()
                                };
                            } else {
                                // Default Trial Flow
                                newUserData = {
                                    role: 'user',
                                    shopId: `shop_${firebaseUser.uid}`,
                                    name: firebaseUser.displayName || "Shop Owner",
                                    email: email,
                                    isApproved: false,
                                    trialEndsAt: Date.now() + (14 * 24 * 60 * 60 * 1000),
                                    createdAt: Date.now()
                                };
                                toast.success("Welcome! Your 14-day trial has started.");
                            }
                        } else {
                            // Fallback for no email
                            newUserData = {
                                role: 'user',
                                shopId: `shop_${firebaseUser.uid}`,
                                name: "Unknown User",
                                isApproved: false,
                                trialEndsAt: Date.now() + (14 * 24 * 60 * 60 * 1000),
                                createdAt: Date.now()
                            };
                        }

                        await setDoc(userRef, newUserData);
                        setUserData(newUserData);
                        checkTrialStatus(newUserData);
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    toast.error("Failed to load user profile");
                }
            } else {
                setUserData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const checkTrialStatus = (data: UserData) => {
        // Superadmin and Approved Shop Admins/Users strictly bypass trial check
        if (data.role === 'superadmin' || data.isApproved) {
            setIsTrialExpired(false);
            return;
        }

        // Role 'user' is effectively a Trial Admin. 
        // If they are NOT approved and time is up -> Expired.
        if (data.trialEndsAt && Date.now() > data.trialEndsAt) {
            setIsTrialExpired(true);
        } else {
            setIsTrialExpired(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, isTrialExpired }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
