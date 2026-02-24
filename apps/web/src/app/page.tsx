'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Video, 
  MessageSquare, 
  X, 
  Users, 
  ShieldCheck, 
  Zap, 
  Settings, 
  User 
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import ChatInterface from '@/components/chat/ChatInterface';
import { useEffect } from 'react';
import Image from 'next/image';

export default function LandingPage() {
  const [interests, setInterests] = useState<string[]>([]);
  const [currentInterest, setCurrentInterest] = useState('');
  const [mode, setMode] = useState<'landing' | 'video' | 'text'>('landing');

  // Settings State
  const [nickname, setNickname] = useState("Stranger");
  const [privacyMode, setPrivacyMode] = useState(false);
  const [autoClear, setAutoClear] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedNickname = localStorage.getItem('gm_nickname');
    const savedPrivacy = localStorage.getItem('gm_privacy') === 'true';
    const savedAutoClear = localStorage.getItem('gm_autoclear') === 'true';

    if (savedNickname) setNickname(savedNickname);
    setPrivacyMode(savedPrivacy);
    setAutoClear(savedAutoClear);

    // Auto-clear logic on leave
    const handleBeforeUnload = () => {
      const isAutoClearEnabled = localStorage.getItem('gm_autoclear') === 'true';
      if (isAutoClearEnabled) {
        localStorage.removeItem('gm_nickname');
        localStorage.removeItem('gm_privacy');
        localStorage.removeItem('gm_autoclear');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const saveSettings = (newNick: string, newPrivacy: boolean, newAuto: boolean) => {
    setNickname(newNick);
    setPrivacyMode(newPrivacy);
    setAutoClear(newAuto);
    localStorage.setItem('gm_nickname', newNick);
    localStorage.setItem('gm_privacy', String(newPrivacy));
    localStorage.setItem('gm_autoclear', String(newAuto));
  };

  const addInterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentInterest && !interests.includes(currentInterest)) {
      setInterests([...interests, currentInterest.trim()]);
      setCurrentInterest('');
    }
  };

  const removeInterest = (tag: string) => {
    setInterests(interests.filter(i => i !== tag));
  };

  if (mode !== 'landing') {
    return (
      <ChatInterface 
        mode={mode} 
        tags={interests} 
        onBack={() => setMode('landing')} 
        nickname={nickname}
        privacyMode={privacyMode}
      />
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-background flex flex-col items-center justify-center p-6 sm:p-12 text-foreground">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/15 blur-[120px] rounded-full point-events-none -z-10" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/15 blur-[120px] rounded-full point-events-none -z-10" />
      <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-cyan-500/10 blur-[100px] rounded-full point-events-none -z-10" />

      {/* Header / Logo */}
      <div className="absolute top-6 sm:top-8 left-6 sm:left-8 right-6 sm:right-8 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30 overflow-hidden">
            <Image 
              src="/logo.png" 
              alt="GuptMilan Logo" 
              width={48} 
              height={48} 
              className="w-full h-full object-cover scale-110"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gupt<span className="text-blue-500">Milan</span></h1>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-400" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-[#0f1117] border-white/10 text-white shadow-2xl backdrop-blur-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black flex items-center gap-3">
                <Settings className="w-6 h-6 text-blue-500" />
                Preferences
              </DialogTitle>
            </DialogHeader>
            <div className="py-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-400 px-1">
                  <User className="w-4 h-4" />
                  IDENTITY
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname" className="text-xs text-neutral-500">Your Nickname (Temporary)</Label>
                  <Input 
                    id="nickname" 
                    value={nickname} 
                    onChange={(e) => saveSettings(e.target.value, privacyMode, autoClear)}
                    placeholder="Stranger"
                    className="bg-white/5 border-white/10 focus:border-blue-500/50 h-11"
                  />
                </div>
              </div>

              <Separator className="bg-white/5" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-400 px-1">
                  <ShieldCheck className="w-4 h-4" />
                  PRIVACY & SECURITY
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Privacy Mode (Video Blur)</Label>
                    <p className="text-[11px] text-neutral-500">Blur video initially until revealed.</p>
                  </div>
                  <Switch 
                    checked={privacyMode} 
                    onCheckedChange={(checked: boolean) => saveSettings(nickname, checked, autoClear)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Auto-Clear History</Label>
                    <p className="text-[11px] text-neutral-500">Wipe all local settings when leaving.</p>
                  </div>
                  <Switch 
                    checked={autoClear}
                    onCheckedChange={(checked: boolean) => saveSettings(nickname, privacyMode, checked)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <p className="text-[10px] text-neutral-600 text-center w-full">
                All settings are stored locally on your device.
              </p>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 xl:grid-cols-2 gap-12 xl:gap-16 items-center z-10 py-16 sm:py-20 xl:py-0">
        {/* Left Side: Hero Text */}
        <div className="space-y-8 sm:space-y-10 text-center xl:text-left">
          <div className="space-y-6">
            <Badge variant="outline" className="inline-flex px-5 py-1.5 rounded-full bg-blue-500/5 text-blue-400 border-blue-500/20 text-sm font-medium tracking-wide">
              100% Anonymous & Secure
            </Badge>
            <h2 className="text-3xl sm:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/70">
              Meet <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Strangers</span>, <br />
              Stay <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Gupt</span>.
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg lg:text-xl max-w-lg mx-auto xl:mx-0 leading-relaxed">
              Instant video and text chat with real people anywhere in the world. No signup, no tracking, just pure connection.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-8 justify-center xl:justify-start max-w-sm mx-auto xl:max-w-none">
            <div className="flex items-center gap-2 sm:gap-3 bg-white/5 sm:bg-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none">
              <div className="p-2 rounded-lg sm:rounded-xl bg-blue-500/10">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              </div>
              <span className="font-medium text-[11px] sm:text-sm text-neutral-300">50k+ Online</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 bg-white/5 sm:bg-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none">
              <div className="p-2 rounded-lg sm:rounded-xl bg-green-500/10">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
              </div>
              <span className="font-medium text-[11px] sm:text-sm text-neutral-300">AI Moderated</span>
            </div>
             <div className="flex items-center gap-2 sm:gap-3 bg-white/5 sm:bg-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none col-span-2 sm:col-auto justify-center sm:justify-start">
              <div className="p-2 rounded-lg sm:rounded-xl bg-yellow-500/10">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
              </div>
              <span className="font-medium text-[11px] sm:text-sm text-neutral-300">Low Latency Connection</span>
            </div>
          </div>
        </div>

        {/* Right Side: Action Card */}
        <div className="relative group w-full max-w-md mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
          <Card className="relative border-white/10 bg-[#0f1117]/80 backdrop-blur-2xl shadow-2xl rounded-3xl overflow-hidden">
            <CardContent className="p-6 sm:p-10 space-y-8 sm:space-y-10">
              <div className="space-y-5">
                <label className="text-sm sm:text-base font-semibold text-neutral-200 flex items-center gap-2">
                  Talk about what you love
                </label>
                <form onSubmit={addInterest} className="flex gap-2 sm:gap-3">
                  <Input
                    placeholder="e.g. Gaming, Music..."
                    value={currentInterest}
                    onChange={(e) => setCurrentInterest(e.target.value)}
                    className="h-11 sm:h-12 bg-white/5 border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm sm:text-base rounded-xl"
                  />
                  <Button type="submit" variant="secondary" className="h-11 sm:h-12 px-4 sm:px-6 rounded-xl font-semibold hover:bg-white hover:text-black transition-all bg-white/10 text-white border-0 text-sm">
                    Add
                  </Button>
                </form>

                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  {interests.length === 0 && (
                    <span className="text-[13px] text-neutral-500 italic mt-2">No interests added. Matched randomly.</span>
                  )}
                  {interests.map((tag) => (
                    <Badge 
                      key={tag} 
                      className="pl-3 pr-1 py-1.5 flex items-center gap-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/20 hover:bg-blue-500/25 transition-all cursor-default rounded-lg text-xs font-medium"
                    >
                      {tag}
                      <button 
                        onClick={() => removeInterest(tag)}
                        className="hover:bg-blue-500/30 rounded-md p-1 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:gap-5">
                <Button 
                  onClick={() => setMode('text')}
                  className="h-20 sm:h-32 flex flex-col gap-2 sm:gap-4 rounded-2xl transition-all duration-300 border group/btn animate-glow-blue-1"
                  variant="ghost"
                >
                  <MessageSquare className="w-5 h-5 sm:w-8 sm:h-8 text-neutral-400 group-hover/btn:text-white group-hover/btn:scale-110 transition-all duration-300" />
                  <span className="font-semibold text-xs sm:text-base text-neutral-300 group-hover/btn:text-white">Text Chat</span>
                </Button>
                <Button 
                  onClick={() => setMode('video')}
                  className="h-20 sm:h-32 flex flex-col gap-2 sm:gap-4 rounded-2xl transition-all duration-300 border group/btn animate-glow-blue-2"
                  variant="ghost"
                >
                  <Video className="w-5 h-5 sm:w-8 sm:h-8 text-neutral-400 group-hover/btn:text-white group-hover/btn:scale-110 transition-all duration-300" />
                  <span className="font-semibold text-xs sm:text-base text-neutral-300 group-hover/btn:text-white">Video Chat</span>
                </Button>
              </div>

              <p className="text-[11px] text-center text-neutral-500 uppercase tracking-[0.2em] font-bold">
                By entering, you agree to our terms & community guidelines
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
