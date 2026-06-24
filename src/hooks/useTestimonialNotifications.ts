import { useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export interface TestimonialNotificationPayload {
  id: string;
  name: string;
  email: string;
  rating: number;
  content: string;
  company?: string;
  title?: string;
  createdAt: string;
}

export function useTestimonialNotifications() {
  /**
   * Triggers the server-side email helper to log/simulatively dispatch
   * an email notification to the business owner.
   */
  const notifyNewSubmission = async (testimonial: any, spaceId: string) => {
    try {
      // 1. Resolve workspace details from Firestore
      let spaceName = "My Business Space";
      let ownerEmail = "owner@sandbox.io";

      if (spaceId) {
        const spaceRef = doc(db, "spaces", spaceId);
        const spaceSnap = await getDoc(spaceRef);
        if (spaceSnap.exists()) {
          const spaceData = spaceSnap.data();
          spaceName = spaceData.name || spaceName;
          
          // Let's check for any contact email, owner email or fallback to current sandbox email
          ownerEmail = spaceData.ownerEmail || "ayanatamene80@gmail.com";
        }
      }

      // 2. Transmit to server API proxy
      const response = await fetch("/api/notify-owner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testimonial,
          spaceName,
          ownerEmail,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to dispatch notify payload to server.");
      }

      const data = await response.json();
      console.log("[Notification System] Email trigger successful:", data);
      return data;
    } catch (error) {
      console.error("[Notification System] Error triggering new submission notification:", error);
      return null;
    }
  };

  /**
   * Triggers the server-side email helper to log/simulatively dispatch
   * an automated "Thank You" email notification to the client.
   */
  const notifyClientThankYou = async (testimonial: any, campaign: any) => {
    try {
      if (!testimonial || !campaign) return null;

      const response = await fetch("/api/notify-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testimonial,
          campaign,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to dispatch client thank you email payload to server.");
      }

      const data = await response.json();
      console.log("[Notification System] Client thank-you email dispatch success:", data);
      return data;
    } catch (error) {
      console.error("[Notification System] Error triggering client thank-you notification:", error);
      return null;
    }
  };

  /**
   * Sets up a real-time Firestore listener for newly added testimonials
   * in the active workspace. Useful for pushing real-time UI Toasts.
   */
  const useLiveSubmissions = (spaceId: string | undefined, onNewSubmission: (testimonial: TestimonialNotificationPayload) => void) => {
    const isInitialRef = useRef(true);
    const resolvedIds = useRef<Set<string>>(new Set());

    useEffect(() => {
      if (!spaceId) return;

      // Reset tracking state when starting a subscription for a new space
      isInitialRef.current = true;
      resolvedIds.current.clear();

      const testimonialsRef = collection(db, "testimonials");
      const q = query(
        testimonialsRef,
        where("spaceId", "==", spaceId)
      );

      console.log(`[Notification System] Setting up real-time listener for space: ${spaceId}`);
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // If this is the initial population of historical records, we just index them
          if (isInitialRef.current) {
            snapshot.docs.forEach((docSnap) => {
              resolvedIds.current.add(docSnap.id);
            });
            isInitialRef.current = false;
            console.log(`[Notification System] Initial loader indexed ${resolvedIds.current.size} historical reviews.`);
            return;
          }

          // Trigger notifications and log sent files for newly appended snapshot rows
          let hasNew = false;
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const docId = change.doc.id;
              
              // Only report if it wasn't tracked previously
              if (!resolvedIds.current.has(docId)) {
                resolvedIds.current.add(docId);
                const data = change.doc.data();
                hasNew = true;
                
                // Trigger callback for the custom toast notification UI
                onNewSubmission({
                  id: docId,
                  name: data.name || "Anonymous User",
                  email: data.email || "",
                  rating: Number(data.rating) || 5,
                  content: data.content || "",
                  company: data.company || "",
                  title: data.title || "",
                  createdAt: data.createdAt || new Date().toISOString(),
                });
              }
            }
          });

          if (hasNew) {
            // Play a satisfying digital chime
            try {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                const now = ctx.currentTime;
                
                const playTone = (freq: number, start: number, duration: number) => {
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.type = "sine";
                  osc.frequency.setValueAtTime(freq, start);
                  gain.gain.setValueAtTime(0.08, start);
                  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.start(start);
                  osc.stop(start + duration);
                };
                
                // C5 -> E5 -> G5 fast chime arpeggio
                playTone(523.25, now, 0.3);
                playTone(659.25, now + 0.08, 0.4);
                playTone(783.99, now + 0.16, 0.5);
              }
            } catch (e) {
              console.warn("Audio chime block:", e);
            }
          }
        },
        (error) => {
          console.error("[Notification System] Listener subscription error:", error);
        }
      );

      return () => {
        unsubscribe();
        console.log(`[Notification System] Disposed real-time listener for space: ${spaceId}`);
      };
    }, [spaceId, onNewSubmission]);
  };

  return {
    notifyNewSubmission,
    notifyClientThankYou,
    useLiveSubmissions,
  };
}
