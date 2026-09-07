"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

import { Sparkles, Send, Package, Bot, RotateCcw, ArrowRight } from "lucide-react";
import { Background } from "./commerce-system";

/* -------------------------------------------------------------------------- */
/*                               Atmosphere                                    */
/* -------------------------------------------------------------------------- */

interface DemoProduct {
  id: string;
  name: string;
  category: "Fashion" | "Footwear" | "Accessories";
  price: string;
  rawPrice: number;
  sizes: string[];
  colorDesc: string;
  thumbBg: string;
}

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: "hoodie",
    name: "Black Oversized Hoodie",
    category: "Fashion",
    price: "৳1,490",
    rawPrice: 1490,
    sizes: ["M", "L", "XL"],
    colorDesc: "Charcoal Black",
    thumbBg: "from-[#1C1C26] to-[#0E0E14]",
  },
  {
    id: "tshirt",
    name: "Premium T-shirt",
    category: "Fashion",
    price: "৳790",
    rawPrice: 790,
    sizes: ["S", "M", "L", "XL"],
    colorDesc: "Organic Combed Cotton",
    thumbBg: "from-[#1F2937] to-[#111827]",
  },
  {
    id: "jacket",
    name: "Denim Jacket",
    category: "Fashion",
    price: "৳2,850",
    rawPrice: 2850,
    sizes: ["M", "L"],
    colorDesc: "14oz Selvedge Denim",
    thumbBg: "from-[#1E3A5F] to-[#0F2338]",
  },
  {
    id: "sneakers",
    name: "Leather Sneakers",
    category: "Footwear",
    price: "৳3,600",
    rawPrice: 3600,
    sizes: ["40", "41", "42", "43", "44"],
    colorDesc: "Italian Nappa Leather",
    thumbBg: "from-[#334155] to-[#1E293B]",
  },
  {
    id: "backpack",
    name: "Canvas Backpack",
    category: "Accessories",
    price: "৳2,100",
    rawPrice: 2100,
    sizes: ["Standard 22L"],
    colorDesc: "Water-Resistant Canvas",
    thumbBg: "from-[#2A3441] to-[#1A202C]",
  },
  {
    id: "watch",
    name: "Everyday Watch",
    category: "Accessories",
    price: "৳3,400",
    rawPrice: 3400,
    sizes: ["40mm"],
    colorDesc: "Sapphire Glass & Quartz",
    thumbBg: "from-[#2D3748] to-[#1A202C]",
  },
];

/* -------------------------------------------------------------------------- */
/*                            Chat Message Types                              */
/* -------------------------------------------------------------------------- */

interface OrderDetails {
  orderId: string;
  productName: string;
  size: string;
  price: string;
  deliveryCharge: string;
  total: string;
  payment: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  productId?: string;
  productCard?: DemoProduct;
  sizeOptions?: string[];
  orderDetails?: OrderDetails;
  showOrderForm?: boolean;
}

interface TrialBusinessProfile {
  businessName: string;
  businessType: string;
  salesChannel: string;
  paymentMethods: string;
  deliveryPolicy: string;
  returnPolicy: string;
  tone: "friendly" | "professional" | "casual" | "premium";
}

const TRIAL_STORAGE_KEY = "sellpilot:test-ai-trial:v1";
const defaultTrialProfile: TrialBusinessProfile = {
  businessName: "",
  businessType: "ECOMMERCE",
  salesChannel: "Facebook and website",
  paymentMethods: "Cash on Delivery",
  deliveryPolicy: "Inside Dhaka 1–2 days; outside Dhaka 2–4 days",
  returnPolicy: "Exchange within 7 days for unused products",
  tone: "friendly",
};

function welcomeMessage(businessName = "your business"): ChatMessage {
  return {
    id: "msg-welcome",
    sender: "ai",
    text: `আসসালামু আলাইকুম! **${businessName}**-এ স্বাগতম 😊\n\nআমি SellPilot AI সেলস অ্যাসিস্ট্যান্ট। ডেমো ক্যাটালগের যেকোনো প্রোডাক্টের স্টক, সাইজ বা প্রাইস নিয়ে প্রশ্ন করতে পারেন।\n\nকোন প্রোডাক্টটি দেখতে চাচ্ছেন?`,
    timestamp: "Just now",
    productId: "hoodie",
  };
}

