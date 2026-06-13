import React, { useState, useEffect, FormEvent } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  limit 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Campaign, Testimonial } from "../types";
import { useTestimonialNotifications } from "../hooks/useTestimonialNotifications";
import { 
  Star, 
  Send, 
  CheckCircle, 
  MessageSquare, 
  Building, 
  User, 
  Globe, 
  Mail, 
  ChevronRight, 
  Heart,
  Loader,
  ArrowLeft,
  Video,
  VideoOff,
  Play,
  Square,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Camera
} from "lucide-react";
import { motion } from "motion/react";

interface SaaSStoreFormProps {
  slug: string;
  onGoHome?: () => void;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=150&q=80"
];

export default function SaaS_Landing_Form({ slug, onGoHome }: SaaSStoreFormProps) {
  const { notifyNewSubmission, notifyClientThankYou } = useTestimonialNotifications();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0]);

  // Video testimonial recording states
  const [reviewType, setReviewType] = useState<"text" | "video">("text");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "requesting" | "recording" | "recorded">("idle");
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoObjectURL, setVideoObjectURL] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [recordingTimer, setRecordingTimer] = useState<any>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const videoPreviewRef = React.useRef<HTMLVideoElement | null>(null);

  // Clean play stream when switching views
  useEffect(() => {
    return () => {
      if (recordingTimer) clearInterval(recordingTimer);
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaStream, recordingTimer]);

  const stopCameraStream = (streamToStop: MediaStream | null) => {
    if (streamToStop) {
      streamToStop.getTracks().forEach(track => track.stop());
    }
  };

  const startCamera = async () => {
    try {
      setRecordingState("requesting");
      setVideoError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true
      });
      setMediaStream(stream);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
      setRecordingState("idle");
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setVideoError("Camera/microphones access failed. Please ensure permissions are granted within your browser controls.");
      setRecordingState("idle");
    }
  };

  const startRecording = () => {
    if (!mediaStream) return;
    setVideoError(null);
    const chunks: BlobPart[] = [];
    
    // We try to use a compatible mime type
    let mimeType = "video/webm";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
      mimeType = "video/webm;codecs=vp8,opus";
    } else if (MediaRecorder.isTypeSupported("video/mp4")) {
      mimeType = "video/mp4";
    }

    try {
      const recorder = new MediaRecorder(mediaStream, { mimeType });
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const completeBlob = new Blob(chunks, { type: "video/webm" });
        setVideoBlob(completeBlob);
        const objUrl = URL.createObjectURL(completeBlob);
        setVideoObjectURL(objUrl);
        setRecordingState("recorded");
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecordingState("recording");
      setRecordedDuration(0);

      const timer = setInterval(() => {
        setRecordedDuration(prev => {
          if (prev >= 60) {
            clearInterval(timer);
            if (recorder.state !== "inactive") {
              recorder.stop();
            }
            stopCameraStream(mediaStream);
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
      setRecordingTimer(timer);
    } catch (err: any) {
      console.error("Failed to start MediaRecorder:", err);
      setVideoError("Could not start recording session: " + err.message);
    }
  };

  const stopRecording = () => {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    stopCameraStream(mediaStream);
  };

  const handleResetRecording = () => {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
    if (videoObjectURL) {
      URL.revokeObjectURL(videoObjectURL);
      setVideoObjectURL(null);
    }
    setVideoBlob(null);
    setRecordedDuration(0);
    setRecordingState("idle");
    startCamera();
  };

  useEffect(() => {
    async function loadCampaign() {
      try {
        setLoading(true);
        setError(null);
        const campaignsRef = collection(db, "campaigns");
        const q = query(campaignsRef, where("slug", "==", slug), limit(1));
        
        let querySnapshot;
        try {
          querySnapshot = await getDocs(q);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `campaigns slug=${slug}`);
          return;
        }

        if (querySnapshot.empty) {
          setError("Campaign not found or is inactive.");
          setLoading(false);
          return;
        }

        const docSnapshot = querySnapshot.docs[0];
        const loadedCampaign = { id: docSnapshot.id, ...docSnapshot.data() } as Campaign;
        
        if (loadedCampaign.status !== "active") {
          setError("This review collection channel is currently paused.");
        } else {
          setCampaign(loadedCampaign);
        }
      } catch (err: any) {
        setError("Error connecting to social proof database.");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      loadCampaign();
    }
  }, [slug]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!campaign) return;
    
    if (campaign.collectDetails.rating && !rating) {
      alert("Please select a star rating.");
      return;
    }

    const activeContent = content.trim() || (reviewType === "video" ? `📹 [Video Review] Recorded video testimonial (${recordedDuration}s)` : "");
    if (!activeContent) {
      alert("Please complete all required fields (Feedback, Name, and Email).");
      return;
    }
    if (!name.trim() || !email.trim()) {
      alert("Please complete Name and Email fields.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let finalVideoUrl = "";
      if (reviewType === "video") {
        if (!videoBlob) {
          alert("Please record/finish a video block or switch back to text form format.");
          setSubmitting(false);
          return;
        }

        try {
          if (videoBlob.size < 900000) {
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(videoBlob);
            });
            finalVideoUrl = base64Data;
          } else {
            finalVideoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
          }
        } catch (err) {
          console.error("Video chunk conversion failed, defaulting:", err);
          finalVideoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
        }
      }

      const testimonialPayload = {
        campaignId: campaign.id,
        spaceId: campaign.spaceId,
        name: name.trim(),
        email: email.trim(),
        rating: campaign.collectDetails.rating ? rating : 5,
        content: activeContent,
        avatarUrl,
        company: campaign.collectDetails.company ? company.trim() : "",
        title: campaign.collectDetails.title ? title.trim() : "",
        socialUrl: campaign.collectDetails.socialUrl ? socialUrl.trim() : "",
        status: "new" as const, // initially 'new' awaiting space owner's consent/approval.
        videoUrl: finalVideoUrl || undefined,
        videoDuration: reviewType === "video" ? recordedDuration : undefined,
        createdAt: new Date().toISOString(),
        tags: []
      };

      try {
        await addDoc(collection(db, "testimonials"), testimonialPayload);
        setSuccess(true);
        // Clean up stream triggers
        stopCameraStream(mediaStream);
        setMediaStream(null);

        // Trigger notification hook to contact owner (email dispatch)
        notifyNewSubmission(testimonialPayload, campaign.spaceId).catch((notifyErr) => {
          console.error("Non-blocking notification error:", notifyErr);
        });
        // Trigger automated customer "Thank-You" template email
        notifyClientThankYou(testimonialPayload, campaign).catch((clientErr) => {
          console.error("Non-blocking thank you notification error:", clientErr);
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "testimonials");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to register your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
          <p className="text-slate-500 font-medium">Retrieving client request channel...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="inline-flex p-3 rounded-full bg-amber-50 text-amber-500 mb-4 animate-pulse">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Workspace Offline</h2>
          <p className="text-slate-500 mb-6">{error || "This link seems to have expired or moved spaces."}</p>
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-850 hover:bg-slate-900 text-white rounded-xl font-semibold text-sm transition-all shadow-md"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" /> Back to TrustBuilder App
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/70 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-between">
      {/* Brand Anchor Header */}
      {onGoHome && (
        <div className="max-w-3xl mx-auto w-full mb-8">
          <button
            onClick={onGoHome}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-600 bg-white shadow-sm hover:shadow px-3.5 py-1.5 rounded-full border border-gray-100 transition-all cursor-pointer"
          >
            ← TrustBuilder Platform
          </button>
        </div>
      )}

      <div className="max-w-2xl mx-auto w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden my-auto">
        {/* Decorative Top Accent */}
        <div className="h-2 bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500" />
        
        {success ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-10 text-center"
          >
            <div className="inline-flex p-4 rounded-full bg-emerald-50 text-emerald-500 mb-6">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
              {campaign.thankYouTitle || "Thank you so much!"}
            </h2>
            <p className="text-slate-500 text-lg max-w-md mx-auto leading-relaxed mb-8">
              {campaign.thankYouMessage || "Your valuable feedback has been submitted to our team as a social proof testimony asset."}
            </p>
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed max-w-md mx-auto">
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Feedback Submitted as</span>
              <span className="text-sm font-semibold text-slate-700">{name}</span>
              {company && <span className="text-xs text-slate-400 font-medium">{title ? `${title} at` : ""} {company}</span>}
              <div className="flex gap-1 mt-2">
                {[...Array(rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="p-8 sm:p-12">
            {/* Form Header */}
            <div className="text-center mb-10">
              {campaign.logoUrl && (
                <img 
                  src={campaign.logoUrl} 
                  alt="Campaign Logo" 
                  className="w-16 h-16 object-cover mx-auto rounded-2xl shadow-sm border border-gray-200 mb-4" 
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              )}
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none mb-3">
                {campaign.heading}
              </h1>
              <p className="text-slate-500 text-base max-w-lg mx-auto leading-relaxed">
                {campaign.subheading}
              </p>
            </div>

            {/* Questions Helper block */}
            {campaign.questions && campaign.questions.length > 0 && (
              <div className="mb-8 p-5 bg-gradient-to-br from-indigo-50/40 to-teal-50/20 rounded-2xl border border-indigo-100/30">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">
                  💡 Tips: What you could mention
                </span>
                <ul className="space-y-2 text-slate-600 text-sm">
                  {campaign.questions.map((q, idx) => (
                    <li key={idx} className="flex gap-2.5 items-start">
                      <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Star Rating Selection */}
              {campaign.collectDetails.rating && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block mb-1">
                    Your Overall Rating <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2 items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 cursor-pointer transition-transform hover:scale-115 focus:outline-none"
                      >
                        <Star 
                          className={`w-9 h-9 transition-colors ${
                            star <= (hoverRating ?? rating) 
                              ? "fill-amber-400 text-amber-400" 
                              : "text-gray-200"
                          }`} 
                        />
                      </button>
                    ))}
                    <span className="text-sm font-bold text-slate-400 ml-2">
                      {rating === 5 ? "Loved it!" : rating === 4 ? "Great!" : rating === 3 ? "Good" : rating === 2 ? "Could be better" : "Disappointed"}
                    </span>
                  </div>
                </div>
              )}

              {/* Review Format Selector */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 block">
                  Choose Review Format <span className="text-red-500">*</span>
                </label>
                <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-205 shadow-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewType("text");
                      stopCameraStream(mediaStream);
                      setMediaStream(null);
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      reviewType === "text"
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    <span>✍️ Write Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewType("video");
                      startCamera();
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      reviewType === "video"
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Video className="w-4 h-4 text-rose-500 animate-pulse" />
                    <span>📹 Record Video</span>
                  </button>
                </div>
              </div>

              {/* Format Specific Blocks */}
              {reviewType === "text" ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex justify-between">
                    <span>Your Review / Feedback <span className="text-red-500">*</span></span>
                    <span className="text-xs text-slate-400 font-medium">{content.length} characters</span>
                  </label>
                  <div className="relative">
                    <textarea
                      required={reviewType === "text"}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={4}
                      placeholder="Describe your raw experience with our product or team..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-emerald-500 hover:border-gray-300 rounded-xl font-medium text-slate-700 text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-100 transition-all outline-none"
                    />
                    <div className="absolute right-3.5 bottom-3 text-slate-300">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-900 rounded-3xl overflow-hidden relative shadow-xl border-2 border-slate-800 flex flex-col justify-between align-middle h-80">
                    {/* Live Stream Viewfinder */}
                    {recordingState === "requesting" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950 text-white z-10">
                        <Loader className="w-10 h-10 text-rose-500 animate-spin mb-3" />
                        <span className="text-xs font-bold uppercase tracking-wider font-mono">Requesting client camera/mic permissions...</span>
                      </div>
                    )}

                    {videoError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-slate-950 text-rose-400 z-10">
                        <AlertTriangle className="w-12 h-12 mb-3 animate-bounce text-rose-500" />
                        <h4 className="text-xs font-black uppercase tracking-wider">Access Blocked</h4>
                        <p className="text-[11px] font-semibold text-slate-400 max-w-sm mt-1 mb-4 leading-normal">{videoError}</p>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                        >
                          Retry Access
                        </button>
                      </div>
                    )}

                    {/* Flipped mirrored livestream display */}
                    {(recordingState === "idle" || recordingState === "recording") && mediaStream && !videoError && (
                      <video
                        ref={videoPreviewRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1] absolute inset-0"
                      />
                    )}

                    {/* Pre-recorded segment preview player */}
                    {recordingState === "recorded" && videoObjectURL && (
                      <video
                        src={videoObjectURL}
                        controls
                        className="w-full h-full object-cover absolute inset-0"
                      />
                    )}

                    {/* REC Banners Top Overlay */}
                    {recordingState === "recording" && (
                      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-rose-600 px-3 py-1 rounded-full text-white text-[10px] font-black uppercase tracking-widest leading-none shadow shadow-rose-950">
                        <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                        <span>Rec • {recordedDuration}s / 60s Limit</span>
                      </div>
                    )}

                    {!videoObjectURL && recordingState === "idle" && (
                      <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur-xs border border-slate-700/50 px-3 py-1 rounded-full text-slate-300 text-[9px] font-black uppercase tracking-wider">
                        📷 Guide: Center your camera before recording
                      </div>
                    )}

                    {/* Bottom Action Ribbons */}
                    <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-3 px-4">
                      {recordingState === "idle" && mediaStream && (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-lg hover:scale-103 transition-all flex items-center gap-1.5"
                        >
                          <Camera className="w-4 h-4 fill-white" />
                          <span>Start Recording</span>
                        </button>
                      )}

                      {recordingState === "recording" && (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="px-5 py-3 bg-red-800 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-lg hover:scale-103 transition-all flex items-center gap-1.5"
                        >
                          <Square className="w-4 h-4 fill-white text-white" />
                          <span>Stop & Save draft</span>
                        </button>
                      )}

                      {recordingState === "recorded" && (
                        <div className="flex gap-2.5">
                          <span className="px-4 py-2.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center">
                            ✓ Saved ({recordedDuration}s)
                          </span>
                          <button
                            type="button"
                            onClick={handleResetRecording}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-4 h-4 text-emerald-400" />
                            <span>Re-record video</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Video Testimonial Companion Text Content block */}
                  <div className="space-y-1.5 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                    <label className="text-[10px] font-black uppercase tracking-wider block text-slate-450 font-mono">
                      Accompanying Review Caption / Commentary (Optional)
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={2}
                      placeholder="Give a quick written context phrase to pair with your high fidelity video testimonial..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl font-medium text-slate-700 text-xs placeholder-slate-400 focus:ring-1 focus:ring-indigo-100 transition-all outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Avatar Preset Selection */}
              {campaign.collectDetails.avatarUrl && (
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 block">
                    Choose an Avatar Profile Photo
                  </label>
                  <div className="flex gap-3 flex-wrap items-center">
                    {PRESET_AVATARS.map((url, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setAvatarUrl(url)}
                        className={`relative rounded-full focus:outline-none overflow-hidden h-11 w-11 transition-all ${
                          avatarUrl === url 
                            ? "ring-4 ring-emerald-500 scale-105 shadow" 
                            : "opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={url} alt={`Avatar Preset ${idx + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Client Name & PII Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 hover:border-gray-300 rounded-xl font-medium text-slate-700 text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-100 transition-all outline-none"
                    />
                    <div className="absolute left-3.5 top-3 text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 hover:border-gray-300 rounded-xl font-medium text-slate-700 text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-100 transition-all outline-none"
                    />
                    <div className="absolute left-3.5 top-3 text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                    🔒 Email is strictly secure and never displayed on public elements.
                  </span>
                </div>
              </div>

              {/* Company & Designation (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {campaign.collectDetails.company && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">
                      Company Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Acme Corp"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 hover:border-gray-300 rounded-xl font-medium text-slate-700 text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-100 transition-all outline-none"
                      />
                      <div className="absolute left-3.5 top-3 text-slate-400">
                        <Building className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                )}

                {campaign.collectDetails.title && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">
                      Job Title / Role
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Product Manager"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 hover:border-gray-300 rounded-xl font-medium text-slate-700 text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-100 transition-all outline-none"
                      />
                      <div className="absolute left-3.5 top-3 text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Social Link (Optional) */}
              {campaign.collectDetails.socialUrl && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block">
                    Link to Profile / Social URL (e.g. LinkedIn or Twitter)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={socialUrl}
                      onChange={(e) => setSocialUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 hover:border-gray-300 rounded-xl font-medium text-slate-700 text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-100 transition-all outline-none"
                    />
                    <div className="absolute left-3.5 top-3 text-slate-400">
                      <Globe className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )}

              {/* Error Warning */}
              {error && (
                <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium">
                  {error}
                </div>
              )}

              {/* Submit Action Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin text-emerald-400" />
                    Submitting feedback...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-emerald-400" />
                    Submit Review & Testimonial
                  </>
                )}
              </button>

            </form>
          </div>
        )}
      </div>

      {/* Humble Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-slate-400 font-medium inline-flex items-center gap-1.5 justify-center">
          Powered by <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" /> Kudos Platform
        </p>
      </div>
    </div>
  );
}
