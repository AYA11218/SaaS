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
import { Space, Campaign, Testimonial, Widget, AISyntheticResult } from "../types";
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
  Tag
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
  const [activeTab, setActiveTab] = useState<"campaigns" | "testimonials" | "widgets" | "ai" | "integrations">("campaigns");

  // Database lists
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);

  // Action / State flags
  const [dbLoading, setDbLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Modal / Creator states
  const [showCampaignModal, setShowCampaignModal] = useState(false);
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
    } catch (err) {
      console.error("Error loading workspace details", err);
    } finally {
      setDbLoading(false);
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 bg-slate-200/50 backdrop-blur-md border border-slate-300/40 p-1.5 rounded-2xl">
            
            <button
              onClick={() => setActiveTab("campaigns")}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "campaigns"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Layout className="w-4 h-4 text-indigo-500" />
              <span>Collect Campaigns</span>
            </button>

            <button
              onClick={() => setActiveTab("testimonials")}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "testimonials"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <MessageSquare className="w-4 h-4 text-teal-500" />
              <span>Review Inbox</span>
            </button>

            <button
              onClick={() => setActiveTab("widgets")}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "widgets"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Sliders className="w-4 h-4 text-emerald-500" />
              <span>Embed Widgets</span>
            </button>

            <button
              onClick={() => setActiveTab("ai")}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "ai"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>AI Copilot</span>
            </button>

            <button
              onClick={() => setActiveTab("integrations")}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all ${
                activeTab === "integrations"
                  ? "bg-white text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-250/30"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Settings className="w-4 h-4 text-rose-500" />
              <span>Integrations Sync</span>
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
                              <span className={`inline-flex px-2.5 py-1 rounded-xl text-[9px] font-black tracking-wider uppercase mb-2 ${c.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-450 border"}`}>
                                {c.status}
                              </span>
                              <h4 className="text-base font-black text-slate-950 tracking-tight leading-snug">{c.title}</h4>
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
                          <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase block">Twitter Draft Copy</span>
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
                          <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase block">LinkedIn Narrative Copy</span>
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
                          <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase block">Facebook / Google Ad Copy</span>
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

    </div>
  );
}
