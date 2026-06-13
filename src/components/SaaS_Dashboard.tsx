import React, { useState, useEffect, FormEvent } from "react";
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from "firebase/auth";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { Space, Campaign, Testimonial, Widget, AISyntheticResult, UserSecurityConfig } from "../types";
import { useTestimonialNotifications } from "../hooks/useTestimonialNotifications";
import SaaS_GoogleDriveIntegration from "./SaaS_GoogleDriveIntegration";
import { SaaS_Sentiment_Dashboard } from "./SaaS_Sentiment_Dashboard";
import { 
  Plus, 
  Check, 
  Trash2, 
  Copy, 
  ExternalLink, 
  Code, 
  Sparkles, 
  Star, 
  MessageSquare, 
  Layout, 
  Settings, 
  Search, 
  Sliders, 
  Database,
  ThumbsUp, 
  Globe, 
  Mail, 
  Building,
  UserCheck, 
  LogOut, 
  User as UserIcon, 
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Clock,
  Loader,
  Send,
  Share2,
  Tag,
  CreditCard,
  Wallet,
  Linkedin,
  Twitter,
  Instagram,
  RefreshCw,
  Edit3
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SaaS_Widget_Embed from "./SaaS_Widget_Embed";

// Default configuration helpers
const GUEST_UID = "sandbox-guest-user-999";

const SEED_TESTIMONIALS = [
  {
    name: "Cody House",
    email: "cody@designspace.io",
    company: "DesignSpace",
    title: "Lead Digital Designer",
    rating: 5,
    content: "TrustBuilder has changed how we close client contracts. Gaining positive, verified quotes takes literal seconds now, and displaying them via the Wall of Love on our site has doubled our lead rate!",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=150&q=80",
    status: "approved" as const,
    tags: ["Productivity", "Conversions"]
  },
  {
    name: "Sophia Zhang",
    email: "sophia@techflow.ai",
    company: "TechFlow AI",
    title: "Co-Founder & CEO",
    rating: 5,
    content: "The API integrations and AI summarizing make the $49/mo pricing an absolute steal. It automatically highlights our enterprise tier's reliability with Zero configurations. Pure SaaS craft.",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    status: "approved" as const,
    tags: ["ROI", "Highly Recommended"]
  },
  {
    name: "Liam O'Connor",
    email: "liam@fintechpod.co",
    company: "FintechPod",
    title: "Product Manager",
    rating: 4,
    content: "Clean, responsive widgets optimized for viewport borders. Our developers integrated the custom script in less than five minutes. Testimonial compliance checks are super helpful.",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    status: "approved" as const,
    tags: ["Dev-Friendly"]
  },
  {
    name: "Elena Rostova",
    email: "elena@pulsemedia.pro",
    company: "PulseMedia Solutions",
    title: "Growth Advisor",
    rating: 5,
    content: "Absolutely phenomenal response metrics from our dental client campaigns. It's so intuitive that even our older dentists can inspect ratings and approve reviews with zero technical assistance.",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    status: "approved" as const,
    tags: ["Intuitive UX", "Niche Success"]
  },
  {
    name: "Julian Barnes",
    email: "julian@codeless.net",
    company: "Codeless Studio",
    title: "Freelance Automator",
    rating: 3,
    content: "Pretty solid micro-tool. Wish there were a few more custom Google Fonts inside the widget, but the default Inter theme looks stellar. Ready to purchase once custom branding updates match our agency layouts.",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
    status: "new" as const, // outstanding for review simulation
    tags: ["Constructive"]
  }
];

export default function SaaS_Dashboard() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Two-Factor Authentication Security States
  const [twoFactorConfig, setTwoFactorConfig] = useState<UserSecurityConfig | null>(null);
  const [session2FAVerified, setSession2FAVerified] = useState(false);
  const [twoFactorVerificationCode, setTwoFactorVerificationCode] = useState("");
  const [twoFactorVerificationError, setTwoFactorVerificationError] = useState("");
  const [isActivating2FA, setIsActivating2FA] = useState(false);
  const [isDeactivating2FA, setIsDeactivating2FA] = useState(false);
  const [twoFactorSetupStep, setTwoFactorSetupStep] = useState<"none" | "configure" | "verify" | "success">("none");
  const [temp2FAPhone, setTemp2FAPhone] = useState("");
  const [temp2FAEmail, setTemp2FAEmail] = useState("");
  const [temp2FAType, setTemp2FAType] = useState<"app" | "email" | "sms">("app");
  
  const [totpCountdown, setTotpCountdown] = useState(30);

  // Live timer countdown for 30s steps in active TOTP codes
  useEffect(() => {
    const interval = setInterval(() => {
      const sec = 30 - (Math.floor(Date.now() / 1000) % 30);
      setTotpCountdown(sec);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTOTPCode = (secret: string) => {
    const epoch = Math.floor(Date.now() / 30000); // 30s steps
    const charSum = secret.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const codeValue = (epoch * charSum) % 1000000;
    return String(codeValue).padStart(6, "0");
  };

  const getVerificationCode = () => {
    if (!twoFactorConfig) return "";
    if (twoFactorConfig.twoFactorType === "app") {
      return getTOTPCode(twoFactorConfig.totpSecret || "KVKG U2S3 N5XG Y6TS");
    } else if (twoFactorConfig.twoFactorType === "sms") {
      const epoch = Math.floor(Date.now() / 60000); // 1 min steps
      const num = String(twoFactorConfig.phoneNumber || "123456789");
      const val = (epoch * (num.match(/\d/g)?.reduce((a, b) => a + Number(b), 1) || 5)) % 1000000;
      return String(val).padStart(6, "0");
    } else {
      const epoch = Math.floor(Date.now() / 60000); // 1 min steps
      const mail = String(twoFactorConfig.emailAddress || "user@example.com");
      const val = (epoch * mail.length) % 1000000;
      return String(val).padStart(6, "0");
    }
  };
  const [activeTab, setActiveTab] = useState<"campaigns" | "testimonials" | "widgets" | "ai" | "integrations" | "blueprint" | "billing">("campaigns");
  const [aiSubTab, setAiSubTab] = useState<"sentiment" | "copywriter" | "rewriter">("sentiment");

  // Mobile Money & Billing Workspace State Controls
  const [billingPlan, setBillingPlan] = useState<"Free Tier" | "Growth CRM ($49/mo)" | "Pro Suite ($99/mo)" | "Enterprise Sync ($149/mo)">("Growth CRM ($49/mo)");
  const [momoProvider, setMomoProvider] = useState("M-Pesa");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoAccountName, setMomoAccountName] = useState("");
  const [momoCountry, setMomoCountry] = useState("+254"); // Default Kenya
  const [isVerifyingMomo, setIsVerifyingMomo] = useState(false);
  const [momoOtpCode, setMomoOtpCode] = useState("");
  const [momoVerificationStep, setMomoVerificationStep] = useState<"idle" | "input" | "otp" | "success">("idle");
  const [momoError, setMomoError] = useState("");
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState("");
  const [momoInvoices, setMomoInvoices] = useState<{ id: string; date: string; description: string; amount: string; status: "paid" | "failed" | "pending"; method: string }[]>([
    { id: "INV-2901", date: "2026-05-15", description: "TrustBuilder Growth CRM Subscription", amount: "$49.00", status: "paid", method: "M-Pesa Cashless" },
    { id: "INV-1823", date: "2026-04-15", description: "TrustBuilder Growth CRM Subscription", amount: "$49.00", status: "paid", method: "Visa Card (*4242)" }
  ]);

  // Founder's Profitability Blueprint state
  const [bpTargetMRR, setBpTargetMRR] = useState(5000);
  const [bpMonthlyPrice, setBpMonthlyPrice] = useState(49);
  const [bpWeeklyEmails, setBpWeeklyEmails] = useState(500);
  const [bpConversionRate, setBpConversionRate] = useState(1.2);
  const [bpTargetNiche, setBpTargetNiche] = useState<"dentist" | "plumber" | "salon" | "agency">("dentist");

  // Database lists
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);

  // Simulated email dispatch log history
  const [sentEmails, setSentEmails] = useState<any[]>([]);
  const loadSentEmails = async () => {
    try {
      const res = await fetch("/api/emails");
      if (res.ok) {
        const data = await res.json();
        setSentEmails(data.emails || []);
      }
    } catch (err) {
      console.error("Failed to load sent emails ledger:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "testimonials") {
      loadSentEmails();
      const interval = setInterval(loadSentEmails, 8050); // Poll SMTP logs in sandbox
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Real-time toast states
  const { useLiveSubmissions } = useTestimonialNotifications();
  interface ActiveToast {
    id: string;
    name: string;
    email: string;
    rating: number;
    content: string;
    createdAt: string;
  }
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const handleLiveTestimonial = (newT: any) => {
    setToasts((prev) => [
      {
        id: newT.id,
        name: newT.name,
        email: newT.email,
        rating: newT.rating,
        content: newT.content,
        createdAt: newT.createdAt
      },
      ...prev
    ]);
    
    // Auto-dismiss within 10 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newT.id));
    }, 10000);

    // Live update the testimonials list on the current page in-memory
    setTestimonials((prev) => {
      if (prev.some((item) => item.id === newT.id)) return prev;
      return [
        {
          id: newT.id,
          name: newT.name,
          email: newT.email,
          rating: newT.rating,
          content: newT.content,
          campaignId: "",
          spaceId: selectedSpace?.id || "",
          status: "new",
          createdAt: newT.createdAt,
          tags: []
        } as Testimonial,
        ...prev
      ];
    });

    // Refresh log feed on new toast entry
    loadSentEmails();
  };

  // Mount real-time subscription listener hook
  useLiveSubmissions(selectedSpace?.id, handleLiveTestimonial);

  // Action / State flags
  const [dbLoading, setDbLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Social Media Marketing Copywriter modal states
  const [socialCopyReview, setSocialCopyReview] = useState<any | null>(null);
  const [socialCopyLoading, setSocialCopyLoading] = useState(false);
  const [socialCopyTone, setSocialCopyTone] = useState<string>("Professional");
  const [socialCopyResult, setSocialCopyResult] = useState<any | null>(null);
  const [socialCopyError, setSocialCopyError] = useState<string | null>(null);

  // Raw Review Rewriter states
  const [rewriterRawReview, setRewriterRawReview] = useState("");
  const [rewriterTone, setRewriterTone] = useState("Professional");
  const [rewriterFormat, setRewriterFormat] = useState<"marketing_copy" | "social_caption" | "both">("both");
  const [rewriterLoading, setRewriterLoading] = useState(false);
  const [rewriterResult, setRewriterResult] = useState<any | null>(null);
  const [rewriterError, setRewriterError] = useState<string | null>(null);

  // Modal / Creator states
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [configuringEmailCampaign, setConfiguringEmailCampaign] = useState<Campaign | null>(null);
  const [configuringDomainCampaign, setConfiguringDomainCampaign] = useState<Campaign | null>(null);
  const [tempCustomDomain, setTempCustomDomain] = useState("");
  const [isVerifyingDomain, setIsVerifyingDomain] = useState(false);
  const [domainVerificationError, setDomainVerificationError] = useState("");
  const [campaignTemplate, setCampaignTemplate] = useState<"general" | "salesforce" | "ecommerce" | "b2b">("general");
  const [newCampTitle, setNewCampTitle] = useState("");
  const [newCampSlug, setNewCampSlug] = useState("");
  const [newCampHeading, setNewCampHeading] = useState("Share your story with us!");
  const [newCampSubheading, setNewCampSubheading] = useState("We love hearing your feedback. Please take 1 minute to leave a review.");

  // Integration settings for Salesforce, E-commerce, and B2B Sales
  const [salesforceConnected, setSalesforceConnected] = useState(false);
  const [salesforceObject, setSalesforceObject] = useState("Lead");
  const [ecommerceConnected, setEcommerceConnected] = useState(false);
  const [ecommerceStoreUrl, setEcommerceStoreUrl] = useState("my-shopify-store.myshopify.com");
  const [ecommercePlatform, setEcommercePlatform] = useState("Shopify");
  const [b2bConnected, setB2bConnected] = useState(false);
  const [b2bPipeline, setB2bPipeline] = useState("Enterprise Deals Sandbox");
  const [syncLogs, setSyncLogs] = useState<{ id: string; timestamp: string; integration: string; message: string; type: "success" | "info" | "warning" }[]>([
    {
      id: "log-1",
      timestamp: new Date(Date.now() - 3600 * 4).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      integration: "Salesforce CRM",
      message: "Sync engine initialized successfully. Ready to push approved testimonials.",
      type: "info"
    },
    {
      id: "log-2",
      timestamp: new Date(Date.now() - 3600 * 2).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      integration: "E-commerce Sync",
      message: "Checked Shopify storefront webhook endpoints. Connected.",
      type: "info"
    }
  ]);

  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);

  // Feedback invitation template states
  const [shareCampaign, setShareCampaign] = useState<Campaign | null>(null);
  const [recipientName, setRecipientName] = useState("Jane");
  const [senderName, setSenderName] = useState("Team");
  const [shareTone, setShareTone] = useState<"friendly" | "professional" | "incentive" | "sms">("friendly");

  const getShareTemplate = () => {
    if (!shareCampaign) return { subject: "", body: "" };
    const campaignUrl = `${window.location.origin}/form/${shareCampaign.slug}`;
    const title = shareCampaign.title;
    
    switch (shareTone) {
      case "professional":
        return {
          subject: `Could you share your feedback on ${title}?`,
          body: `Hi ${recipientName},\n\nI hope you're doing well.\n\nWe recently wrapped up our work together on ${title}, and we'd love to hear your thoughts. Could you spare 1-2 minutes to write a quick testimonial for us?\n\nYou can submit your feedback directly here:\n${campaignUrl}\n\nYour insights are incredibly valuable to us and help us continuously improve!\n\nThank you so much for your time and guidance.\n\nBest regards,\n${senderName}`
        };
      case "incentive":
        return {
          subject: `We'd love to feature you! (Testimonial request for ${title})`,
          body: `Hi ${recipientName},\n\nWe are looking to feature some of our favorite client stories on our public Wall of Fame, and your experience with ${title} immediately came to mind!\n\nCould you take 1 minute to leave us an honest review? We will gladly link back to your business/website and showcase your achievements.\n\nYou can submit it here:\n${campaignUrl}\n\nThank you for being such an awesome partner!\n\nWarmly,\n${senderName}`
        };
      case "sms":
        return {
          subject: "SMS Template",
          body: `Hi ${recipientName}! Could you do us a quick favor and share your feedback for ${title}? It only takes a minute. Leave a review here: ${campaignUrl} — Thanks from ${senderName}!`
        };
      case "friendly":
      default:
        return {
          subject: `Quick favor? (1-min review for ${title} 😊)`,
          body: `Hey ${recipientName}!\n\nI hope you're having an amazing week.\n\nSince we've worked together on ${title}, I wanted to ask if you'd be open to leaving us a quick rating or review? It takes less than a minute and means absolute worlds to our small team.\n\nHere is the link:\n${campaignUrl}\n\nThanks a million for your support!\n\nCheers,\n${senderName}`
        };
    }
  };

  // AI states
  const [aiResult, setAiResult] = useState<AISyntheticResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Filters
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"all" | "new" | "approved" | "archived" | "Positive" | "Neutral" | "Negative">("all");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [tagEditingTestimonialId, setTagEditingTestimonialId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState("");

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Sync campaign modal auto-fill contents when template choice changes
  useEffect(() => {
    if (campaignTemplate === "general") {
      setNewCampHeading("Share your story with us!");
      setNewCampSubheading("We love hearing your feedback. Please take 1 minute to leave a review.");
      setNewCampSlug("saas-review");
    } else if (campaignTemplate === "salesforce") {
      setNewCampHeading("How has Salesforce CRM integration helped you?");
      setNewCampSubheading("We'd love to hear how our custom Salesforce sync improved your team's lead management and CRM pipelines!");
      setNewCampSlug("salesforce-success");
    } else if (campaignTemplate === "ecommerce") {
      setNewCampHeading("Review our store buying experience");
      setNewCampSubheading("Tell us about shipping fast speeds, checkout ease, and overall product satisfaction of your order!");
      setNewCampSlug("ecommerce-shop");
    } else if (campaignTemplate === "b2b") {
      setNewCampHeading("B2B Enterprise ROI & Procurement Outcomes");
      setNewCampSubheading("We value enterprise insights. Share your team's metrics, onboarding experience, and direct cost-reduction with us.");
      setNewCampSlug("b2b-proof");
    }
  }, [campaignTemplate]);

  // Sync database metrics on space selection
  useEffect(() => {
    if (authLoading) return;
    loadWorkspaceData();
  }, [currentUser, selectedSpace]);

  // If logged in user changes and has no space, ensure at least one space exists
  useEffect(() => {
    if (!currentUser && !authLoading) return;
    initializeUserSpace();
  }, [currentUser, authLoading]);

  const loadWorkspaceData = async () => {
    const ownerId = currentUser ? currentUser.uid : GUEST_UID;
    setDbLoading(true);

    try {
      // 1. Fetch spaces
      const spacesRef = collection(db, "spaces");
      const qSpaces = query(spacesRef, where("ownerId", "==", ownerId));
      let spaceDocs;
      try {
        spaceDocs = await getDocs(qSpaces);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "spaces");
        return;
      }

      const spaceList: Space[] = [];
      spaceDocs.forEach((d) => {
        spaceList.push({ id: d.id, ...d.data() } as Space);
      });
      setSpaces(spaceList);

      let currentSpace = selectedSpace;
      if (spaceList.length > 0) {
        if (!currentSpace || !spaceList.some(s => s.id === currentSpace?.id)) {
          currentSpace = spaceList[0];
          setSelectedSpace(currentSpace);
        }
      } else {
        setDbLoading(false);
        return;
      }

      if (!currentSpace) return;

      // 2. Fetch Campaigns
      const campaignsRef = collection(db, "campaigns");
      const qCamps = query(campaignsRef, where("spaceId", "==", currentSpace.id));
      let campDocs;
      try {
        campDocs = await getDocs(qCamps);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "campaigns");
        return;
      }
      const campList: Campaign[] = [];
      campDocs.forEach((d) => {
        campList.push({ id: d.id, ...d.data() } as Campaign);
      });
      setCampaigns(campList);

      // 3. Fetch Testimonials
      const testimonialsRef = collection(db, "testimonials");
      const qTest = query(testimonialsRef, where("spaceId", "==", currentSpace.id));
      let testDocs;
      try {
        testDocs = await getDocs(qTest);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "testimonials");
        return;
      }
      const testList: Testimonial[] = [];
      testDocs.forEach((d) => {
        testList.push({ id: d.id, ...d.data() } as Testimonial);
      });
      setTestimonials(testList);

      // 4. Fetch Widgets
      const widgetsRef = collection(db, "widgets");
      const qWids = query(widgetsRef, where("spaceId", "==", currentSpace.id));
      let widDocs;
      try {
        widDocs = await getDocs(qWids);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "widgets");
        return;
      }
      const widList: Widget[] = [];
      widDocs.forEach((d) => {
        widList.push({ id: d.id, ...d.data() } as Widget);
      });
      setWidgets(widList);

      if (widList.length > 0 && !selectedWidget) {
        setSelectedWidget(widList[0]);
      }

      // 5. Fetch Two-Factor Authentication Security Settings
      const securityRef = collection(db, "user_security");
      const qSecurity = query(securityRef, where("userId", "==", ownerId));
      let securityDocs;
      try {
        securityDocs = await getDocs(qSecurity);
      } catch (err) {
        console.warn("Failed to fetch security doc:", err);
      }

      if (securityDocs && !securityDocs.empty) {
        const docData = securityDocs.docs[0].data() as UserSecurityConfig;
        setTwoFactorConfig(docData);
        const sessionVerified = sessionStorage.getItem(`2fa_verified_${ownerId}`) === "true";
        setSession2FAVerified(sessionVerified || !docData.twoFactorEnabled);
      } else {
        const initialConfig: UserSecurityConfig = {
          userId: ownerId,
          twoFactorEnabled: false,
          twoFactorType: "app",
          totpSecret: "KVKG U2S3 N5XG Y6TS",
          emailAddress: currentUser?.email || "sandbox-guest-user-999@example.com",
          phoneNumber: "",
          backupCodes: ["123456", "789012", "345678", "901234", "567890"]
        };
        setTwoFactorConfig(initialConfig);
        setSession2FAVerified(true);
      }
    } catch (err) {
      console.error("Error loading workspace details", err);
    } finally {
      setDbLoading(false);
    }
  };

  // Two-Factor Authentication (2FA) Security Operations
  const handleStart2FAConfig = () => {
    setTemp2FAEmail(currentUser?.email || "sandbox-user@example.com");
    setTemp2FAPhone("");
    setTwoFactorSetupStep("configure");
    setTwoFactorVerificationCode("");
    setTwoFactorVerificationError("");
  };

  const handleVerifyAndActivate2FA = async () => {
    if (!twoFactorConfig) return;
    setIsActivating2FA(true);
    setTwoFactorVerificationError("");

    const expected = getTOTPCode(twoFactorConfig.totpSecret || "KVKG U2S3 N5XG Y6TS");
    const testCode = twoFactorVerificationCode.trim();

    const isBackup = twoFactorConfig.backupCodes.includes(testCode);
    const isMatch = (testCode === expected) || (testCode === "123456") || isBackup;

    if (!isMatch) {
      setTwoFactorVerificationError("Incorrect verification passcode. Please copy the live token from the sandbox tracker or use a backup code.");
      setIsActivating2FA(false);
      return;
    }

    try {
      const ownerId = currentUser ? currentUser.uid : GUEST_UID;
      const updatedConfig: UserSecurityConfig = {
        ...twoFactorConfig,
        twoFactorEnabled: true,
        twoFactorType: temp2FAType,
        phoneNumber: temp2FAPhone,
        emailAddress: temp2FAEmail || currentUser?.email || "sandbox-user@example.com",
      };

      const securityRef = collection(db, "user_security");
      const qSecurity = query(securityRef, where("userId", "==", ownerId));
      const securityDocs = await getDocs(qSecurity);

      if (!securityDocs.empty) {
        const docId = securityDocs.docs[0].id;
        await updateDoc(doc(db, "user_security", docId), updatedConfig as any);
      } else {
        await addDoc(collection(db, "user_security"), updatedConfig);
      }

      setTwoFactorConfig(updatedConfig);
      setSession2FAVerified(true);
      sessionStorage.setItem(`2fa_verified_${ownerId}`, "true");
      setTwoFactorSetupStep("success");
      setTwoFactorVerificationCode("");
    } catch (err: any) {
      setTwoFactorVerificationError("Security collection save failed: " + err.message);
    } finally {
      setIsActivating2FA(false);
    }
  };

  const handleDeactivate2FA = async () => {
    if (!confirm("Are you confident you wish to disable 2-Factor Authentication? Your accounts will lose advanced credentials protection.")) return;
    if (!twoFactorConfig) return;

    setIsDeactivating2FA(true);
    try {
      const ownerId = currentUser ? currentUser.uid : GUEST_UID;
      const updatedConfig: UserSecurityConfig = {
        ...twoFactorConfig,
        twoFactorEnabled: false
      };

      const securityRef = collection(db, "user_security");
      const qSecurity = query(securityRef, where("userId", "==", ownerId));
      const securityDocs = await getDocs(qSecurity);

      if (!securityDocs.empty) {
        const docId = securityDocs.docs[0].id;
        await updateDoc(doc(db, "user_security", docId), updatedConfig as any);
      } else {
        await addDoc(collection(db, "user_security"), updatedConfig);
      }

      setTwoFactorConfig(updatedConfig);
      setSession2FAVerified(true);
      sessionStorage.setItem(`2fa_verified_${ownerId}`, "true");
      setTwoFactorSetupStep("none");
    } catch (err: any) {
      alert("Could not disable 2FA security features: " + err.message);
    } finally {
      setIsDeactivating2FA(false);
    }
  };

  const handleVerifyChallengeCode = () => {
    if (!twoFactorConfig) return;
    setTwoFactorVerificationError("");

    const expected = getVerificationCode();
    const testCode = twoFactorVerificationCode.trim();

    const isBackup = twoFactorConfig.backupCodes.includes(testCode);
    const isMatch = (testCode === expected) || (testCode === "123456") || isBackup;

    if (isMatch) {
      const ownerId = currentUser ? currentUser.uid : GUEST_UID;
      setSession2FAVerified(true);
      sessionStorage.setItem(`2fa_verified_${ownerId}`, "true");
      setTwoFactorVerificationCode("");
    } else {
      setTwoFactorVerificationError("The security code entered is invalid or has expired. Please verify and try again.");
    }
  };

  const initializeUserSpace = async () => {
    const ownerId = currentUser ? currentUser.uid : GUEST_UID;
    try {
      const spacesRef = collection(db, "spaces");
      const q = query(spacesRef, where("ownerId", "==", ownerId));
      let snap;
      try {
        snap = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "spaces");
        return;
      }

      if (snap.empty) {
        setDbLoading(true);
        // Create default business workspace
        const defaultSpaceId = "space-" + Math.random().toString(36).slice(2, 9);
        const newSpace: Space = {
          id: defaultSpaceId,
          name: currentUser ? `${currentUser.displayName || "My"} Company` : "Acme Digital Agency",
          logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80",
          ownerId,
          createdAt: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, "spaces", defaultSpaceId), newSpace);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `spaces/${defaultSpaceId}`);
          return;
        }
        setSelectedSpace(newSpace);
        
        // Auto create active campaign & widget as bootstrap configuration
        const defaultCampId = "camp-" + Math.random().toString(36).slice(2, 9);
        const defaultCampaign: Campaign = {
          id: defaultCampId,
          spaceId: defaultSpaceId,
          title: "General Client Feedback Collection",
          slug: "acme-review",
          status: "active",
          heading: "Help us shape the future of Acme!",
          subheading: "Your voice shapes our growth. Take 20 seconds to share what you love most.",
          questions: [
            "What did you like about our onboarding process?",
            "How has our product decreased your daily manual workload?",
            "Would you recommend Acme to your professional colleagues?"
          ],
          collectDetails: {
            rating: true,
            title: true,
            company: true,
            socialUrl: true,
            avatarUrl: true
          },
          thankYouTitle: "Thank you for supporting us!",
          thankYouMessage: "We've registered your review. Your social proof helps small teams like ours scale safely.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        try {
          await setDoc(doc(db, "campaigns", defaultCampId), defaultCampaign);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `campaigns/${defaultCampId}`);
          return;
        }

        const defaultWidId = "widget-" + Math.random().toString(36).slice(2, 9);
        const defaultWidget: Widget = {
          id: defaultWidId,
          spaceId: defaultSpaceId,
          name: "Standard Wall of Love",
          type: "grid",
          theme: "light",
          campaignIds: [defaultCampId],
          styles: {
            backgroundColor: "#f8fafc",
            textColor: "#0f172a",
            cardBgColor: "#ffffff",
            ratingColor: "#eab308",
            borderRadius: "lg",
            borderStyle: "subtle",
            enableGridAnimation: true
          },
          limit: 12,
          showRating: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        try {
          await setDoc(doc(db, "widgets", defaultWidId), defaultWidget);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `widgets/${defaultWidId}`);
          return;
        }

        await loadWorkspaceData();
      }
    } catch (err) {
      console.error("Error setting up user workspace", err);
    }
  };

  // Sync local mobile money & billing controls when active workspace changes
  useEffect(() => {
    if (selectedSpace) {
      setBillingPlan(selectedSpace.billingPlan || "Growth CRM ($49/mo)");
      if (selectedSpace.paymentMethod?.type === "mobile_money") {
        setMomoProvider(selectedSpace.paymentMethod.momoProvider || "M-Pesa");
        const savedPhone = selectedSpace.paymentMethod.momoPhoneNumber || "";
        const parts = savedPhone.split(" ");
        if (parts.length > 1) {
          setMomoCountry(parts[0]);
          setMomoNumber(parts.slice(1).join(" "));
        } else {
          setMomoNumber(savedPhone);
        }
        setMomoAccountName(selectedSpace.paymentMethod.momoAccountName || "");
        setMomoVerificationStep("success");
      } else {
        setMomoVerificationStep("idle");
        setMomoNumber("");
        setMomoAccountName("");
      }
    }
  }, [selectedSpace]);

  const handleSaveMomoPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpace) return;
    
    setIsVerifyingMomo(true);
    setMomoError("");
    
    if (!momoNumber.trim()) {
      setMomoError("Mobile Money phone number is required");
      setIsVerifyingMomo(false);
      return;
    }
    if (!momoAccountName.trim()) {
      setMomoError("Registered Mobile Money account holder name is required");
      setIsVerifyingMomo(false);
      return;
    }

    // Direct transition to OTP simulation step
    setTimeout(() => {
      setIsVerifyingMomo(false);
      setMomoVerificationStep("otp");
    }, 1200);
  };

  const handleConfirmMomoOtp = async () => {
    if (!selectedSpace) return;
    if (momoOtpCode.trim() !== "1234" && momoOtpCode.trim().length !== 4) {
      setMomoError("Invalid code. Enter '1234' for sandbox authentication approval.");
      return;
    }

    setIsVerifyingMomo(true);
    setMomoError("");

    try {
      const spaceDocRef = doc(db, "spaces", selectedSpace.id);
      const updatedPaymentMethod = {
        type: "mobile_money" as const,
        momoProvider,
        momoPhoneNumber: `${momoCountry} ${momoNumber}`,
        momoAccountName,
        status: "active" as const
      };

      await updateDoc(spaceDocRef, {
        billingPlan,
        paymentMethod: updatedPaymentMethod
      });

      const refreshedSpace = {
        ...selectedSpace,
        billingPlan,
        paymentMethod: updatedPaymentMethod
      };
      setSelectedSpace(refreshedSpace);
      
      setSpaces(prev => prev.map(s => s.id === selectedSpace.id ? refreshedSpace : s));

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `momo-setup-${Date.now()}`,
          timestamp,
          integration: "Mobile Money billing",
          message: `Successfully connected ${momoProvider} account (${momoCountry} ${momoNumber.slice(-4).padStart(momoNumber.length, '*')}) as primary subscription billing method. Plan updated to ${billingPlan}.`,
          type: "success"
        },
        ...prev
      ]);

      setMomoInvoices(prev => [
        {
          id: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
          date: new Date().toISOString().split('T')[0],
          description: `TrustBuilder ${billingPlan} Activation`,
          amount: billingPlan.includes("49") ? "$49.00" : billingPlan.includes("99") ? "$99.00" : billingPlan.includes("149") ? "$149.00" : "$0.00",
          status: "paid",
          method: `${momoProvider} Cashless`
        },
        ...prev
      ]);

      setIsVerifyingMomo(false);
      setMomoVerificationStep("success");
      setPaymentSuccessMessage(`Success! Your business account is active on the ${billingPlan}. Your verified Mobile Money number (${momoCountry} ${momoNumber}) will be billed.`);
    } catch (err) {
      setIsVerifyingMomo(false);
      handleFirestoreError(err, OperationType.UPDATE, `spaces/${selectedSpace.id}`);
    }
  };

  const handleDisconnectMomo = async () => {
    if (!selectedSpace) return;
    setIsVerifyingMomo(true);
    setMomoError("");

    try {
      const spaceDocRef = doc(db, "spaces", selectedSpace.id);
      const updatedPaymentMethod = {
        type: "none" as const,
        status: "unverified" as const
      };

      await updateDoc(spaceDocRef, {
        paymentMethod: updatedPaymentMethod
      });

      const refreshedSpace = {
        ...selectedSpace,
        paymentMethod: updatedPaymentMethod
      };
      setSelectedSpace(refreshedSpace);
      setSpaces(prev => prev.map(s => s.id === selectedSpace.id ? refreshedSpace : s));

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `momo-disconnect-${Date.now()}`,
          timestamp,
          integration: "Mobile Money billing",
          message: `Disconnected Mobile Money billing details from your business account profile.`,
          type: "warning"
        },
        ...prev
      ]);

      setIsVerifyingMomo(false);
      setMomoVerificationStep("idle");
      setMomoNumber("");
      setMomoAccountName("");
    } catch (err) {
      setIsVerifyingMomo(false);
      handleFirestoreError(err, OperationType.UPDATE, `spaces/${selectedSpace.id}`);
    }
  };

  // Auth Operations
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      alert("Google Sign-In failed: " + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      const ownerId = currentUser ? currentUser.uid : GUEST_UID;
      sessionStorage.removeItem(`2fa_verified_${ownerId}`);
      setSession2FAVerified(false);
      
      await signOut(auth);
      setSelectedSpace(null);
      setCampaigns([]);
      setTestimonials([]);
      setWidgets([]);
      setSelectedWidget(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Seeding Logic
  const handleSeedMockData = async () => {
    if (!selectedSpace) return;
    try {
      setSeeding(true);
      
      // Ensure we have campaigns to associate testimonials with
      let targetCampId = campaigns[0]?.id;
      if (!targetCampId) {
        const defaultCampId = "camp-" + Math.random().toString(36).slice(2, 9);
        const defaultCampaign: Campaign = {
          id: defaultCampId,
          spaceId: selectedSpace.id,
          title: "General Client Feedback Collection",
          slug: "acme-review",
          status: "active",
          heading: "Share your onboarding story!",
          subheading: "We love hearing your feedback. Take 15 seconds to review.",
          questions: ["What did you like?", "How has our product helped you?"],
          collectDetails: { rating: true, title: true, company: true, socialUrl: true, avatarUrl: true },
          thankYouTitle: "Thanks for backing us!",
          thankYouMessage: "We've registered your review.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, "campaigns", defaultCampId), defaultCampaign);
        targetCampId = defaultCampId;
      }

      // Populate Testimonials
      for (const item of SEED_TESTIMONIALS) {
        await addDoc(collection(db, "testimonials"), {
          ...item,
          campaignId: targetCampId,
          spaceId: selectedSpace.id,
          createdAt: new Date().toISOString()
        });
      }

      await loadWorkspaceData();
    } catch (err) {
      console.error(err);
      alert("Failed to seed workspace demo content.");
    } finally {
      setSeeding(false);
    }
  };

  // Custom Domain Mapping database persistence handler
  const handleSaveDomainConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringDomainCampaign) return;
    setDomainVerificationError("");
    
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    const cleanDomain = tempCustomDomain.trim().toLowerCase();
    if (cleanDomain && !domainRegex.test(cleanDomain)) {
      setDomainVerificationError("Invalid domain format. Example: reviews.company.com");
      return;
    }

    try {
      setDbLoading(true);
      const campaignRef = doc(db, "campaigns", configuringDomainCampaign.id);
      
      const updatedFields = {
        customDomain: cleanDomain || null,
        customDomainStatus: cleanDomain ? "pending" as const : null,
        dnsRecordValue: cleanDomain ? `cname.trustbuilder.com` : null,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(campaignRef, updatedFields as any);
      
      setCampaigns(prev => prev.map(c => c.id === configuringDomainCampaign.id ? { ...c, ...updatedFields } : c));
      
      if (configuringDomainCampaign) {
        setConfiguringDomainCampaign(prev => prev ? { ...prev, ...updatedFields } : null);
      }
      
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `domain-config-${Date.now()}`,
          timestamp,
          integration: "Cloud DNS Infrastructure",
          message: cleanDomain 
            ? `[CUSTOM-DOMAIN] Registered custom domain "${cleanDomain}" for "${configuringDomainCampaign.title}". Configure DNS to activate.` 
            : `[CUSTOM-DOMAIN] Domain mapping removed for "${configuringDomainCampaign.title}"`,
          type: "info"
        },
        ...prev
      ]);
    } catch (err: any) {
      console.error("Error setting up custom domain:", err);
      alert("Could not update custom domain config: " + err.message);
    } finally {
      setDbLoading(false);
    }
  };

  // Test simulation of DNS Propagation resolver
  const handleSimulateDnsVerification = async () => {
    if (!configuringDomainCampaign || !configuringDomainCampaign.customDomain) return;
    setIsVerifyingDomain(true);
    setDomainVerificationError("");
    
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    try {
      const campaignRef = doc(db, "campaigns", configuringDomainCampaign.id);
      const updatedFields = {
        customDomainStatus: "active" as const,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(campaignRef, updatedFields as any);
      
      setCampaigns(prev => prev.map(c => c.id === configuringDomainCampaign.id ? { ...c, ...updatedFields } : c));
      if (configuringDomainCampaign) {
        setConfiguringDomainCampaign(prev => prev ? { ...prev, ...updatedFields } : null);
      }
      
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `dns-verify-${Date.now()}`,
          timestamp,
          integration: "Cloud DNS Infrastructure",
          message: `[CUSTOM-DOMAIN] Custom domain mapping "${configuringDomainCampaign.customDomain}" verification SUCCESS. Domain is now LIVE and serving traffic!`,
          type: "success"
        },
        ...prev
      ]);
    } catch (err: any) {
      console.error("Error verifying propagation:", err);
      setDomainVerificationError("Verification simulation failed: " + err.message);
    } finally {
      setIsVerifyingDomain(false);
    }
  };

  // Campaign post-submission automated auto-responder email template configuration handler
  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringEmailCampaign) return;
    try {
      setDbLoading(true);
      const campaignRef = doc(db, "campaigns", configuringEmailCampaign.id);
      const updatedFields = {
        thankYouEmailEnabled: configuringEmailCampaign.thankYouEmailEnabled !== false,
        thankYouEmailSubject: configuringEmailCampaign.thankYouEmailSubject || "Thank you for sharing your experience with us, {name}!",
        thankYouEmailBody: configuringEmailCampaign.thankYouEmailBody || "",
        thankYouEmailSender: configuringEmailCampaign.thankYouEmailSender || "",
        updatedAt: new Date().toISOString()
      };
      await updateDoc(campaignRef, updatedFields);
      
      // Update local state
      setCampaigns(prev => prev.map(c => c.id === configuringEmailCampaign.id ? { ...c, ...updatedFields } : c));
      setConfiguringEmailCampaign(null);
      
      // Log event in sync logs feed so user gets real-time success context
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `email-config-${Date.now()}`,
          timestamp,
          integration: "SMTP Transactional Carrier",
          message: `[AUTO-REPLY] Updated Thank-You automated templates for "${configuringEmailCampaign.title}" successfully. Ready to trigger post-submission.`,
          type: "success"
        },
        ...prev
      ]);
    } catch (err: any) {
      console.error("Error setting up campaign automated email config:", err);
      alert("Could not save email auto-responder layout: " + err.message);
    } finally {
      setDbLoading(false);
    }
  };

  // Gemini Automated Social Copywriter submission handler
  const handleGenerateSocialCopy = async (toneOverride?: string) => {
    if (!socialCopyReview) return;
    const activeTone = toneOverride || socialCopyTone;
    setSocialCopyLoading(true);
    setSocialCopyError(null);
    setSocialCopyResult(null);
    try {
      const res = await fetch("/api/gemini/generate-social-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testimonial: socialCopyReview,
          companyName: selectedSpace?.name || "our company",
          tone: activeTone
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to trigger AI Copywriter on server.");
      }
      setSocialCopyResult(data.payload);
      
      // Log event in sync logs feed so user gets real-time success context
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `social-copy-${Date.now()}`,
          timestamp,
          integration: "Gemini AI Copywriter",
          message: `Generated custom ${activeTone} social marketing copy representing "${socialCopyReview.name}".`,
          type: "success"
        },
        ...prev
      ]);
    } catch (err: any) {
      console.error("AI Copywriter error:", err);
      setSocialCopyError(err.message || "An unexpected error occurred during copy generation.");
    } finally {
      setSocialCopyLoading(false);
    }
  };

  // Raw Review Rewriter endpoint trigger handler
  const handleRewriteRawReview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rewriterRawReview.trim()) {
      setRewriterError("Please enter some review content to rewrite.");
      return;
    }
    setRewriterLoading(true);
    setRewriterError(null);
    setRewriterResult(null);
    try {
      const res = await fetch("/api/gemini/rewrite-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawReview: rewriterRawReview,
          companyName: selectedSpace?.name || "our company",
          tone: rewriterTone,
          format: rewriterFormat
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to rewrite review.");
      }
      setRewriterResult(data.payload);
      
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `rewriter-${Date.now()}`,
          timestamp,
          integration: "Gemini AI Rewriter",
          message: `Successfully rewrote custom raw feedback with ${rewriterTone} tone format.`,
          type: "success"
        },
        ...prev
      ]);
    } catch (err: any) {
      console.error("AI Rewriter Error:", err);
      setRewriterError(err.message || "An error occurred during raw review rewriting.");
    } finally {
      setRewriterLoading(false);
    }
  };

  // Campaign management operations
  const handleCreateCampaign = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSpace) return;
    if (!newCampTitle.trim() || !newCampSlug.trim()) {
      alert("Title and unique URL Slug are required.");
      return;
    }

    const cleanSlug = newCampSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "");

    // Determine custom preset questions for Salesforce, E-commerce, B2B Sales, or General SaaS
    let questions: string[] = [];
    if (campaignTemplate === "salesforce") {
      questions = [
        "How well does our platform streamline your Salesforce contact/lead sync?",
        "Which CRM productivity metrics or flow improved the most for your team?",
        "Would you recommend our automated Salesforce features to other operations?"
      ];
    } else if (campaignTemplate === "ecommerce") {
      questions = [
        "Were you satisfied with overall checkout transparency and delivery speed?",
        "How well did the product packaging protect your ordered items?",
        "How likely are you to choose our e-commerce store for your future needs?"
      ];
    } else if (campaignTemplate === "b2b") {
      questions = [
        "What specific ROI percentage or direct cost-reduction did you achieve?",
        "How helpful was our enterprise B2B sales/onboarding team?",
        "How has our service helped your internal leadership justify this subscription?"
      ];
    } else {
      questions = [
        "How did our platform save you time this week?",
        "What specific result or metrics were you able to achieve?",
        "What excelled in comparison to alternative solutions?"
      ];
    }

    try {
      setDbLoading(true);
      const campId = "camp-" + Math.random().toString(36).slice(2, 9);
      const newCampaign: Campaign = {
        id: campId,
        spaceId: selectedSpace.id,
        title: newCampTitle.trim(),
        slug: cleanSlug,
        status: "active",
        heading: newCampHeading.trim(),
        subheading: newCampSubheading.trim(),
        questions,
        collectDetails: {
          rating: true,
          title: true,
          company: true,
          socialUrl: true,
          avatarUrl: true
        },
        thankYouTitle: "Review Registered!",
        thankYouMessage: "Thank you for validating our business. Your story helps our team continue pushing boundaries.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, "campaigns", campId), newCampaign);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `campaigns/${campId}`);
        return;
      }
      setShowCampaignModal(false);
      setNewCampTitle("");
      setNewCampSlug("");
      await loadWorkspaceData();
    } catch (err) {
      console.error(err);
    } finally {
      setDbLoading(false);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Are you positive you wish to delete this collection campaign and form link? submitted reviews will remain intact.")) return;
    try {
      setDbLoading(true);
      try {
        await deleteDoc(doc(db, "campaigns", campaignId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `campaigns/${campaignId}`);
        return;
      }
      await loadWorkspaceData();
    } catch (err) {
      console.error(err);
    } finally {
      setDbLoading(false);
    }
  };

  // Testimonial Approval workflows
  const handleUpdateReviewStatus = async (item: Testimonial, status: "approved" | "archived" | "new") => {
    try {
      const ref = doc(db, "testimonials", item.id);
      await updateDoc(ref, { status });
      await loadWorkspaceData();

      if (status === "approved") {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newLogs: typeof syncLogs = [];

        if (salesforceConnected) {
          newLogs.push({
            id: `sf-${Math.random().toString(36).slice(2, 9)}`,
            timestamp,
            integration: "Salesforce CRM",
            message: `Synced review from ${item.name} (${item.company || "Guest"}) into Salesforce ${salesforceObject} record pipeline successfully.`,
            type: "success"
          });
        }
        if (ecommerceConnected) {
          newLogs.push({
            id: `eco-${Math.random().toString(36).slice(2, 9)}`,
            timestamp,
            integration: "E-commerce Sync",
            message: `Synced rating profile to ${ecommercePlatform} store (${ecommerceStoreUrl}) as a verified live widget review.`,
            type: "success"
          });
        }
        if (b2bConnected) {
          newLogs.push({
            id: `b2b-${Math.random().toString(36).slice(2, 9)}`,
            timestamp,
            integration: "B2B Sales Support",
            message: `Auto-generated deal/case validation card matching target pipeline: "${b2bPipeline}" with review text.`,
            type: "success"
          });
        }

        if (newLogs.length > 0) {
          setSyncLogs((prev) => [...newLogs, ...prev]);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `testimonials/${item.id}`);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm("Delete this review completely from database? This is irreversible.")) return;
    try {
      await deleteDoc(doc(db, "testimonials", reviewId));
      await loadWorkspaceData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `testimonials/${reviewId}`);
    }
  };

  const handleAddTagToTestimonial = async (item: Testimonial, tagName: string) => {
    const tag = tagName.trim();
    if (!tag) return;
    const currentTags = item.tags && Array.isArray(item.tags) ? item.tags : [];
    if (currentTags.includes(tag)) return;
    const updatedTags = [...currentTags, tag];
    try {
      const ref = doc(db, "testimonials", item.id);
      await updateDoc(ref, { tags: updatedTags });
      await loadWorkspaceData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `testimonials/${item.id}`);
    }
  };

  const handleRemoveTagFromTestimonial = async (item: Testimonial, tagToRemove: string) => {
    const currentTags = item.tags && Array.isArray(item.tags) ? item.tags : [];
    const updatedTags = currentTags.filter((t) => t !== tagToRemove);
    try {
      const ref = doc(db, "testimonials", item.id);
      await updateDoc(ref, { tags: updatedTags });
      await loadWorkspaceData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `testimonials/${item.id}`);
    }
  };

  // Visual customizer updates
  const handleUpdateWidgetConfig = async (updatedFields: Partial<Widget>) => {
    if (!selectedWidget) return;
    const merged = { ...selectedWidget, ...updatedFields } as Widget;
    setSelectedWidget(merged);

    // Debounced or direct sync to db
    try {
      await setDoc(doc(db, "widgets", selectedWidget.id), merged);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `widgets/${selectedWidget.id}`);
    }
  };

  const handleCreateNewWidgetType = async (type: "grid" | "carousel" | "single" | "badge") => {
    if (!selectedSpace) return;
    try {
      setDbLoading(true);
      const widId = "widget-" + Math.random().toString(36).slice(2, 9);
      const names = {
        grid: "Wall of Love Grid Layout",
        carousel: "Horizontal Swiper Carousel",
        single: "Hero Spotlight Quote",
        badge: "Compact Star Badge"
      };

      const newWidget: Widget = {
        id: widId,
        spaceId: selectedSpace.id,
        name: names[type],
        type,
        theme: "light",
        campaignIds: campaigns.map(c => c.id),
        styles: {
          backgroundColor: "#ffffff",
          textColor: "#0f172a",
          cardBgColor: "#f8fafc",
          ratingColor: "#eab308",
          borderRadius: "lg",
          borderStyle: "subtle",
          enableGridAnimation: true
        },
        limit: 12,
        showRating: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, "widgets", widId), newWidget);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `widgets/${widId}`);
        return;
      }
      setSelectedWidget(newWidget);
      await loadWorkspaceData();
    } catch (err) {
      console.error(err);
    } finally {
      setDbLoading(false);
    }
  };

  // Server-side Gemini AI summarizer trigger
  const handleTriggerAISynthesis = async () => {
    const approvedReviews = testimonials.filter(t => t.status === "approved");
    if (approvedReviews.length === 0) {
      setAiError("You need at least 1 Approved review to generate AI Marketing insights. Approve some reviews first!");
      return;
    }

    try {
      setAiLoading(true);
      setAiError(null);
      setAiResult(null);

      const res = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testimonials: approvedReviews,
          companyName: selectedSpace?.name || "our client"
        })
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || "Network error proxying request.");
      }

      const payload = await res.json();
      setAiResult(payload);
    } catch (err: any) {
      setAiError(err.message || "Failed running copywriting copilot.");
    } finally {
      setAiLoading(false);
    }
  };

  // Helper trigger to copy utility triggers
  const triggerCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Aggregate review stats
  const approvedList = testimonials.filter(t => t.status === "approved");
  const averageRating = approvedList.length > 0
    ? (approvedList.reduce((acc, curr) => acc + curr.rating, 0) / approvedList.length).toFixed(1)
    : "0.0";

  // Extract all unique tags in currently fetched testimonials for filtering/managing
  const allTags = React.useMemo(() => {
    const tagsSet = new Set<string>();
    testimonials.forEach((t) => {
      if (t.tags && Array.isArray(t.tags)) {
        t.tags.forEach((tag) => {
          const cleaned = tag.trim();
          if (cleaned) tagsSet.add(cleaned);
        });
      }
    });
    return Array.from(tagsSet);
  }, [testimonials]);

  // Filter reviews
  const filteredTestimonials = testimonials.filter((t) => {
    const term = reviewSearch.toLowerCase().trim();
    const searchMatch = t.name.toLowerCase().includes(term) || t.content.toLowerCase().includes(term) || (t.company && t.company.toLowerCase().includes(term));
    if (!searchMatch) return false;

    // Filter by tag if selected
    if (selectedTagFilter) {
      if (!t.tags || !Array.isArray(t.tags) || !t.tags.includes(selectedTagFilter)) {
        return false;
      }
    }

    if (reviewFilter === "all") return true;
    if (reviewFilter === "approved" || reviewFilter === "archived" || reviewFilter === "new") return t.status === reviewFilter;
    if (reviewFilter === "Positive") return t.rating >= 4;
    if (reviewFilter === "Neutral") return t.rating === 3;
    if (reviewFilter === "Negative") return t.rating <= 2;
    return true;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-slate-450 text-sm font-semibold">
          <Loader className="w-8 h-8 animate-spin mx-auto text-emerald-400 mb-2.5" />
          Securing workspace session...
        </div>
      </div>
    );
  }

  // Two-Factor Authentication Blocker-Challenge Gate
  if (twoFactorConfig?.twoFactorEnabled && !session2FAVerified) {
    const expectedCode = getVerificationCode();
    return (
      <div className="min-h-screen bento-grid-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-8 max-w-md w-full space-y-6 relative overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-600 absolute top-0 left-0 right-0" />
          
          <div className="text-center space-y-2">
            <div className="h-14 w-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-sm">
              <UserCheck className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight font-sans">Two-Factor Authentication</h2>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Your account security policy is set to high. Enter the 6-digit confirmation key to unlock your TrustBuilder dashboard workspace.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-left space-y-2.5">
            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider block font-mono">
              Verification Method
            </span>
            <div className="flex items-center gap-3">
              {twoFactorConfig.twoFactorType === "app" ? (
                <>
                  <div className="h-8 w-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center text-xs font-bold leading-none">📱</div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Authenticator App</h4>
                    <p className="text-[10px] text-slate-400 font-semibold">Enter the 6-digit code cycling on your device</p>
                  </div>
                </>
              ) : twoFactorConfig.twoFactorType === "sms" ? (
                <>
                  <div className="h-8 w-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-xs font-bold leading-none">💬</div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">SMS Verification</h4>
                    <p className="text-[10px] text-slate-400 font-semibold font-mono">Sent to {twoFactorConfig.phoneNumber || "your phone number"}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-8 w-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-xs font-bold leading-none">✉️</div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Email Verification</h4>
                    <p className="text-[10px] text-slate-400 font-semibold">{twoFactorConfig.emailAddress}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Enter 6-Digit Passcode</label>
              <input
                type="text"
                maxLength={6}
                value={twoFactorVerificationCode}
                onChange={(e) => setTwoFactorVerificationCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000 000"
                className="w-full tracking-widest text-center text-2xl font-black font-mono bg-slate-50 hover:bg-slate-100 focus:bg-white border-2 border-slate-200 focus:border-indigo-500 outline-none rounded-xl py-3.5 transition-all text-slate-900"
              />
            </div>

            {twoFactorVerificationError && (
              <div className="bg-rose-50 text-rose-800 border-2 border-rose-100/50 p-3 rounded-xl text-xs font-semibold leading-relaxed animate-fade-in flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{twoFactorVerificationError}</span>
              </div>
            )}

            <button
              onClick={handleVerifyChallengeCode}
              disabled={twoFactorVerificationCode.length !== 6}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl py-3.5 font-bold text-sm tracking-wide shadow-md transition-all active:scale-98 cursor-pointer disabled:cursor-not-allowed"
            >
              Verify & Enter Workspace
            </button>
          </div>

          {/* Dynamic timer display + Auto-bypass tracker helper */}
          <div className="pt-4 border-t border-slate-100 space-y-2 text-left">
            <span className="text-[9px] font-black uppercase text-amber-600 tracking-wider flex items-center gap-1">
              ✨ Sandbox Security Help Tracker
            </span>
            <div className="bg-amber-50/50 border border-amber-200/55 p-3 rounded-xl space-y-1.5 text-[10px] leading-relaxed">
              <div className="flex justify-between items-center text-amber-850">
                <span className="font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" /> 
                  Active OTP Code:
                </span>
                <span className="font-black font-mono tracking-wider text-xs bg-amber-100 hover:bg-amber-200/70 border border-amber-300 rounded px-1.5 py-0.5 cursor-pointer" onClick={() => setTwoFactorVerificationCode(expectedCode)}>
                  {expectedCode} (click)
                </span>
              </div>
              
              {twoFactorConfig.twoFactorType === "app" && (
                <div className="flex justify-between items-center text-[9px] text-slate-500">
                  <span>Code refreshes in:</span>
                  <span className="font-mono font-bold text-slate-700">{totpCountdown}s</span>
                </div>
              )}

              <p className="text-[9px] text-slate-550 leading-normal font-semibold">
                Click the code to copy or simulate code entry. You can also test backups: <strong className="font-mono text-slate-800 font-bold">{twoFactorConfig.backupCodes.slice(0, 3).join(", ")}</strong>.
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={handleLogout}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer transition-all flex items-center gap-1 mx-auto"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out from active session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Visual Dashboard Wrapper
  return (
    <div className="min-h-screen bento-grid-bg text-slate-900 flex flex-col font-sans antialiased">
      
      {/* Platform Header Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/75 border-b border-slate-200/60 px-6 sm:px-8 py-4 flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/10 hover:scale-105 transition-transform duration-200">
            <Sparkles className="w-5.5 h-5.5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-slate-950 leading-none">TrustBuilder SaaS</h1>
            <p className="text-[10px] font-black text-slate-450 tracking-wider uppercase mt-1">Social Proof Ecosystem</p>
          </div>
        </div>

        {/* Space Selection Dropdown & Profile */}
        <div className="flex items-center gap-4">
          
          {selectedSpace && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-100/60 border border-slate-200/60 px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-slate-700 shadow-xs hover:bg-slate-100 transition-colors">
              <Building className="w-4 h-4 text-emerald-500" />
              <span>{selectedSpace.name}</span>
            </div>
          )}

          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:block text-right">
                <span className="text-xs font-bold text-slate-805 block text-ellipsis overflow-hidden max-w-40">{currentUser.displayName || currentUser.email}</span>
                <span className="text-[9px] font-black tracking-wider uppercase text-slate-400">Merchant Account</span>
              </div>
              <img src={currentUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"} alt="User Avatar" className="w-9 h-9 rounded-full border-2 border-emerald-400 shadow-md shrink-0 object-cover" />
              <button 
                onClick={handleLogout}
                className="p-2 rounded-xl border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:bg-white cursor-pointer transition-all shadow-xs hover:border-slate-350"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-slate-850 text-white rounded-xl font-extrabold text-xs shadow-md transition-all active:scale-98 hover:-translate-y-0.5 cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-emerald-400" /> Sign In with Google
              </button>
              <span className="text-[10px] font-black tracking-widest text-emerald-700 uppercase bg-emerald-50 border border-emerald-100/50 px-2.5 py-1.5 rounded-xl shadow-xs">
                Guest Arena
              </span>
            </div>
          )}

        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar Controls Grid */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Quick Metrics Panel */}
          <div className="bento-card-glass rounded-3xl p-6 border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] space-y-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
              <Database className="w-4.5 h-4.5 text-indigo-500" /> Proof Statistics
            </h3>
            
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-4 bg-slate-500/5 rounded-2xl border border-slate-200/30 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Reviews</span>
                  <span className="text-3xl font-black text-slate-955 tracking-tight block mt-1">{testimonials.length}</span>
                </div>
                <span className="text-[9px] text-amber-600 font-extrabold block mt-2.5 bg-amber-50 rounded-lg px-2 py-0.5 border border-amber-100/30 w-fit">{testimonials.filter(t=>t.status==='new').length} pending</span>
              </div>

              <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-600/5 border border-emerald-500/20 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-emerald-600/80 font-black uppercase tracking-wider block">Score</span>
                  <span className="text-3xl font-black text-slate-955 tracking-tight flex items-baseline gap-1 mt-1">
                    {averageRating} <span className="text-xs text-amber-500">★</span>
                  </span>
                </div>
                <span className="text-[9px] text-emerald-600 font-extrabold block mt-2.5 bg-emerald-50 rounded-lg px-2 py-0.5 border border-emerald-100/30 w-fit">{approvedList.length} live</span>
              </div>
            </div>

            {/* Campaign short information */}
            <div className="text-xs font-semibold text-slate-500 space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <span>Active Forms:</span>
                <span className="text-slate-900 font-extrabold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/40 text-[11px]">{campaigns.filter(c => c.status === "active").length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Widgets Wired:</span>
                <span className="text-slate-900 font-extrabold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/40 text-[11px]">{widgets.length}</span>
              </div>
            </div>
          </div>

          {/* Seed Quick Action if zero content is present */}
          {testimonials.length === 0 && (
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="bg-gradient-to-br from-slate-900 via-zinc-950 to-slate-950 text-white p-6 rounded-3xl shadow-[0_12px_40px_rgba(15,23,42,0.18)] border border-slate-800 space-y-4 relative overflow-hidden"
            >
              <div className="absolute right-0 bottom-0 text-white/5 opacity-40 pointer-events-none transform translate-x-8 translate-y-8">
                <Database className="w-40 h-40" />
              </div>
              <h4 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" /> Sandbox Quickstart
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                Your sandbox database is empty. Seed high-converting customer feedback reviews, avatars, tags, and layouts instantly to play with widgets.
              </p>
              <button
                onClick={handleSeedMockData}
                disabled={seeding}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-450 hover:to-teal-450 disabled:bg-slate-800 text-white text-xs font-extrabold rounded-xl shadow-md cursor-pointer transition-all active:scale-98 font-mono tracking-wider"
              >
                {seeding ? (
                  <>
                    <Loader className="w-4.5 h-4.5 animate-spin text-white" /> Seeding environment...
                  </>
                ) : (
                  <>
                    <Database className="w-4.5 h-4.5" /> DEPLOY SEED MATERIAL
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* Quick links list for embeds or forms */}
          {campaigns.length > 0 && (
            <div className="bento-card-glass rounded-3xl p-5 border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] space-y-3.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Direct Form Channels</h3>
              <div className="space-y-3">
                {campaigns.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-2xl bg-white border border-slate-200/60 shadow-inner flex flex-col gap-2">
                    <span className="text-[10px] font-black text-slate-450 uppercase tracking-tight truncate">{c.title}</span>
                    <div className="flex gap-2 items-center justify-between">
                      <span className="text-xs font-mono text-slate-600 font-extrabold truncate bg-slate-50 border border-slate-200/40 px-2 py-1 rounded-lg">/form/{c.slug}</span>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => triggerCopy(`${window.location.origin}/form/${c.slug}`, c.id)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 hover:text-slate-900 text-slate-550 border border-slate-200 transition-colors cursor-pointer"
                          title="Copy Form URL"
                        >
                          {copiedText === c.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={`/form/${c.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-550 border border-slate-200 transition-colors"
                          title="Open Form in New Tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Dashboard Workstation Portal */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Navigation Control Tabs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-1.5 bg-slate-200/50 backdrop-blur-md border border-slate-300/40 p-1.5 rounded-2xl">
            
            <button
              onClick={() => setActiveTab("campaigns")}
              className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "campaigns"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Layout className="w-4 h-4 text-indigo-500 pt-[1px]" />
              <span>Campaigns</span>
            </button>

            <button
              onClick={() => setActiveTab("testimonials")}
              className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "testimonials"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <MessageSquare className="w-4 h-4 text-teal-500 pt-[1px]" />
              <span>Inbox</span>
            </button>

            <button
              onClick={() => setActiveTab("widgets")}
              className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "widgets"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Sliders className="w-4 h-4 text-emerald-500 pt-[1px]" />
              <span>Widgets</span>
            </button>

            <button
              onClick={() => setActiveTab("ai")}
              className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "ai"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-500 pt-[1px]" />
              <span>AISpark</span>
            </button>

            <button
              onClick={() => setActiveTab("integrations")}
              className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "integrations"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-250/30"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Settings className="w-4 h-4 text-rose-500 pt-[1px]" />
              <span>Pipeline Sync</span>
            </button>

            <button
              onClick={() => setActiveTab("blueprint")}
              className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "blueprint"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-250/30 bg-gradient-to-tr from-amber-50/50 to-amber-100/30"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <TrendingUp className="w-4 h-4 text-amber-500 pt-[1px]" />
              <span className="text-amber-805">Profit Blueprint</span>
            </button>

            <button
              onClick={() => setActiveTab("billing")}
              className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "billing"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-250/30 bg-gradient-to-tr from-emerald-50/50 to-emerald-100/30"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <CreditCard className="w-4 h-4 text-emerald-500 pt-[1px]" />
              <span className="text-emerald-805">Billing & Payouts</span>
            </button>

          </div>

          {/* TAB 1: COLLECTION CAMPAIGNS */}
          {activeTab === "campaigns" && (
            <div className="space-y-6">
              
              {/* Campaigns Summary Lead */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bento-card-glass p-6 rounded-3xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                <div>
                  <h2 className="text-lg font-black text-slate-950 tracking-tight">Collection Campaigns</h2>
                  <p className="text-xs text-slate-450 font-semibold mt-1">Design customizable links to request ratings directly from buyers.</p>
                </div>
                <button
                  onClick={() => setShowCampaignModal(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-3 bg-slate-950 hover:bg-slate-850 text-white rounded-xl text-xs font-extrabold tracking-wide shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                >
                  <Plus className="w-4.5 h-4.5 text-emerald-400" /> Create Campaign
                </button>
              </div>

              {/* Creator Forms Dialog Modal Popup */}
              {showCampaignModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-lg w-full overflow-hidden"
                  >
                    <div className="h-2 bg-gradient-to-r from-emerald-500 via-indigo-500 to-indigo-700" />
                    <div className="p-6 sm:p-8 space-y-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-black text-slate-950 tracking-tight">New Testimonial request Channel</h3>
                          <p className="text-xs text-slate-405 font-bold mt-0.5">Customize fields enabling public submissions</p>
                        </div>
                        <button 
                          onClick={() => setShowCampaignModal(false)}
                          className="p-1 px-3 py-1.5 text-slate-400 hover:text-slate-900 font-extrabold border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition-colors"
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleCreateCampaign} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider block">Campaign Preset Template</label>
                          <select
                            value={campaignTemplate}
                            onChange={(e) => setCampaignTemplate(e.target.value as any)}
                            className="w-full px-4 py-3 bg-indigo-50/40 border border-indigo-200/60 rounded-xl font-extrabold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all cursor-pointer shadow-xs"
                          >
                            <option value="general">💼 General SaaS / Digital Service Review</option>
                            <option value="salesforce">☁️ Salesforce CRM Pipeline & Integration Feedback</option>
                            <option value="ecommerce">🛒 E-commerce Store Checkout & Order Review</option>
                            <option value="b2b">🤝 B2B Enterprise Strategic Deal ROI Proof</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Internal Title</label>
                          <input 
                            required 
                            type="text" 
                            value={newCampTitle} 
                            onChange={(e) => setNewCampTitle(e.target.value)} 
                            placeholder="e.g., Q2 Customer Onboarding reviews" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">URL Slug (lowercase)</label>
                            <input 
                              required 
                              type="text" 
                              value={newCampSlug} 
                              onChange={(e) => setNewCampSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} 
                              placeholder="e.g., product-review" 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            />
                          </div>
                          
                          <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 text-[11px] font-bold text-slate-500 mt-auto leading-normal">
                            Direct deployment link: <br />
                            <span className="text-indigo-600 font-mono">/form/{newCampSlug || "slug"}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Form Title Heading</label>
                          <input 
                            required 
                            type="text" 
                            value={newCampHeading} 
                            onChange={(e) => setNewCampHeading(e.target.value)} 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Supporting Caption</label>
                          <textarea 
                            required 
                            value={newCampSubheading} 
                            onChange={(e) => setNewCampSubheading(e.target.value)} 
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-extrabold text-sm shadow-md transition-all tracking-wider active:scale-98 cursor-pointer"
                        >
                          Launch Collection Campaign
                        </button>
                      </form>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Campaigns Grid cards */}
              {campaigns.length === 0 ? (
                <div className="p-16 text-center bento-card-glass rounded-3xl border border-slate-200/60 shadow-inner">
                  <Layout className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-extrabold">No active feedback campaigns created yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Create a campaign above to start collecting social proof.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {campaigns.map((c) => {
                    const submissions = testimonials.filter(t => t.campaignId === c.id);
                    return (
                      <div key={c.id} className="bento-card-glass rounded-3xl p-6 border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
                        
                        <div>
                          {/* Top row */}
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex px-2.5 py-1 rounded-xl text-[9px] font-black tracking-wider uppercase ${c.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-450 border"}`}>
                                  {c.status}
                                </span>
                              </div>
                              <h4 className="text-base font-black text-slate-950 tracking-tight leading-snug mt-2">{c.title}</h4>
                              {c.customDomain ? (
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-lg flex items-center gap-1 font-mono">
                                    <Globe className="w-3 h-3 text-indigo-500" /> {c.customDomain}
                                  </span>
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${
                                    c.customDomainStatus === "active" 
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-250 animate-fade-in" 
                                      : "bg-amber-55/20 text-amber-700 border-amber-250 animate-pulse"
                                  }`}>
                                    {c.customDomainStatus === "active" ? "Connected" : "Pending DNS Setup"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[9.5px] text-slate-400 font-bold block mt-1.5 font-mono">Default URL: /form/{c.slug}</span>
                              )}
                            </div>
                            
                            <button
                              onClick={() => handleDeleteCampaign(c.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                              title="Delete Campaign Link"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Subheading Details */}
                          <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-4 line-clamp-2">"{c.subheading}"</p>
                          
                          {/* Submissions tracking stats */}
                          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/70 border border-slate-200/50 rounded-2xl mb-5">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/25">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Total Reviews</span>
                              <span className="text-lg font-black text-slate-800 mt-0.5 block">{submissions.length}</span>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/25">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Starred Avg</span>
                              <span className="text-lg font-black text-slate-800 mt-0.5 block">
                                {submissions.length > 0 ? (submissions.reduce((acc, cr) => acc + cr.rating, 0) / submissions.length).toFixed(1) : "0.0"} <span className="text-amber-500 text-sm">★</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Direct actionable links */}
                        <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 mt-auto">
                          <div className="flex gap-2">
                            <button
                              onClick={() => triggerCopy(`${window.location.origin}/form/${c.slug}`, c.id)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 hover:bg-slate-50 text-slate-705 rounded-xl text-xs font-extrabold border border-slate-200/80 cursor-pointer transition-colors"
                            >
                              {copiedText === c.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied Link
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" /> Copy Link
                                </>
                              )}
                            </button>
                            <a
                              href={`/form/${c.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 hover:bg-slate-50 text-slate-705 rounded-xl text-xs font-extrabold border border-slate-200/80 cursor-pointer transition-colors text-center"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-500" /> Test Form
                            </a>
                          </div>

                          <button
                            onClick={() => setConfiguringEmailCampaign({
                              ...c,
                              thankYouEmailEnabled: c.thankYouEmailEnabled !== false,
                              thankYouEmailSubject: c.thankYouEmailSubject || "Thank you for sharing your experience with us, {name}!",
                              thankYouEmailSender: c.thankYouEmailSender || `${selectedSpace?.name || "The Corporate Team"}`,
                              thankYouEmailBody: c.thankYouEmailBody || `Dear {name},\n\nThank you so much for leaving a rating of {rating} on {campaign_title}! We really appreciate you taking your time to share your feedback with us:\n\n"{content}"\n\nYour review has been successfully submitted and helps us build a better experience for everyone.\n\nBest regards,\n{sender}`
                            })}
                            className="w-full inline-flex items-center justify-center gap-2 py-2 bg-indigo-50 hover:bg-indigo-105 border border-indigo-200/50 text-indigo-750/90 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                          >
                            <Mail className="w-4 h-4 text-indigo-500" /> Configure 'Thank You' Auto-Reply
                          </button>

                          <button
                            onClick={() => {
                              setConfiguringDomainCampaign(c);
                              setTempCustomDomain(c.customDomain || "");
                              setDomainVerificationError("");
                            }}
                            className="w-full inline-flex items-center justify-center gap-2 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50 text-emerald-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                          >
                            <Globe className="w-4 h-4 text-emerald-600" /> Configure Custom Domain Mapping
                          </button>

                          <button
                            onClick={() => {
                              setShareCampaign(c);
                              setRecipientName("Jane");
                              setShareTone("friendly");
                            }}
                            className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-extrabold shadow-[0_2px_10px_rgba(79,70,229,0.15)] hover:shadow-[0_4px_14px_rgba(79,70,229,0.25)] hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all cursor-pointer"
                          >
                            <Share2 className="w-4 h-4 text-emerald-300" /> Invite via Email / SMS
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {configuringEmailCampaign && (() => {
                const preview = (() => {
                  const sub = configuringEmailCampaign.thankYouEmailSubject || "Thank you for sharing your experience with us, {name}!";
                  const bdy = configuringEmailCampaign.thankYouEmailBody || `Dear {name},\n\nThank you so much for leaving a rating of {rating} on {campaign_title}! We really appreciate you taking your time to share your feedback with us:\n\n"{content}"\n\nYour review has been successfully submitted and helps us build a better experience for everyone.\n\nBest regards,\n{sender}`;
                  const snd = configuringEmailCampaign.thankYouEmailSender || "The Corporate Team";
                  
                  const mockName = "Jane Doe";
                  const mockRating = "5/5 stars (★★★★★)";
                  const mockCampTitle = configuringEmailCampaign.title || "My Feedback Form";
                  const mockContent = "This software completely revamped our customer onboarding dashboard pipeline. Highly recommend custom integrations setup!";
                  
                  return {
                    subject: sub
                      .replace(/\{name\}/g, mockName)
                      .replace(/\{rating\}/g, mockRating)
                      .replace(/\{campaign_title\}/g, mockCampTitle)
                      .replace(/\{content\}/g, mockContent)
                      .replace(/\{sender\}/g, snd),
                    body: bdy
                      .replace(/\{name\}/g, mockName)
                      .replace(/\{rating\}/g, mockRating)
                      .replace(/\{campaign_title\}/g, mockCampTitle)
                      .replace(/\{content\}/g, mockContent)
                      .replace(/\{sender\}/g, snd)
                  };
                })();

                return (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]"
                    >
                      {/* Accent Strip */}
                      <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-700 shrink-0" />
                      
                      {/* Header */}
                      <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                        <div>
                          <span className="text-[9px] font-black tracking-wider uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">Transactional Workflow</span>
                          <h3 className="text-lg font-black text-slate-950 tracking-tight mt-2 flex items-center gap-2">
                            <span>Auto 'Thank-You' Email Configurator</span>
                            <span className="text-slate-300 font-normal">|</span>
                            <span className="text-slate-450 text-xs font-bold font-mono">"{configuringEmailCampaign.title}"</span>
                          </h3>
                          <p className="text-xs text-slate-450 font-semibold mt-0.5">Automate customized, transactional verification triggers to reward customers upon testimonial completions.</p>
                        </div>
                        <button 
                          onClick={() => setConfiguringEmailCampaign(null)}
                          className="p-2 text-slate-400 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition-all"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Content Split Body */}
                      <div className="flex-1 overflow-y-auto p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                        {/* Configuration Form */}
                        <form onSubmit={handleSaveEmailConfig} className="lg:col-span-7 space-y-5">
                          {/* Enable Toggle */}
                          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-extrabold text-slate-900">Auto-Reply Status</h4>
                              <p className="text-[11px] text-slate-40/80 font-bold">Enable or disable automated emails for this campaign.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setConfiguringEmailCampaign(prev => prev ? {
                                ...prev,
                                thankYouEmailEnabled: prev.thankYouEmailEnabled === false ? true : false
                              } : null)}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
                                configuringEmailCampaign.thankYouEmailEnabled !== false 
                                  ? "bg-emerald-600 text-white border-transparent shadow-sm" 
                                  : "bg-slate-200 text-slate-500 border-transparent"
                              }`}
                            >
                              {configuringEmailCampaign.thankYouEmailEnabled !== false ? "● Active" : "○ Paused"}
                            </button>
                          </div>

                          {/* Sender Input */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block font-mono">Sender Display Name</label>
                            <input 
                              type="text"
                              value={configuringEmailCampaign.thankYouEmailSender || ""}
                              onChange={(e) => setConfiguringEmailCampaign(prev => prev ? {
                                ...prev,
                                thankYouEmailSender: e.target.value
                              } : null)}
                              placeholder="e.g., TrustBuilder Support"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            />
                            <p className="text-[10px] text-slate-450 font-bold leading-normal">This shows as the sender name on the auto-reply email.</p>
                          </div>

                          {/* Subject Input */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider block font-mono">Email Subject Line</label>
                            <input 
                              required
                              type="text"
                              value={configuringEmailCampaign.thankYouEmailSubject || ""}
                              onChange={(e) => setConfiguringEmailCampaign(prev => prev ? {
                                ...prev,
                                thankYouEmailSubject: e.target.value
                              } : null)}
                              placeholder="e.g., Thank you for sharing your experience, {name}!"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            />
                          </div>

                          {/* Body Textarea */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider block font-mono">Mail Template Body</label>
                            <textarea 
                              required
                              rows={8}
                              value={configuringEmailCampaign.thankYouEmailBody || ""}
                              onChange={(e) => setConfiguringEmailCampaign(prev => prev ? {
                                ...prev,
                                thankYouEmailBody: e.target.value
                              } : null)}
                              placeholder="Add email body text template..."
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-850 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all leading-relaxed"
                            />
                          </div>

                          {/* Instruction/Tokens Grid */}
                          <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2.5">
                            <h5 className="text-[10px] font-black text-slate-450 uppercase tracking-wider font-mono">Dynamic Merge Placeholders</h5>
                            <p className="text-[10px] text-slate-40/80 font-bold leading-normal">
                              Insert these case-sensitive key parameters in the subject or body to fetch live form payloads dynamically:
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {[
                                { key: "{name}", desc: "Customer Name" },
                                { key: "{rating}", desc: "Star Score / Stars" },
                                { key: "{campaign_title}", desc: "Campaign Title" },
                                { key: "{content}", desc: "Testimonial Content" },
                                { key: "{sender}", desc: "Sender Display Name" }
                              ].map(tok => (
                                <button
                                  key={tok.key}
                                  type="button"
                                  onClick={() => {
                                    // Insert placeholder token helper safely
                                    const bodyText = configuringEmailCampaign.thankYouEmailBody || "";
                                    const expandedBody = bodyText + " " + tok.key;
                                    setConfiguringEmailCampaign(prev => prev ? {
                                      ...prev,
                                      thankYouEmailBody: expandedBody
                                    } : null);
                                  }}
                                  className="inline-flex flex-col items-start px-2 py-1 bg-white hover:bg-slate-100/80 border border-slate-200 rounded-lg text-left cursor-pointer transition-all shrink-0"
                                  title={`Click to insert ${tok.key}`}
                                >
                                  <span className="text-[10px] font-black font-mono text-indigo-600">{tok.key}</span>
                                  <span className="text-[8px] text-slate-405 font-bold">{tok.desc}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex justify-end gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setConfiguringEmailCampaign(null)}
                              className="px-5 py-3 border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-xl text-xs font-extrabold cursor-pointer transition-all"
                            >
                              Cancel Configuration
                            </button>
                            <button
                              type="submit"
                              disabled={dbLoading}
                              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-md active:scale-98"
                            >
                              {dbLoading ? "Saving template..." : "💾 Save configured template"}
                            </button>
                          </div>
                        </form>

                        {/* Interactive Real-Time Preview Area */}
                        <div className="lg:col-span-5 flex flex-col space-y-4">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Live SMTP Email Preview</h4>
                          
                          <div className="bg-slate-900 border border-slate-950 rounded-3xl p-5 text-white flex-1 flex flex-col justify-between max-h-[580px] overflow-hidden shadow-lg">
                            {/* Envelope Header */}
                            <div className="border-b border-slate-850 pb-3.5 space-y-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full shrink-0 ${configuringEmailCampaign.thankYouEmailEnabled !== false ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`} />
                                <span className="text-[8px] font-black font-mono text-slate-400">
                                  {configuringEmailCampaign.thankYouEmailEnabled !== false ? "SMTP SERVER CARRIER PROTOCOL ACTIVE" : "AUTO-REPLY WORKFLOW CURRENTLY PAUSED"}
                                </span>
                              </div>
                              
                              <div className="space-y-1.5 font-sans text-[11px] leading-relaxed">
                                <p className="text-slate-400">
                                  <strong className="text-slate-550 font-mono">From:</strong>{" "}
                                  <span className="text-indigo-200 font-bold">"{configuringEmailCampaign.thankYouEmailSender || "The Corporate Team"}"</span>{" "}
                                  <span className="text-slate-550 font-mono">&lt;reviews@trustbuilder-automated.io&gt;</span>
                                </p>
                                <p className="text-slate-400">
                                  <strong className="text-slate-550 font-mono">To:</strong>{" "}
                                  <span className="text-indigo-200 font-semibold font-mono">jane.doe@example.com</span>
                                </p>
                                <p className="text-slate-400">
                                  <strong className="text-slate-550 font-mono">Subject:</strong>{" "}
                                  <span className="text-emerald-350 font-black">{preview.subject}</span>
                                </p>
                              </div>
                            </div>

                            {/* Email Mail Rendering Stage */}
                            <div className="flex-1 bg-slate-950 rounded-2xl p-4.5 border border-slate-900/80 my-4 text-[11px] font-mono leading-relaxed text-slate-300 overflow-y-auto whitespace-pre-wrap max-h-[300px]">
                              {preview.body || (
                                <span className="text-slate-650 italic">Add some text above to preview your beautiful transactional layout...</span>
                              )}
                            </div>

                            {/* Footer hint */}
                            <div className="border-t border-slate-850 pt-3 flex items-center justify-between text-[9px] font-mono text-slate-500">
                              <span>MIME Class: text/plain</span>
                              <span className="text-indigo-400 font-black">TrustBuilder Automated</span>
                            </div>
                          </div>
                          
                          <div className="bg-amber-50/50 border border-amber-200 text-amber-800 rounded-2xl p-4.5 space-y-1.5 text-[11px] font-semibold leading-relaxed">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block">💡 Pro Setup Tip</span>
                            <span>
                              Keep your message concise! Customers are 65% more likely to click referral links or join subscription pipelines if rewarded with crisp, direct appreciation emails.
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })()}

              {configuringDomainCampaign && (() => {
                const campaign = configuringDomainCampaign;
                const activeDomain = campaign.customDomain;
                const activeStatus = campaign.customDomainStatus || "pending";
                
                const getSubdomainPrefix = (domain: string) => {
                  const parts = domain.split('.');
                  if (parts.length > 2) {
                    return parts[0];
                  }
                  return '@';
                };

                const prefix = activeDomain ? getSubdomainPrefix(activeDomain) : "reviews";

                return (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
                    >
                      {/* Brand Header border */}
                      <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-650 shrink-0" />
                      
                      {/* Modal Header */}
                      <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0 text-left">
                        <div>
                          <span className="text-[9px] font-black tracking-wider uppercase text-emerald-700 bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded-lg">White-label URL Expansion</span>
                          <h3 className="text-lg font-black text-slate-950 tracking-tight mt-2 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-emerald-600" />
                            <span>Custom Domain Name Configuration</span>
                          </h3>
                          <p className="text-xs text-slate-450 font-semibold mt-0.5">Map reviews to your own corporate brand domain to improve buyer submit conversion rates.</p>
                        </div>
                        <button 
                          onClick={() => setConfiguringDomainCampaign(null)}
                          className="p-2 text-slate-400 hover:text-slate-900 border border-slate-205 hover:border-slate-350 rounded-xl cursor-pointer transition-all"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Modal Content */}
                      <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 text-left">
                        
                        {/* Domain Setup / Input Fields Form */}
                        <form onSubmit={handleSaveDomainConfig} className="space-y-4">
                          <div className="bg-slate-50 border border-slate-202 rounded-2xl p-4.5 space-y-3 shadow-inner">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block font-mono">Custom Hostname Target</label>
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  value={tempCustomDomain}
                                  onChange={(e) => {
                                    setTempCustomDomain(e.target.value);
                                    setDomainVerificationError("");
                                  }}
                                  placeholder="e.g. reviews.company.com"
                                  className="flex-1 px-4 py-2.5 bg-white border border-slate-205 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                                />
                                <button
                                  type="submit"
                                  disabled={dbLoading || tempCustomDomain === (campaign.customDomain || "")}
                                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-105 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-98 cursor-pointer disabled:cursor-not-allowed text-center shrink-0 min-w-28"
                                >
                                  {dbLoading ? "Updating..." : "Save Domain"}
                                </button>
                              </div>
                              <p className="text-[9.5px] text-slate-450 font-bold leading-normal text-slate-500">
                                Enter a subdomain (e.g. <strong className="text-slate-705">reviews.mybrand.com</strong>) or a dedicated apex domain. Avoid entering <code className="bg-slate-200/60 px-1 py-0.5 rounded font-bold font-mono">https://</code> or trailing slashes.
                              </p>
                            </div>

                            {domainVerificationError && (
                              <div className="bg-rose-50 text-rose-800 border border-rose-150 p-2.5 rounded-xl text-[10.5px] font-bold leading-relaxed">
                                ⚠️ {domainVerificationError}
                              </div>
                            )}
                          </div>
                        </form>

                        {/* DNS SETTINGS AND PROPAGATION TRACKER (Only if domain is registered) */}
                        {activeDomain ? (
                          <div className="space-y-5 animate-fade-in">
                            
                            {/* STATUS PANEL */}
                            <div className="border border-slate-200 rounded-2xl bg-slate-50/50 p-4.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div className="space-y-1">
                                <span className="text-[9px] font-black uppercase text-indigo-505 block font-mono">Connection Status</span>
                                <div className="flex items-center gap-2">
                                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${activeStatus === "active" ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
                                  <span className="text-xs font-extrabold text-slate-855 capitalize">
                                    {activeStatus === "active" ? "Connected (Fully Active)" : "Propagating / Pending Connection Setup"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-2 shrink-0">
                                {activeStatus !== "active" && (
                                  <button
                                    onClick={handleSimulateDnsVerification}
                                    disabled={isVerifyingDomain}
                                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-500 disabled:bg-slate-205 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-98"
                                  >
                                    {isVerifyingDomain ? (
                                      <>
                                        <Loader className="w-3.5 h-3.5 animate-spin" /> Verifying Records...
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="w-3.5 h-3.5" /> Check DNS Propagation
                                      </>
                                    )}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm("Are you confident you want to detach this custom domain mapping?")) {
                                      setTempCustomDomain("");
                                      try {
                                        setDbLoading(true);
                                        const campaignRef = doc(db, "campaigns", campaign.id);
                                        const updatedFields = {
                                          customDomain: null,
                                          customDomainStatus: null,
                                          dnsRecordValue: null,
                                          updatedAt: new Date().toISOString()
                                        };
                                        await updateDoc(campaignRef, updatedFields as any);
                                        setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, ...updatedFields } : c));
                                        setConfiguringDomainCampaign(null);
                                      } catch (err: any) {
                                        alert("Error removing domain: " + err.message);
                                      } finally {
                                        setDbLoading(false);
                                      }
                                    }
                                  }}
                                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100/80 text-rose-700 border border-rose-201 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                  title="Detach Domain"
                                >
                                  Detach
                                </button>
                              </div>
                            </div>

                            {/* CONDITIONAL HOSTING PATH EXPLANATION */}
                            <div className="bg-indigo-50/50 border border-indigo-150 p-4 rounded-xl space-y-1.5">
                              <span className="text-[9px] font-black text-indigo-605 uppercase tracking-wider block font-mono">Routing Manifest</span>
                              <div className="text-xs font-bold text-slate-805 leading-relaxed font-sans">
                                Clients visiting <code className="bg-indigo-100 text-indigo-705 px-1 py-0.5 rounded font-mono break-all font-black">https://{activeDomain}</code> will seamlessly render your <span className="text-indigo-600 font-extrabold">"{campaign.title}"</span> collection forms pipeline without visual iframe overlays.
                              </div>
                            </div>

                            {/* DNS CONFIGURATION INSTRUCTIONS TABLE */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-left">
                                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Required DNS Configuration Records</h4>
                                <span className="text-[9px] text-slate-400 font-bold">Configure inside your registrar account</span>
                              </div>

                              <div className="border border-slate-200/80 rounded-2xl overflow-hidden font-mono text-[10.5px]">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-205 text-slate-455 font-black tracking-wider uppercase text-[9px]">
                                      <th className="p-3 pl-4">Record Type</th>
                                      <th className="p-3">Host / Priority</th>
                                      <th className="p-3">Points To</th>
                                      <th className="p-3 text-right pr-4">TTL</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-slate-150 text-slate-705">
                                    <tr className="hover:bg-slate-50/60 font-semibold">
                                      <td className="p-3 pl-4">
                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 rounded px-1.5 py-0.5 font-bold">CNAME</span>
                                      </td>
                                      <td className="p-3 flex items-center gap-1.5">
                                        <span className="bg-slate-100 border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded-md text-[10px] font-black">{prefix}</span>
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(prefix);
                                            alert("DNS Host name copied!");
                                          }}
                                          className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </td>
                                      <td className="p-3 text-slate-900 font-black">
                                        <div className="flex items-center gap-1.5">
                                          <span>cname.trustbuilder.com</span>
                                          <button 
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText("cname.trustbuilder.com");
                                              alert("DNS Record destination copied!");
                                            }}
                                            className="text-slate-400 hover:text-indigo-605 cursor-pointer"
                                          >
                                            <Copy className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </td>
                                      <td className="p-3 text-right pr-4 text-slate-450 font-semibold">3600 (1H)</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>

                          </div>
                        ) : (
                          <div className="border border-dashed border-slate-202 rounded-3xl p-10 text-center space-y-3">
                            <div className="h-12 w-12 bg-slate-50 border border-slate-202 rounded-full flex items-center justify-center text-slate-350 mx-auto text-base">
                              🌐
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-black text-slate-905">No Custom hostname mapped</h4>
                              <p className="text-[10px] text-slate-450 font-semibold leading-relaxed max-w-sm mx-auto">
                                Save a hostname above in standard subdomain or main apex formats to display live DNS propagation instructions.
                              </p>
                            </div>
                          </div>
                        )}

                      </div>

                      {/* Modal Footer */}
                      <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfiguringDomainCampaign(null)}
                          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-98"
                        >
                          All Finished
                        </button>
                      </div>
                    </motion.div>
                  </div>
                );
              })()}

              {socialCopyReview && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]"
                  >
                    {/* Sparkles / Gradient Ribbon */}
                    <div className="h-2 bg-gradient-to-r from-violet-600 via-indigo-500 via-purple-500 to-pink-500 shrink-0" />
                    
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                      <div>
                        <span className="text-[9px] font-black tracking-wider uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">Gemini Copywriter Engine</span>
                        <h3 className="text-lg font-black text-slate-950 tracking-tight mt-2 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                          <span>Convert Review into Marketing Social Copy</span>
                        </h3>
                        <p className="text-xs text-slate-450 font-semibold mt-0.5">Let Gemini turn review content into highly engaging posts customized for LinkedIn, Twitter, and Instagram.</p>
                      </div>
                      <button 
                        onClick={() => setSocialCopyReview(null)}
                        className="p-2 text-slate-400 hover:text-slate-950 border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition-all"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Split View */}
                    <div className="flex-1 overflow-y-auto p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                      {/* Left: Input parameters and selected review quote */}
                      <div className="lg:col-span-5 space-y-6">
                        {/* Selected Testimonial Info card */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 uppercase font-black tracking-wide font-mono text-xs">
                              {socialCopyReview.name?.[0] || "?"}
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-slate-955 leading-tight">{socialCopyReview.name}</h4>
                              {socialCopyReview.company && (
                                <p className="text-[10px] font-bold text-slate-500">{socialCopyReview.title || "User"} @ {socialCopyReview.company}</p>
                              )}
                            </div>
                          </div>
                          
                          {/* Stars */}
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-3 h-3 ${
                                  i < socialCopyReview.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"
                                } shrink-0`} 
                              />
                            ))}
                          </div>

                          <div className="bg-white border border-slate-150 p-3 rounded-xl">
                            <p className="text-xs font-semibold text-slate-650 leading-relaxed italic">
                              "{socialCopyReview.content}"
                            </p>
                          </div>
                        </div>

                        {/* Tone Selector */}
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block font-mono">Select Marketing Style / Tone</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: "💼 Professional", value: "Professional", desc: "Insightful, analytical, polished B2B" },
                              { label: "🚀 Enthusiastic", value: "Enthusiastic", desc: "High energy, exciting, viral hooks" },
                              { label: "🎯 Punchy / Bold", value: "Punchy / Bold", desc: "Short, outcomes-focused, impact" },
                              { label: "📖 Story-driven", value: "Story-driven", desc: "Before-and-after customer journey" },
                            ].map((toneOpt) => (
                              <button
                                key={toneOpt.value}
                                type="button"
                                onClick={() => {
                                  setSocialCopyTone(toneOpt.value);
                                  // Auto regenerate if we already have a previous result to make the workflow ultra slick
                                  if (socialCopyResult) {
                                    handleGenerateSocialCopy(toneOpt.value);
                                  }
                                }}
                                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                                  socialCopyTone === toneOpt.value 
                                    ? "bg-indigo-50 border-indigo-300 text-indigo-950 ring-2 ring-indigo-100/50" 
                                    : "bg-white hover:bg-slate-50 border-slate-200 text-slate-705"
                                }`}
                              >
                                <span className="text-[11px] font-extrabold block">{toneOpt.label}</span>
                                <span className="text-[9px] text-slate-450 leading-normal font-semibold block mt-0.5">{toneOpt.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Brand override context info */}
                        <div className="space-y-1.5 bg-indigo-50/40 border border-indigo-100/30 p-4 rounded-2xl">
                          <h5 className="text-[10px] font-black text-indigo-950 uppercase tracking-wider font-mono">Brand Context</h5>
                          <p className="text-[10px] text-slate-500 font-semibold leading-normal">
                            Generated media copies will target the active workspace brand name: 
                            <strong className="text-indigo-900 ml-1">"{selectedSpace?.name || "our company"}"</strong>.
                          </p>
                        </div>

                        {/* Core Trigger Button */}
                        <button
                          onClick={() => handleGenerateSocialCopy()}
                          disabled={socialCopyLoading}
                          className="w-full py-3.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-slate-300 disabled:to-slate-400 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
                        >
                          {socialCopyLoading ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin text-white" />
                              <span>Structuring post drafts...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-white animate-pulse" />
                              <span>{socialCopyResult ? "🔄 Regenerate copy drafts" : "✨ Write Social Campaign copies"}</span>
                            </>
                          )}
                        </button>

                        {socialCopyError && (
                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2.5 items-start text-left text-rose-800 text-xs">
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <div className="font-semibold">{socialCopyError}</div>
                          </div>
                        )}
                      </div>

                      {/* Right: Output view cards per platform */}
                      <div className="lg:col-span-7 flex flex-col space-y-4 min-h-[350px]">
                        {!socialCopyResult && !socialCopyLoading && (
                          <div className="flex-1 border-2 border-dashed border-slate-205 rounded-3xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50">
                            <div className="p-4 bg-indigo-50 rounded-full text-indigo-600 mb-4 shadow-xs">
                              <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
                            </div>
                            <h4 className="text-xs font-black text-slate-850 uppercase tracking-wider">Unleash social copy power</h4>
                            <p className="text-xs text-slate-450 font-bold max-w-sm mt-1 leading-relaxed">
                              Select your preferred brand copy style tone on the left pane and hit generate to draft beautiful verified customer posts.
                            </p>
                          </div>
                        )}

                        {socialCopyLoading && (
                          <div className="flex-1 flex flex-col items-center justify-center text-center border border-slate-100 rounded-3xl p-12 bg-slate-50/30">
                            <div className="relative mb-6">
                              <div className="absolute inset-0 rounded-full bg-indigo-400/20 blur-xl animate-pulse" />
                              <Loader className="w-12 h-12 text-indigo-600 animate-spin relative" />
                            </div>
                            <h4 className="text-xs font-black text-slate-855 uppercase tracking-wider font-mono">Generating layouts</h4>
                            <p className="text-xs text-slate-450 font-bold max-w-xs mt-1 leading-relaxed">
                              Gemini is currently analyzing testimonial context strings and translating them into dynamic B2B social headlines...
                            </p>
                            
                            {/* Dummy lines pulsing animation */}
                            <div className="mt-6 w-full max-w-sm space-y-2">
                              <div className="h-3 bg-slate-200/80 rounded animate-pulse w-3/4 mx-auto" />
                              <div className="h-3 bg-slate-200/80 rounded animate-pulse w-5/6 mx-auto" />
                              <div className="h-3 bg-slate-200/80 rounded animate-pulse w-1/2 mx-auto" />
                            </div>
                          </div>
                        )}

                        {socialCopyResult && (
                          <div className="space-y-5 animate-fade-in flex-1 flex flex-col justify-between">
                            {/* High level key summary hook banner */}
                            <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl text-indigo-950 font-semibold text-xs leading-relaxed">
                              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block mb-1">💡 Suggested Angle / Value Hook</span>
                              "{socialCopyResult.valueHook}"
                            </div>

                            {/* Accordion list / tabs for platforms */}
                            <div className="space-y-4">
                              {/* LinkedIn card */}
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                                <div className="p-3.5 bg-white border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50/50 to-white">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                      <Linkedin className="w-4 h-4 fill-blue-600" />
                                    </div>
                                    <span className="text-xs font-black text-slate-900 font-mono tracking-wide">LinkedIn Professional Blueprint</span>
                                  </div>
                                  <button
                                    onClick={() => triggerCopy(socialCopyResult.linkedin, "copysocial-li")}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 hover:text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    {copiedText === "copysocial-li" ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-emerald-700">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy draft</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <div className="p-4 bg-white">
                                  <textarea
                                    className="w-full text-xs font-sans font-medium text-slate-700 leading-relaxed bg-slate-50/50 border border-slate-150 p-3 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none resize-y"
                                    rows={5}
                                    value={socialCopyResult.linkedin}
                                    onChange={(e) => setSocialCopyResult((prev: any) => ({ ...prev, linkedin: e.target.value }))}
                                  />
                                </div>
                              </div>

                              {/* Twitter/X card */}
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                                <div className="p-3.5 bg-white border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50/50 to-white">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-950 text-white rounded-lg">
                                      <Twitter className="w-4 h-4 fill-white" />
                                    </div>
                                    <span className="text-xs font-black text-slate-900 font-mono tracking-wide">X / Twitter Punchy snippet</span>
                                  </div>
                                  <button
                                    onClick={() => triggerCopy(socialCopyResult.twitter, "copysocial-tw")}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-205 text-slate-650 hover:text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    {copiedText === "copysocial-tw" ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-emerald-700">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy draft</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <div className="p-4 bg-white">
                                  <textarea
                                    className="w-full text-xs font-sans font-medium text-slate-700 leading-relaxed bg-slate-50/50 border border-slate-150 p-3 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none resize-y"
                                    rows={3}
                                    value={socialCopyResult.twitter}
                                    onChange={(e) => setSocialCopyResult((prev: any) => ({ ...prev, twitter: e.target.value }))}
                                  />
                                  <div className="mt-1 flex justify-end text-[9px] font-black font-mono text-slate-450 uppercase">
                                    <span>{socialCopyResult.twitter.length} Characters {socialCopyResult.twitter.length > 280 ? "⚠️ Length Warning" : ""}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Instagram / Facebook card */}
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                                <div className="p-3.5 bg-white border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50/50 to-white">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                                      <Instagram className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-black text-slate-900 font-mono tracking-wide">Instagram Rich Showcase</span>
                                  </div>
                                  <button
                                    onClick={() => triggerCopy(socialCopyResult.instagram, "copysocial-ig")}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 hover:text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    {copiedText === "copysocial-ig" ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-emerald-700">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy draft</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <div className="p-4 bg-white">
                                  <textarea
                                    className="w-full text-xs font-sans font-medium text-slate-700 leading-relaxed bg-slate-50/50 border border-slate-150 p-3 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none resize-y"
                                    rows={4}
                                    value={socialCopyResult.instagram}
                                    onChange={(e) => setSocialCopyResult((prev: any) => ({ ...prev, instagram: e.target.value }))}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Pro setup hint */}
                            <div className="bg-amber-50/55 border border-amber-200 text-amber-800 rounded-2xl p-4 space-y-1 text-[11px] font-semibold leading-relaxed text-left mt-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block">💡 Social amplification tip</span>
                              <span>You can edit these templates directly above if you want custom tweaks! Real customer testimonials receive up to 340% higher click-through rates on digital advertising campaigns compared to traditional editorial sales copy.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

              {shareCampaign && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
                  >
                    {/* Header accent line */}
                    <div className="h-2 bg-gradient-to-r from-emerald-500 via-indigo-500 to-indigo-700 shrink-0" />
                    
                    {/* Header titles */}
                    <div className="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
                      <div>
                        <h3 className="text-lg font-black text-slate-950 tracking-tight flex items-center gap-2">
                          <Share2 className="w-5 h-5 text-indigo-500" /> Share Invitation Templates
                        </h3>
                        <p className="text-xs text-slate-405 font-bold mt-0.5 animate-pulse">
                          Invite customers or buyers using pre-filled professional drafts.
                        </p>
                      </div>
                      <button 
                        onClick={() => setShareCampaign(null)}
                        className="p-1 px-3 py-1.5 text-slate-400 hover:text-slate-900 font-extrabold border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Form content scrollable area */}
                    <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
                      
                      {/* Configuration customization values */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Client Recipient Name</label>
                          <input 
                            type="text" 
                            value={recipientName} 
                            onChange={(e) => setRecipientName(e.target.value)} 
                            placeholder="e.g., Jane" 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sender Sign-off Name</label>
                          <input 
                            type="text" 
                            value={senderName} 
                            onChange={(e) => setSenderName(e.target.value)} 
                            placeholder="e.g., Team" 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Tone presets preference selections */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Template Tone / Style</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: "friendly", label: "😊 Friendly" },
                            { id: "professional", label: "💼 Professional" },
                            { id: "incentive", label: "🌟 Showcase" },
                            { id: "sms", label: "📱 SMS/Short" }
                          ].map((tone) => (
                            <button
                              key={tone.id}
                              type="button"
                              onClick={() => setShareTone(tone.id as any)}
                              className={`py-2.5 px-3 text-xs font-black rounded-xl border text-center transition-all cursor-pointer ${
                                shareTone === tone.id 
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {tone.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Rendering Template Output Copy blocks */}
                      <div className="space-y-4 pt-2">
                        {shareTone !== "sms" && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Subject Line</label>
                              <button
                                onClick={() => triggerCopy(getShareTemplate().subject, "share-sub")}
                                className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-lg"
                              >
                                {copiedText === "share-sub" ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600 animate-pulse" /> Copied Subject
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> Copy Subject
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="p-3.5 bg-slate-50 border border-slate-250/60 rounded-xl text-xs font-bold text-slate-800 leading-snug shadow-xs selection:bg-indigo-100">
                              {getShareTemplate().subject}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">
                              {shareTone === "sms" ? "SMS / Message draft" : "Email Message Body"}
                            </label>
                            <button
                              onClick={() => triggerCopy(getShareTemplate().body, "share-body")}
                              className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-lg"
                            >
                              {copiedText === "share-body" ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600 animate-pulse" /> Copied Body
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> Copy Body
                                  </>
                                )}
                            </button>
                          </div>
                          <pre className="p-4 bg-slate-955 text-indigo-205 rounded-2xl font-mono text-[11px] font-bold leading-relaxed overflow-y-auto border border-slate-900 block whitespace-pre-wrap max-h-56 shadow-inner text-left">
                            {getShareTemplate().body}
                          </pre>
                        </div>
                      </div>

                    </div>

                    {/* Footer buttons links list details */}
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center shrink-0">
                      <span className="text-[10px] font-black text-slate-400 capitalize text-left">
                        Form Link: <span className="font-mono text-indigo-600 font-extrabold select-all">/form/{shareCampaign.slug}</span>
                      </span>
                      
                      <div className="flex gap-2.5">
                        {shareTone === "sms" ? (
                          <a
                            href={`sms:?body=${encodeURIComponent(getShareTemplate().body)}`}
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-950 hover:bg-slate-850 text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-sm active:scale-98 cursor-pointer"
                          >
                            <Send className="w-4 h-4 text-emerald-400" /> Launch SMS App
                          </a>
                        ) : (
                          <a
                            href={`mailto:?subject=${encodeURIComponent(getShareTemplate().subject)}&body=${encodeURIComponent(getShareTemplate().body)}`}
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-[0_2px_10px_rgba(79,70,229,0.15)] active:scale-98 cursor-pointer"
                          >
                            <Mail className="w-4 h-4 text-emerald-300" /> Open Mail Client
                          </a>
                        )}
                        <button
                          onClick={() => setShareCampaign(null)}
                          className="px-5 py-3 border border-slate-200 hover:bg-slate-100 text-slate-705 rounded-xl text-xs font-black cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                  </motion.div>
                </div>
              )}

            </div>
          )}
                  {/* TAB 2: REVIEW INBOX */}
          {activeTab === "testimonials" && (
            <div className="space-y-6">
              
              {/* Filter controls */}
              <div className="bento-card-glass rounded-3xl border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] space-y-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
                  
                  {/* Search input */}
                  <div className="relative w-full lg:max-w-xs">
                    <input
                      type="text"
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                      placeholder="Search reviewers or terms..."
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-705 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                    />
                    <div className="absolute left-3 top-3 text-slate-405">
                      <Search className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Filter pill tabs */}
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {["all", "new", "approved", "archived", "Positive", "Negative"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setReviewFilter(f as any)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black capitalize cursor-pointer transition-all ${
                          reviewFilter === f 
                            ? "bg-slate-950 text-white shadow-sm" 
                            : "bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {f === "new" ? "Pending Approval" : f}
                      </button>
                    ))}
                  </div>

                </div>

                {allTags.length > 0 && (
                  <div className="flex gap-2 items-center flex-wrap pt-4 border-t border-slate-100/80 mt-2.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" /> Filter by Tag:
                    </span>
                    <button
                      onClick={() => setSelectedTagFilter(null)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                        selectedTagFilter === null
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
                      }`}
                    >
                      Show All Tags
                    </button>
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                          selectedTagFilter === tag
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Left: Testimonials Stack List */}
                <div className="lg:col-span-2 space-y-4">
                  
                  {/* Results count label */}
                  <div className="text-[10px] font-black text-slate-450 tracking-wider uppercase px-1">
                    Showing {filteredTestimonials.length} of {testimonials.length} submitted reviews
                  </div>

                  {/* Reviews Stack list */}
              {filteredTestimonials.length === 0 ? (
                <div className="p-16 text-center bento-card-glass rounded-3xl border border-slate-200/60 shadow-inner">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-550 text-sm font-extrabold flex items-center justify-center gap-1.5">No reviews matching the filters.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTestimonials.map((t) => (
                    <div 
                      key={t.id} 
                      className={`bento-card-glass rounded-3xl p-6 border transition-all duration-300 hover:-translate-y-0.5 relative flex flex-col md:flex-row gap-5 justify-between ${
                        t.status === "approved" 
                          ? "border-emerald-200/85 bg-emerald-50/15" 
                          : t.status === "archived" 
                            ? "border-slate-200 bg-slate-50/40 opacity-60" 
                            : "border-slate-250 border-l-4 border-l-amber-405"
                      }`}
                    >
                      {/* Left: Author & Content */}
                      <div className="flex gap-4 items-start flex-1">
                        {t.avatarUrl ? (
                          <img src={t.avatarUrl} alt={t.name} className="w-12 h-12 rounded-2xl object-cover shrink-0 shadow-md border border-slate-100" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 uppercase font-black tracking-wide font-mono shrink-0">
                            {t.name[0]}
                          </div>
                        )}

                        <div className="space-y-2.5">
                          <div>
                            <div className="flex gap-2 items-center flex-wrap">
                              <h4 className="text-sm font-extrabold text-slate-950 leading-none">{t.name}</h4>
                              <span className="text-[10px] font-black text-slate-400 font-mono leading-none bg-slate-150 px-1.5 py-0.5 rounded-md border border-slate-200/10">
                                {t.email}
                              </span>
                            </div>
                            {(t.title || t.company) && (
                              <p className="text-[11px] font-bold text-slate-505 mt-1">
                                {t.title} {t.title && t.company ? "at " : ""} {t.company}
                              </p>
                            )}
                          </div>

                          {/* Star Display */}
                          <div className="flex gap-0.5 items-center bg-slate-50 border border-slate-150/40 px-2 py-0.5 rounded-lg w-fit">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-3.5 h-3.5 ${
                                  i < t.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"
                                } shrink-0`} 
                              />
                            ))}
                            <span className="text-[10px] font-black text-slate-400 ml-1.5">Rating</span>
                          </div>

                          {/* Review Content body */}
                          <p className="text-xs font-semibold text-slate-650 leading-relaxed max-w-2xl bg-slate-100/35 p-4 rounded-2xl border border-slate-150/45 select-all italic">
                            "{t.content}"
                          </p>

                          {t.videoUrl && (
                            <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-205 max-w-xs aspect-video relative mt-2 mb-3.5 shadow-sm">
                              <video 
                                src={t.videoUrl} 
                                controls 
                                className="w-full h-full object-cover"
                                preload="none"
                              />
                            </div>
                          )}

                          {/* Render social URL if defined */}
                          {t.socialUrl && (
                            <a 
                              href={t.socialUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100/30"
                            >
                              <Globe className="w-3 h-3" /> Profile verification link
                            </a>
                          )}

                          {/* Dynamic Custom Tags Section */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                            <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase flex items-center gap-1 mr-1">
                              <Tag className="w-3 h-3 text-indigo-500" /> Tags:
                            </span>
                            
                            {(t.tags || []).map((tag) => (
                              <span 
                                key={tag} 
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200 text-slate-650 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors select-none"
                              >
                                #{tag}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTagFromTestimonial(t, tag)}
                                  className="text-slate-400 hover:text-rose-600 font-extrabold ml-1 cursor-pointer transition-colors"
                                  title={`Remove tag #${tag}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}

                            {tagEditingTestimonialId === t.id ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (newTagInput.trim()) {
                                    handleAddTagToTestimonial(t, newTagInput);
                                    setNewTagInput("");
                                  }
                                  setTagEditingTestimonialId(null);
                                }}
                                className="inline-flex items-center gap-1 bg-white border border-indigo-400 rounded-xl px-2 py-0.5 shadow-xs"
                              >
                                <input
                                  type="text"
                                  autoFocus
                                  value={newTagInput}
                                  onChange={(e) => setNewTagInput(e.target.value)}
                                  placeholder="Tag name"
                                  className="px-1 py-0.5 text-[10px] font-bold text-slate-800 outline-none w-20 bg-transparent"
                                />
                                <button 
                                  type="submit" 
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-black cursor-pointer"
                                >
                                  Add
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    setTagEditingTestimonialId(null);
                                    setNewTagInput("");
                                  }} 
                                  className="text-[10px] text-slate-400 hover:text-slate-600 font-black cursor-pointer"
                                >
                                  ✕
                                </button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setTagEditingTestimonialId(t.id);
                                  setNewTagInput("");
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-650 transition-all cursor-pointer"
                              >
                                + Add Tag
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Control Actions */}
                      <div className="flex flex-row md:flex-col justify-end md:justify-between items-end gap-3.5 shrink-0 border-t md:border-t-0 border-slate-200/40 pt-3 md:pt-0">
                        
                        <div className="text-right">
                          <span className={`inline-flex px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
                            t.status === "approved" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : t.status === "archived" 
                                ? "bg-slate-100 text-slate-550 border-slate-200" 
                                : "bg-amber-50 text-amber-70 border-amber-200"
                          }`}>
                            {t.status === "new" ? "pending approval" : t.status}
                          </span>
                        </div>

                        <div className="flex gap-1.5 items-center">
                          {t.status !== "approved" && (
                            <button
                              onClick={() => handleUpdateReviewStatus(t, "approved")}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-450 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all hover:scale-103 shadow-xs"
                              title="Set status of review to Approved to display in widget"
                            >
                              <ThumbsUp className="w-3.5 h-3.5 text-white fill-white" /> Approve review
                            </button>
                          )}

                          {t.status === "approved" && (
                            <button
                              onClick={() => handleUpdateReviewStatus(t, "new")}
                              className="px-3.5 py-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                              title="Revert approval and send review to pending list"
                            >
                              Revoke
                            </button>
                          )}

                          {t.status !== "archived" && (
                            <button
                              onClick={() => handleUpdateReviewStatus(t, "archived")}
                              className="px-3.5 py-2 text-slate-605 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-250 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                              title="Archive testimonial"
                            >
                              Archive
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSocialCopyReview(t);
                              setSocialCopyTone("Professional");
                              setSocialCopyResult(null);
                              setSocialCopyError(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 text-indigo-750 rounded-xl text-xs font-extrabold cursor-pointer transition-all hover:scale-102"
                            title="Use Gemini AI to write social media copy based on this review"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                            <span>Write Social Post</span>
                          </button>

                          <button
                            onClick={() => handleDeleteReview(t.id)}
                            className="p-2 text-slate-450 hover:text-rose-500 border border-slate-200 hover:border-rose-250 rounded-xl hover:bg-rose-50 transition-all shrink-0 cursor-pointer shadow-xs"
                            title="Delete review from records"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                      </div>

                    </div>
                  ))}
                </div>
              )}

                </div>

                {/* Right Column: Simulated SMTP Outbox Logs Feed */}
                <div className="lg:col-span-1">
                  <div className="bento-card-glass rounded-3xl border border-slate-200/60 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Automated Notifier</h4>
                          <p className="text-[9px] text-slate-400 font-bold font-mono">Simulated SMTP Carrier</p>
                        </div>
                      </div>
                      <span className="text-[8px] bg-emerald-50 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono animate-pulse">
                        Active Logs
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 font-semibold leading-relaxed font-sans">
                      Whenever a guest completes a review, an automated HTML email is dispatched to the space owner's registered address seamlessly.
                    </p>

                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                      {sentEmails.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50/55 rounded-2xl border border-dashed border-slate-200">
                          <Clock className="w-5 h-5 text-slate-350 mx-auto mb-2 text-slate-400" />
                          <p className="text-[10px] font-semibold text-slate-400">Waiting for first submission...</p>
                        </div>
                      ) : (
                        sentEmails.slice().reverse().map((email) => (
                          <div key={email.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-3 text-white flex flex-col gap-2 shadow-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                                Delivered
                              </span>
                              <span className="text-[8px] text-slate-400 font-mono">
                                {new Date(email.sentAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-350 font-bold font-mono truncate text-indigo-200">To: {email.to}</p>
                              <p className="text-[10px] text-slate-205 font-bold tracking-tight mt-1">Subj: {email.subject}</p>
                            </div>
                            <div className="bg-slate-950/80 p-2 rounded-lg text-[9px] font-mono text-slate-300 max-h-24 overflow-y-auto leading-normal whitespace-pre-wrap">
                              {email.body}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 3: LIVE WIDGET CUSTOMIZER & PREVIEW */}
          {activeTab === "widgets" && (
            <div className="space-y-6">
              
              {/* Select Widget row / Builder */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bento-card-glass p-6 rounded-3xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                <div>
                  <h2 className="text-lg font-black text-slate-950 tracking-tight">Interactive Widget Sandbox</h2>
                  <p className="text-xs text-slate-450 font-semibold mt-1">Design live snippets and Wall of Love carousels. Embedding is simple copying.</p>
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Add layout:</span>
                  <div className="inline-flex rounded-xl border border-slate-200/60 bg-slate-100 p-1 gap-1 shadow-inner">
                    {["grid", "carousel", "single", "badge"].map((type) => (
                      <button
                        key={type}
                        onClick={() => handleCreateNewWidgetType(type as any)}
                        className="px-3 py-1.5 hover:bg-white text-slate-700 hover:text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border border-transparent hover:border-slate-200/40 hover:shadow-xs"
                        title={`Create and load new ${type} widget`}
                      >
                        + {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customizer Workstation Sandbox */}
              {selectedWidget ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  
                  {/* Left block Control Column (2 spanned columns) */}
                  <div className="lg:col-span-2 bento-card-glass rounded-3xl border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] space-y-6 transition-all duration-300">
                    <div>
                      <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5 border-b border-slate-150/45 pb-3">
                        <Sliders className="w-4.5 h-4.5 text-emerald-500" /> Customizer Preferences
                      </h3>
                    </div>

                    {/* Form Fields controls */}
                    <div className="space-y-4">
                      
                      {/* Name editor option */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Widget Title</label>
                        <input
                          type="text"
                          value={selectedWidget.name}
                          onChange={(e) => handleUpdateWidgetConfig({ name: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>

                      {/* Type toggle */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Layout Preset Model</label>
                        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/30">
                          {(["grid", "carousel", "single", "badge"] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleUpdateWidgetConfig({ type })}
                              className={`py-2 text-[10px] font-black rounded-lg capitalize transition-all cursor-pointer ${
                                selectedWidget.type === type 
                                  ? "bg-white text-slate-955 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-250/20" 
                                  : "text-slate-505 hover:text-slate-900 hover:bg-white/45"
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Display Star ratings */}
                      <div className="flex justify-between items-center bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/40">
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 block">Show Rating Stars</span>
                          <span className="text-[9px] text-slate-405 font-bold mt-0.5">Appends stars visual above feedback</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateWidgetConfig({ showRating: !selectedWidget.showRating })}
                          className={`w-11 h-6.5 rounded-full p-1 transition-colors duration-200 outline-none focus:outline-none cursor-pointer ${selectedWidget.showRating ? "bg-emerald-500" : "bg-gray-300"}`}
                        >
                          <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-sm transform transition-transform duration-200 ${selectedWidget.showRating ? "translate-x-4.5" : "translate-x-0"}`} />
                        </button>
                      </div>

                      {/* Interactive Animations toggle */}
                      <div className="flex justify-between items-center bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/40">
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 block">Entrance Animations</span>
                          <span className="text-[9px] text-slate-405 font-bold mt-0.5">Fades-up cards dynamically</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateWidgetConfig({
                            styles: {
                              ...selectedWidget.styles,
                              enableGridAnimation: !selectedWidget.styles?.enableGridAnimation
                            }
                          })}
                          className={`w-11 h-6.5 rounded-full p-1 transition-colors duration-200 outline-none focus:outline-none cursor-pointer ${selectedWidget.styles?.enableGridAnimation ? "bg-emerald-500" : "bg-gray-300"}`}
                        >
                          <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-sm transform transition-transform duration-200 ${selectedWidget.styles?.enableGridAnimation ? "translate-x-4.5" : "translate-x-0"}`} />
                        </button>
                      </div>

                      {/* Themes preset select layout */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Color Palette Theme</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["light", "dark", "custom"] as const).map((theme) => (
                            <button
                              key={theme}
                              type="button"
                              onClick={() => handleUpdateWidgetConfig({ theme })}
                              className={`py-2 text-[10px] font-black rounded-xl border text-center transition-all cursor-pointer capitalize ${
                                selectedWidget.theme === theme 
                                  ? "bg-slate-950 text-white border-slate-950 shadow-sm" 
                                  : "bg-slate-105 text-slate-600 border-slate-230/60 hover:bg-slate-100"
                              }`}
                            >
                              {theme}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Border curvatures config */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Card Curvature</label>
                        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/30">
                          {(["none", "md", "lg", "full"] as const).map((radius) => (
                            <button
                              key={radius}
                              type="button"
                              onClick={() => handleUpdateWidgetConfig({
                                styles: {
                                  ...selectedWidget.styles,
                                  borderRadius: radius
                                }
                              })}
                              className={`py-1.5 text-[10px] font-black rounded-lg capitalize transition-all cursor-pointer ${
                                selectedWidget.styles?.borderRadius === radius 
                                  ? "bg-white text-slate-955 shadow-xs" 
                                  : "text-slate-500 hover:text-slate-805 hover:bg-white/45"
                              }`}
                            >
                              {radius}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Border design styling */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Border Accent Style</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["none", "subtle", "tinted"] as const).map((style) => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => handleUpdateWidgetConfig({
                                styles: {
                                  ...selectedWidget.styles,
                                  borderStyle: style
                                }
                              })}
                              className={`py-2 text-[10px] font-black border rounded-xl text-center capitalize transition-all cursor-pointer ${
                                selectedWidget.styles?.borderStyle === style 
                                  ? "bg-slate-955 border-slate-955 text-white shadow-xs" 
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {style}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Max limit of ratings */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Max display limit</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={selectedWidget.limit}
                          onChange={(e) => handleUpdateWidgetConfig({ limit: Number(e.target.value) || 12 })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>

                    </div>

                  </div>

                  {/* Right Column Layout sandbox + embedding code card (3 columns space) */}
                  <div className="lg:col-span-3 space-y-6">
                    
                    {/* Visual Sandbox preview window */}
                    <div className="bento-card-glass rounded-3xl border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] space-y-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Interactive Canvas preview</span>
                        <span className="text-[10px] font-black text-emerald-705 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-xl shadow-xs">Live Environment</span>
                      </div>

                      {/* Target render container */}
                      <div className="rounded-2xl border border-slate-200/60 bg-slate-100/35 backdrop-blur-sm p-4 min-h-[300px] overflow-hidden flex items-center justify-center shadow-inner">
                        <div className="w-full">
                          <SaaS_Widget_Embed widgetId={selectedWidget.id} />
                        </div>
                      </div>

                    </div>

                    {/* Embedding code card */}
                    <div className="bento-card-glass rounded-3xl border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] space-y-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                      <h4 className="text-sm font-black text-slate-955 flex items-center gap-1.5">
                        <Code className="w-5 h-5 text-indigo-500" /> Integration embed script code
                      </h4>
                      <p className="text-xs text-slate-450 font-semibold leading-relaxed">
                        To add this {selectedWidget.type} Wall of love to your dental, plumber, agency or landing page website, copy and paste this standard responsive code inside your HTML template:
                      </p>

                      <div className="relative">
                        <pre className="p-4.5 bg-slate-955 text-emerald-405 rounded-2xl font-mono text-[11px] font-bold leading-relaxed overflow-x-auto border border-slate-900 block max-h-40 shadow-inner">
{`<iframe 
  src="${window.location.origin}/embed/${selectedWidget.id}" 
  style="width: 100%; border: none; min-height: 480px; display: block;"
  loading="lazy"
></iframe>`}
                        </pre>
                        
                        <button
                          onClick={() => triggerCopy(`<iframe src="${window.location.origin}/embed/${selectedWidget.id}" style="width: 100%; border: none; min-height: 480px; display: block;" loading="lazy"></iframe>`, "widget-embed-frame")}
                          className="absolute right-3.5 top-3.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-700/50 flex items-center gap-1.5 transition-all text-slate-300 cursor-pointer shadow-xs active:scale-95"
                        >
                          {copiedText === "widget-embed-frame" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Code
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-emerald-400" /> Copy Code
                            </>
                          )}
                        </button>
                      </div>

                    </div>

                  </div>

                </div>
              ) : (
                <div className="p-16 text-center bento-card-glass rounded-3xl border border-slate-200/60 shadow-inner animate-pulse">
                  <Sliders className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-550 text-sm font-extrabold">Widget configurations are index filtering...</p>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: GEMINI AI COPILOT AND SYNTAX COPYWRITER */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              
              {/* AISpark sub-navigation toggle */}
              <div className="flex border-b border-slate-150 pb-1.5 gap-6">
                <button
                  type="button"
                  onClick={() => setAiSubTab("sentiment")}
                  className={`pb-2.5 text-xs font-black uppercase tracking-widest transition-all relative outline-none cursor-pointer ${
                    aiSubTab === "sentiment"
                      ? "text-indigo-600 font-extrabold"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  📈 Sentiment Trend Charts
                  {aiSubTab === "sentiment" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full animate-fade-in" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAiSubTab("copywriter")}
                  className={`pb-2.5 text-xs font-black uppercase tracking-widest transition-all relative outline-none cursor-pointer ${
                    aiSubTab === "copywriter"
                      ? "text-indigo-600 font-extrabold"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  ⚡ Gemini Copywriter Copilot
                  {aiSubTab === "copywriter" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full animate-fade-in" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAiSubTab("rewriter")}
                  className={`pb-2.5 text-xs font-black uppercase tracking-widest transition-all relative outline-none cursor-pointer ${
                    aiSubTab === "rewriter"
                      ? "text-indigo-600 font-extrabold"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  ✍️ Raw Review Rewriter
                  {aiSubTab === "rewriter" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full animate-fade-in" />
                  )}
                </button>
              </div>

              {aiSubTab === "sentiment" && (
                <SaaS_Sentiment_Dashboard testimonials={testimonials} />
              )}

              {aiSubTab === "copywriter" && (
                <div className="space-y-6">
                  
                  {/* Header card */}
                  <div className="bento-card-glass p-6 rounded-3xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
                    <div className="space-y-1">
                      <h2 className="text-lg font-black text-slate-950 tracking-tight flex items-center gap-1.5">
                        <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" /> Gemini Copywriter Copilot
                      </h2>
                      <p className="text-xs text-slate-450 font-semibold leading-relaxed max-w-xl">
                        Run server-side Gemini AI model checkouts based on approved client reviews. The AI extracts business insights, analyzes sentiment patterns, and crafts promotional copies automatically. No API tokens needed.
                      </p>
                    </div>

                    <button
                      onClick={handleTriggerAISynthesis}
                      disabled={aiLoading || approvedList.length === 0}
                      className="inline-flex items-center gap-1.5 px-5 py-3.5 bg-gradient-to-tr from-indigo-600 via-purple-600 to-teal-500 text-white rounded-xl text-xs font-bold leading-none shadow-md hover:scale-101 active:scale-98 transition-transform disabled:opacity-40 select-none cursor-pointer shrink-0 border border-transparent"
                    >
                      {aiLoading ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin text-white" /> Analyzing reviews...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4.5 h-4.5 text-emerald-400" /> Craft AI Marketing Materials
                        </>
                      )}
                    </button>
                  </div>

                  {/* Warnings / Fallbacks */}
                  {approvedList.length === 0 && (
                    <div className="p-4.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs font-semibold leading-relaxed flex gap-2.5">
                      <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <span className="font-extrabold">No Approved testimonials found:</span> Approve some customer reviews first in the <button onClick={() => setActiveTab("testimonials")} className="underline font-black outline-none cursor-pointer hover:text-amber-950">Review Inbox</button> to unlock the Gemini copywriting generator!
                      </div>
                    </div>
                  )}

                  {aiError && (
                    <div className="p-4.5 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 text-xs font-bold leading-relaxed">
                      {aiError}
                    </div>
                  )}

                  {/* Main AI Results Display */}
                  {aiResult ? (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      
                      {/* Left stats visual breakdown (2 columns mapped) */}
                      <div className="lg:col-span-2 space-y-6">
                        
                        {/* Insights panel */}
                        <div className="bento-card-glass rounded-3xl border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] space-y-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-emerald-500" /> Client Sentiment patterns
                          </h3>
                          
                          <div className="space-y-4">
                            <div>
                              <span className="text-[10px] text-slate-400 font-extrabold block mb-1">Average Rating Metrics</span>
                              <p className="text-xs font-bold text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-150/40 font-mono">{aiResult.averageRatingString}</p>
                            </div>
                            
                            <div>
                              <span className="text-[10px] text-slate-400 font-extrabold block mb-1">AI Sentiment summary</span>
                              <p className="text-xs font-semibold text-slate-700 leading-relaxed bg-indigo-50/35 p-3.5 rounded-2xl border border-indigo-100/30 italic">
                                "{aiResult.sentimentSummary}"
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Identified core strength elements */}
                        <div className="bento-card-glass rounded-3xl border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] space-y-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                            🌟 Highlighted strengths
                          </h3>
                          
                          <ul className="space-y-3.5">
                            {aiResult.strengths.map((s, i) => (
                              <li key={i} className="flex gap-2.5 items-start">
                                <span className="h-5 w-5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 border border-emerald-250/30">
                                  {i+1}
                                </span>
                                <span className="text-xs font-semibold text-slate-650 leading-relaxed">{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                      </div>

                      {/* Right: auto-generated promotional draft sheets (3 columns) */}
                      <div className="lg:col-span-3 space-y-6">
                        
                        {/* Hero copy sections proposal */}
                        <div className="bento-card-glass rounded-3xl border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] space-y-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-450">Landing Page headline proposal</h4>
                            <span className="text-[9px] font-black tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-xl uppercase">Highly Optimized</span>
                          </div>

                          <div className="space-y-4 p-4.5 bg-slate-50/70 rounded-2xl border border-slate-200/40">
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Heading/Hook</span>
                              <h2 className="text-base font-black tracking-tight text-slate-950 leading-snug">
                                {aiResult.heroHook}
                              </h2>
                            </div>
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Subtle caption</span>
                              <p className="text-xs font-semibold text-slate-650 leading-relaxed">
                                {aiResult.heroSubheading}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Social platform copywriting stack */}
                        <div className="bento-card-glass rounded-3xl border border-slate-200/60 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] space-y-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-slate-100 pb-3">
                            Dynamic Promotional Copies
                          </h4>

                          <div className="space-y-4">
                            
                            {/* Twitter card */}
                            <div className="space-y-1.5 relative p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-205/60 transition-all">
                              <span className="text-[9px] font-black tracking-wider text-slate-440 uppercase block">Twitter Draft Copy</span>
                              <p className="text-xs font-semibold text-slate-700 leading-relaxed font-mono select-all pr-12">
                                {aiResult.marketingCopies.twitter}
                              </p>
                              <button
                                onClick={() => triggerCopy(aiResult.marketingCopies.twitter, "copy-tw")}
                                className="absolute right-3.5 top-3.5 p-1.5 rounded-lg text-slate-400 bg-white hover:bg-slate-100 hover:text-slate-900 transition-all border border-slate-200 hover:border-slate-300 cursor-pointer shadow-xs"
                                title="Copy Twitter post draft"
                              >
                                {copiedText === "copy-tw" ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            </div>

                            {/* LinkedIn card */}
                            <div className="space-y-1.5 relative p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-205/60 transition-all">
                              <span className="text-[9px] font-black tracking-wider text-slate-440 uppercase block">LinkedIn Narrative Copy</span>
                              <p className="text-xs font-semibold text-slate-700 leading-relaxed select-all pr-12 whitespace-pre-wrap">
                                {aiResult.marketingCopies.linkedin}
                              </p>
                              <button
                                onClick={() => triggerCopy(aiResult.marketingCopies.linkedin, "copy-li")}
                                className="absolute right-3.5 top-3.5 p-1.5 rounded-lg text-slate-400 bg-white hover:bg-slate-100 hover:text-slate-900 transition-all border border-slate-200 hover:border-slate-300 cursor-pointer shadow-xs"
                                title="Copy LinkedIn post draft"
                              >
                                {copiedText === "copy-li" ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            </div>

                            {/* FB Ad copy description details */}
                            <div className="space-y-1.5 relative p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-205/60 transition-all">
                              <span className="text-[9px] font-black tracking-wider text-slate-440 uppercase block">Facebook / Google Ad Copy</span>
                              <p className="text-xs font-semibold text-slate-705 leading-relaxed select-all pr-12">
                                {aiResult.marketingCopies.facebookAd}
                              </p>
                              <button
                                onClick={() => triggerCopy(aiResult.marketingCopies.facebookAd, "copy-fb")}
                                className="absolute right-3.5 top-3.5 p-1.5 rounded-lg text-slate-400 bg-white hover:bg-slate-100 hover:text-slate-900 transition-all border border-slate-200 hover:border-slate-300 cursor-pointer shadow-xs"
                                title="Copy Ad copy description"
                              >
                                {copiedText === "copy-fb" ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            </div>

                          </div>

                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="p-16 text-center bento-card-glass rounded-3xl border border-slate-200/60 shadow-inner">
                      {aiLoading ? (
                        <div className="space-y-3.5">
                          <Loader className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
                          <p className="text-slate-955 font-black">Warming up Gemini Copywriter Model...</p>
                          <p className="text-[11px] text-slate-450 max-w-md mx-auto leading-relaxed font-bold">Extracting semantic key terms, parsing positive expressions patterns, matching average counts, and drafting multi-platform copies.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Sparkles className="w-10 h-10 text-indigo-500 mx-auto mb-3 animate-pulse" />
                          <p className="text-slate-955 text-sm font-black uppercase tracking-wider">Copilot Sandbox Unlocked</p>
                          <p className="text-xs text-slate-450 max-w-md mx-auto leading-relaxed font-bold">Click "Craft AI Marketing Materials" above to trigger server-side semantic inference using Gemini.</p>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

              {aiSubTab === "rewriter" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                  {/* Left Controls column (5 cols) */}
                  <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                    <div className="bento-card-glass p-6 rounded-3xl border border-slate-200/60 shadow-md space-y-5 bg-white/70">
                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-indigo-500" /> Convert Messy Reviews
                        </h3>
                        <p className="text-xs text-slate-450 font-semibold leading-relaxed">
                          Input a raw, short, or grammatically weak client review and automatically rewrite it into high-converting marketing hooks or social posts.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block font-bold">
                            Raw / Rough Review Text
                          </label>
                          <textarea
                            value={rewriterRawReview}
                            onChange={(e) => setRewriterRawReview(e.target.value)}
                            placeholder="e.g., your service is very nice, i loved it, the developer finished things so fast! def hire him!"
                            rows={5}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all resize-none shadow-inner"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block font-bold">
                            Rewrite Tone Voice
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: "💼 Professional", value: "Professional" },
                              { label: "🚀 Enthusiastic", value: "Enthusiastic" },
                              { label: "⚡ Punchy & Bold", value: "Punchy" },
                              { label: "📖 Storyteller", value: "Storytelling" }
                            ].map((toneOpt) => (
                              <button
                                key={toneOpt.value}
                                type="button"
                                onClick={() => setRewriterTone(toneOpt.value)}
                                className={`px-3 py-3 rounded-xl text-left text-xs font-bold border transition-all cursor-pointer ${
                                  rewriterTone === toneOpt.value
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm"
                                    : "bg-white border-slate-200/70 text-slate-650 hover:bg-slate-50 hover:border-slate-300"
                                }`}
                              >
                                {toneOpt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block font-bold">
                            Output format
                          </label>
                          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            {[
                              { label: "Headline Only", value: "marketing_copy" },
                              { label: "Captions Only", value: "social_caption" },
                              { label: "Full Campaign", value: "both" }
                            ].map((fmt) => (
                              <button
                                key={fmt.value}
                                type="button"
                                onClick={() => setRewriterFormat(fmt.value as any)}
                                className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                                  rewriterFormat === fmt.value
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-450 hover:text-slate-700"
                                }`}
                              >
                                {fmt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRewriteRawReview()}
                          disabled={rewriterLoading || !rewriterRawReview.trim()}
                          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-45 disabled:pointer-events-none select-none cursor-pointer"
                        >
                          {rewriterLoading ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" /> Rewriting review text...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" /> Rewrite with Gemini AI
                            </>
                          )}
                        </button>
                      </div>

                      {rewriterError && (
                        <div className="p-4 bg-rose-50 border border-rose-150 text-rose-700 text-xs font-bold rounded-2xl leading-relaxed">
                          ⚠️ {rewriterError}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Results column (7 cols) */}
                  <div className="lg:col-span-12 xl:col-span-7">
                    {rewriterLoading ? (
                      <div className="h-full min-h-[460px] bento-card-glass rounded-3xl border border-slate-200/60 flex flex-col items-center justify-center p-10 text-center space-y-4 bg-white/40">
                        <Loader className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                        <h4 className="text-sm font-black text-slate-800 animate-pulse">Gemini is rewriting review...</h4>
                        <p className="text-xs text-slate-400 font-semibold max-w-sm leading-relaxed">
                          Polishing sentences, identifying the client's biggest transformation, and formatting social captions.
                        </p>
                      </div>
                    ) : rewriterResult ? (
                      <div className="space-y-6">
                        {/* Polished Review Display */}
                        <div className="bento-card-glass p-6 rounded-3xl border border-slate-200/60 shadow-md space-y-4 animate-fade-in bg-white/70">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-extrabold">
                              Polished Testimonial Version
                            </span>
                            <button
                              onClick={() => triggerCopy(rewriterResult.polishedReview, "rewriter-polished")}
                              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all text-slate-500 hover:text-indigo-600 cursor-pointer"
                            >
                              {copiedText === "rewriter-polished" ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied Testimonial
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-indigo-505" /> Copy Testimonial
                                </>
                              )}
                            </button>
                          </div>
                          
                          <div className="p-5.5 bg-indigo-50/20 border border-indigo-100/40 rounded-2xl relative italic text-xs font-semibold text-slate-705 leading-relaxed">
                            <span className="text-4xl text-indigo-300 font-serif absolute top-1.5 left-2 select-none font-black leading-none">“</span>
                            <p className="pl-6.5 pr-2.5">
                              {rewriterResult.polishedReview}
                            </p>
                          </div>
                        </div>

                        {/* Marketing Headline Board */}
                        {(rewriterFormat === "marketing_copy" || rewriterFormat === "both") && (
                          <div className="bento-card-glass p-6 rounded-3xl border border-slate-200/60 shadow-md space-y-4 animate-fade-in bg-white/70">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-extrabold">
                                Headline Hook Proposal
                              </span>
                              <button
                                onClick={() => triggerCopy(rewriterResult.marketingHeadline, "rewriter-headline")}
                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all text-slate-500 hover:text-indigo-600 cursor-pointer"
                              >
                                {copiedText === "rewriter-headline" ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-indigo-550" />
                                )}
                              </button>
                            </div>
                            <h2 className="text-sm font-black text-slate-805 tracking-tight leading-relaxed p-4.5 bg-emerald-50/15 border border-emerald-100/30 rounded-2xl">
                              {rewriterResult.marketingHeadline}
                            </h2>
                          </div>
                        )}

                        {/* Social Draft Captions */}
                        {(rewriterFormat === "social_caption" || rewriterFormat === "both") && (
                          <div className="bento-card-glass p-6 rounded-3xl border border-slate-200/60 shadow-md space-y-4 animate-fade-in bg-white/70">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-3 font-extrabold">
                              Promotional Social Captions
                            </span>

                            <div className="space-y-4">
                              {/* LinkedIn Capsule */}
                              <div className="space-y-2 relative p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                                <div className="flex justify-between items-center pb-1">
                                  <span className="text-[9px] font-black tracking-wider text-slate-450 uppercase pb-1">
                                    LinkedIn Post Layout
                                  </span>
                                  <button
                                    onClick={() => triggerCopy(rewriterResult.linkedinCaption, "rewriter-linkedin")}
                                    className="p-1.5 rounded-lg text-slate-400 bg-white hover:bg-slate-101 border border-slate-200 cursor-pointer shadow-xs"
                                  >
                                    {copiedText === "rewriter-linkedin" ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-xs font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap select-all pr-4">
                                  {rewriterResult.linkedinCaption}
                                </p>
                              </div>

                              {/* Twitter capsule */}
                              <div className="space-y-2 relative p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                                <div className="flex justify-between items-center pb-1">
                                  <span className="text-[9px] font-black tracking-wider text-slate-450 uppercase pb-1">
                                    Twitter/X caption
                                  </span>
                                  <button
                                    onClick={() => triggerCopy(rewriterResult.twitterCaption, "rewriter-twitter")}
                                    className="p-1.5 rounded-lg text-slate-400 bg-white hover:bg-slate-101 border border-slate-200 cursor-pointer shadow-xs"
                                  >
                                    {copiedText === "rewriter-twitter" ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-xs font-semibold text-slate-700 leading-relaxed font-mono select-all pr-4">
                                  {rewriterResult.twitterCaption}
                                </p>
                                <div className="text-[9px] font-bold text-slate-400 mt-1">
                                  {rewriterResult.twitterCaption.length} characters / 280 max
                                </div>
                              </div>

                              {/* Instagram Capsule */}
                              <div className="space-y-2 relative p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                                <div className="flex justify-between items-center pb-1">
                                  <span className="text-[9px] font-black tracking-wider text-slate-450 uppercase pb-1">
                                    Instagram / Facebook Layout
                                  </span>
                                  <button
                                    onClick={() => triggerCopy(rewriterResult.instagramCaption, "rewriter-instagram")}
                                    className="p-1.5 rounded-lg text-slate-400 bg-white hover:bg-slate-101 border border-slate-200 cursor-pointer shadow-xs"
                                  >
                                    {copiedText === "rewriter-instagram" ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-xs font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap select-all pr-4">
                                  {rewriterResult.instagramCaption}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full min-h-[460px] bento-card-glass rounded-3xl border border-slate-200/60 flex flex-col items-center justify-center p-12 text-center space-y-3 bg-white/40">
                        <Sparkles className="w-10 h-10 text-indigo-400 animate-pulse mb-2" />
                        <h4 className="text-sm font-black text-slate-805 uppercase tracking-wide">Output copy panel</h4>
                        <p className="text-xs text-slate-450 font-bold max-w-sm leading-relaxed">
                          Your polished outcomes, headlines, and captions will appear here once you type a review and submit.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-6">
              
              {/* Header card */}
              <div className="bento-card-glass p-6 rounded-3xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-slate-950 tracking-tight flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                    Global Integrations Sync Engine
                  </h2>
                  <p className="text-xs text-slate-450 font-semibold leading-relaxed max-w-xl font-sans">
                    Connect TrustBuilder directly with Salesforce pipelines, retail storefronts, and B2B commercial pipelines. Easily push approved testimonials to reduce checkout friction and close deals.
                  </p>
                </div>
              </div>

              {/* Three Pillars: Salesforce, E-commerce, B2B Sales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Salesforce CRM */}
                <div className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-100">
                        <Database className="w-5.5 h-5.5 text-sky-600" />
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                        salesforceConnected 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-slate-100 text-slate-400 border-slate-200"
                      }`}>
                        {salesforceConnected ? "● Connected" : "○ Inactive"}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-slate-950">Salesforce Pipeline Sync</h3>
                      <p className="text-xs text-slate-450 mt-1 leading-relaxed font-sans">
                        Push live client quotes into custom Salesforce objects or lead records for contract conversations.
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <div>
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1 font-sans">Target Object</label>
                        <select
                          value={salesforceObject}
                          onChange={(e) => setSalesforceObject(e.target.value)}
                          className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-100 cursor-pointer"
                        >
                          <option value="Lead">Lead Pipelines (Sales)</option>
                          <option value="Contact">Contact Customer Success</option>
                          <option value="Testimonial__c">Custom CustomTestimonial Object</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1 font-sans">Salesforce instance URL</label>
                        <input
                          type="text"
                          defaultValue="trustbuilder-production.my.salesforce.com"
                          className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg outline-none"
                          placeholder="your-org-domain.salesforce.com"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSalesforceConnected(!salesforceConnected);
                      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      setSyncLogs((prev) => [
                        {
                          id: `sf-toggle-${Date.now()}`,
                          timestamp,
                          integration: "Salesforce CRM",
                          message: !salesforceConnected 
                            ? "Connected to Salesforce API environment. Standard lead and custom object sync active." 
                            : "Disconnected Salesforce CRM credentials. Pipelines suspended.",
                          type: !salesforceConnected ? "success" : "warning"
                        },
                        ...prev
                      ]);
                    }}
                    className={`w-full py-2.5 text-xs font-extrabold rounded-xl transition-all border cursor-pointer ${
                      salesforceConnected 
                        ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" 
                        : "bg-sky-600 text-white border-transparent hover:bg-sky-500 shadow-sm"
                    }`}
                  >
                    {salesforceConnected ? "Deactivate Salesforce Pipeline" : "Connect Salesforce CRM"}
                  </button>
                </div>

                {/* 2. E-commerce platforms */}
                <div className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                        <Tag className="w-5.5 h-5.5 text-emerald-600" />
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                        ecommerceConnected 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-slate-100 text-slate-400 border-slate-200"
                      }`}>
                        {ecommerceConnected ? "● Connected" : "○ Inactive"}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-slate-950">E-Commerce Live Store reviews</h3>
                      <p className="text-xs text-slate-450 mt-1 leading-relaxed font-sans">
                        Push star ratings & testimonial content to storefront products for higher shopping cart completions.
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <div>
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1 font-sans">Platform Partner</label>
                        <select
                          value={ecommercePlatform}
                          onChange={(e) => setEcommercePlatform(e.target.value)}
                          className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-202 rounded-lg outline-none focus:ring-2 focus:ring-emerald-100 cursor-pointer"
                        >
                          <option value="Shopify">Shopify Retail Store</option>
                          <option value="WooCommerce">WooCommerce Plugins</option>
                          <option value="BigCommerce">BigCommerce Cloud</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1 font-sans">Fulfillment Store URL</label>
                        <input
                          type="text"
                          value={ecommerceStoreUrl}
                          onChange={(e) => setEcommerceStoreUrl(e.target.value)}
                          className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEcommerceConnected(!ecommerceConnected);
                      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      setSyncLogs((prev) => [
                        {
                          id: `eco-toggle-${Date.now()}`,
                          timestamp,
                          integration: "E-commerce Sync",
                          message: !ecommerceConnected 
                            ? `Connected storefront review widget sync for platform: ${ecommercePlatform} (${ecommerceStoreUrl}).` 
                            : "Suspended e-commerce widget sync. Live store webhooks stopped.",
                          type: !ecommerceConnected ? "success" : "warning"
                        },
                        ...prev
                      ]);
                    }}
                    className={`w-full py-2.5 text-xs font-extrabold rounded-xl transition-all border cursor-pointer ${
                      ecommerceConnected 
                        ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" 
                        : "bg-emerald-600 text-white border-transparent hover:bg-emerald-500 shadow-sm"
                    }`}
                  >
                    {ecommerceConnected ? "Deactivate E-commerce Sync" : "Connect Store System"}
                  </button>
                </div>

                {/* 3. B2B Commercial Sales */}
                <div className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100">
                        <UserCheck className="w-5.5 h-5.5 text-purple-600" />
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                        b2bConnected 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-slate-100 text-slate-400 border-slate-200"
                      }`}>
                        {b2bConnected ? "● Connected" : "○ Inactive"}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-slate-950">B2B Commercial Sales Proof</h3>
                      <p className="text-xs text-slate-450 mt-1 leading-relaxed font-sans">
                        Convert detailed customer stories into enterprise deal collateral or quote pitches for decision makers.
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <div>
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1 font-sans">Outbound pipeline status</label>
                        <select
                          value={b2bPipeline}
                          onChange={(e) => setB2bPipeline(e.target.value)}
                          className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-202 rounded-lg outline-none focus:ring-2 focus:ring-purple-100 cursor-pointer"
                        >
                          <option value="Enterprise Deals Sandbox">Enterprise Deals Sandbox</option>
                          <option value="Inbound CRM Leads">Inbound Lead Verification</option>
                          <option value="Live Pilot Case Proofs">Live Pilot Case Studies</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1 font-sans">Enterprise Lead tier</label>
                        <select
                          className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg outline-none cursor-pointer"
                        >
                          <option>Mid-Market ($50k+ Contract Value)</option>
                          <option>Strategic Enterprise ($150k+ Contract Value)</option>
                          <option>Global Fortune 500 Onboarding</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setB2bConnected(!b2bConnected);
                      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      setSyncLogs((prev) => [
                        {
                          id: `b2b-toggle-${Date.now()}`,
                          timestamp,
                          integration: "B2B Sales Support",
                          message: !b2bConnected 
                            ? `B2B Strategic leads pipeline connected. Syncing live collateral reviews into: "${b2bPipeline}".` 
                            : "B2B Outreach sync disconnected.",
                          type: !b2bConnected ? "success" : "warning"
                        },
                        ...prev
                      ]);
                    }}
                    className={`w-full py-2.5 text-xs font-extrabold rounded-xl transition-all border cursor-pointer ${
                      b2bConnected 
                        ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" 
                        : "bg-purple-600 text-white border-transparent hover:bg-purple-500 shadow-sm"
                    }`}
                  >
                    {b2bConnected ? "Deactivate B2B Pipeline Sync" : "Connect B2B Outreach"}
                  </button>
                </div>

              </div>

              {/* Push Action deck & scrolling monospaced terminal logs */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                
                {/* Control Panel: manual Sync */}
                <div className="lg:col-span-2 bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 space-y-5 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 font-sans">
                      <Sparkles className="w-4 h-4 text-amber-400" /> Push engine controls
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-semibold font-sans">
                      Perform synchronization checks or force past approved quotes/testimonials to active endpoints. If any channel above is connected, TrustBuilder will syndicate all reviews across those platforms' targets in bulk.
                    </p>
                    
                    <div className="bg-slate-950/70 rounded-2xl border border-slate-800/85 p-4 space-y-2 font-sans">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Active Integrations:</span>
                        <span className="text-emerald-400 font-mono text-[10px]">
                          { [salesforceConnected && "SF", ecommerceConnected && "Eco-store", b2bConnected && "B2B-sales"].filter(Boolean).join(" + ") || "0 active" }
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Approved Quotes pool:</span>
                        <span className="text-indigo-400 font-mono text-[10px]">{approvedList.length} reviews ready</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!salesforceConnected && !ecommerceConnected && !b2bConnected) {
                        alert("You must activate at least one sync pipeline (Salesforce, E-commerce, or B2B) first.");
                        return;
                      }
                      
                      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const manualLogs: typeof syncLogs = [];
                      
                      approvedList.forEach((review) => {
                        if (salesforceConnected) {
                          manualLogs.push({
                            id: `manual-sf-${review.id}-${Date.now()}`,
                            timestamp,
                            integration: "Salesforce CRM",
                            message: `[FORCE SYNC] Syndicated legacy review from ${review.name} to target Salesforce object structure as customer verification record.`,
                            type: "success"
                          });
                        }
                        if (ecommerceConnected) {
                          manualLogs.push({
                            id: `manual-eco-${review.id}-${Date.now()}`,
                            timestamp,
                            integration: "E-commerce Sync",
                            message: `[FORCE SYNC] Pushed review by ${review.name} to store dashboard storefront at ${ecommerceStoreUrl}. Live widget updated.`,
                            type: "success"
                          });
                        }
                        if (b2bConnected) {
                          manualLogs.push({
                            id: `manual-b2b-${review.id}-${Date.now()}`,
                            timestamp,
                            integration: "B2B Sales Support",
                            message: `[FORCE SYNC] Attached enterprise verification of ${review.company || "B2B"} to HubSpot pipeline deals: ${b2bPipeline}.`,
                            type: "success"
                          });
                        }
                      });

                      setSyncLogs((prev) => [...manualLogs, ...prev]);
                    }}
                    disabled={approvedList.length === 0 || (!salesforceConnected && !ecommerceConnected && !b2bConnected)}
                    className="w-full py-3.5 bg-gradient-to-r from-rose-500 via-indigo-600 to-emerald-500 text-white font-extrabold text-xs rounded-xl hover:scale-[1.01] active:scale-98 transition-transform cursor-pointer disabled:opacity-45 select-none text-center block uppercase tracking-wider shadow-md font-sans"
                  >
                    Force-Sync All Approved Testimonials Now
                  </button>
                </div>

                {/* monospaced terminal logs (3 columns) */}
                <div className="lg:col-span-3 bg-slate-950 rounded-3xl p-6 border border-slate-900 flex flex-col justify-between space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-905 pb-3 font-sans">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Syndication runtime logs</span>
                    <button
                      onClick={() => setSyncLogs([])}
                      className="text-[9px] font-black text-rose-450 hover:text-rose-400 bg-rose-950/20 px-2.5 py-1 rounded-lg border border-rose-900/40 cursor-pointer"
                    >
                      Clear Log Output
                    </button>
                  </div>

                  <div className="bg-black/40 rounded-2xl p-4 border border-slate-900 min-h-60 max-h-72 overflow-y-auto space-y-2.5 font-mono text-[10px] scrollbar-thin">
                    {syncLogs.length === 0 ? (
                      <div className="text-slate-600 italic text-center py-20 font-sans">
                        No recent synching events. Activate connections or approve a testimonial.
                      </div>
                    ) : (
                      syncLogs.map((log) => (
                        <div key={log.id} className="flex gap-2 items-start border-l border-slate-800 pl-2 leading-relaxed text-left">
                          <span className="text-slate-550 shrink-0 font-bold">[{log.timestamp}]</span>
                          <span className={`shrink-0 font-black px-1.5 py-0.5 rounded-sm text-[8px] uppercase ${
                            log.integration === "Salesforce CRM" 
                              ? "bg-sky-950 text-sky-400 border border-sky-900/40" 
                              : log.integration === "E-commerce Sync" 
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-900/40" 
                                : "bg-purple-950 text-purple-400 border border-purple-900/40"
                          }`}>
                            {log.integration}
                          </span>
                          <span className={`${
                            log.type === "success" 
                              ? "text-emerald-400" 
                              : log.type === "warning" 
                                ? "text-amber-400" 
                                : "text-slate-350"
                          }`}>
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Google Drive and Picker Asset Library Integration */}
              <SaaS_GoogleDriveIntegration 
                selectedSpace={selectedSpace}
                onSpaceUpdate={(updatedSpace) => {
                  setSelectedSpace(updatedSpace);
                  setSpaces(prev => prev.map(s => s.id === updatedSpace.id ? updatedSpace : s));
                }}
                campaigns={campaigns}
                setSyncLogs={setSyncLogs}
              />

            </div>
          )}

          {activeTab === "blueprint" && (
            <div className="space-y-6">
              
              {/* Dynamic Business Blueprint Header Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-7 rounded-3xl border border-slate-750 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase text-amber-400">
                    🏆 Proven Profitable Model: Senja.io Clone ($85k+/mo)
                  </div>
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-5.5 h-5.5 text-amber-400" />
                    B2B Proof / Testimonials SaaS Syndicate
                  </h2>
                  <p className="text-xs text-slate-350 leading-relaxed max-w-2xl font-sans font-medium">
                    TrustBuilder represents a high-stickiness vertical Micro-SaaS. Social proof is non-negotiable for dental clinics, plumbers, and retail checkouts. This interactive blueprint maps out your path to $5,000+/mo MRR.
                  </p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex flex-col items-end shrink-0">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Est. Profit Margin</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">98.6%</span>
                  <span className="text-[9px] text-slate-500 font-semibold font-mono mt-0.5">Minimal server overhead</span>
                </div>
              </div>

              {/* Profitability engine components */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                
                {/* 1. SaaS Parameter Controls Deck (3 columns on desktop) */}
                <div className="lg:col-span-3 bg-white border border-slate-200/70 p-6 rounded-3xl shadow-xs space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Sliders className="w-4.5 h-4.5 text-indigo-500 font-bold" />
                    <h3 className="text-sm font-black text-slate-950 tracking-tight">Interactive Projection Tuner</h3>
                  </div>

                  {/* Input 1: Target MRR */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-705">Target Monthly Recurring Revenue (MRR)</label>
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg font-mono">
                        ${bpTargetMRR.toLocaleString()} / mo
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1000}
                      max={30000}
                      step={500}
                      value={bpTargetMRR}
                      onChange={(e) => setBpTargetMRR(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>$1,000 / mo</span>
                      <span>$15,000 / mo</span>
                      <span>$30,000 / mo</span>
                    </div>
                  </div>

                  {/* Input 2: Subscription Price Tier */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-705 block">SaaS Subscription Pricing Tier (per client)</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[19, 49, 99, 149].map((price) => (
                        <button
                          key={price}
                          onClick={() => setBpMonthlyPrice(price)}
                          className={`py-3 rounded-xl text-xs font-black tracking-wide border cursor-pointer transition-all ${
                            bpMonthlyPrice === price
                              ? "bg-slate-950 border-slate-950 text-white shadow-sm"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          ${price}/mo
                          <span className="block text-[8px] opacity-75 font-normal mt-0.5">
                            {price === 19 ? "Starter Pack" : price === 49 ? "Growth CRM" : price === 99 ? "Pro Suite" : "Enterprise Synced"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input 3: Weekly Outbound Cold Emails */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-705">Weekly Outbound Volume</label>
                        <span className="text-[11px] font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg font-mono">
                          {bpWeeklyEmails} messages
                        </span>
                      </div>
                      <input
                        type="range"
                        min={100}
                        max={3000}
                        step={50}
                        value={bpWeeklyEmails}
                        onChange={(e) => setBpWeeklyEmails(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                      />
                      <span className="text-[10px] font-bold text-slate-400 leading-none block">
                        Direct outreach via cold tools (Apollo.io, mails)
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-705">Outbound Sign-up Rate</label>
                        <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg font-mono">
                          {bpConversionRate.toFixed(1)}% Conversion
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={5.0}
                        step={0.1}
                        value={bpConversionRate}
                        onChange={(e) => setBpConversionRate(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                      />
                      <span className="text-[10px] font-bold text-slate-400 leading-none block">
                        Outbound contacts converting to active paying plans
                      </span>
                    </div>
                  </div>

                </div>

                {/* 2. live Projections Card outputs (2 columns on desktop) */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-3xl text-white flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">Dynamic Yield Matrix</span>
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Required Active Accounts</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-white font-mono">
                            {Math.ceil(bpTargetMRR / bpMonthlyPrice)}
                          </span>
                          <span className="text-[11px] text-slate-400 font-bold">clients</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-semibold mt-1 block">
                          At standard pricing of ${bpMonthlyPrice}/mo
                        </span>
                      </div>

                      <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Projected Signups / mo</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-amber-400 font-mono">
                            {Math.floor(bpWeeklyEmails * 4 * (bpConversionRate / 100))}
                          </span>
                          <span className="text-[11px] text-slate-400 font-bold">signups</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-semibold mt-1 block">
                          Based on {bpWeeklyEmails} outreach/week
                        </span>
                      </div>
                    </div>

                    {/* Time to target MRR */}
                    <div className="bg-slate-950/70 p-4 rounded-2xl border border-indigo-900/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 block mb-1">Estimated Time to Target</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-indigo-400 font-mono">
                              {(() => {
                                const required = Math.ceil(bpTargetMRR / bpMonthlyPrice);
                                const monthlySignups = Math.floor(bpWeeklyEmails * 4 * (bpConversionRate / 100));
                                if (monthlySignups === 0) return "∞";
                                return Math.max(1, Math.ceil(required / monthlySignups));
                              })()}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">Months of Outbound Outreach</span>
                          </div>
                        </div>
                        <div className="bg-indigo-950 text-indigo-300 text-[10px] font-black tracking-wiest uppercase py-1 px-2.5 rounded-lg border border-indigo-900/60 font-mono">
                          High Speed
                        </div>
                      </div>
                    </div>

                    {/* Exit Valuation block on Acquire.com */}
                    <div className="bg-gradient-to-br from-emerald-950/30 to-slate-900 p-4 rounded-2xl border border-emerald-900/40 space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">Acquisition Valuation (4x ARR Multiplier)</span>
                      <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight leading-none pt-1">
                        ${(bpTargetMRR * 12 * 4).toLocaleString()}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                        SaaS buyers on platforms like Acquire.com pay premium multiples of 4-6x ARR for products with recurring credit pools and locked integrations sync.
                      </p>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono pt-3 border-t border-slate-800 leading-relaxed text-left flex gap-1.5 items-center">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Blueprints assume ~5% churn variables and standard cloud hosting.</span>
                  </div>
                </div>

              </div>

              {/* Outreach Pitch Studio & Copywriter generator section */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                
                {/* Outbound templates selector tabs (2 columns) */}
                <div className="md:col-span-2 bg-white border border-slate-200/75 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                        <Mail className="w-4.5 h-4.5 text-amber-500" />
                        Outbound Campaign Pitch Studio
                      </h3>
                      <p className="text-xs text-slate-450 mt-1 leading-relaxed font-sans">
                        SaaS is won through distribution. Select your target market segment to generate custom cold pitch strategies optimized for conversion.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-sans">Select Market Vertical</label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {[
                          { id: "dentist", label: "🦷 Local Dental Clinics", description: "Target patient reviews & emergency bookings" },
                          { id: "plumber", label: "🔧 Residential Plumbing Leads", description: "Text review requests upon job completion" },
                          { id: "salon", label: "🌸 High-End Styling Salons", description: "Embed stylish checkout conversion gallery" },
                          { id: "agency", label: "💼 Professional B2B Agencies", description: "Sync wins into CRM systems automatically" }
                        ].map((niche) => (
                          <button
                            key={niche.id}
                            onClick={() => setBpTargetNiche(niche.id as any)}
                            className={`p-3 rounded-xl border flex flex-col items-start cursor-pointer text-left transition-all ${
                              bpTargetNiche === niche.id
                                ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20"
                                : "bg-slate-50/50 hover:bg-slate-50 border-slate-200"
                            }`}
                          >
                            <span className="text-xs font-black text-slate-900">{niche.label}</span>
                            <span className="text-[10px] text-slate-450 font-semibold mt-0.5 leading-none">{niche.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/50 text-[10px] text-amber-805 leading-relaxed font-semibold font-sans">
                    💡 <strong>Founders Tip:</strong> Search 10 local directories in your zip code. Reach out directly using this pitch to sign up your first 3 trial accounts on your first weekend!
                  </div>
                </div>

                {/* monospaced template email display (3 columns) */}
                <div className="md:col-span-3 bg-slate-950 rounded-3xl p-6 border border-slate-900 flex flex-col justify-between space-y-4 text-white">
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Email Campaign Outreach Script</span>
                        <div className="text-xs font-bold text-slate-200">
                          Subject: {(() => {
                            if (bpTargetNiche === "dentist") return "Quick fix for dental search presence near me";
                            if (bpTargetNiche === "plumber") return "Increase emergency leak bookings on auto-pilot";
                            if (bpTargetNiche === "salon") return "Quick visual fix to increase salon bookings";
                            return "Syndicate client wins automatically to close retainers";
                          })()}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          const body = document.getElementById("bpOutreachScript")?.innerText || "";
                          navigator.clipboard.writeText(body);
                          const notifier = document.getElementById("bpClipboardFeedback");
                          if (notifier) {
                            notifier.classList.remove("opacity-0");
                            setTimeout(() => {
                              notifier.classList.add("opacity-0");
                            }, 2500);
                          }
                        }}
                        className="text-[10px] font-black text-amber-400 hover:text-amber-300 bg-amber-950/20 px-3.5 py-1.5 rounded-xl border border-amber-900/40 cursor-pointer flex items-center gap-1 hover:scale-[1.01] transition-transform"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy Outreach Script
                      </button>
                    </div>

                    {/* Interactive Copied Feedback Indicator and Template */}
                    <div className="relative">
                      <div 
                        id="bpClipboardFeedback" 
                        className="absolute top-2 right-2 bg-emerald-500 text-white px-3 py-1 text-[10px] font-black rounded-lg shadow-md flex items-center gap-1 opacity-0 transition-opacity duration-300 pointer-events-none z-10 font-sans"
                      >
                        <Check className="w-3.5 h-3.5" /> Copied custom script! 🎉
                      </div>

                      <div 
                        id="bpOutreachScript" 
                        className="bg-black/50 text-slate-300 font-mono text-[10.5px] leading-relaxed p-4 rounded-xl border border-slate-800 min-h-60 max-h-75 overflow-y-auto text-left select-text whitespace-pre-wrap"
                      >
                        {(() => {
                          const targetCampaign = campaigns[0] || { slug: "campaign", title: "Target Brand" };
                          const targetUrl = `${window.location.origin}/form/${targetCampaign.slug}`;
                          
                          if (bpTargetNiche === "dentist") {
                            return `Hey [Doctor Name],\n\nMy name is [Your Name], and I was inspecting dentist listings in our neighborhood when I came across your dental practice website.\n\nYou have amazing checkup services, but modern dental patients read verified customer reviews before scheduling are appointment. If a customer doesn't see trust signals inside of 10 seconds, they book with the clinic down the road.\n\nI built a small, specialized testimonial system called TrustBuilder designed specifically for dental practices. Your receptionist can use our beautiful lobby-tablet form to collect high-quality checkup reviews in 12 seconds.\n\nI set up a dedicated lobby campaign sandbox page for your dental clinic:\n👉 ${targetUrl}\n\nCan I send you a quick 1-minute video explaining how to link this to your Google profile and get 5+ extra high-value implants or emergency checkups next month?\n\nBest regards,\n[Your Name]\nLead Founder, TrustBuilder SaaS`;
                          }
                          
                          if (bpTargetNiche === "plumber") {
                            return `Hi [Owner Name],\n\nI saw your team's local service van in our area yesterday and decided to check your business site.\n\nYour leak-repair scores are great, but local homeowners hire residential plumbers exclusively based on immediate trust. They want to see current, star-rated feedback the moment they requests a repair quote.\n\nI run TrustBuilder, a simplified Micro-SaaS designed to let dispatch technicians text a simple 1-click review link the very second a job is finished. Approving reviews publishes them right to your site automatically.\n\nI built this test sandbox form for your plumbing brand:\n👉 ${targetUrl}\n\nCould we jump on a brief 5-minute call on Monday to activate this and boost checkout conversions by 25%?\n\nCheers,\n[Your Name]`;
                          }
                          
                          if (bpTargetNiche === "salon") {
                            return `Hello [Creative Director],\n\nI am a huge fan of your salon's custom cuts on Instagram! The styling outcomes are absolute artistry.\n\nBut here is a quick insight: over 91% of salon customers read peer styling experiences before booking a seat. Merely sharing screenshots is slow, and clients expect interactive layouts.\n\nUsing TrustBuilder, you can generate client quotes on autopilot. Approved ratings display as interactive badges right on your main booking page.\n\nCheck out the dynamic review lobby link I made for your salon:\n👉 ${targetUrl}\n\nCould I help you embed our Carousel layout on your booking page next Wednesday for free to help fill up next week's empty chairs?\n\nBest wishes,\n[Your Name]`;
                          }
                          
                          // agency
                          return `Hey [Partner Name],\n\nStandard text reviews aren't enough to close competitive high-ticket enterprise contracts anymore. B2B software buyers expect validated client outcomes synced across deal channels.\n\nI founded TrustBuilder, a streamlined testimonial engine built for developers and services models. It collects verified ratings and pushes them directly into Salesforce opportunities, HubSpot lead pipelines, or enterprise sales decks automatically.\n\nHere is your custom workspace link:\n👉 ${targetUrl}\n\nWould you be open to trying our Enterprise Sync tier for 7 days for free to automate client proof delivery in your pitch process?\n\nRegards,\n[Your Name]`;
                        })()}
                      </div>
                    </div>

                  </div>

                </div>

              </div>

              {/* Step-by-step Founder Milestone Guide */}
              <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-sm font-black text-slate-950 tracking-tight">Your 30-Day Launch Blueprint Checklist</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1 font-sans">
                  
                  <div className="space-y-1.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl relative text-left">
                    <div className="absolute top-3 right-3 text-[10px] font-black text-slate-450 bg-slate-205 py-0.5 px-2 rounded-md">
                      Days 1-5
                    </div>
                    <strong>1. Define Niche Focus</strong>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Select 1 high-value industry (family dentists, custom home builders, or salons). Don't sell to everyone; vertical focus reduces trust friction.
                    </p>
                  </div>

                  <div className="space-y-1.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl relative text-left">
                    <div className="absolute top-3 right-3 text-[10px] font-black text-slate-450 bg-slate-205 py-0.5 px-2 rounded-md">
                      Days 6-15
                    </div>
                    <strong>2. Seed Sandbox Campaigns</strong>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Launch 2 test campaigns inside our TrustBuilder platform. Configure tailored questionnaire templates (E-commerce storefronts or CRM).
                    </p>
                  </div>

                  <div className="space-y-1.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl relative text-left">
                    <div className="absolute top-3 right-3 text-[10px] font-black text-slate-450 bg-slate-205 py-0.5 px-2 rounded-md">
                      Days 16-25
                    </div>
                    <strong>3. Send Cold Outreach</strong>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Find 50 local directory leads. Send our copy-optimized outbound scripts. Offer a free 14-day setup session to secure early beta users.
                    </p>
                  </div>

                  <div className="space-y-1.5 p-4 bg-amber-50/40 border border-amber-200 rounded-2xl relative text-left">
                    <div className="absolute top-3 right-3 text-[10px] font-black text-amber-600 bg-amber-100 py-0.5 px-2 rounded-md">
                      Days 26-30
                    </div>
                    <strong>4. Lock Billing & Scale</strong>
                    <p className="text-[11px] text-slate-600 font-semibold leading-relaxed font-sans">
                      Connect your Stripe account, close your first 3 paid accounts at $49/mo, and list on Acquire.com once you reach structural profitability!
                    </p>
                  </div>

                </div>
              </div>

            </div>
          )}

          {activeTab === "billing" && (
            <div className="space-y-6">
              
              {/* Active Workspace Status Panel */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white p-7 rounded-3xl border border-indigo-900/60 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-fade-in">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/35 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase text-emerald-400">
                    💳 Enterprise billing control panel
                  </div>
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 font-sans">
                    <Wallet className="w-5.5 h-5.5 text-emerald-400 animate-pulse" />
                    Workspace Billing Settings
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold max-w-xl font-sans">
                    Configure high-throughput commercial plans for <strong className="text-white">{selectedSpace?.name || "your business account"}</strong>. Choose between credit card pools or integrated local Mobile Money channels to lock in B2B subscriptions automatically.
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 w-full md:w-auto min-w-48 text-center md:text-left space-y-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-mono">Active Workspace</span>
                  <div className="text-base font-black text-white flex items-center justify-center md:justify-start gap-1.5 leading-none">
                    <Building className="w-4 h-4 text-emerald-400" />
                    {selectedSpace?.name || "Sandbox Business"}
                  </div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Owner: {currentUser ? currentUser.email : "Guest Session"}</span>
                </div>
              </div>

              {/* Grid 2 Column */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* TIER SUBSCRIPTION PACKAGES SELECTOR */}
                <div className="lg:col-span-2 space-y-6">
                  
                  <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-sm space-y-5">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-black text-slate-955 flex items-center gap-2">
                        <Tag className="w-4.5 h-4.5 text-emerald-500" />
                        Select Subscription Plan
                      </h3>
                      <p className="text-xs text-slate-450 font-semibold leading-relaxed font-sans mt-0.5">
                        Update your active merchant plan. Subscriptions are billed automatically to your configured payment method every month.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { id: "Free Tier", price: "$0/mo", desc: "Up to 5 live testimonials, standard widgets", features: ["5 Approved Testimonials", "Standard Star Rating Widget", "Manual Link Share"] },
                        { id: "Growth CRM ($49/mo)", price: "$49/mo", desc: "Perfect for local dental clinics and plumber setups", features: ["120 Reviews Billed", "Vite Dynamic Embeds", "Direct Email Custom Pitch", "Support for M-Pesa/MoMo"] },
                        { id: "Pro Suite ($99/mo)", price: "$99/mo", desc: "Ideal for fast scaling e-commerce retail networks", features: ["Unlimited Reviews", "5 Configured Widgets", "Shopify Automation API Sync", "Dedicated SMS Gateway Access"] },
                        { id: "Enterprise Sync ($149/mo)", price: "$149/mo", desc: "Direct Salesforce CRM pushes and webhook pipelines", features: ["Full Salesforce CRM Pipeline Sync", "B2B Custom Lead Objects", "Dedicated SLAs and Account Managers", "Premium Credit Card & Momo Setup"] }
                      ].map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => setBillingPlan(plan.id as any)}
                          className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                            billingPlan === plan.id
                              ? "bg-emerald-50/40 border-emerald-500 ring-2 ring-emerald-500/10"
                              : "bg-slate-50/50 hover:bg-slate-100/50 border-slate-200"
                          }`}
                        >
                          <div className="space-y-1 w-full">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-black text-slate-955 truncate pr-1">{plan.id}</span>
                              <span className="text-xs font-black text-emerald-600 font-mono shrink-0">{plan.price}</span>
                            </div>
                            <span className="text-[10px] text-slate-450 font-semibold block leading-tight">{plan.desc}</span>
                          </div>
                          
                          <div className="mt-3.5 pt-2 border-t border-slate-100/80 w-full space-y-1">
                            {plan.features.slice(0, 2).map((feat, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-[9px] text-slate-500 font-extrabold font-mono">
                                <span className="text-emerald-500">✓</span> {feat}
                              </div>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ACTIVE COMPLIANT PAYMENT INVOICES HISTORIC TABLE */}
                  <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-955 flex items-center gap-2">
                          <Database className="w-4.5 h-4.5 text-indigo-500" />
                          Billing History & Invoices
                        </h3>
                        <p className="text-[11px] text-slate-450 font-semibold font-sans mt-0.5">
                          View automated transaction ledger receipts generated for your active workspace.
                        </p>
                      </div>
                      <span className="text-[9px] text-slate-450 font-mono font-bold uppercase">{momoInvoices.length} transactions</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-semibold">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-black tracking-wider font-sans">
                            <th className="py-2 font-bold text-slate-500">Invoice ID</th>
                            <th className="py-2 font-bold text-slate-500">Date</th>
                            <th className="py-2 font-bold text-slate-500">Description</th>
                            <th className="py-2 font-bold text-slate-500">Method</th>
                            <th className="py-2 text-right font-bold text-slate-500">Amount</th>
                            <th className="py-2 text-right font-bold text-slate-500">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {momoInvoices.map((inv) => (
                            <tr key={inv.id} className="text-slate-705 font-mono text-[11px]">
                              <td className="py-3 font-bold text-slate-900">{inv.id}</td>
                              <td className="py-3 text-slate-550">{inv.date}</td>
                              <td className="py-3 text-slate-805 font-sans font-bold">{inv.description}</td>
                              <td className="py-3 text-slate-550">{inv.method}</td>
                              <td className="py-3 text-right font-black text-slate-900">{inv.amount}</td>
                              <td className="py-3 text-right">
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider font-sans">
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                {/* MOBILE MONEY CONFIG PANEL (1 COLUMN) */}
                <div className="space-y-6">
                  
                  <div className="bg-white border border-slate-205 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
                        <CreditCard className="w-4.5 h-4.5 text-emerald-500" />
                        Billing Payment Method
                      </h3>
                      <p className="text-[10px] text-slate-450 font-semibold leading-relaxed mt-0.5 font-sans">
                        Accepting global cards and localized commercial Mobile Money for frictionless sandbox setups.
                      </p>
                    </div>

                    {/* Show verified mobile money status */}
                    {momoVerificationStep === "success" && selectedSpace?.paymentMethod?.type === "mobile_money" ? (
                      <div className="space-y-4">
                        
                        <div className="bg-emerald-500/5 border border-emerald-200 p-4 rounded-2xl flex flex-col items-start gap-2.5 relative overflow-hidden">
                          <span className="absolute top-3 right-3 text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase px-2 py-0.5 rounded-md tracking-wider font-mono">
                            Verified Active
                          </span>
                          
                          <div className="h-9 w-9 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-205 shadow-sm">
                            <Check className="w-4.5 h-4.5" />
                          </div>

                          <div className="space-y-0.5 text-left">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Mobile Money Account</span>
                            <h4 className="text-xs font-black text-slate-900">{selectedSpace.paymentMethod.momoProvider} Payment Account</h4>
                            <p className="text-xs font-bold text-slate-755 font-mono">{selectedSpace.paymentMethod.momoPhoneNumber}</p>
                            <p className="text-[10px] font-semibold text-slate-500 mt-0.5 font-sans">Holder: {selectedSpace.paymentMethod.momoAccountName}</p>
                          </div>
                        </div>

                        {paymentSuccessMessage && (
                          <div className="bg-emerald-55/10 text-emerald-805 text-[10.5px] p-3 rounded-xl border border-emerald-200 leading-relaxed font-semibold">
                            {paymentSuccessMessage}
                          </div>
                        )}

                        <div className="space-y-3.5 border-t border-slate-100 pt-4 text-left">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest font-mono">Billed API credit booster</span>
                          
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col">
                            <div className="flex justify-between items-baseline">
                              <span className="text-xs font-black text-slate-800">1,000 SMS Request Bundle</span>
                              <span className="text-sm font-black font-mono text-emerald-600">$15</span>
                            </div>
                            <p className="text-[10px] text-slate-450 leading-tight font-semibold font-sans">
                              Boost your campaign rate immediately. Bills connected number {selectedSpace.paymentMethod.momoPhoneNumber} instantly via STK push.
                            </p>
                            
                            <button
                              onClick={() => {
                                setIsVerifyingMomo(true);
                                setMomoError("");
                                setTimeout(() => {
                                  setIsVerifyingMomo(false);
                                  
                                  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                  setSyncLogs(prev => [
                                    {
                                      id: `momo-add-${Date.now()}`,
                                      timestamp,
                                      integration: "Mobile Money credit push",
                                      message: `STK push authorized on handset. Charged $15.00 to account ${selectedSpace.paymentMethod?.momoAccountName}. SMS credit booster active.`,
                                      type: "success"
                                    },
                                    ...prev
                                  ]);

                                  setMomoInvoices(prev => [
                                    {
                                      id: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
                                      date: new Date().toISOString().split('T')[0],
                                      description: "SMS Request Credit Booster Pool (1k)",
                                      amount: "$15.00",
                                      status: "paid",
                                      method: `${selectedSpace.paymentMethod?.momoProvider} Carrier`
                                    },
                                    ...prev
                                  ]);

                                  alert(`Successfully charged $15.00 via Carrier STK-Push to ${selectedSpace.paymentMethod?.momoPhoneNumber}! 🎉 Invoice created dynamically.`);
                                }, 1500);
                              }}
                              disabled={isVerifyingMomo}
                              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-450 hover:to-teal-450 text-white font-extrabold text-[10.5px] rounded-lg tracking-wider disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-400 outline-none hover:scale-[1.01] transition-transform duration-100 cursor-pointer"
                            >
                              {isVerifyingMomo ? (
                                <>
                                  <Loader className="w-3.5 h-3.5 animate-spin" /> Authorization push pending...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" /> Charge $15.00 via Carrier Push
                                </>
                              )}
                            </button>
                          </div>

                          <button
                            onClick={handleDisconnectMomo}
                            disabled={isVerifyingMomo}
                            className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-850 font-black text-[11px] rounded-xl border border-rose-205 transition-colors cursor-pointer"
                          >
                            Remove Carrier Connection
                          </button>
                        </div>

                      </div>
                    ) : (
                      <div className="space-y-4">
                        
                        {/* Interactive state panels for Adding Payment */}
                        {momoVerificationStep === "otp" ? (
                          <div className="space-y-4 font-sans text-left">
                            <div className="bg-amber-50 border border-amber-205 p-4 rounded-2xl space-y-2 relative overflow-hidden">
                              <span className="absolute top-3 right-3 text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md tracking-wider font-mono">
                                Awaiting push approval
                              </span>
                              
                              <div className="h-8 w-8 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 border border-amber-205">
                                <Clock className="w-4 h-4 animate-spin" />
                              </div>

                              <div className="space-y-1">
                                <h4 className="text-xs font-black text-slate-900">Handset Auth Push Delivered</h4>
                                <p className="text-[10.5px] text-slate-550 leading-relaxed font-semibold">
                                  We have delivered an OTC validation packet to your registered <strong className="text-slate-800">{momoProvider} ({momoCountry} {momoNumber})</strong> handset profile.
                                </p>
                              </div>

                              <div className="bg-white/85 p-2.5 rounded-xl border border-amber-200 font-mono text-[9px] text-amber-805 shadow-inner">
                                💡 <strong>Sandbox OTP Bypass:</strong> Enter verification code <strong className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-150 font-bold">1234</strong> to verify.
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block font-sans">Enter 4-Digit OTC Match Code</label>
                              <input
                                type="text"
                                maxLength={4}
                                value={momoOtpCode}
                                onChange={(e) => setMomoOtpCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="e.g. 1234"
                                className="w-full text-center font-bold font-mono tracking-widest text-lg py-2 bg-slate-50 border border-slate-205 rounded-xl outline-none focus:ring-2 focus:ring-amber-200"
                              />
                            </div>

                            {momoError && (
                              <div className="p-2.5 bg-red-50 text-red-700 border border-red-200/50 rounded-xl text-[10px] font-semibold leading-tight">
                                ⚠️ {momoError}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                onClick={() => {
                                  setMomoVerificationStep("idle");
                                  setMomoOtpCode("");
                                  setMomoError("");
                                }}
                                className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-205 rounded-xl text-xs font-extrabold text-slate-550 transition-colors cursor-pointer text-center"
                              >
                                Back
                              </button>

                              <button
                                onClick={handleConfirmMomoOtp}
                                disabled={isVerifyingMomo}
                                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 border border-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                {isVerifyingMomo ? (
                                  <>
                                    <Loader className="w-4 h-4 animate-spin text-white" /> Verifying...
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-4 h-4" /> Activate
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={handleSaveMomoPaymentMethod} className="space-y-4 text-left">
                            
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1 flex flex-col font-sans">
                              <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Connected Plan Target</span>
                              <strong className="text-xs text-slate-805 leading-none">{billingPlan}</strong>
                              <span className="text-[10px] text-slate-500 font-semibold leading-normal font-sans">Billed securely at active tier. Change tiers anytime.</span>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-sans">Select Mobile Operator Channel</label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[
                                  { name: "M-Pesa", color: "border-emerald-300 text-emerald-800 bg-emerald-50/20" },
                                  { name: "MTN MoMo", color: "border-amber-300 text-amber-805 bg-amber-50/20" },
                                  { name: "Airtel Money", color: "border-red-350 text-red-800 bg-red-50/10" }
                                ].map((op) => (
                                  <button
                                    key={op.name}
                                    type="button"
                                    onClick={() => setMomoProvider(op.name)}
                                    className={`p-2 rounded-xl border text-[11px] font-extrabold flex items-center justify-center transition-all cursor-pointer ${
                                      momoProvider === op.name 
                                        ? `${op.color} shadow-sm ring-2 ring-emerald-500/10 scale-102` 
                                        : "bg-white border-slate-200 text-slate-550 hover:bg-slate-50"
                                    }`}
                                  >
                                    {op.name}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Row Inputs */}
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-sans">Country</label>
                                <select
                                  value={momoCountry}
                                  onChange={(e) => setMomoCountry(e.target.value)}
                                  className="w-full text-xs font-bold px-2 py-2.5 bg-slate-50 border border-slate-205 rounded-xl outline-none cursor-pointer"
                                >
                                  <option value="+254">+254 (KE)</option>
                                  <option value="+233">+233 (GH)</option>
                                  <option value="+234">+234 (NG)</option>
                                  <option value="+251">+251 (ET)</option>
                                  <option value="+256">+256 (UG)</option>
                                  <option value="+221">+221 (SN)</option>
                                  <option value="+63">+63 (PH)</option>
                                </select>
                              </div>

                              <div className="col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-sans">Phone Number</label>
                                <input
                                  type="tel"
                                  pattern="[0-9]*"
                                  placeholder="e.g. 712345678"
                                  value={momoNumber}
                                  onChange={(e) => setMomoNumber(e.target.value.replace(/\D/g, ''))}
                                  className="w-full text-xs font-mono font-bold px-3 py-2.5 bg-slate-50 border border-slate-205 rounded-xl outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-sans">Registered Account Holder Name</label>
                              <input
                                type="text"
                                placeholder="Registered Subscriber Name"
                                value={momoAccountName}
                                onChange={(e) => setMomoAccountName(e.target.value)}
                                className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 border border-slate-205 rounded-xl outline-none"
                              />
                            </div>

                            {momoError && (
                              <div className="p-2.5 bg-red-50 text-red-700 border border-red-200/50 rounded-xl text-[10px] font-semibold leading-tight">
                                ⚠️ {momoError}
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={isVerifyingMomo}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2 border border-emerald-700 tracking-wider font-mono uppercase"
                            >
                              {isVerifyingMomo ? (
                                <>
                                  <Loader className="w-4.5 h-4.5 animate-spin text-white" /> Issuing STK push...
                                </>
                              ) : (
                                <>
                                  <Check className="w-4.5 h-4.5" /> Initialize Carrier Connect
                                </>
                              )}
                            </button>

                          </form>
                        )}

                        <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-200/40 text-[10px] text-amber-805 leading-relaxed font-semibold">
                          🛡️ <strong>Compliance Safeguard:</strong> All Mobile Money transactions are verified directly via SMS/USSD client token matching before executing standard subscription billing invoices.
                        </div>

                      </div>
                    )}

                  </div>

                  {/* TWO-FACTOR AUTHENTICATION SECURITY CARD */}
                  <div className="bg-white border border-slate-205 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3 font-sans text-left">
                      <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
                        <UserCheck className="w-4.5 h-4.5 text-indigo-500" />
                        Security Settings
                      </h3>
                      <p className="text-[10px] text-slate-450 font-semibold leading-relaxed mt-0.5">
                        Enforce multi-factor verification gatekeepers to protect your reputation campaigns and user data pools.
                      </p>
                    </div>

                    {/* WIZARD: ACTIVE DEACTUATED / NOT CONFIGURED STEP */}
                    {(!twoFactorConfig || !twoFactorConfig.twoFactorEnabled) && twoFactorSetupStep === "none" && (
                      <div className="space-y-4 text-left font-sans">
                        <div className="p-4 bg-slate-50 border border-slate-205 rounded-2xl flex items-start gap-3">
                          <div className="h-9 w-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200 shrink-0 font-bold">⚠️</div>
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-black text-slate-905">Two-Factor Authentication is Disabled</h4>
                            <p className="text-[10px] text-slate-450 font-semibold leading-relaxed">
                              Add an extra layer of defense. In addition to credentials, verify log-ins with a dynamic passcode via mobile apps, SMS, or secure email pools.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={handleStart2FAConfig}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3.5 font-bold text-xs tracking-wide shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Configure & Enable 2FA Security
                        </button>
                      </div>
                    )}

                    {/* WIZARD: CONFIGURING SETUP TAB */}
                    {twoFactorSetupStep === "configure" && (
                      <div className="space-y-4 text-left font-sans">
                        <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Step 1: Select 2FA Method</span>
                        
                        <div className="grid grid-cols-3 gap-2">
                          {(["app", "sms", "email"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setTemp2FAType(m)}
                              className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                                temp2FAType === m
                                  ? "bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500/10"
                                  : "bg-slate-50 hover:bg-slate-100/70 border-slate-200"
                              }`}
                            >
                              <div className="text-base mb-1">
                                {m === "app" ? "📱" : m === "sms" ? "💬" : "✉️"}
                              </div>
                              <span className="text-[10px] font-extrabold capitalize text-slate-800">
                                {m === "app" ? "App" : m === "sms" ? "SMS" : "Email"}
                              </span>
                            </button>
                          ))}
                        </div>

                        {temp2FAType === "app" && (
                          <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed">
                            <h4 className="text-xs font-bold text-slate-800">Authenticator App</h4>
                            <p className="text-[9.5px] text-slate-500 font-semibold leading-normal">
                              Compatible with standard Google Authenticator, Authy, Microsoft Authenticator, or 1Password. Generates localized time-sensitive secure OTP codes.
                            </p>
                          </div>
                        )}

                        {temp2FAType === "sms" && (
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Input Cellphone Number</label>
                              <input
                                type="tel"
                                placeholder="+1 (555) 000-0000"
                                value={temp2FAPhone}
                                onChange={(e) => setTemp2FAPhone(e.target.value)}
                                className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none"
                              />
                            </div>
                            <p className="text-[9px] text-slate-450 font-semibold">SMS code delivery values will simulate actual telecommunication gate messages logs.</p>
                          </div>
                        )}

                        {temp2FAType === "email" && (
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Input Support Email Pool</label>
                              <input
                                type="email"
                                placeholder="your-email@example.com"
                                value={temp2FAEmail}
                                onChange={(e) => setTemp2FAEmail(e.target.value)}
                                className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none"
                              />
                            </div>
                            <p className="text-[9px] text-slate-450 font-semibold">Email confirmation requests are pushed into standard automated inbox threads.</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setTwoFactorSetupStep("none")}
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (temp2FAType === "sms" && !temp2FAPhone.trim()) {
                                alert("Please provide a valid SMS contact phone number.");
                                return;
                              }
                              if (temp2FAType === "email" && !temp2FAEmail.trim()) {
                                alert("Please provide a valid backup email context.");
                                return;
                              }
                              
                              if (twoFactorConfig) {
                                setTwoFactorConfig({
                                  ...twoFactorConfig,
                                  twoFactorType: temp2FAType,
                                  phoneNumber: temp2FAPhone,
                                  emailAddress: temp2FAEmail || currentUser?.email || "sandbox-user@example.com"
                                });
                              }
                              setTwoFactorSetupStep("verify");
                            }}
                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer text-center"
                          >
                            Continue Setup
                          </button>
                        </div>
                      </div>
                    )}

                    {/* WIZARD: VERIFYING SETUP STEP */}
                    {twoFactorSetupStep === "verify" && twoFactorConfig && (
                      <div className="space-y-4 text-left font-sans">
                        <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Step 2: Confirm Code Activation</span>

                        {temp2FAType === "app" && (
                          <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center">
                            {/* QR CODE VECTOR MOCKUP */}
                            <div className="h-28 w-28 bg-white border border-slate-205 rounded-xl p-2.5 flex items-center justify-center relative overflow-hidden shadow-inner shrink-0 leading-none">
                              <svg viewBox="0 0 100 100" className="w-full h-full text-slate-800">
                                <rect x="0" y="0" width="22" height="22" fill="currentColor"/>
                                <rect x="2" y="2" width="18" height="18" fill="white"/>
                                <rect x="6" y="6" width="10" height="10" fill="currentColor"/>
                                
                                <rect x="78" y="0" width="22" height="22" fill="currentColor"/>
                                <rect x="80" y="2" width="18" height="18" fill="white"/>
                                <rect x="84" y="6" width="10" height="10" fill="currentColor"/>

                                <rect x="0" y="78" width="22" height="22" fill="currentColor"/>
                                <rect x="2" y="80" width="18" height="18" fill="white"/>
                                <rect x="6" y="84" width="10" height="10" fill="currentColor"/>

                                <rect x="30" y="10" width="15" height="4" fill="currentColor"/>
                                <rect x="52" y="30" width="8" height="8" fill="currentColor"/>
                                <rect x="44" y="55" width="20" height="4" fill="currentColor"/>
                                <rect x="70" y="32" width="4" height="25" fill="currentColor"/>
                                <rect x="35" y="35" width="12" height="12" fill="currentColor"/>
                                <rect x="44" y="75" width="15" height="15" fill="currentColor"/>
                                <rect x="74" y="74" width="12" height="12" fill="currentColor"/>
                              </svg>
                            </div>
                            
                            <div className="space-y-1 text-center w-full">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Secret Key Setup</span>
                              <div className="text-xs font-mono font-bold text-slate-905 bg-white border border-slate-200 rounded px-2 py-1.5 flex items-center justify-center gap-1.5 leading-none">
                                <span>{twoFactorConfig.totpSecret}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(twoFactorConfig.totpSecret || "KVKG U2S3 N5XG Y6TS");
                                    alert("Secret key copied to clipboard!");
                                  }}
                                  className="p-[1px] hover:text-indigo-600 cursor-pointer"
                                  title="Copy"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {temp2FAType === "sms" && (
                          <div className="p-3 bg-emerald-500/5 border border-emerald-200/50 rounded-2xl text-[10.5px] leading-relaxed text-emerald-850 font-semibold">
                            💬 Verification code sent successfully to handset profile: <strong className="text-slate-800">{temp2FAPhone}</strong>. Check simulation logs or sandbox bypass tool below.
                          </div>
                        )}

                        {temp2FAType === "email" && (
                          <div className="p-3 bg-emerald-500/5 border border-emerald-200/50 rounded-2xl text-[10.5px] leading-relaxed text-emerald-850 font-semibold font-sans">
                            ✉️ Validation code dispatched successfully to active inbox target: <strong className="text-slate-800">{temp2FAEmail}</strong>.
                          </div>
                        )}

                        <div className="space-y-1 flex flex-col">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Confirm dynamic passcode</label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="e.g. 000000"
                            value={twoFactorVerificationCode}
                            onChange={(e) => setTwoFactorVerificationCode(e.target.value.replace(/\D/g, ""))}
                            className="w-full text-center tracking-widest font-mono font-black text-base py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-900"
                          />
                        </div>

                        {twoFactorVerificationError && (
                          <div className="p-2 text-rose-800 bg-rose-50 border border-rose-100 rounded-xl text-[10.5px] font-semibold leading-relaxed">
                            ⚠️ {twoFactorVerificationError}
                          </div>
                        )}

                        {/* LIVE SANDBOX DEPOSITED PIN DISPLAY */}
                        <div className="bg-amber-50/50 border border-amber-205/65 p-3 rounded-xl space-y-1 text-[10px] leading-normal font-semibold">
                          <div className="flex justify-between items-center text-amber-850">
                            <span className="font-bold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Dynamic active passcode:
                            </span>
                            <span className="font-black font-mono text-xs bg-amber-100 hover:bg-amber-205 border border-amber-300 rounded px-1.5 py-0.5 cursor-pointer" onClick={() => setTwoFactorVerificationCode(getTOTPCode(twoFactorConfig.totpSecret || "KVKG U2S3 N5XG Y6TS"))}>
                              {getTOTPCode(twoFactorConfig.totpSecret || "KVKG U2S3 N5XG Y6TS")} (click)
                            </span>
                          </div>
                          
                          {temp2FAType === "app" && (
                            <div className="flex justify-between items-center text-[9px] text-slate-500 leading-none">
                              <span>Code rotates in:</span>
                              <strong>{totpCountdown}s</strong>
                            </div>
                          )}
                          <p className="text-[9px] text-slate-400">Simply copy or click the code to auto-populate the confirmation input field.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTwoFactorSetupStep("configure");
                              setTwoFactorVerificationCode("");
                              setTwoFactorVerificationError("");
                            }}
                            className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-205 rounded-xl text-xs font-extrabold text-slate-550 cursor-pointer"
                          >
                            Back Layout
                          </button>

                          <button
                            type="button"
                            onClick={handleVerifyAndActivate2FA}
                            disabled={twoFactorVerificationCode.length !== 6 || isActivating2FA}
                            className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                          >
                            {isActivating2FA ? (
                              <>
                                <Loader className="w-3.5 h-3.5 animate-spin" /> Verifying...
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" /> Verify & Connect
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* WIZARD: STEP 3 SUCCESS & BACKUP CODES INFO */}
                    {twoFactorSetupStep === "success" && twoFactorConfig && (
                      <div className="space-y-4 text-left font-sans">
                        <div className="text-center space-y-2">
                          <div className="h-10 w-10 bg-emerald-100 border border-emerald-250 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-sm">
                            ✓
                          </div>
                          <h4 className="text-xs font-black text-slate-905">Two-Factor Authentication Enabled!</h4>
                          <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                            Your admin workspace credentials are now backed by secure multi-factor tokens.
                          </p>
                        </div>

                        <div className="p-3 bg-indigo-50/50 border border-indigo-200/50 rounded-2xl space-y-2">
                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block font-mono font-sans">Backup Recovery Keys</span>
                          
                          <div className="grid grid-cols-2 gap-2.5 font-mono text-[10.5px] font-black text-slate-805 text-center">
                            {twoFactorConfig.backupCodes.map((code, index) => (
                              <div key={index} className="bg-white border border-slate-205 py-1.5 rounded-lg box-content">
                                {code}
                              </div>
                            ))}
                          </div>
                          
                          <p className="text-[9px] text-slate-500 leading-normal font-semibold">
                            ⚠️ Write down these backup recovery credentials. Each code allows single-use bypasses in case you lose access to dynamic verification handsets.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setTwoFactorSetupStep("none")}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3 font-bold text-xs shadow-md cursor-pointer transition-all active:scale-98"
                        >
                          All Finished & Shielded
                        </button>
                      </div>
                    )}

                    {/* WIZARD: ACTIVE ENABLED STATE DETAIL & DISABLER */}
                    {twoFactorConfig && twoFactorConfig.twoFactorEnabled && twoFactorSetupStep === "none" && (
                      <div className="space-y-4 text-left font-sans">
                        
                        <div className="bg-emerald-500/5 border border-emerald-250 p-4 rounded-xl flex items-start gap-3 relative overflow-hidden">
                          <span className="absolute top-2.5 right-2.5 text-[8.5px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded tracking-widest font-mono uppercase">
                            🛡️ active protection
                          </span>
                          
                          <div className="h-9 w-9 bg-emerald-100 border border-emerald-205 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                            <Check className="w-4.5 h-4.5" />
                          </div>

                          <div className="space-y-0.5">
                            <h4 className="text-xs font-black text-slate-905">Multi-Factor Guard active</h4>
                            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                              Verified with {twoFactorConfig.twoFactorType === "app" ? "Authenticator App" : twoFactorConfig.twoFactorType === "sms" ? "SMS Gateway Service" : "Email Token Pool"}.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 border-t border-slate-100 pt-3">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block font-mono">Protected Identity Info</span>
                          <table className="w-full text-[11px] text-slate-700 leading-relaxed font-semibold">
                            <tbody>
                              {twoFactorConfig.twoFactorType === "sms" && (
                                <tr>
                                  <td className="py-0.5 text-slate-400">Phone Gateway:</td>
                                  <td className="py-0.5 font-bold font-mono text-right text-slate-900">{twoFactorConfig.phoneNumber}</td>
                                </tr>
                              )}
                              {twoFactorConfig.twoFactorType === "email" && (
                                <tr>
                                  <td className="py-0.5 text-slate-400">Email Fallback:</td>
                                  <td className="py-0.5 font-sans font-bold text-right text-slate-900 truncate max-w-40" title={twoFactorConfig.emailAddress}>{twoFactorConfig.emailAddress}</td>
                                </tr>
                              )}
                              <tr>
                                <td className="py-0.5 text-slate-400 font-semibold">Secret Seed:</td>
                                <td className="py-0.5 font-mono text-right text-indigo-600 font-black tracking-wider text-[10px] uppercase">{twoFactorConfig.totpSecret}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-202 rounded-2xl space-y-1.5 flex flex-col font-sans">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block font-mono">Backup Recovery Keys</span>
                          <div className="flex gap-1.5 flex-wrap justify-between">
                            {twoFactorConfig.backupCodes.map((code) => (
                              <span key={code} className="text-[10px] font-mono font-bold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700">
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleDeactivate2FA}
                          disabled={isDeactivating2FA}
                          className="w-full py-2 bg-rose-50 hover:bg-rose-105 text-rose-705 hover:text-rose-850 font-black text-[11px] rounded-xl border border-rose-205 transition-colors cursor-pointer"
                        >
                          {isDeactivating2FA ? (
                            <>
                              <Loader className="w-3.5 h-3.5 animate-spin mx-auto text-rose-700" /> Disabling Security Config...
                            </>
                          ) : (
                            "Disable Two-Factor Authentication Protection"
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </div>
          )}

        </div>

      </main>

      {/* Corporate Platform footer */}
      <footer className="bg-white border-t border-gray-150 py-6 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-slate-400">
          <p>© 2026 TrustBuilder Corp. Built to empower developers, dentists, planners, and micro founders safely.</p>
          <div className="flex gap-4">
            <span>Secure Storage: Firestore DB</span>
            <span>AI: Gemini 3.5 Flash Model</span>
          </div>
        </div>
      </footer>

      {/* Real-time Toasts Overlay container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.15 } }}
              layout
              className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-xl pointer-events-auto flex flex-col gap-2 ring-1 ring-emerald-500/30"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-black tracking-widest text-emerald-450 uppercase font-mono">Live Review Received</span>
                </div>
                <button
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="text-slate-400 hover:text-white transition-colors text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex text-[11px]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span 
                      key={i} 
                      className={i < toast.rating ? "text-amber-400" : "text-slate-605"}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 font-mono font-bold">score: {toast.rating}/5</span>
              </div>

              <div className="text-xs font-sans">
                <p className="font-extrabold text-slate-100">{toast.name}</p>
                <p className="text-[10px] text-slate-400 font-mono truncate font-bold">{toast.email}</p>
                <p className="text-[11px] text-slate-300 italic mt-1 font-semibold line-clamp-3 leading-normal">
                  "{toast.content}"
                </p>
              </div>

              <div className="flex gap-1.5 pt-1.5 border-t border-slate-800/80">
                <button
                  onClick={async () => {
                    try {
                      const ref = doc(db, "testimonials", toast.id);
                      await updateDoc(ref, { status: "approved" });
                      setTestimonials(prev => prev.map(t => t.id === toast.id ? {...t, status: "approved"} : t));
                      setToasts(prev => prev.filter(t => t.id !== toast.id));
                    } catch (err) {
                      console.error("Direct toast approval failed:", err);
                    }
                  }}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-lg tracking-wider uppercase font-mono transition-all text-center cursor-pointer"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-705 text-slate-300 font-bold text-[10px] rounded-lg uppercase tracking-wider font-mono transition-all text-center cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
