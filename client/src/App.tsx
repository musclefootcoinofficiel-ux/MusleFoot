import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Home, Zap, Wallet as WalletIcon, Info, Shield, CheckCircle2, Key, Copy, Eye, EyeOff, AlertTriangle, Map, Twitter, Send, ShoppingCart, TrendingUp, ArrowUp, ArrowDown, Clock, Crown, Loader2, Battery, LogOut, Droplets, Megaphone, Code, Globe, Rocket, Trophy, Gem, ExternalLink, Heart, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@assets/logo_1770393823994.png";
import { initTelegramApp, getTelegramUserId, getTelegramUserName, isTelegramEnvironment, hapticTap, hapticSuccess, hapticError } from "./lib/telegram";
import { loadGameSave, saveGameToSupabase, updateHighScore, flushOfflineQueue, isGuestMode } from "./lib/supabase";

const RECEIVER_WALLET = "GnNkrN2oDNre6tR6i2Z71vgMbvE8tfVeWu5VtUN4ocUX";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

const LEVEL_CONFIG = [
  { name: "Beginner",     maxEnergy: 100,   recoverySeconds: 5 * 60,         costPerTap: 0.5,  gainPerTap: 0.001,  upgradeCost: 0,      solPrice: 0 },
  { name: "Gym Rat",      maxEnergy: 300,   recoverySeconds: 2 * 60 * 60,    costPerTap: 1.0,  gainPerTap: 0.01,   upgradeCost: 5,      solPrice: 0.15 },
  { name: "Influencer",   maxEnergy: 750,   recoverySeconds: 4 * 60 * 60,    costPerTap: 2.5,  gainPerTap: 0.10,   upgradeCost: 10000,  solPrice: 0.45 },
  { name: "Pro",          maxEnergy: 1500,  recoverySeconds: 6 * 60 * 60,    costPerTap: 5.0,  gainPerTap: 0.40,   upgradeCost: 50000,  solPrice: 1.5 },
  { name: "Legend",       maxEnergy: 1500,  recoverySeconds: 8 * 60 * 60,    costPerTap: 7.5,  gainPerTap: 0.75,   upgradeCost: 200000, solPrice: 3.0 },
  { name: "Muscle God",   maxEnergy: 10000, recoverySeconds: 8 * 60 * 60,    costPerTap: 25.0, gainPerTap: 1.00,   upgradeCost: -1,     solPrice: 10 },
];

function getPhantomBrowseUrl(): string {
  const url = window.location.origin + window.location.pathname;
  return `https://phantom.app/ul/browse/${encodeURIComponent(url)}`;
}

