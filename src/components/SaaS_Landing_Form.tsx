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
  ArrowLeft
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
  const { notifyNewSubmission } = useTestimonialNotifications();
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
    if (!content.trim() || !name.trim() || !email.trim()) {
      alert("Please complete all required fields (Feedback, Name, and Email).");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const testimonialPayload = {
        campaignId: campaign.id,
        spaceId: campaign.spaceId,
        name: name.trim(),
        email: email.trim(),
        rating: campaign.collectDetails.rating ? rating : 5,
        content: content.trim(),
        avatarUrl,
        company: campaign.collectDetails.company ? company.trim() : "",
        title: campaign.collectDetails.title ? title.trim() : "",
        socialUrl: campaign.collectDetails.socialUrl ? socialUrl.trim() : "",
        status: "new" as const, // initially 'new' awaiting space owner's consent/approval.
        createdAt: new Date().toISOString(),
        tags: []
      };

      try {
        await addDoc(collection(db, "testimonials"), testimonialPayload);
        setSuccess(true);
        // Trigger notification hook to contact owner (email dispatch)
        notifyNewSubmission(testimonialPayload, campaign.spaceId).catch((notifyErr) => {
          console.error("Non-blocking notification error:", notifyErr);
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

              {/* Review Text */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex justify-between">
                  <span>Your Review / Feedback <span className="text-red-500">*</span></span>
                  <span className="text-xs text-slate-400 font-medium">{content.length} characters</span>
                </label>
                <div className="relative">
                  <textarea
                    required
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