/* -------------------------------------------------------------------------- */
/*                           Markdown Formatter                               */
/* -------------------------------------------------------------------------- */

function FormattedMessageText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, lIdx) => {
        if (!line.trim()) {
          return <div key={lIdx} className="h-1.5" />;
        }

        const parts = line.split(/(\*\*[^*]+\*\*)/g);

        return (
          <p key={lIdx} className="leading-relaxed">
            {parts.map((part, pIdx) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong key={pIdx} className="font-semibold">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function TestAIDemoPage() {
  const [trialProfile, setTrialProfile] =
    useState<TrialBusinessProfile>(defaultTrialProfile);
  const [setupComplete, setSetupComplete] = useState(false);
  const [trialHydrated, setTrialHydrated] = useState(false);
  // Free messages counter: exactly 10 initial messages
  const [messagesRemaining, setMessagesRemaining] = useState<number>(10);
  const [showLimitModal, setShowLimitModal] = useState<boolean>(false);

  // Active product highlighted in catalog
  const [activeProductId, setActiveProductId] = useState<string>("hoodie");

  // User input & typing state
  const [inputText, setInputText] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageCounterRef = useRef<number>(1);

  // Initial conversation
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage()]);

  // Selected size for checkout
  const [selectedSize, setSelectedSize] = useState<string>("L");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TRIAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          profile?: TrialBusinessProfile;
          setupComplete?: boolean;
          messagesRemaining?: number;
          activeProductId?: string;
          selectedSize?: string;
          messages?: ChatMessage[];
        };
        if (parsed.profile)
          setTrialProfile({ ...defaultTrialProfile, ...parsed.profile });
        if (parsed.setupComplete) setSetupComplete(true);
        if (Number.isInteger(parsed.messagesRemaining))
          setMessagesRemaining(
            Math.max(0, Math.min(10, Number(parsed.messagesRemaining))),
          );
        if (parsed.activeProductId) setActiveProductId(parsed.activeProductId);
        if (parsed.selectedSize) setSelectedSize(parsed.selectedSize);
        if (Array.isArray(parsed.messages) && parsed.messages.length) {
          setMessages(parsed.messages.slice(-30));
          messageCounterRef.current = parsed.messages.length + 1;
        }
      }
    } catch {
      window.localStorage.removeItem(TRIAL_STORAGE_KEY);
    } finally {
      setTrialHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!trialHydrated) return;
    window.localStorage.setItem(
      TRIAL_STORAGE_KEY,
      JSON.stringify({
        profile: trialProfile,
        setupComplete,
        messagesRemaining,
        activeProductId,
        selectedSize,
        messages: messages.slice(-30),
      }),
    );
  }, [
    activeProductId,
    messages,
    messagesRemaining,
    selectedSize,
    setupComplete,
    trialHydrated,
    trialProfile,
  ]);

  const startBusinessTrial = () => {
    if (trialProfile.businessName.trim().length < 2) return;
    const profile = {
      ...trialProfile,
      businessName: trialProfile.businessName.trim(),
    };
    setTrialProfile(profile);
    setMessages([welcomeMessage(profile.businessName)]);
    setMessagesRemaining(10);
    setActiveProductId("hoodie");
    setSetupComplete(true);
  };

  const signupTrialPayload = {
    ...trialProfile,
    messagesUsed: 10 - messagesRemaining,
    history: messages
      .slice(-10)
      .map(({ sender, text }) => ({ sender, text: text.slice(0, 500) })),
  };

  // Auto scroll ONLY chat inner container to bottom when messages update
  const chatContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isTyping]);

  // Window testing hooks for automated verification
  useEffect(() => {
    if (typeof window !== "undefined") {
      (
        window as unknown as { __triggerDemoModal?: () => void }
      ).__triggerDemoModal = () => setShowLimitModal(true);
      (
        window as unknown as { __setDemoRemaining?: (n: number) => void }
      ).__setDemoRemaining = (n: number) => {
        setMessagesRemaining(n);
        if (n <= 0) setShowLimitModal(true);
      };
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                       Conversational Sales Logic                         */
  /* ------------------------------------------------------------------------ */

  const handleSendMessage = useCallback(
    (textToSend?: string) => {
      const text = (textToSend || inputText).trim();
      if (!text) return;

      // Check message limit
      if (messagesRemaining <= 0) {
        setShowLimitModal(true);
        return;
      }

      // Decrement free messages counter
      const newRemaining = messagesRemaining - 1;
      setMessagesRemaining(newRemaining);

      const userMsgId = `user-msg-${messageCounterRef.current++}`;

      // Append user message
      const userMsg: ChatMessage = {
        id: userMsgId,
        sender: "user",
        text: text,
        timestamp: "Just now",
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setIsTyping(true);

      const willHitZero = newRemaining === 0;
      const lower = text.toLowerCase();

      setTimeout(() => {
        let aiResponseText = "";
        let matchedProdId = activeProductId;
        let matchedProdCard: DemoProduct | undefined = undefined;
        let availableSizes: string[] | undefined = undefined;
        let showOrderDetails: OrderDetails | undefined = undefined;
        let showForm = false;

        // 1. Customer asks about the Hoodie
        if (
          lower.includes("hoodie") ||
          lower.includes("হুডি") ||
          lower.includes("black hoodie")
        ) {
          matchedProdId = "hoodie";
          setActiveProductId("hoodie");

          aiResponseText =
            "জি, ache 😊\n**Black Oversized Hoodie** available ache।\n\n• **Price**: ৳1,490\n• **Fabric**: 380 GSM Cotton Fleece\n• **Sizes**: M, L, XL\n\nSize L available। Apni ki size nite chan?";
          matchedProdCard = DEMO_PRODUCTS.find((p) => p.id === "hoodie");
          availableSizes = ["M", "L", "XL"];
        }
        // 2. Customer asks about Sneakers / Shoes
        else if (
          lower.includes("sneaker") ||
          lower.includes("shoe") ||
          lower.includes("জুতো") ||
          lower.includes("leather")
        ) {
          matchedProdId = "sneakers";
          setActiveProductId("sneakers");

          aiResponseText =
            "জি, আমাদের **Leather Sneakers** available আছে ✨\n\n• **Price**: ৳3,600\n• **Material**: Italian Nappa Leather\n• **Sizes**: 40, 41, 42, 43, 44\n\nApnar koto size lagbe?";
          matchedProdCard = DEMO_PRODUCTS.find((p) => p.id === "sneakers");
          availableSizes = ["40", "41", "42", "43", "44"];
        }
        // 3. Customer asks about T-shirt
        else if (
          lower.includes("t-shirt") ||
          lower.includes("tshirt") ||
          lower.includes("টি-শার্ট")
        ) {
          matchedProdId = "tshirt";
          setActiveProductId("tshirt");

          aiResponseText =
            "জি, **Premium T-shirt** available আছে!\n\n• **Price**: ৳790\n• **Fabric**: 100% Organic Combed Cotton\n• **Sizes**: S, M, L, XL\n\nকোন সাইজটি দেখতে চান?";
          matchedProdCard = DEMO_PRODUCTS.find((p) => p.id === "tshirt");
          availableSizes = ["S", "M", "L", "XL"];
        }
        // 4. Customer asks about Jacket
        else if (
          lower.includes("jacket") ||
          lower.includes("জ্যাকেট") ||
          lower.includes("denim")
        ) {
          matchedProdId = "jacket";
          setActiveProductId("jacket");

          aiResponseText =
            "আমাদের **Denim Jacket** available আছে!\n\n• **Price**: ৳2,850\n• **Material**: 14oz Selvedge Denim\n• **Sizes**: M, L\n\nক্যাশ অন ডেলিভারিতে নিতে চান?";
          matchedProdCard = DEMO_PRODUCTS.find((p) => p.id === "jacket");
          availableSizes = ["M", "L"];
        }
        // 5. Customer asks about Backpack or Watch
        else if (
          lower.includes("backpack") ||
          lower.includes("ব্যাগ") ||
          lower.includes("watch") ||
          lower.includes("ঘড়ি")
        ) {
          const isBackpack =
            lower.includes("backpack") || lower.includes("ব্যাগ");
          matchedProdId = isBackpack ? "backpack" : "watch";
          setActiveProductId(matchedProdId);

          aiResponseText = isBackpack
            ? "**Canvas Backpack** এর প্রাইস **৳2,100**।\n\nWater-resistant ক্যানভাস ও ১৬-ইঞ্চি ল্যাপটপ স্লট সহ সম্পূর্ণ ওয়াটারপ্রুফ।\n\nঅর্ডার করতে চান?"
            : "**Everyday Watch** এর প্রাইস **৳3,400**।\n\nজাপানিজ কোয়ার্টজ মুভমেন্ট এবং স্যাফায়ার গ্লাস।\n\nঅর্ডার করতে ডিটেইলস দিন 😊";
          matchedProdCard = DEMO_PRODUCTS.find((p) => p.id === matchedProdId);
        }
        // 6. Customer selects size (e.g. "L", "M", "XL", "42")
        else if (
          lower === "m" ||
          lower === "l" ||
          lower === "xl" ||
          lower === "s" ||
          lower === "40" ||
          lower === "41" ||
          lower === "42" ||
          lower === "43" ||
          lower === "44" ||
          lower.includes("size")
        ) {
          const sizeChosen =
            text.toUpperCase().replace("SIZE", "").trim() || "L";
          setSelectedSize(sizeChosen);

          aiResponseText = `Sure 😊\n**Size ${sizeChosen}** apnar jonno book kora holo।\n\nApnar naam, phone number ebong delivery address ta din। Cash on Delivery te niben?`;
          showForm = true;
        }
        // 7. Customer says "Order korte chai" or provides contact details
        else if (
          lower.includes("order") ||
          lower.includes("confirm") ||
          lower.includes("dhaka") ||
          lower.includes("০১৭") ||
          lower.includes("017") ||
          lower.includes("018") ||
          lower.includes("019") ||
          lower.includes("013") ||
          lower.includes("address") ||
          lower.includes("নাম") ||
          lower.includes("ঠিকানা")
        ) {
          const targetProd =
            DEMO_PRODUCTS.find((p) => p.id === activeProductId) ||
            DEMO_PRODUCTS[0];
          const deliveryFee = 60;
          const totalAmount = targetProd.rawPrice + deliveryFee;

          aiResponseText = `ধন্যবাদ! আপনার অর্ডারটি গ্রহণ করা হয়েছে 🎉\n\nআমাদের সেলস টিম খুব দ্রুত কল করে পার্সেলটি পাঠিয়ে দেবে।`;

          showOrderDetails = {
            orderId: `NX-${Math.floor(1000 + Math.random() * 9000)}`,
            productName: `${targetProd.name} (Size ${selectedSize})`,
            size: selectedSize,
            price: targetProd.price,
            deliveryCharge: `৳${deliveryFee}`,
            total: `৳${totalAmount.toLocaleString()}`,
            payment: "Cash on Delivery",
          };
        }
        // 8. Delivery charge questions
        else if (
          lower.includes("delivery") ||
          lower.includes("charge") ||
          lower.includes("ডেলিভারি") ||
          lower.includes("koto")
        ) {
          aiResponseText =
            "আমাদের ডেলিভারি চার্জ:\n\n• **ঢাকার ভেতর**: ৬০ টাকা (২৪-৪৮ ঘণ্টার মধ্যে হোম ডেলিভারি)\n• **ঢাকার বাইরে**: ১২০ টাকা (৪৮-৭২ ঘণ্টার মধ্যে)\n• **পেমেন্ট**: Cash on Delivery (প্রোডাক্ট দেখে পেমেন্ট সুবিধা)\n\nকোন প্রোডাক্টটি নিতে চান?";
        }
        // 9. Default friendly AI response
        else {
          aiResponseText =
            "জি, আমি সাহায্য করছি! আপনি DigitRoss-এর যেকোনো প্রোডাক্ট সম্পর্কে জানতে পারেন:\n\n• **Black Oversized Hoodie** (৳1,490)\n• **Leather Sneakers** (৳3,600)\n• **Canvas Backpack** (৳2,100)\n\nবামপাশের ক্যাটালগে ক্লিক করুন অথবা আপনার পছন্দের কথা লিখে জানান 😊";
        }

        const aiMsgId = `ai-msg-${messageCounterRef.current++}`;
        const aiMsg: ChatMessage = {
          id: aiMsgId,
          sender: "ai",
          text: aiResponseText,
          timestamp: "Just now",
          productId: matchedProdId,
          productCard: matchedProdCard,
          sizeOptions: availableSizes,
          orderDetails: showOrderDetails,
          showOrderForm: showForm,
        };

        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);

        if (willHitZero) {
          setTimeout(() => {
            setShowLimitModal(true);
          }, 600);
        }
      }, 550);
    },
    [activeProductId, inputText, messagesRemaining, selectedSize],
  );

  const handleProductSelect = (product: DemoProduct) => {
    setActiveProductId(product.id);
    handleSendMessage(`${product.name} ta ache?`);
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleSizeClick = (size: string) => {
    setSelectedSize(size);
    handleSendMessage(`Size ${size}`);
  };

  const handleFastAutofillOrder = () => {
    handleSendMessage(
      "Name: Tanvir, Phone: 01712-445566, Address: Dhanmondi 27, Dhaka. Cash on delivery",
    );
  };

  const handleResetDemo = () => {
    setMessagesRemaining(10);
    setShowLimitModal(false);
    setActiveProductId("hoodie");
    setMessages([welcomeMessage(trialProfile.businessName || "your business")]);
  };

return <main className="trial-page sp-dark relative"><Background/><div className="sp-wrap relative py-10 sm:py-14"><header className="sp-section-head"><div><p className="sp-eyebrow">The SellPilot experience</p><h1 className="text-3xl sm:text-4xl mt-4">See the conversation differently.</h1></div><p className="sp-copy !text-sm">An interactive demo with a sample catalog. No real orders are placed. Your trial is saved in this browser.</p></header>{!setupComplete?<section className="trial-setup sp-light"><div><span className="sp-icon"><Sparkles/></span><h2 className="text-3xl mt-6">First, make it yours.</h2><p className="sp-copy mt-4 !text-sm">Add some business context, then explore a 10-message sample conversation.</p><ol className="mt-8 space-y-4 text-sm text-[#79778e]"><li>01 · Tell us about your business</li><li>02 · Explore the sample catalog</li><li>03 · Try a customer conversation</li></ol></div><form onSubmit={e=>{e.preventDefault();startBusinessTrial();}}><div className="sp-grid-2">{([["businessName","Business name"],["salesChannel","Main sales channel"],["paymentMethods","Payment methods"],["deliveryPolicy","Delivery policy"],["returnPolicy","Return / exchange policy"]] as const).map(([key,label])=><label className="sp-label" key={key}>{label}<input className="sp-field" value={trialProfile[key]} required={key==="businessName"} minLength={key==="businessName"?2:undefined} onChange={e=>setTrialProfile({...trialProfile,[key]:e.target.value})}/></label>)}<label className="sp-label">Business type<select className="sp-field" value={trialProfile.businessType} onChange={e=>setTrialProfile({...trialProfile,businessType:e.target.value})}><option value="ECOMMERCE">Ecommerce</option><option value="RESTAURANT">Restaurant</option><option value="SERVICE">Services</option><option value="EDUCATION">Education</option><option value="OTHER">Other business</option></select></label></div><fieldset className="mt-6"><legend className="sp-label mb-3">Conversation tone</legend><div className="flex flex-wrap gap-2">{(["friendly","professional","casual","premium"] as const).map(tone=><button type="button" className="trial-tone" aria-pressed={trialProfile.tone===tone} key={tone} onClick={()=>setTrialProfile({...trialProfile,tone})}>{tone}</button>)}</div></fieldset><button className="sp-button sp-button-primary mt-7" disabled={!trialHydrated||trialProfile.businessName.trim().length<2}>Start my conversation<ArrowRight size={16}/></button></form></section>:<><div className="trial-workbench"><section className="trial-catalog"><div className="mb-5"><p className="sp-eyebrow">Sample catalog</p><h2 className="text-lg mt-3">{trialProfile.businessName}</h2><p className="sp-note mt-2">Choose a product to ask about.</p></div><div className="trial-product-list">{DEMO_PRODUCTS.map(product=><button disabled={isTyping||messagesRemaining<=0} type="button" key={product.id} className="trial-catalog-item" aria-pressed={activeProductId===product.id} onClick={()=>handleProductSelect(product)}><span className="trial-product-icon"><Package size={20}/></span><span><strong>{product.name}</strong><small>{product.category}</small><b>{product.price}</b></span></button>)}</div></section><section className="trial-conversation"><header><div className="flex items-center gap-3"><span className="sp-icon"><Bot/></span><div><h2>SellPilot AI</h2><p>{trialProfile.businessName} · Demo conversation</p></div></div><div className="flex items-center gap-3"><span className="sp-tag">{messagesRemaining}/10 left</span><button onClick={handleResetDemo} aria-label="Reset conversation" title="Reset conversation"><RotateCcw size={16}/></button></div></header><div className="trial-messages" ref={chatContainerRef} aria-live="polite" aria-relevant="additions text">{messages.map(msg=><article key={msg.id} className={`trial-message ${msg.sender}`}><p className="trial-message-meta">{msg.sender==="user"?"You":"SellPilot"} · {msg.timestamp}</p><div className="trial-message-content"><FormattedMessageText text={msg.text}/>{msg.productCard&&<div className="trial-rich-product"><div className="flex items-center justify-between gap-3"><div><strong>{msg.productCard.name}</strong><p className="text-[#bc9aed] mt-1">{msg.productCard.price}</p></div><span className="sp-tag">Sample product</span></div>{msg.sizeOptions&&<div className="flex flex-wrap items-center gap-2 mt-4">{msg.sizeOptions.map(s=><button disabled={isTyping} type="button" key={s} aria-pressed={selectedSize===s} className="trial-size" onClick={()=>handleSizeClick(s)}>{s}</button>)}<button disabled={isTyping} type="button" className="trial-size" onClick={()=>handleSendMessage("Order করতে চাই")}>Try ordering →</button></div>}</div>}{msg.showOrderForm&&<button disabled={isTyping} className="trial-size mt-3" onClick={handleFastAutofillOrder}>Use sample delivery details</button>}{msg.orderDetails&&<div className="trial-order"><p className="sp-eyebrow">Demo order summary</p><dl>{[["Order",msg.orderDetails.orderId],["Product",msg.orderDetails.productName],["Size",msg.orderDetails.size],["Price",msg.orderDetails.price],["Delivery",msg.orderDetails.deliveryCharge],["Total",msg.orderDetails.total],["Payment",msg.orderDetails.payment]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="sp-note mt-4">Simulation only. No purchase has been submitted.</p></div>}</div></article>)}{isTyping&&<p className="trial-typing" role="status">SellPilot is composing a reply<span>…</span></p>}<div ref={chatBottomRef}/></div><div className="trial-prompts">{["Black hoodie ta ache?","Leather sneakers er price koto?","Order korte chai","Delivery charge koto?"].map(prompt=><button disabled={isTyping||messagesRemaining<=0} key={prompt} onClick={()=>handleQuickPrompt(prompt)}>{prompt}</button>)}</div><form className="trial-composer" onSubmit={e=>{e.preventDefault();handleSendMessage();}}><input ref={inputRef} value={inputText} onChange={e=>setInputText(e.target.value)} placeholder="Ask about a product, size, or delivery…" aria-label="Your message" disabled={isTyping||messagesRemaining<=0}/><button disabled={isTyping||!inputText.trim()||messagesRemaining<=0} aria-label="Send message"><Send size={17}/></button></form></section></div>{showLimitModal&&<section className="trial-limit sp-light" role="status"><div><p className="sp-eyebrow">Your next step</p><h2 className="text-2xl mt-3">You’ve explored your 10 free messages.</h2><p className="sp-copy mt-3 !text-sm">Create an account to continue setting up your business.</p></div><div className="sp-actions"><Link className="sp-button sp-button-primary" href="/signup?trial=1" onClick={()=>{window.name=JSON.stringify({kind:"sellpilot-trial",payload:signupTrialPayload});}}>Create account<ArrowRight size={16}/></Link><button className="sp-button sp-button-secondary" onClick={handleResetDemo}>Restart demo</button></div></section>}</>}<p className="sp-note text-center mt-6">Sample responses and products · Your production AI uses your connected business knowledge</p></div></main>;
}