function isPhantomInstalled(): boolean {
  return !!(window as any).phantom?.solana?.isPhantom || !!(window as any).solana?.isPhantom;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "FULL";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function Game() {
  const { toast } = useToast();
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [telegramName, setTelegramName] = useState<string | null>(null);
  const [tgChecked, setTgChecked] = useState(false);

  useEffect(() => {
    initTelegramApp();
    const uid = getTelegramUserId();
    const uname = getTelegramUserName();
    setTelegramId(uid);
    setTelegramName(uname);
    setTgChecked(true);
    if (uid) {
      flushOfflineQueue();
    }
    const handleOnline = () => { if (uid) flushOfflineQueue(); };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const [level, setLevel] = useState(() => {
    const saved = localStorage.getItem("mf-level");
    return saved !== null ? Number(saved) : 0;
  });
  const [points, setPoints] = useState(() => {
    const saved = localStorage.getItem("mf-points");
    return saved !== null ? Number(saved) : 0;
  });
  const [energy, setEnergy] = useState(() => {
    const savedEnergy = localStorage.getItem("mf-energy");
    const savedTimestamp = localStorage.getItem("mf-last-tap-ts");
    const savedLevel = localStorage.getItem("mf-level");
    const lvl = savedLevel !== null ? Number(savedLevel) : 0;
    const config = LEVEL_CONFIG[lvl];

    if (savedEnergy !== null && savedTimestamp !== null) {
      const lastEnergy = Number(savedEnergy);
      const lastTs = Number(savedTimestamp);
      const now = Date.now();
      const elapsedSec = (now - lastTs) / 1000;
      const recoveryRate = config.maxEnergy / config.recoverySeconds;
      const recovered = lastEnergy + elapsedSec * recoveryRate;
      return Math.min(config.maxEnergy, recovered);
    }
    return config.maxEnergy;
  });
  const [lastTapTs, setLastTapTs] = useState(() => {
    const saved = localStorage.getItem("mf-last-tap-ts");
    return saved !== null ? Number(saved) : Date.now();
  });

  const [wallet, setWallet] = useState(() => localStorage.getItem("wallet-address") || "");
  const [secretKey, setSecretKey] = useState(() => localStorage.getItem("wallet-secret-key") || "");
  const [isConnected, setIsConnected] = useState(() => !!localStorage.getItem("wallet-address"));
  const [showSecret, setShowSecret] = useState(false);
  const [walletType, setWalletType] = useState<"phantom" | "generated" | null>(() => {
    const saved = localStorage.getItem("wallet-type");
    return (saved as "phantom" | "generated") || null;
  });
  const solanaAdapterWallet = useWallet();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solBalanceLoading, setSolBalanceLoading] = useState(false);
  const [godPackExpiryDate, setGodPackExpiryDate] = useState<string | null>(() => localStorage.getItem("mf-god-pack-expiry"));

  const WITHDRAWAL_CONFIG: Record<number, { minAmount: number; feePercent: number; delayHours: number; delayLabel: string }> = {
    0: { minAmount: 1000, feePercent: 10, delayHours: 72, delayLabel: "72h" },
    1: { minAmount: 1000, feePercent: 5, delayHours: 48, delayLabel: "48h" },
    2: { minAmount: 5000, feePercent: 3, delayHours: 24, delayLabel: "24h" },
    3: { minAmount: 15000, feePercent: 2, delayHours: 12, delayLabel: "12h" },
    4: { minAmount: 15000, feePercent: 2, delayHours: 12, delayLabel: "12h" },
    5: { minAmount: 15000, feePercent: 1, delayHours: 0, delayLabel: "Instant" },
  };
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [showWithdrawHistory, setShowWithdrawHistory] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    if (!telegramId) return;
    try {
      const { supabase } = await import("./lib/supabase");
      if (!supabase) return;
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("telegram_id", telegramId)
        .order("created_at", { ascending: false });
      if (data) setWithdrawals(data);
    } catch {}
  }, [telegramId]);

  const fetchSolBalance = useCallback(async (address: string) => {
    setSolBalanceLoading(true);
    try {
      const res = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
      });
      if (res.ok) {
        const data = await res.json();
        setSolBalance((data.result?.value ?? 0) / LAMPORTS_PER_SOL);
      } else {
        setSolBalance(null);
      }
    } catch {
      setSolBalance(null);
    } finally {
      setSolBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (solanaAdapterWallet.connected && solanaAdapterWallet.publicKey) {
      const addr = solanaAdapterWallet.publicKey.toBase58();
      setWallet(addr);
      setWalletType("phantom");
      setIsConnected(true);
      localStorage.setItem("wallet-address", addr);
      fetchSolBalance(addr);
      if (telegramId) {
        immediateSave();
      }
    } else if (!solanaAdapterWallet.connected) {
      setSolBalance(null);
    }
  }, [solanaAdapterWallet.connected, solanaAdapterWallet.publicKey]);

  useEffect(() => {
    if (!solanaAdapterWallet.connected || !solanaAdapterWallet.publicKey) return;
    const interval = setInterval(() => {
      fetchSolBalance(solanaAdapterWallet.publicKey!.toBase58());
    }, 30000);
    return () => clearInterval(interval);
  }, [solanaAdapterWallet.connected, solanaAdapterWallet.publicKey, fetchSolBalance]);

  const handleDisconnectWallet = useCallback(async () => {
    try {
      if (solanaAdapterWallet.connected) {
        await solanaAdapterWallet.disconnect();
      }
      setWallet("");
      setWalletType(null);
      setIsConnected(false);
      setSecretKey("");
      setShowSecret(false);
      setSolBalance(null);
      localStorage.removeItem("wallet-address");
      localStorage.removeItem("wallet-type");
      localStorage.removeItem("wallet-secret-key");
      toast({ title: "Wallet Disconnected" });
    } catch (err) {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    }
  }, [solanaAdapterWallet, toast]);

  const [clicks, setClicks] = useState<{ id: number; x: number; y: number; gain: number }[]>([]);
  const [shaking, setShaking] = useState(false);
  const [countdown, setCountdown] = useState("");

  const config = LEVEL_CONFIG[level];
  const energyPercent = (energy / config.maxEnergy) * 100;

  useEffect(() => {
    localStorage.setItem("mf-level", level.toString());
    localStorage.setItem("mf-points", points.toString());
    localStorage.setItem("mf-energy", energy.toString());
    localStorage.setItem("mf-last-tap-ts", lastTapTs.toString());
    localStorage.setItem("wallet-address", wallet);
    localStorage.setItem("wallet-secret-key", secretKey);
    if (walletType) localStorage.setItem("wallet-type", walletType);
    else localStorage.removeItem("wallet-type");
  }, [level, points, energy, lastTapTs, wallet, secretKey, walletType]);

  useEffect(() => {
    const timer = setInterval(() => {
      setEnergy(prev => {
        if (prev >= config.maxEnergy) {
          setCountdown("FULL");
          return config.maxEnergy;
        }
        const recoveryRate = config.maxEnergy / config.recoverySeconds;
        const newEnergy = Math.min(config.maxEnergy, prev + recoveryRate);
        const remaining = config.maxEnergy - newEnergy;
        if (remaining <= 0) {
          setCountdown("FULL");
        } else {
          const secsLeft = remaining / recoveryRate;
          setCountdown(formatCountdown(secsLeft));
        }
        return newEnergy;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [config]);

  const immediateSave = useCallback((overrides?: { level?: number; energy?: number; points?: number }) => {
    if (!telegramId) return;
    const currentPoints = overrides?.points ?? points;
    saveGameToSupabase({
      telegram_id: telegramId,
      username: telegramName,
      muscle_points: currentPoints,
      level: overrides?.level ?? level,
      current_energy: overrides?.energy ?? energy,
      last_tap_timestamp: new Date(lastTapTs).toISOString(),
      wallet_address: wallet || null,
      god_pack_expiry: godPackExpiryDate || null,
    }).then(() => {
      updateHighScore(telegramId, currentPoints);
    });
  }, [points, level, energy, lastTapTs, wallet, telegramId, telegramName, godPackExpiryDate]);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (energy < config.costPerTap) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setEnergy(prev => Math.max(0, prev - config.costPerTap));
    setPoints(prev => prev + config.gainPerTap);
    setLastTapTs(Date.now());
    hapticTap();

    const id = Date.now() + Math.random();
    setClicks(prev => [...prev, { id, x: clientX, y: clientY, gain: config.gainPerTap }]);
    setTimeout(() => setClicks(prev => prev.filter(c => c.id !== id)), 1000);

    if (level >= 4) {
      setShaking(true);
      setTimeout(() => setShaking(false), 150);
    }
  }, [energy, config, level]);

  const handleRankUp = useCallback(() => {
    if (level >= 5) return;
    const nextLevel = level + 1;
    const cost = LEVEL_CONFIG[nextLevel].upgradeCost;
    if (cost === -1) {
      toast({ title: "Muscle God requires 10 SOL payment", description: "Use the golden button below to ascend!" });
      return;
    }
    if (points < cost) {
      toast({ title: "Not enough $MF!", variant: "destructive" });
      return;
    }
    const newPoints = points - cost;
    setPoints(newPoints);
    setLevel(nextLevel);
    const newConfig = LEVEL_CONFIG[nextLevel];
    setEnergy(newConfig.maxEnergy);
    localStorage.setItem("mf-level", String(nextLevel));
    localStorage.setItem("mf-energy", String(newConfig.maxEnergy));
    localStorage.setItem("mf-points", String(newPoints));
    immediateSave({ level: nextLevel, energy: newConfig.maxEnergy, points: newPoints });
    toast({ title: `Ranked up to ${newConfig.name}!`, description: `Gain: ${newConfig.gainPerTap} $MF/tap. Energy: ${newConfig.maxEnergy.toLocaleString()}.` });
  }, [level, points, toast, immediateSave]);

  const generateWallet = () => {
    const kp = Keypair.generate();
    const address = kp.publicKey.toBase58();
    const secret = Array.from(kp.secretKey).map(b => b.toString(16).padStart(2, '0')).join('');
    setWallet(address);
    setSecretKey(secret);
    setWalletType("generated");
    setIsConnected(true);
    toast({ title: "Wallet Generated!", description: "Your new Solana wallet is ready." });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} Copied!` });
  };

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentStep, setPaymentStep] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState<{ rankName: string; solPrice: number; targetLevel: number; isGodPack: boolean } | null>(null);
  const [goldExplosion, setGoldExplosion] = useState(false);
  const [explosionParticles, setExplosionParticles] = useState<Array<{ id: number; x: number; y: number; tx: string; ty: string; color: string; size: number; delay: number }>>([]);
  const [confettiParticles, setConfettiParticles] = useState<Array<{ id: number; x: number; delay: number; duration: number; color: string; size: number; rotation: number }>>([]);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donateAmount, setDonateAmount] = useState("0.1");
  const [showDonateConfirm, setShowDonateConfirm] = useState(false);

  const triggerGoldExplosion = useCallback(() => {
    setGoldExplosion(true);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const colors = ["#d4ff00", "#ffd700", "#fff8dc", "#ffb300", "#ffe066", "#ffffff"];
    const particles: typeof explosionParticles = [];
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80 + (Math.random() - 0.5) * 0.5;
      const dist = 100 + Math.random() * 350;
      particles.push({
        id: i,
        x: cx,
        y: cy,
        tx: `${Math.cos(angle) * dist}px`,
        ty: `${Math.sin(angle) * dist}px`,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 10,
        delay: Math.random() * 0.3,
      });
    }
    setExplosionParticles(particles);
    setTimeout(() => {
      setGoldExplosion(false);
      setExplosionParticles([]);
    }, 2500);
  }, []);

  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerConfetti = useCallback(() => {
    if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    const colors = ["#d4ff00", "#ffd700", "#ff6b00", "#00f2ff", "#ff00ff", "#ffffff", "#ffb300"];
    const pieces: typeof confettiParticles = [];
    for (let i = 0; i < 60; i++) {
      pieces.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
      });
    }
    setConfettiParticles(pieces);
    confettiTimeoutRef.current = setTimeout(() => setConfettiParticles([]), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    };
  }, []);

  type PaymentType = "muscle_god" | "energy_refill" | "tier_upgrade";
  const pendingPaymentRef = useRef<{ amount: number; type: PaymentType; targetLevel?: number } | null>(null);

  const executeSolPayment = useCallback(async (amount: number, type: PaymentType, targetLevel?: number) => {
    if (!solanaAdapterWallet.publicKey || !solanaAdapterWallet.signTransaction) {
      toast({ title: "Wallet not ready", description: "Please reconnect your wallet and try again.", variant: "destructive" });
      setPaymentLoading(false);
      return;
    }

    if (solBalance !== null && solBalance < amount + 0.005) {
      toast({ title: "Insufficient balance for this transaction", description: `You need at least ${amount} SOL plus gas fees. Current balance: ${solBalance.toFixed(4)} SOL`, variant: "destructive" });
      setPaymentLoading(false);
      return;
    }

    setPaymentLoading(true);
    setPaymentStep(1);
    setPaymentStatus("Creating transaction...");

    try {
      const blockhashRes = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestBlockhash", params: [{ commitment: "finalized" }] }),
      });
      if (!blockhashRes.ok) throw new Error("Failed to get blockhash from network");
      const blockhashData = await blockhashRes.json();
      const blockhash = blockhashData.result?.value?.blockhash;
      const lastValidBlockHeight = blockhashData.result?.value?.lastValidBlockHeight;
      if (!blockhash) throw new Error("Invalid blockhash response");

      const receiverPubkey = new PublicKey(RECEIVER_WALLET);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: solanaAdapterWallet.publicKey,
          toPubkey: receiverPubkey,
          lamports: Math.round(amount * LAMPORTS_PER_SOL),
        })
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = solanaAdapterWallet.publicKey;

      setPaymentStep(2);
      setPaymentStatus("Confirm in your wallet...");
      const signedTx = await solanaAdapterWallet.signTransaction(transaction);

      setPaymentStep(3);
      setPaymentStatus(type === "muscle_god" ? "Ascending to Godhood... Checking Blockchain..." : "Sending to blockchain...");

      const serialized = signedTx.serialize().toString("base64");
      const sendRes = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params: [serialized, { encoding: "base64", preflightCommitment: "confirmed" }] }),
      });
      if (!sendRes.ok) throw new Error("Failed to send transaction");
      const sendData = await sendRes.json();
      if (sendData.error) throw new Error(sendData.error.message || "Failed to send transaction");
      const signature = sendData.result;

      setPaymentStatus("Confirming on blockchain...");
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(SOLANA_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignatureStatuses", params: [[signature]] }),
        });
        const statusData = await statusRes.json();
        const status = statusData.result?.value?.[0];
        if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
          if (status.err) throw new Error("Transaction failed on-chain");
          confirmed = true;
          break;
        }
      }
      if (!confirmed) throw new Error("Transaction confirmation timed out");

      setPaymentStep(4);
      setPaymentStatus("Verified!");
      const result = { godPackExpiryDate: null as string | null };
      if (type === "muscle_god") {
        const expiry = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString();
        result.godPackExpiryDate = expiry;
      }

      if (solanaAdapterWallet.publicKey) fetchSolBalance(solanaAdapterWallet.publicKey.toBase58());

      if (type === "muscle_god") {
        setLevel(5);
        setEnergy(10000);
        localStorage.setItem("mf-level", "5");
        localStorage.setItem("mf-energy", "10000");
        if (result.godPackExpiryDate) {
          setGodPackExpiryDate(result.godPackExpiryDate);
          localStorage.setItem("mf-god-pack-expiry", result.godPackExpiryDate);
        }
        immediateSave({ level: 5, energy: 10000 });
        setPaymentLoading(false);
        setPaymentStatus("");
        setPaymentStep(0);
        triggerGoldExplosion();
        triggerConfetti();
        setShowSuccessModal(true);
      } else if (type === "tier_upgrade" && targetLevel !== undefined) {
        const newCfg = LEVEL_CONFIG[targetLevel];
        setLevel(targetLevel);
        setEnergy(newCfg.maxEnergy);
        localStorage.setItem("mf-level", String(targetLevel));
        localStorage.setItem("mf-energy", String(newCfg.maxEnergy));
        immediateSave({ level: targetLevel, energy: newCfg.maxEnergy });
        setPaymentLoading(false);
        setPaymentStatus("");
        setPaymentStep(0);
        triggerGoldExplosion();
        triggerConfetti();
        toast({ title: `Upgraded to ${newCfg.name}!`, description: `You are now Level ${targetLevel}. Gain: ${newCfg.gainPerTap} $MF/tap. Energy: ${newCfg.maxEnergy.toLocaleString()}.` });
      } else {
        setEnergy(config.maxEnergy);
        immediateSave({ energy: config.maxEnergy });
        toast({ title: "Energy Refilled!", description: "Your energy is now at maximum!" });
        setPaymentLoading(false);
        setPaymentStatus("");
        setPaymentStep(0);
      }
    } catch (err: any) {
      setPaymentLoading(false);
      setPaymentStatus("");
      setPaymentStep(0);
      const msg = err?.message || "";
      if (msg.includes("User rejected") || msg.includes("rejected")) {
        toast({ title: "Transaction cancelled by user", description: "No SOL was spent.", variant: "destructive" });
      } else if (msg.includes("Insufficient") || msg.includes("insufficient")) {
        toast({ title: "Insufficient balance for this transaction", description: "You don't have enough SOL to complete this transaction.", variant: "destructive" });
      } else if (msg.includes("expired") || msg.includes("blockhash")) {
        toast({ title: "Transaction expired", description: "The transaction timed out. No SOL was spent. Please try again.", variant: "destructive" });
      } else {
        toast({ title: "Transaction failed", description: msg || "No SOL was spent. Please try again.", variant: "destructive" });
      }
    }
  }, [solanaAdapterWallet, config, toast, triggerGoldExplosion, triggerConfetti, fetchSolBalance, solBalance, immediateSave]);

  useEffect(() => {
    if (solanaAdapterWallet.connected && solanaAdapterWallet.publicKey && pendingPaymentRef.current) {
      const { amount, type, targetLevel } = pendingPaymentRef.current;
      pendingPaymentRef.current = null;
      executeSolPayment(amount, type, targetLevel);
    }
  }, [solanaAdapterWallet.connected, solanaAdapterWallet.publicKey, executeSolPayment]);

  const sendSolPayment = useCallback(async (amount: number, type: PaymentType, targetLevel?: number) => {
    setPaymentLoading(true);

    if (!solanaAdapterWallet.connected) {
      setPaymentStatus("Connecting wallet...");
      pendingPaymentRef.current = { amount, type, targetLevel };
      try {
        await solanaAdapterWallet.connect();
      } catch (err: any) {
        if (err?.message?.includes("User rejected")) {
          toast({ title: "Wallet connection cancelled", variant: "destructive" });
        } else {
          toast({ title: "Failed to connect wallet", description: err?.message || "Unknown error", variant: "destructive" });
        }
        pendingPaymentRef.current = null;
        setPaymentLoading(false);
        setPaymentStatus("");
      }
      return;
    }

    await executeSolPayment(amount, type, targetLevel);
  }, [solanaAdapterWallet, executeSolPayment, toast]);

  const executeDonation = useCallback(async (amount: number) => {
    if (!solanaAdapterWallet.publicKey || !solanaAdapterWallet.signTransaction) {
      toast({ title: "Wallet not ready", description: "Please reconnect your wallet and try again.", variant: "destructive" });
      setPaymentLoading(false);
      return;
    }

    if (solBalance !== null && solBalance < amount + 0.005) {
      toast({ title: "Insufficient balance for this transaction", description: `You need at least ${amount} SOL plus gas fees. Current balance: ${solBalance.toFixed(4)} SOL`, variant: "destructive" });
      setPaymentLoading(false);
      return;
    }

    setPaymentLoading(true);
    setPaymentStep(1);
    setPaymentStatus("Creating donation...");
    try {
      const blockhashRes = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestBlockhash", params: [{ commitment: "finalized" }] }),
      });
      if (!blockhashRes.ok) throw new Error("Failed to get blockhash from network");
      const blockhashData = await blockhashRes.json();
      const blockhash = blockhashData.result?.value?.blockhash;
      if (!blockhash) throw new Error("Invalid blockhash response");

      const receiverPubkey = new PublicKey(RECEIVER_WALLET);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: solanaAdapterWallet.publicKey,
          toPubkey: receiverPubkey,
          lamports: Math.round(amount * LAMPORTS_PER_SOL),
        })
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = solanaAdapterWallet.publicKey;

      setPaymentStep(2);
      setPaymentStatus("Confirm in your wallet...");
      const signedTx = await solanaAdapterWallet.signTransaction(transaction);

      setPaymentStep(3);
      setPaymentStatus("Sending donation to blockchain...");

      const serialized = signedTx.serialize().toString("base64");
      const sendRes = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params: [serialized, { encoding: "base64", preflightCommitment: "confirmed" }] }),
      });
      if (!sendRes.ok) throw new Error("Failed to send donation");
      const sendData = await sendRes.json();
      if (sendData.error) throw new Error(sendData.error.message || "Failed to send donation");
      const signature = sendData.result;

      setPaymentStatus("Confirming donation...");
      let donationConfirmed = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(SOLANA_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignatureStatuses", params: [[signature]] }),
        });
        const statusData = await statusRes.json();
        const status = statusData.result?.value?.[0];
        if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
          if (status.err) throw new Error("Donation failed on-chain");
          donationConfirmed = true;
          break;
        }
      }
      if (!donationConfirmed) throw new Error("Donation confirmation timed out");

      setPaymentStep(4);
      setPaymentStatus("Donation confirmed!");
      if (solanaAdapterWallet.publicKey) fetchSolBalance(solanaAdapterWallet.publicKey.toBase58());
      toast({ title: "Donation Successful!", description: `Thank you for donating ${amount} SOL. 95% goes to Liquidity Pool.` });
      setPaymentLoading(false);
      setPaymentStatus("");
      setPaymentStep(0);
    } catch (err: any) {
      setPaymentLoading(false);
      setPaymentStatus("");
      setPaymentStep(0);
      const msg = err?.message || "";
      if (msg.includes("User rejected") || msg.includes("rejected")) {
        toast({ title: "Transaction cancelled by user", description: "No SOL was spent.", variant: "destructive" });
      } else if (msg.includes("Insufficient") || msg.includes("insufficient")) {
        toast({ title: "Insufficient balance for this transaction", description: "You don't have enough SOL.", variant: "destructive" });
      } else {
        toast({ title: "Donation failed", description: msg || "Please try again.", variant: "destructive" });
      }
    }
  }, [solanaAdapterWallet, toast, fetchSolBalance, solBalance]);

  const handleWithdraw = useCallback(async () => {
    if (!telegramId || isGuestMode()) {
      toast({ title: "Telegram required", description: "Connect via Telegram to withdraw $MSCF", variant: "destructive" });
      return;
    }
    const amount = parseFloat(withdrawAmount);
    const wCfg = WITHDRAWAL_CONFIG[level] || WITHDRAWAL_CONFIG[0];
    if (isNaN(amount) || amount < wCfg.minAmount) {
      toast({ title: "Invalid amount", description: `Minimum ${wCfg.minAmount.toLocaleString()} $MF required`, variant: "destructive" });
      return;
    }
    if (amount > points) {
      toast({ title: "Insufficient balance", description: "You don't have enough $MF", variant: "destructive" });
      return;
    }
    if (!isConnected || !wallet) {
      toast({ title: "Wallet required", description: "Connect your wallet first", variant: "destructive" });
      return;
    }
    setWithdrawLoading(true);
    try {
      const feeAmt = amount * wCfg.feePercent / 100;
      const netAmt = amount - feeAmt;
      const newBalance = points - amount;

      const { supabase } = await import("./lib/supabase");
      if (!supabase) throw new Error("Database not available");
      const { error } = await supabase.from("withdrawals").insert({
        telegram_id: telegramId,
        wallet_address: wallet,
        amount,
        fee_percent: wCfg.feePercent,
        fee_amount: feeAmt,
        net_amount: netAmt,
        rank_at_withdrawal: level,
        delay_hours: wCfg.delayHours,
        status: wCfg.delayHours === 0 ? "completed" : "pending",
        available_at: wCfg.delayHours === 0 ? new Date().toISOString() : new Date(Date.now() + wCfg.delayHours * 3600000).toISOString(),
      });
      if (error) throw error;

      setPoints(newBalance);
      localStorage.setItem("mf-points", String(newBalance));
      immediateSave({ points: newBalance });
      setWithdrawAmount("");
      fetchWithdrawals();
      if (wCfg.delayHours === 0) {
        toast({ title: "Withdrawal Complete!", description: `${netAmt.toLocaleString()} $MF sent instantly. ${feeAmt.toLocaleString()} $MF burned.` });
      } else {
        toast({ title: "Withdrawal Submitted!", description: `${netAmt.toLocaleString()} $MF will be available in ${wCfg.delayLabel}. ${feeAmt.toLocaleString()} $MF burned.` });
      }
      hapticSuccess();
    } catch (err) {
      hapticError();
      toast({ title: "Error", description: "Withdrawal failed. Try again.", variant: "destructive" });
    } finally {
      setWithdrawLoading(false);
    }
  }, [withdrawAmount, level, points, isConnected, wallet, toast, fetchWithdrawals, telegramId, immediateSave]);

  const handleDonateConfirm = useCallback(async () => {
    const amount = parseFloat(donateAmount);
    if (isNaN(amount) || amount < 0.0001) {
      toast({ title: "Invalid amount", description: "Minimum donation is 0.0001 SOL", variant: "destructive" });
      return;
    }
    setShowDonateConfirm(false);
    setShowDonateModal(false);
    if (!solanaAdapterWallet.connected) {
      try {
        await solanaAdapterWallet.connect();
      } catch {
        toast({ title: "Wallet connection failed", variant: "destructive" });
        return;
      }
    }
    await executeDonation(amount);
  }, [donateAmount, solanaAdapterWallet, executeDonation, toast]);

  const isGod = level === 5;
  const canRankUp = level < 4 && points >= LEVEL_CONFIG[level + 1].upgradeCost;
  const nextUpgradeCost = level < 5 ? LEVEL_CONFIG[level + 1]?.upgradeCost ?? -1 : -1;

  const formatGain = (g: number) => {
    if (g < 0.01) return `+${g.toFixed(4)}`;
    if (g < 1) return `+${g.toFixed(2)}`;
    return `+${g.toFixed(2)}`;
  };

  const [location] = useLocation();

  useEffect(() => {
    if (location === "/wallet" && isConnected) {
      fetchWithdrawals();
    }
  }, [location, isConnected, fetchWithdrawals]);

  const autoSaveRef = useRef<NodeJS.Timeout>();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (godPackExpiryDate) {
      const expiry = new Date(godPackExpiryDate).getTime();
      if (Date.now() >= expiry && level === 5) {
        setLevel(4);
        const legendCfg = LEVEL_CONFIG[4];
        setEnergy(legendCfg.maxEnergy);
        setGodPackExpiryDate(null);
        localStorage.setItem("mf-level", "4");
        localStorage.setItem("mf-energy", String(legendCfg.maxEnergy));
        localStorage.removeItem("mf-god-pack-expiry");
        toast({ title: "GOD PACK Expired", description: "Your Muscle God status has expired. You have been reverted to Legend rank." });
        immediateSave({ level: 4, energy: legendCfg.maxEnergy });
      }
    }
  }, [godPackExpiryDate, level, toast, immediateSave]);

  useEffect(() => {
    if (!telegramId) return;

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadGameSave(telegramId).then(save => {
        if (save) {
          const dbPoints = save.muscle_points ?? 0;
          const dbLevel = save.level ?? 0;
          const localPoints = Number(localStorage.getItem("mf-points") || "0");
          const localLevel = Number(localStorage.getItem("mf-level") || "0");
          if (dbPoints > localPoints || dbLevel > localLevel) {
            setPoints(Math.max(dbPoints, localPoints));
            setLevel(Math.max(dbLevel, localLevel));
            const cfg = LEVEL_CONFIG[Math.max(dbLevel, localLevel)];
            if (save.last_tap_timestamp) {
              const elapsed = (Date.now() - new Date(save.last_tap_timestamp).getTime()) / 1000;
              const recoveryRate = cfg.maxEnergy / cfg.recoverySeconds;
              const recoveredEnergy = Math.min(cfg.maxEnergy, (save.current_energy ?? 0) + elapsed * recoveryRate);
              setEnergy(recoveredEnergy);
            }
          }
          if (save.god_pack_expiry) {
            setGodPackExpiryDate(save.god_pack_expiry);
            localStorage.setItem("mf-god-pack-expiry", save.god_pack_expiry);
          }
        }
      }).catch(() => {});
    }

    autoSaveRef.current = setInterval(() => {
      saveGameToSupabase({
        telegram_id: telegramId,
        username: telegramName,
        muscle_points: points,
        level,
        current_energy: energy,
        last_tap_timestamp: new Date(lastTapTs).toISOString(),
        wallet_address: wallet || null,
        god_pack_expiry: godPackExpiryDate || null,
      }).then(() => {
        updateHighScore(telegramId, points);
      });
    }, 30000);

    return () => clearInterval(autoSaveRef.current);
  }, [points, level, energy, lastTapTs, wallet, telegramId, telegramName, godPackExpiryDate]);

  if (!tgChecked) {
    return (
      <div className="bg-[#000000] text-white flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#00f2ff] mx-auto" />
          <p className="text-gray-400 text-sm font-display">Loading MUSCLEFOOT...</p>
        </div>
      </div>
    );
  }

  const isGuest = !telegramId;

  return (
    <div className={`bg-[#000000] text-white font-sans overflow-hidden flex flex-col ${shaking ? 'animate-shake' : ''}`} style={{ height: '100dvh' }} onContextMenu={e => e.preventDefault()}>
      {isGuest && (
        <div className="w-full bg-[#d4ff00]/10 border-b border-[#d4ff00]/30 px-3 py-1.5 text-center shrink-0 z-50" data-testid="guest-banner">
          <p className="text-[10px] sm:text-xs font-bold text-[#d4ff00] tracking-wider font-display">
            Guest Mode: Connect via Telegram to earn $MSCF
          </p>
        </div>
      )}
      <header className="w-full bg-black/90 backdrop-blur-xl border-b border-[#00f2ff]/15 z-50 px-2 sm:px-3 py-1.5 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap max-w-lg mx-auto min-h-[36px]">
          <div className="flex items-center gap-1.5 min-w-0 shrink">
            <div className="text-[#00f2ff] font-black font-numbers text-xs whitespace-nowrap drop-shadow-[0_0_8px_rgba(0,242,255,0.4)]" data-testid="text-header-balance">
              {points < 1 ? points.toFixed(4) : points.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-[9px] ml-0.5 text-[#00f2ff]/70">$MF</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[8px] font-black text-[#d4ff00]/60 uppercase tracking-wider whitespace-nowrap px-1.5 py-1 rounded-md bg-[#d4ff00]/10 border border-[#d4ff00]/20 hidden sm:flex items-center"
              data-testid="text-header-coming-soon"
            >
              $MF Available Soon
            </span>
            <Link
              href="/"
              className="play-neon-btn px-3 py-1 rounded-md font-black font-display text-xs uppercase tracking-wider text-[#00f2ff]"
              data-testid="button-header-play"
            >
              PLAY
            </Link>
            <span
              className="text-[8px] font-black text-[#d4ff00]/60 uppercase tracking-wider whitespace-nowrap px-1.5 py-1 rounded-md bg-[#d4ff00]/10 border border-[#d4ff00]/20 sm:hidden flex items-center"
              data-testid="text-header-coming-soon-mobile"
            >
              Soon
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setShowDonateModal(true); setDonateAmount("0.1"); setShowDonateConfirm(false); }}
              disabled={paymentLoading}
              className="donate-golden-btn h-7 px-2 rounded-md font-black font-display text-[9px] uppercase tracking-wider text-black flex items-center gap-1 disabled:opacity-40"
              data-testid="button-header-donate"
            >
              <Heart className="w-3 h-3" />
              <span className="hidden sm:inline">DONATE</span>
            </button>
            <div className="solana-wallet-btn-wrapper header-wallet-btn">
              <WalletMultiButton data-testid="button-header-wallet" style={{
                height: '28px',
                padding: '0 8px',
                background: 'rgba(171,159,242,0.9)',
                color: '#000',
                fontWeight: 900,
                borderRadius: '6px',
                fontSize: '9px',
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '0.03em',
                justifyContent: 'center',
                lineHeight: '28px',
              }} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden border-0">
        <AnimatePresence mode="wait">
          {location === "/" && (
            <motion.div
              key="play"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center px-4 relative h-full overflow-hidden"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] aspect-square bg-radial-cyan pointer-events-none opacity-20" />

              <div className="text-center mb-2 relative z-10">
                <h1 className="text-3xl font-black text-[#00f2ff] italic tracking-tighter font-display drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]">$MUSCLEFOOT</h1>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {isGod && <Crown className="w-4 h-4 text-[#d4ff00]" />}
                  <p className={`font-bold uppercase tracking-widest text-xs ${isGod ? 'text-[#d4ff00] drop-shadow-[0_0_8px_rgba(212,255,0,0.6)]' : 'text-gray-500'}`}>
                    Lvl {level} - {config.name}
                  </p>
                  {isGod && <Crown className="w-4 h-4 text-[#d4ff00]" />}
                </div>
                {isGod && godPackExpiryDate && (
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-0.5" data-testid="text-god-pack-expiry">
                    GOD PACK expires: {(() => {
                      const days = Math.max(0, Math.ceil((new Date(godPackExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                      return `${days} days remaining`;
                    })()}
                  </p>
                )}
                <div className="text-4xl font-black mt-2 flex items-center justify-center gap-1 font-numbers text-[#d4ff00] drop-shadow-[0_0_15px_rgba(212,255,0,0.3)]">
                  {points < 1 ? points.toFixed(4) : points.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className="text-sm text-gray-500 ml-1">$MF</span>
                </div>
              </div>

              <div className="relative w-full max-w-[280px] aspect-square flex items-center justify-center z-10 mx-auto" data-testid="tap-area">
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  onClick={handleTap}
                  className={`relative z-10 cursor-pointer transition-transform ${energy < config.costPerTap ? 'opacity-40 grayscale' : ''}`}
                  data-testid="button-tap"
                >
                  <img
                    src={logoImg}
                    alt="MuscleFoot"
                    className="w-full h-full object-contain filter drop-shadow-[0_0_20px_#00f2ff]"
                  />
                </motion.div>

                {clicks.map(click => (
                  <motion.div
                    key={click.id}
                    initial={{ opacity: 1, y: 0, scale: 1 }}
                    animate={{ opacity: 0, y: -100, scale: 1.5 }}
                    className="fixed pointer-events-none text-[#d4ff00] font-black text-xl z-50 font-numbers"
                    style={{ left: click.x - 30, top: click.y - 40 }}
                  >
                    {formatGain(click.gain)}
                  </motion.div>
                ))}
              </div>

              <div className="w-full max-w-xs mt-3 space-y-1 relative z-10">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-400">
                  <span>Energy</span>
                  <span className={isGod ? "text-[#d4ff00]" : "text-[#00f2ff]"}>
                    {Math.floor(energy)}/{config.maxEnergy}
                  </span>
                </div>
                <div className={`h-3 w-full rounded-full border overflow-hidden ${
                  isGod
                    ? 'bg-[#d4ff00]/10 border-[#d4ff00]/40 shadow-[0_0_15px_rgba(212,255,0,0.3)]'
                    : 'bg-white/10 border-[#00f2ff]/30 shadow-[0_0_10px_rgba(0,242,255,0.2)]'
                }`}>
                  <motion.div
                    className={`h-full ${isGod ? 'bg-gradient-to-r from-[#d4ff00] to-[#ffd700]' : 'bg-gradient-to-r from-[#00f2ff] to-[#00d8e6]'}`}
                    animate={{ width: `${energyPercent}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 30 }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1"><Clock size={10} /> Refill: {countdown}</span>
                  <span>Cost: {config.costPerTap} / Tap</span>
                </div>
              </div>

              {level < 4 && (
                <div className="w-full max-w-xs mt-4 z-10">
                  <Button
                    onClick={handleRankUp}
                    disabled={!canRankUp}
                    className={`w-full h-12 font-black font-display text-sm tracking-wider transition-all ${
                      canRankUp
                        ? 'bg-gradient-to-r from-[#00f2ff] to-[#d4ff00] text-black shadow-[0_0_20px_rgba(0,242,255,0.3)] active:scale-95'
                        : 'bg-white/5 text-white/30 border border-white/5'
                    }`}
                    data-testid="button-rank-up"
                  >
                    <ArrowUp className="w-4 h-4 mr-2" />
                    RANK UP TO {LEVEL_CONFIG[level + 1]?.name.toUpperCase() || '---'}
                    {nextUpgradeCost > 0 && (
                      <span className="ml-2 text-[10px] opacity-70">({nextUpgradeCost.toLocaleString()} $MF)</span>
                    )}
                  </Button>
                </div>
              )}

              {level < 5 && (
                <div className="w-full max-w-sm mt-4 z-10 relative flex flex-col items-center">
                  <div className="gold-halo" style={{ top: '-120px', left: '50%', transform: 'translateX(-50%)' }} />

                  {[...Array(12)].map((_, i) => (
                    <div
                      key={`spark-${i}`}
                      className="gold-spark"
                      style={{
                        left: `${8 + Math.random() * 84}%`,
                        bottom: '10px',
                        '--float-y': `${-40 - Math.random() * 60}px`,
                        '--float-x': `${(Math.random() - 0.5) * 30}px`,
                        '--spark-duration': `${1.5 + Math.random() * 2}s`,
                        '--spark-delay': `${Math.random() * 3}s`,
                      } as React.CSSProperties}
                    />
                  ))}

                  <button
                    onClick={() => setShowPurchaseConfirm({ rankName: "Muscle God", solPrice: 10, targetLevel: 5, isGodPack: true })}
                    disabled={paymentLoading}
                    className="golden-god-btn w-full h-16 rounded-lg font-black font-display text-base uppercase tracking-wider text-black disabled:opacity-40 relative z-10 flex items-center justify-center gap-2"
                    data-testid="button-buy-muscle-god"
                  >
                    {paymentLoading ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />{paymentStatus}</span>
                    ) : (
                      <span className="flex items-center gap-2"><Crown className="w-5 h-5" />BECOME A MUSCLE GOD: 10 SOL</span>
                    )}
                  </button>
                </div>
              )}

              {energy < config.maxEnergy && !paymentLoading && (
                <div className="w-full max-w-xs mt-2 z-10">
                  <Button
                    onClick={() => sendSolPayment(0.01, "energy_refill")}
                    disabled={paymentLoading || !solanaAdapterWallet.connected}
                    className="w-full h-9 text-xs font-black font-display tracking-wider bg-[#00f2ff]/20 text-[#00f2ff] border border-[#00f2ff]/30 disabled:opacity-30"
                    data-testid="button-refill-energy"
                  >
                    <Battery className="w-3 h-3 mr-1" /> REFILL ENERGY NOW (0.01 SOL)
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {location === "/boost" && (
            <motion.div key="boost" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4 overflow-y-auto h-full pb-24">
              <h2 className="text-2xl font-black text-[#00f2ff] mb-2 font-display" data-testid="text-boost-title">RANK SYSTEM</h2>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-4">Your rank determines your earning power and energy capacity</p>
              
              <div className="space-y-3">
                {LEVEL_CONFIG.map((cfg, idx) => {
                  const isCurrent = idx === level;
                  const isLocked = idx > level;
                  const isUnlocked = idx < level;
                  const isGodTier = idx === 5;
                  const isNextTier = idx === level + 1;

                  return (
                    <Card key={idx} className={`overflow-visible border transition-all ${
                      isCurrent 
                        ? isGodTier 
                          ? 'bg-[#d4ff00]/10 border-[#d4ff00]/50 shadow-[0_0_20px_rgba(212,255,0,0.2)]'
                          : 'bg-[#00f2ff]/10 border-[#00f2ff]/50 shadow-[0_0_15px_rgba(0,242,255,0.2)]'
                        : isLocked 
                          ? 'bg-white/[0.02] border-white/5 opacity-60' 
                          : 'bg-white/5 border-white/10'
                    }`} data-testid={`card-rank-${idx}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isGodTier && <Crown className="w-4 h-4 text-[#d4ff00]" />}
                            <h3 className={`font-black font-display text-sm ${
                              isCurrent ? (isGodTier ? 'text-[#d4ff00]' : 'text-[#00f2ff]') : 'text-white'
                            }`}>
                              Lvl {idx} - {cfg.name}
                            </h3>
                            {isCurrent && <Badge variant="outline" className="text-[9px] border-[#00f2ff] text-[#00f2ff]">CURRENT</Badge>}
                            {isUnlocked && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                          </div>
                          {isLocked && cfg.solPrice > 0 && !isNextTier && !isGodTier && (
                            <span className="text-[9px] font-black font-numbers text-gray-500">{cfg.solPrice} SOL</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Energy</span>
                            <span className="font-numbers font-bold text-white">{cfg.maxEnergy.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Recovery</span>
                            <span className="font-numbers font-bold text-white">
                              {cfg.recoverySeconds >= 3600 ? `${cfg.recoverySeconds / 3600}h` : `${cfg.recoverySeconds / 60}min`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Gain/Tap</span>
                            <span className="font-numbers font-bold text-[#d4ff00]">{cfg.gainPerTap < 0.01 ? cfg.gainPerTap.toFixed(4) : cfg.gainPerTap < 1 ? cfg.gainPerTap.toFixed(2) : cfg.gainPerTap.toFixed(2)} $MF</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Cost/Tap</span>
                            <span className="font-numbers font-bold text-white">{cfg.costPerTap} Energy</span>
                          </div>
                        </div>

                        {isLocked && isNextTier && !isGodTier && (
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              onClick={handleRankUp}
                              disabled={!canRankUp}
                              className={`flex-1 h-10 font-black font-display text-xs ${
                                canRankUp
                                  ? 'bg-[#00f2ff] text-black shadow-[0_0_10px_rgba(0,242,255,0.3)]'
                                  : 'bg-white/5 text-white/30'
                              }`}
                              data-testid={`button-upgrade-${idx}`}
                            >
                              UPGRADE ({cfg.upgradeCost.toLocaleString()} $MF)
                            </Button>
                            <button
                              onClick={() => setShowPurchaseConfirm({ rankName: cfg.name, solPrice: cfg.solPrice, targetLevel: idx, isGodPack: false })}
                              disabled={paymentLoading}
                              className="golden-tier-btn h-10 px-4 rounded-lg font-black font-numbers text-xs text-black disabled:opacity-30 flex items-center justify-center gap-1.5 shrink-0"
                              data-testid={`button-sol-upgrade-${idx}`}
                            >
                              <Zap className="w-3 h-3" />
                              {cfg.solPrice} SOL
                            </button>
                          </div>
                        )}

                        {isLocked && !isNextTier && !isGodTier && cfg.solPrice > 0 && (
                          <div className="mt-3">
                            <button
                              onClick={() => setShowPurchaseConfirm({ rankName: cfg.name, solPrice: cfg.solPrice, targetLevel: idx, isGodPack: false })}
                              disabled={paymentLoading}
                              className="golden-tier-btn w-full h-9 rounded-lg font-black font-numbers text-xs text-black disabled:opacity-30 flex items-center justify-center gap-1.5"
                              data-testid={`button-sol-upgrade-${idx}`}
                            >
                              <Zap className="w-3 h-3" />
                              SKIP TO {cfg.name.toUpperCase()} - {cfg.solPrice} SOL
                            </button>
                          </div>
                        )}

                        {isLocked && isGodTier && (
                          <div className="mt-3 space-y-2">
                            <button
                              onClick={() => setShowPurchaseConfirm({ rankName: "Muscle God", solPrice: 10, targetLevel: 5, isGodPack: true })}
                              disabled={paymentLoading}
                              className="golden-god-btn w-full h-12 rounded-lg font-black font-display text-sm text-black disabled:opacity-30 flex items-center justify-center gap-2 relative overflow-hidden"
                              data-testid="button-boost-muscle-god"
                            >
                              {paymentLoading ? (
                                <span className="flex items-center gap-2 relative z-10"><Loader2 className="w-4 h-4 animate-spin" />{paymentStatus}</span>
                              ) : (
                                <span className="flex items-center gap-2 relative z-10"><Crown className="w-4 h-4" />GOD PACK - 10 SOL</span>
                              )}
                            </button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          )}

          {location === "/roadmap" && (
            <motion.div key="roadmap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 space-y-6 overflow-y-auto h-full pb-24 roadmap-grid-bg">
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-[#00f2ff] font-display uppercase tracking-tighter" data-testid="text-roadmap-title">Path to Glory</h2>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Project Completion</span>
                    <span className="text-[10px] text-[#d4ff00] font-black font-numbers">35%</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div className="h-full bg-gradient-to-r from-[#00f2ff] to-[#d4ff00] rounded-full shadow-[0_0_10px_rgba(0,242,255,0.4)]" style={{ width: '35%' }} />
                  </div>
                </div>
              </div>

              <div className="relative pl-8">
                <div className="absolute left-[11px] top-4 bottom-4 w-[2px] timeline-glow-line" />

                {[
                  {
                    q: "Phase 1", t: "The Warm-Up", status: "done" as const,
                    icon: Trophy,
                    items: [
                      "Telegram Portal Launch \u2014 Official $MF community hub",
                      "Infrastructure Stress-Test on Solana tap-to-earn bot",
                      "Alpha Access & Whitelisting \u2014 First 50 OG testers",
                      "Sustainability Audit \u2014 15% revenue to LP & Buybacks",
                      "Community Expansion \u2014 Marketing push on X"
                    ],
                    badge: "DONE", badgeColor: "bg-[#00f2ff]/20 text-[#00f2ff] border-[#00f2ff]/30"
                  },
                  {
                    q: "Phase 2", t: "The Feb 30-Day Sprint", status: "active" as const,
                    icon: Zap,
                    items: [
                      "Official Airdrop Kick-off \u2014 Fri, Feb 13th",
                      "30% Supply Allocation \u2014 300M $MF locked for community",
                      "Daily Multipliers \u2014 Weekend boosts & referral bonuses",
                      "Viral Expansion \u2014 Valentine\u2019s weekend social blitz"
                    ],
                    badge: "LIVE", badgeColor: "bg-[#d4ff00]/20 text-[#d4ff00] border-[#d4ff00]/30"
                  },
                  {
                    q: "Phase 3", t: "The Pump & Reward", status: "upcoming" as const,
                    icon: Rocket,
                    items: [
                      "Token Generation Event (TGE) \u2014 Fair Launch on Solana",
                      "Early Adopter Bonus \u2014 Exclusive multiplier for Feb joiners",
                      "Leaderboard Rewards \u2014 Top 100 Gym Rat bonus",
                      "Distribution Day \u2014 Airdrop based on 30-day performance",
                      "Sustainability Mode \u2014 15% revenue fuels LP & Buybacks"
                    ],
                    badge: "NEXT", badgeColor: "bg-white/10 text-gray-400 border-white/10"
                  },
                  {
                    q: "Phase 4", t: "The Muscle Democracy", status: "future" as const,
                    icon: Globe,
                    items: [
                      "Tier-1 CEX Listings \u2014 Global mass adoption",
                      "Strategic Fitness Partnerships \u2014 Gym chains & brands",
                      "DAO Governance \u2014 Community-led upgrades",
                      "Staking & Passive Gains \u2014 $MF staking platform"
                    ],
                    badge: "Q2 2026+", badgeColor: "bg-white/5 text-gray-500 border-white/5"
                  }
                ].map((phase, idx) => (
                  <motion.div
                    key={phase.q}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative mb-6 last:mb-0"
                  >
                    <div className={`absolute -left-8 top-4 w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                      phase.status === 'done' ? 'bg-[#00f2ff] shadow-[0_0_12px_rgba(0,242,255,0.8)]' :
                      phase.status === 'active' ? 'bg-[#d4ff00] shadow-[0_0_15px_rgba(212,255,0,0.8)] animate-pulse' :
                      'bg-white/10 border border-white/20'
                    }`}>
                      <phase.icon className={`w-3 h-3 ${phase.status === 'done' || phase.status === 'active' ? 'text-black' : 'text-gray-500'}`} />
                    </div>

                    <div className={`glassmorphism-card p-4 rounded-xl transition-transform duration-300 hover:scale-[1.02] active:scale-[1.02] ${
                      phase.status === 'active' ? 'border-[#d4ff00]/30 shadow-[0_0_20px_rgba(212,255,0,0.1)]' : ''
                    }`} data-testid={`card-roadmap-${idx}`}>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div>
                          <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{phase.q}</p>
                          <h3 className="font-black text-white text-base font-display">{phase.t}</h3>
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${phase.badgeColor}`}>{phase.badge}</span>
                      </div>
                      <ul className="space-y-2">
                        {phase.items.map(item => (
                          <li key={item} className="flex items-start gap-2">
                            <CheckCircle2 className={`w-3 h-3 mt-0.5 shrink-0 ${
                              phase.status === 'done' ? 'text-[#00f2ff]' :
                              phase.status === 'active' ? 'text-[#d4ff00]/60' : 'text-white/10'
                            }`} />
                            <span className={`text-xs font-medium ${
                              phase.status === 'done' ? 'text-gray-300' :
                              phase.status === 'active' ? 'text-gray-400' : 'text-gray-600'
                            }`}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {location === "/info" && (
            <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 space-y-6 overflow-y-auto h-full pb-24">

              <section className="space-y-3">
                <div className="flex items-center gap-3">
                  <Gem className="w-5 h-5 text-[#00f2ff]" />
                  <h2 className="text-xl font-black text-[#00f2ff] font-display uppercase tracking-tighter" data-testid="text-economy-title">Sustainable Economy</h2>
                </div>
                <p className="text-gray-400 text-xs font-medium leading-relaxed">
                  Every SOL spent in the game fuels the $MF ecosystem. Transparency is our priority.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest font-display">Revenue Distribution</h3>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4" data-testid="section-revenue">
                  {[
                    { label: "Liquidity Pool & Buybacks", pct: 75, color: "#3b82f6", bgColor: "bg-blue-500", icon: Droplets, desc: "Stable & rising floor price for $MF", tid: "liquidity" },
                    { label: "Marketing & Operations", pct: 20, color: "#f97316", bgColor: "bg-orange-500", icon: Megaphone, desc: "Ads, server costs & global expansion", tid: "marketing" },
                    { label: "Dev Fund", pct: 5, color: "#a855f7", bgColor: "bg-purple-500", icon: Code, desc: "Team rewards & technical updates", tid: "dev" },
                  ].map(item => (
                    <div key={item.label} className="space-y-2" data-testid={`row-revenue-${item.tid}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <item.icon className="w-4 h-4" style={{ color: item.color }} />
                          <span className="text-white text-xs font-bold">{item.label}</span>
                        </div>
                        <span className="font-black font-numbers text-sm" style={{ color: item.color }}>{item.pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${item.pct}%`, backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}40` }} />
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium pl-6">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-gray-600 font-medium leading-relaxed px-1 italic">
                  Smart contracts will automatically route these funds to ensure project longevity.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest font-display">Token Info</h3>
                <div className="bg-white/5 rounded-xl border border-white/10 divide-y divide-white/5" data-testid="section-token-info">
                  {[
                    { label: "Total Supply", value: "1,000,000,000 $MF", tid: "supply" },
                    { label: "Network", value: "Solana (SPL)", tid: "network" },
                    { label: "Contract Address", value: "TBA", tid: "contract" },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between p-3" data-testid={`row-token-${row.tid}`}>
                      <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{row.label}</span>
                      <span className={`text-xs font-black font-numbers ${row.value === 'TBA' ? 'text-gray-600' : 'text-white'}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest font-display">Token Allocation</h3>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3" data-testid="section-allocation">
                  {[
                    { l: "Liquidity Pool", v: "55%", c: "text-[#00f2ff]", bar: "bg-[#00f2ff]", w: 55, s: "Fair Launch \u2014 LP Burned", tid: "lp" },
                    { l: "Community Airdrop", v: "25%", c: "text-[#d4ff00]", bar: "bg-[#d4ff00]", w: 25, s: "Dedicated athletes & early adopters", tid: "airdrop" },
                    { l: "Ecosystem & Growth", v: "15%", c: "text-white", bar: "bg-white", w: 15, s: "Game features & staking rewards", tid: "ecosystem" },
                    { l: "Marketing & Team", v: "5%", c: "text-gray-400", bar: "bg-gray-400", w: 5, s: "Global reach & development", tid: "team" }
                  ].map(item => (
                    <div key={item.l} className="space-y-1" data-testid={`row-allocation-${item.tid}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-xs font-bold">{item.l}</span>
                        <span className={`font-black text-sm font-numbers ${item.c}`}>{item.v}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${item.bar} rounded-full opacity-60`} style={{ width: `${item.w}%` }} />
                      </div>
                      <p className="text-[9px] text-gray-600 font-medium">{item.s}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest font-display mb-3">Join the Army</h3>
                <div className="grid grid-cols-1 gap-3">
                  <Button asChild className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between px-5 rounded-xl group transition-all active:scale-95">
                    <a href="https://x.com/MUSCLEFOOTCOIN" target="_blank" rel="noopener noreferrer" data-testid="link-twitter">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-black rounded-lg border border-white/20 group-hover:border-[#00f2ff] transition-colors">
                          <Twitter className="w-4 h-4 text-[#00f2ff]" />
                        </div>
                        <span className="font-black font-display uppercase tracking-widest text-xs">Follow on X</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-[#00f2ff]" />
                    </a>
                  </Button>
                  <Button asChild className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between px-5 rounded-xl group transition-all active:scale-95">
                    <a href="https://t.me/+tc-g71IeTCVmNjM0" target="_blank" rel="noopener noreferrer" data-testid="link-telegram">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-black rounded-lg border border-white/20 group-hover:border-[#00f2ff] transition-colors">
                          <Send className="w-4 h-4 text-[#00f2ff]" />
                        </div>
                        <span className="font-black font-display uppercase tracking-widest text-xs">Join Telegram</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-[#00f2ff]" />
                    </a>
                  </Button>
                  <div className="w-full h-14 bg-[#d4ff00]/20 text-[#d4ff00]/60 flex items-center justify-between px-5 rounded-xl border border-[#d4ff00]/20" data-testid="text-buy-coming-soon">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-black/10 rounded-lg border border-black/20">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      <span className="font-black font-display uppercase tracking-widest text-xs">Buy $MUSCLEFOOT</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Available Soon</span>
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {location === "/wallet" && (
            <motion.div key="wallet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 space-y-6 overflow-y-auto h-full pb-24">
              <div className="text-center bg-white/5 p-8 rounded-2xl border border-white/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-[#00f2ff]/5 blur-3xl -z-10" />
                <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2 font-display">Your $MF Balance</p>
                <div className="text-4xl font-black text-[#d4ff00] font-numbers drop-shadow-[0_0_15px_rgba(212,255,0,0.3)]" data-testid="text-mf-balance">
                  {points < 1 ? points.toFixed(4) : points.toLocaleString(undefined, { maximumFractionDigits: 2 })} $MF
                </div>
              </div>

              <Card className="bg-white/5 border-white/10 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between gap-2 font-display text-[#00f2ff]">
                    <span className="flex items-center gap-2"><ArrowDown className="w-5 h-5" /> Withdrawal</span>
                    <Badge variant="outline" className="text-[10px] border-[#00f2ff] text-[#00f2ff] bg-[#00f2ff]/10">V2.0</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    {!isConnected ? (
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex flex-col items-stretch gap-2">
                          <div className="solana-wallet-btn-wrapper">
                            <WalletMultiButton style={{
                              width: '100%',
                              height: '64px',
                              background: '#ab9ff2',
                              color: '#000',
                              fontWeight: 900,
                              borderRadius: '12px',
                              fontSize: '14px',
                              fontFamily: 'Orbitron, sans-serif',
                              letterSpacing: '0.05em',
                              justifyContent: 'center',
                            }} />
                          </div>
                          <p className="text-[9px] text-gray-500 text-center font-bold uppercase tracking-wider">Connect your Solana wallet to withdraw</p>
                          {!isPhantomInstalled() && (
                            <a
                              href={getPhantomBrowseUrl()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full h-12 rounded-xl font-black text-xs tracking-wider flex items-center justify-center gap-2 border-2 border-[#ab9ff2]/40 text-[#ab9ff2] bg-[#ab9ff2]/10 mt-1"
                              style={{ fontFamily: 'Orbitron, sans-serif' }}
                              data-testid="link-open-phantom-app"
                            >
                              <ExternalLink className="w-4 h-4" />
                              OPEN IN PHANTOM APP
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {walletType === "generated" && (
                          <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="p-4 bg-yellow-500/10 border-2 border-[#d4ff00] rounded-xl text-[#d4ff00] animate-pulse shadow-[0_0_15px_rgba(212,255,0,0.2)]"
                          >
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                              <p className="text-[10px] font-black uppercase leading-tight tracking-tight">
                                IMPORTANT: This is a local wallet. Your Secret Key is stored ONLY on this browser.
                                If you clear your cache, you will LOSE ACCESS. Save your Secret Key immediately!
                              </p>
                            </div>
                          </motion.div>
                        )}

                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="w-5 h-5 text-[#00f2ff]" />
                              <div>
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                  {walletType === "phantom" ? "Phantom Connected" : "Instant Wallet Active"}
                                </p>
                                <p className="font-mono text-xs text-[#00f2ff] truncate max-w-[180px]" data-testid="text-wallet-address">
                                  {wallet.substring(0, 8)}...{wallet.substring(wallet.length - 8)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => copyToClipboard(wallet, "Address")}
                                className="text-gray-400"
                                data-testid="button-copy-address"
                              >
                                <Copy size={16} />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleDisconnectWallet}
                                className="text-gray-400"
                                data-testid="button-disconnect-wallet"
                              >
                                <LogOut size={16} />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                              <p className="text-[9px] text-gray-500 font-black uppercase">SOL Balance</p>
                              <p className="text-sm font-black font-numbers" data-testid="text-sol-balance">
                                {solBalanceLoading ? (
                                  <span className="text-gray-400 flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  </span>
                                ) : solBalance !== null ? (
                                  `${solBalance.toFixed(4)} SOL`
                                ) : (
                                  "-- SOL"
                                )}
                              </p>
                            </div>
                            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                              <p className="text-[9px] text-gray-500 font-black uppercase">$MF Balance</p>
                              <p className="text-sm font-black font-numbers text-[#d4ff00]" data-testid="text-mf-wallet-balance">
                                {points < 1 ? points.toFixed(4) : points.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>

                          {walletType === "generated" && (
                            <div className="space-y-2 pt-2 border-t border-white/5">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Security Backup</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowSecret(!showSecret)}
                                  className="text-[10px] font-black text-[#d4ff00]"
                                  data-testid="button-toggle-secret"
                                >
                                  {showSecret ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />}
                                  {showSecret ? "HIDE SECRET" : "VIEW SECRET KEY"}
                                </Button>
                              </div>
                              {showSecret && (
                                <div className="p-3 bg-black/60 rounded-lg border border-[#d4ff00]/30 break-all">
                                  <p className="font-mono text-[9px] text-[#d4ff00] leading-relaxed mb-2" data-testid="text-secret-key">
                                    {secretKey}
                                  </p>
                                  <Button
                                    className="w-full bg-[#d4ff00] text-black text-[10px] font-black"
                                    onClick={() => copyToClipboard(secretKey, "Secret Key")}
                                    data-testid="button-copy-secret"
                                  >
                                    COPY SECRET KEY
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-gray-500 text-[10px] font-black tracking-widest uppercase mt-2"
                            onClick={handleDisconnectWallet}
                            data-testid="button-disconnect"
                          >
                            SWITCH / DISCONNECT WALLET
                          </Button>
                        </div>
                      </div>
                    )}

                    {!isConnected && (
                      <p className="text-[10px] text-gray-400 italic text-center px-4 leading-relaxed font-medium uppercase tracking-tight">
                        MuscleFoot will never ask for your seed phrase. Connection is used only for withdrawals.
                      </p>
                    )}

                    {(() => {
                      const wCfg = WITHDRAWAL_CONFIG[level] || WITHDRAWAL_CONFIG[0];
                      const parsedAmount = parseFloat(withdrawAmount) || 0;
                      const feeAmt = parsedAmount * (wCfg.feePercent / 100);
                      const netAmt = parsedAmount - feeAmt;
                      const canWithdraw = isConnected && parsedAmount >= wCfg.minAmount && parsedAmount <= points;
                      const belowMin = points < wCfg.minAmount;

                      return (
                        <div className="space-y-4">
                          <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Your Rank Terms</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-black/40 p-3 rounded-lg border border-white/5 text-center">
                                <p className="text-[9px] text-gray-500 font-black uppercase">Min. Amount</p>
                                <p className="text-sm font-black text-[#00f2ff] font-numbers">{wCfg.minAmount.toLocaleString()}</p>
                                <p className="text-[8px] text-gray-600 font-bold">$MF</p>
                              </div>
                              <div className="bg-black/40 p-3 rounded-lg border border-white/5 text-center">
                                <p className="text-[9px] text-gray-500 font-black uppercase">Fee</p>
                                <p className="text-sm font-black text-[#d4ff00] font-numbers">{wCfg.feePercent}%</p>
                                <p className="text-[8px] text-gray-600 font-bold">Burned</p>
                              </div>
                              <div className="bg-black/40 p-3 rounded-lg border border-white/5 text-center">
                                <p className="text-[9px] text-gray-500 font-black uppercase">Processing</p>
                                <p className={`text-sm font-black font-numbers ${wCfg.delayHours === 0 ? 'text-[#d4ff00]' : 'text-white'}`}>{wCfg.delayLabel}</p>
                                <p className="text-[8px] text-gray-600 font-bold">{wCfg.delayHours === 0 ? 'GOD Perk' : 'Delay'}</p>
                              </div>
                            </div>
                          </div>

                          {belowMin && isConnected && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                              <p className="text-red-400 text-[11px] font-bold uppercase tracking-tight" data-testid="text-min-warning">
                                Minimum {wCfg.minAmount.toLocaleString()} $MF required to withdraw at your current rank.
                              </p>
                            </div>
                          )}

                          <div className="space-y-3">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Withdraw Amount</p>
                            <div className="relative">
                              <input
                                type="number"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                placeholder={`Min. ${wCfg.minAmount.toLocaleString()} $MF`}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-numbers font-bold text-lg focus:outline-none focus:border-[#00f2ff]/50 transition-colors placeholder:text-gray-600"
                                disabled={!isConnected || belowMin}
                                data-testid="input-withdraw-amount"
                              />
                              {isConnected && !belowMin && (
                                <button
                                  onClick={() => setWithdrawAmount(String(Math.floor(points)))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#00f2ff] uppercase tracking-widest"
                                  data-testid="button-max-withdraw"
                                >
                                  MAX
                                </button>
                              )}
                            </div>
                          </div>

                          {parsedAmount > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2"
                            >
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Withdrawal Summary</p>
                              <div className="flex justify-between text-xs font-bold">
                                <span className="text-gray-400">Amount</span>
                                <span className="text-white font-numbers">{parsedAmount.toLocaleString()} $MF</span>
                              </div>
                              <div className="flex justify-between text-xs font-bold">
                                <span className="text-gray-400">Fee ({wCfg.feePercent}% burned)</span>
                                <span className="text-red-400 font-numbers">-{feeAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })} $MF</span>
                              </div>
                              <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-black">
                                <span className="text-gray-300">You Receive</span>
                                <span className="text-[#d4ff00] font-numbers" data-testid="text-net-amount">{netAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })} $MF</span>
                              </div>
                              {wCfg.delayHours > 0 && (
                                <div className="flex items-center gap-2 pt-1">
                                  <Clock className="w-3 h-3 text-gray-500" />
                                  <p className="text-[10px] text-gray-500 font-bold">Available after {wCfg.delayLabel} processing delay</p>
                                </div>
                              )}
                              {wCfg.delayHours === 0 && (
                                <div className="flex items-center gap-2 pt-1">
                                  <Zap className="w-3 h-3 text-[#d4ff00]" />
                                  <p className="text-[10px] text-[#d4ff00] font-bold">Instant processing (GOD Rank perk)</p>
                                </div>
                              )}
                            </motion.div>
                          )}

                          <Button
                            className={`w-full h-14 font-black text-lg transition-all duration-500 relative overflow-hidden font-display ${
                              canWithdraw
                                ? 'bg-[#d4ff00] text-black shadow-[0_0_30px_rgba(212,255,0,0.4)]'
                                : 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'
                            }`}
                            disabled={!canWithdraw || withdrawLoading}
                            onClick={handleWithdraw}
                            data-testid="button-withdraw"
                          >
                            {withdrawLoading ? (
                              <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> PROCESSING...</span>
                            ) : !isConnected ? (
                              'CONNECT WALLET FIRST'
                            ) : belowMin ? (
                              'INSUFFICIENT BALANCE'
                            ) : parsedAmount < wCfg.minAmount ? (
                              `MIN. ${wCfg.minAmount.toLocaleString()} $MF`
                            ) : (
                              'WITHDRAW NOW'
                            )}
                          </Button>

                          <p className="text-[10px] text-gray-500 text-center leading-relaxed font-medium uppercase tracking-tighter">
                            All fees are permanently burned from the total supply.
                          </p>
                        </div>
                      );
                    })()}

                    <div className="pt-4 border-t border-white/5">
                      <button
                        onClick={() => { setShowWithdrawHistory(!showWithdrawHistory); if (!showWithdrawHistory) fetchWithdrawals(); }}
                        className="w-full flex items-center justify-between py-2"
                        data-testid="button-toggle-history"
                      >
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Withdrawal History</p>
                        <ArrowDown className={`w-3 h-3 text-gray-500 transition-transform ${showWithdrawHistory ? 'rotate-180' : ''}`} />
                      </button>
                      {showWithdrawHistory && (
                        <div className="space-y-2 mt-2">
                          {withdrawals.length === 0 ? (
                            <p className="text-[10px] text-gray-600 text-center py-4 font-bold uppercase">No withdrawals yet</p>
                          ) : (
                            withdrawals.slice(0, 10).map((w: any) => (
                              <div key={w.id} className="p-3 bg-black/40 rounded-lg border border-white/5 space-y-1" data-testid={`row-withdrawal-${w.id}`}>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-white font-numbers">{w.netAmount.toLocaleString()} $MF</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] ${
                                      w.status === 'completed' ? 'border-green-500 text-green-400 bg-green-500/10' :
                                      w.status === 'pending' ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10' :
                                      'border-gray-500 text-gray-400 bg-gray-500/10'
                                    }`}
                                  >
                                    {w.status === 'completed' ? 'Completed' : w.status === 'pending' ? 'Processing' : w.status}
                                  </Badge>
                                </div>
                                <div className="flex justify-between text-[9px] text-gray-500">
                                  <span>Fee: {w.feeAmount.toLocaleString()} $MF ({w.feePercent}%)</span>
                                  <span>{new Date(w.createdAt).toLocaleDateString()}</span>
                                </div>
                                {w.status === 'pending' && w.availableAt && (
                                  <div className="flex items-center gap-1 text-[9px] text-yellow-500">
                                    <Clock className="w-3 h-3" />
                                    <span>Available: {new Date(w.availableAt).toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/5 text-center">
                      <p className="text-[10px] text-gray-500 font-black tracking-[0.2em] mb-3 uppercase">Need Support?</p>
                      <Button
                        asChild
                        variant="ghost"
                        className="h-auto py-2 px-4 group transition-all"
                      >
                        <a href="https://x.com/MUSCLEFOOTCOIN" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" data-testid="link-support">
                          <Twitter className="w-4 h-4 text-[#00f2ff]" />
                          <span className="text-[#00f2ff] font-black font-display text-xs tracking-widest uppercase">Contact us on X</span>
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="w-full bg-[#d4ff00]/20 text-[#d4ff00]/60 font-black h-14 rounded-2xl font-display text-lg tracking-wider flex items-center justify-center gap-3 border border-[#d4ff00]/20" data-testid="text-buy-musclefoot-soon">
                <span>BUY $MUSCLEFOOT</span>
                <span className="text-xs font-bold opacity-70">— Available Soon</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {paymentLoading && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center gap-6" data-testid="payment-overlay">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-[#d4ff00]/30 border-t-[#d4ff00] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Crown className="w-8 h-8 text-[#d4ff00]" />
            </div>
          </div>

          <div className="text-center space-y-3 max-w-xs">
            <p className="text-[#d4ff00] font-black font-display text-base uppercase tracking-widest animate-pulse" data-testid="text-payment-status">
              {paymentStatus}
            </p>

            <div className="flex items-center justify-center gap-2 mt-4">
              {[1, 2, 3, 4].map(step => (
                <div key={step} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    paymentStep >= step
                      ? 'bg-[#d4ff00] shadow-[0_0_8px_rgba(212,255,0,0.6)]'
                      : 'bg-white/10'
                  }`} />
                  {step < 4 && <div className={`w-6 h-0.5 transition-all duration-500 ${
                    paymentStep > step ? 'bg-[#d4ff00]' : 'bg-white/10'
                  }`} />}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1 mt-2">
              {["Preparing", "Signing", "Confirming", "Verified"].map((label, idx) => (
                <div key={label} className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${
                  paymentStep > idx + 1 ? 'text-[#d4ff00]' : paymentStep === idx + 1 ? 'text-white' : 'text-white/20'
                }`}>
                  {paymentStep > idx + 1 ? `\u2713 ${label}` : label}
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider mt-4">Do not close this screen</p>
        </div>
      )}

      <AnimatePresence>
        {showPurchaseConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[180] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowPurchaseConfirm(null)}
            data-testid="modal-purchase-confirm"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="w-full max-w-sm rounded-2xl border overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(30,28,20,0.98) 0%, rgba(15,14,10,0.98) 100%)',
                borderColor: showPurchaseConfirm.isGodPack ? 'rgba(212,255,0,0.3)' : 'rgba(255,215,0,0.2)',
                boxShadow: showPurchaseConfirm.isGodPack
                  ? '0 0 40px rgba(212,255,0,0.15), inset 0 1px 0 rgba(255,215,0,0.1)'
                  : '0 0 30px rgba(255,215,0,0.1), inset 0 1px 0 rgba(255,215,0,0.05)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-5">
                <div className="text-center space-y-2">
                  <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${
                    showPurchaseConfirm.isGodPack
                      ? 'bg-gradient-to-br from-[#d4ff00] via-[#ffd700] to-[#ffb300] shadow-[0_0_25px_rgba(212,255,0,0.4)]'
                      : 'bg-gradient-to-br from-[#ffd700] to-[#b8860b] shadow-[0_0_15px_rgba(255,215,0,0.3)]'
                  }`}>
                    {showPurchaseConfirm.isGodPack ? (
                      <Crown className="w-7 h-7 text-black" />
                    ) : (
                      <ArrowUp className="w-7 h-7 text-black" />
                    )}
                  </div>
                  <h3 className="text-lg font-black font-display text-white uppercase tracking-tight" data-testid="text-confirm-title">
                    {showPurchaseConfirm.isGodPack ? 'Unlock God Pack' : `Upgrade to ${showPurchaseConfirm.rankName}`}
                  </h3>
                  <p className="text-gray-400 text-xs font-medium">
                    Are you sure you want to upgrade to <span className="text-white font-bold">{showPurchaseConfirm.rankName}</span> for{' '}
                    <span className="text-[#ffd700] font-black font-numbers">{showPurchaseConfirm.solPrice} SOL</span>?
                  </p>
                </div>

                {showPurchaseConfirm.isGodPack && (
                  <div className="space-y-2">
                    <div className="p-3 bg-[#d4ff00]/10 border border-[#d4ff00]/20 rounded-xl">
                      <p className="text-[#d4ff00] text-[10px] font-black uppercase tracking-tight flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        This status is valid for 100 days.
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-gray-400 text-[10px] font-bold leading-relaxed">
                    75% of this transaction is automatically used for <span className="text-[#00f2ff]">$MF Buybacks & Liquidity</span>.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPurchaseConfirm(null)}
                    className="flex-1 h-11 rounded-xl bg-white/10 text-gray-300 font-black font-display text-xs uppercase tracking-wider transition-all active:scale-95"
                    data-testid="button-confirm-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const info = showPurchaseConfirm;
                      setShowPurchaseConfirm(null);
                      if (info.isGodPack) {
                        sendSolPayment(info.solPrice, "muscle_god");
                      } else {
                        sendSolPayment(info.solPrice, "tier_upgrade", info.targetLevel);
                      }
                    }}
                    className="flex-1 h-11 rounded-xl font-black font-display text-xs text-black uppercase tracking-wider transition-all active:scale-95 golden-god-btn"
                    data-testid="button-confirm-purchase"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDonateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[180] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => { setShowDonateModal(false); setShowDonateConfirm(false); }}
            data-testid="modal-donate"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="w-full max-w-sm rounded-2xl border overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(30,28,20,0.98) 0%, rgba(15,14,10,0.98) 100%)',
                borderColor: 'rgba(255,215,0,0.2)',
                boxShadow: '0 0 30px rgba(255,215,0,0.1), inset 0 1px 0 rgba(255,215,0,0.05)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {!showDonateConfirm ? (
                <div className="p-6 space-y-5">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center bg-gradient-to-br from-[#ffd700] to-[#b8860b] shadow-[0_0_15px_rgba(255,215,0,0.3)]">
                      <Heart className="w-7 h-7 text-black" />
                    </div>
                    <h3 className="text-lg font-black font-display text-white uppercase tracking-tight" data-testid="text-donate-title">
                      Support $MUSCLEFOOT
                    </h3>
                    <p className="text-gray-400 text-xs font-medium">
                      Your donation fuels the ecosystem. 95% goes directly to the <span className="text-[#00f2ff]">Liquidity Pool</span>.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount (SOL)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={donateAmount}
                        onChange={(e) => setDonateAmount(e.target.value)}
                        className="w-full h-12 bg-white/5 border border-white/15 rounded-xl px-4 text-white font-black font-numbers text-lg focus:outline-none focus:border-[#ffd700]/50 focus:shadow-[0_0_10px_rgba(255,215,0,0.15)] transition-all"
                        placeholder="0.1"
                        data-testid="input-donate-amount"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-black">SOL</span>
                    </div>
                    <div className="flex gap-2">
                      {[0.05, 0.1, 0.5, 1].map(preset => (
                        <button
                          key={preset}
                          onClick={() => setDonateAmount(String(preset))}
                          className={`flex-1 h-8 rounded-lg text-[10px] font-black font-numbers border transition-all ${
                            donateAmount === String(preset)
                              ? 'bg-[#ffd700]/20 border-[#ffd700]/40 text-[#ffd700]'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                          }`}
                          data-testid={`button-preset-${preset}`}
                        >
                          {preset} SOL
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowDonateModal(false); setShowDonateConfirm(false); }}
                      className="flex-1 h-11 rounded-xl bg-white/10 text-gray-300 font-black font-display text-xs uppercase tracking-wider transition-all active:scale-95"
                      data-testid="button-donate-cancel"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const amt = parseFloat(donateAmount);
                        if (isNaN(amt) || amt < 0.0001) {
                          toast({ title: "Invalid amount", description: "Minimum is 0.0001 SOL", variant: "destructive" });
                          return;
                        }
                        setShowDonateConfirm(true);
                      }}
                      className="flex-1 h-11 rounded-xl font-black font-display text-xs text-black uppercase tracking-wider transition-all active:scale-95 golden-tier-btn"
                      data-testid="button-donate-next"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-5">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center bg-gradient-to-br from-[#ffd700] to-[#b8860b] shadow-[0_0_15px_rgba(255,215,0,0.3)]">
                      <Shield className="w-7 h-7 text-black" />
                    </div>
                    <h3 className="text-lg font-black font-display text-white uppercase tracking-tight" data-testid="text-donate-confirm-title">
                      Confirm Donation
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                      <span className="text-gray-400 text-xs font-bold">Amount</span>
                      <span className="text-[#ffd700] font-black font-numbers text-lg">{donateAmount} SOL</span>
                    </div>

                    <div className="p-3 bg-[#00f2ff]/5 border border-[#00f2ff]/15 rounded-xl space-y-2">
                      <p className="text-[10px] font-bold text-gray-300 uppercase tracking-tight">Fund Allocation:</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Droplets className="w-3 h-3 text-[#00f2ff]" />
                          <span className="text-xs font-bold text-[#00f2ff]">Liquidity Pool</span>
                        </div>
                        <span className="text-sm font-black font-numbers text-[#00f2ff]">95%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code className="w-3 h-3 text-gray-400" />
                          <span className="text-xs font-bold text-gray-400">Infrastructure</span>
                        </div>
                        <span className="text-sm font-black font-numbers text-gray-400">5%</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                      <p className="text-gray-500 text-[9px] font-bold leading-relaxed break-all">
                        Receiver: {RECEIVER_WALLET}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDonateConfirm(false)}
                      className="flex-1 h-11 rounded-xl bg-white/10 text-gray-300 font-black font-display text-xs uppercase tracking-wider transition-all active:scale-95"
                      data-testid="button-donate-back"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleDonateConfirm}
                      disabled={paymentLoading}
                      className="flex-1 h-11 rounded-xl font-black font-display text-xs text-black uppercase tracking-wider transition-all active:scale-95 golden-god-btn disabled:opacity-40"
                      data-testid="button-donate-confirm"
                    >
                      Donate Now
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center"
            data-testid="success-modal"
          >
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
              {confettiParticles.map(p => (
                <div
                  key={p.id}
                  className="confetti-piece"
                  style={{
                    left: `${p.x}%`,
                    width: p.size,
                    height: p.size * 0.6,
                    background: p.color,
                    animationDelay: `${p.delay}s`,
                    animationDuration: `${p.duration}s`,
                    transform: `rotate(${p.rotation}deg)`,
                  }}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 100, delay: 0.2 }}
              className="relative text-center px-8 py-10 max-w-sm mx-4"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-[#d4ff00]/10 via-[#ffd700]/5 to-transparent rounded-3xl border border-[#d4ff00]/20" />
              <div className="absolute -inset-4 bg-[#d4ff00]/5 blur-3xl rounded-full" />

              <div className="relative z-10 space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.5 }}
                  className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#d4ff00] via-[#ffd700] to-[#ffb300] flex items-center justify-center shadow-[0_0_40px_rgba(212,255,0,0.4)]"
                >
                  <Crown className="w-12 h-12 text-black" />
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="text-3xl font-black font-display text-[#d4ff00] uppercase tracking-wider drop-shadow-[0_0_20px_rgba(212,255,0,0.5)]"
                  data-testid="text-success-title"
                >
                  Welcome, Muscle God
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="text-gray-300 text-sm font-medium leading-relaxed"
                  data-testid="text-success-message"
                >
                  Your power is now infinite. Go crush the leaderboard.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1 }}
                  className="flex justify-center gap-6 text-center"
                >
                  <div>
                    <p className="text-2xl font-black font-numbers text-[#d4ff00]">10,000</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Max Energy</p>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div>
                    <p className="text-2xl font-black font-numbers text-[#d4ff00]">LVL 5</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Muscle God</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3 }}
                >
                  <Button
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full h-14 bg-gradient-to-r from-[#d4ff00] to-[#ffd700] text-black font-black font-display text-sm uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(212,255,0,0.3)]"
                    data-testid="button-close-success"
                  >
                    Start Crushing
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {goldExplosion && (
        <>
          <div className="fixed inset-0 z-[150] pointer-events-none">
            <div className="absolute inset-0 bg-[#d4ff00]/10 animate-pulse" />
          </div>
          {explosionParticles.map(p => (
            <div
              key={p.id}
              className="gold-particle"
              style={{
                left: p.x,
                top: p.y,
                width: p.size,
                height: p.size,
                background: `radial-gradient(circle, ${p.color}, transparent)`,
                boxShadow: `0 0 ${p.size}px ${p.color}`,
                '--tx': p.tx,
                '--ty': p.ty,
                animationDelay: `${p.delay}s`,
              } as React.CSSProperties}
            />
          ))}
        </>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-[#00f2ff]/20 h-20 px-2 z-50">
        <div className="flex justify-between items-center h-full max-w-lg mx-auto">
          {[
            { p: "/info", i: Info, l: "INFO" },
            { p: "/roadmap", i: Map, l: "ROADMAP" },
            { p: "/", i: Home, l: "PLAY" },
            { p: "/boost", i: Zap, l: "BOOST" },
            { p: "/wallet", i: WalletIcon, l: "WALLET" }
          ].map(tab => (
            <Link key={tab.p} href={tab.p} className={`flex flex-col items-center gap-1 transition-all duration-300 min-w-[54px] ${location === tab.p ? 'text-[#00f2ff] scale-110 drop-shadow-[0_0_8px_rgba(0,242,255,0.6)]' : 'text-gray-500 hover:text-gray-300'}`} data-testid={`nav-${tab.l.toLowerCase()}`}>
              <tab.i size={20} strokeWidth={location === tab.p ? 3 : 2} />
              <span className="text-[9px] font-black font-display tracking-widest">{tab.l}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Game} />
      <Route path="/boost" component={Game} />
      <Route path="/roadmap" component={Game} />
      <Route path="/info" component={Game} />
      <Route path="/wallet" component={Game} />
    </Switch>
  );
}

function App() {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
