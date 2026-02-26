'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSocket } from '@/context/SocketContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Send, 
  RotateCcw, 
  AlertTriangle,
  ChevronLeft,
  Loader2,
  ShieldX,
  MessageSquare,
  Flag,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface Message {
  id: string;
  sender: 'me' | 'partner' | 'system';
  content: string;
}

interface ChatInterfaceProps {
  mode: 'video' | 'text';
  tags: string[];
  onBack: () => void;
  nickname?: string;
  location?: string;
  privacyMode?: boolean;
}

const REPORT_REASONS = [
  'Inappropriate content',
  'Harassment or bullying',
  'Nudity or sexual content',
  'Spam or scam',
  'Underage user',
  'Other',
];

export default function ChatInterface({ mode, tags, onBack, nickname, location, privacyMode }: ChatInterfaceProps) {
  const { toast } = useToast();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [partnerNickname, setPartnerNickname] = useState('Stranger');
  const [partnerLocation, setPartnerLocation] = useState('');
  const [isRemoteBlurred, setIsRemoteBlurred] = useState(privacyMode);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mobileLocalVideoRef = useRef<HTMLVideoElement>(null);
  const mobileRemoteVideoRef = useRef<HTMLVideoElement>(null);

  // Draggable PiP state
  const pipRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [pipPos, setPipPos] = useState({ x: 12, y: 12 });

  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', content }]);
  }, []);

  const nextPartnerRef = useRef<() => void>(() => {});

  const { 
    localStream, 
    remoteStream, 
    isMatching, 
    partnerId, 
    findPartner, 
    nextPartner 
  } = useWebRTC({
    type: mode,
    nickname,
    onMatchFound: useCallback((_id: string, pNick: string, pLoc?: string) => {
      setPartnerNickname(pNick || 'Stranger');
      setPartnerLocation(pLoc || 'Location hidden');
      setIsRemoteBlurred(privacyMode);
      setMessages([{ id: 'sys-match', sender: 'system', content: `🎉 You are now chatting with ${pNick || 'a stranger'}. Say hi!` }]);
      toast({ title: "Partner Found!", description: `Say hello to ${pNick || 'Stranger'} 👋` });
    }, [toast, privacyMode]),
    onPartnerLeft: useCallback(() => {
      addSystemMessage('👋 Partner has disconnected.');
      toast({ title: "Partner Left", description: "Finding next match..." });
      nextPartnerRef.current();
    }, [addSystemMessage, toast]),
    location
  });

  useEffect(() => {
    nextPartnerRef.current = nextPartner;
  }, [nextPartner]);

  useEffect(() => {
    findPartner(tags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (localStream) {
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      if (mobileLocalVideoRef.current) mobileLocalVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (mobileRemoteVideoRef.current) mobileRemoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isPartnerTyping]);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('receive_message', (data: { content: string }) => {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'partner', content: data.content }]);
    });

    socket.on('partner_typing', (isTyping: boolean) => {
      setIsPartnerTyping(isTyping);
    });

    socket.on('system_message', (data: { content: string }) => {
      addSystemMessage(data.content);
    });

    socket.on('ready_for_next', () => {
      setMessages([]);
      setIsPartnerTyping(false);
      setSelectedReason('');
    });

    return () => {
      socket.off('receive_message');
      socket.off('partner_typing');
      socket.off('system_message');
      socket.off('ready_for_next');
    };
  }, [socket, addSystemMessage]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => (t.enabled = !isMuted));
    }
  }, [isMuted, localStream]);

  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => (t.enabled = !isVideoOff));
    }
  }, [isVideoOff, localStream]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !partnerId) return;
    socket?.emit('send_message', { content: inputMessage });
    socket?.emit('typing', false);
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'me', content: inputMessage }]);
    setInputMessage('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (!partnerId) return;
    socket?.emit('typing', true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket?.emit('typing', false);
    }, 1500);
  };

  const skipPartner = () => {
    setMessages([]);
    setIsPartnerTyping(false);
    nextPartner();
  };

  const submitReport = async () => {
    if (!selectedReason) return;
    setIsReporting(true);
    socket?.emit('report_user', { reason: selectedReason });
    setShowReportModal(false);
    setIsReporting(false);
  };

  // PiP drag handlers
  const onPipPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pipRef.current) return;
    isDragging.current = true;
    const rect = pipRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    pipRef.current.setPointerCapture(e.pointerId);
  };

  const onPipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const pipW = pipRef.current?.offsetWidth ?? 112;
    const pipH = pipRef.current?.offsetHeight ?? 160;
    const newX = Math.min(Math.max(e.clientX - dragOffset.current.x, 0), window.innerWidth - pipW);
    const newY = Math.min(Math.max(e.clientY - dragOffset.current.y, 0), window.innerHeight - pipH);
    setPipPos({ x: newX, y: newY });
  };

  const onPipPointerUp = () => { isDragging.current = false; };

  const msgCount = messages.filter(m => m.sender !== 'system').length;

  const MessageBubbles = ({ compact = false }: { compact?: boolean }) => (
    <>
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.sender === 'system' ? 'justify-center' : msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-2xl leading-relaxed shadow-sm
            ${compact ? 'px-4 py-2.5 text-sm' : 'px-5 py-3 text-[15px]'}
            ${msg.sender === 'system'
              ? 'bg-white/5 text-neutral-400 italic text-xs font-medium tracking-wide border border-white/5 text-center'
              : msg.sender === 'me'
              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-sm'
              : 'bg-[#1a1d27] border border-white/5 text-neutral-200 rounded-tl-sm'}`}>
            {msg.content}
          </div>
        </div>
      ))}
      {isPartnerTyping && (
        <div className="flex justify-start">
          <div className="bg-[#1a1d27] border border-white/5 text-neutral-400 rounded-2xl rounded-tl-sm px-5 py-3 flex items-center gap-2">
            <span className="text-xs">{partnerNickname} is typing</span>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
      <div ref={scrollRef} />
    </>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground font-sans overflow-hidden">
      {/* Top Header */}
      <div className="h-12 sm:h-16 border-b border-white/5 flex items-center justify-between px-3 sm:px-6 bg-[#0f1117]/80 backdrop-blur-2xl z-20 shadow-sm shadow-black/50">
        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-white/10 text-neutral-300 hover:text-white transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="hidden sm:flex items-center gap-2 mr-2">
            <Image src="/logo.png" alt="GM" width={24} height={24} className="rounded-lg shadow-lg shadow-blue-500/20" />
            <span className="text-[10px] font-black tracking-tighter text-blue-500">GUPTMILAN</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <div className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full shrink-0 shadow-lg transition-colors ${partnerId ? 'bg-green-500 shadow-green-500/50 animate-pulse' : isMatching ? 'bg-yellow-500 shadow-yellow-500/50' : 'bg-neutral-600'}`} />
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] sm:text-sm font-semibold tracking-wide text-neutral-200 truncate leading-tight">
                {partnerId ? partnerNickname : (isMatching ? 'Searching...' : 'Disconnected')}
              </span>
              {partnerId && (
                <span className="text-[10px] text-neutral-500 truncate leading-tight">
                  {partnerLocation}
                </span>
              )}
            </div>
            {partnerId && tags.length > 0 && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] hidden lg:inline-flex">Matched</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowReportModal(true)}
            disabled={!partnerId}
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/15 gap-2 font-medium rounded-lg disabled:opacity-30 h-8 sm:h-9 px-2 sm:px-3"
          >
            <Flag className="w-4 h-4" />
            <span className="hidden sm:inline">Report</span>
          </Button>
        </div>
      </div>

      {/* ===== MOBILE LAYOUT (hidden on md+) ===== */}
      {mode === 'video' ? (
        <div className="md:hidden flex-1 relative overflow-hidden bg-black">
          {/* Remote video — full screen */}
          <div className="absolute inset-0">
            {remoteStream ? (
              <>
                <video
                  ref={mobileRemoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover transition-all duration-700 ${isRemoteBlurred ? 'blur-[50px] scale-110' : ''}`}
                />
                {isRemoteBlurred && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <Button
                      onClick={() => setIsRemoteBlurred(false)}
                      className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl px-6 py-6 h-auto flex flex-col gap-3"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <EyeOff className="w-6 h-6 text-blue-400" />
                      </div>
                      <span className="font-bold text-sm">Privacy Mode Active</span>
                      <span className="text-[10px] text-neutral-400">Tap to reveal {partnerNickname}</span>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-5 text-neutral-500">
                {isMatching ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse" />
                    <Loader2 className="w-14 h-14 animate-spin text-blue-500 relative z-10" />
                  </div>
                ) : (
                  <ShieldX className="w-14 h-14 text-neutral-600" />
                )}
                <p className="font-medium text-base">{isMatching ? 'Finding someone...' : 'Waiting for partner'}</p>
              </div>
            )}
          </div>

          {/* Remote badge */}
          <div className="absolute top-3 left-3 z-20">
            <Badge variant="secondary" className="bg-black/60 backdrop-blur-md border-white/10 px-3 py-1 text-xs text-neutral-300">
              {partnerNickname} (Stranger)
            </Badge>
          </div>

          {/* Draggable PiP — local video */}
          <div
            ref={pipRef}
            style={{ left: pipPos.x, top: pipPos.y, touchAction: 'none' }}
            className="absolute z-40 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl shadow-black/70 cursor-grab active:cursor-grabbing select-none"
            onPointerDown={onPipPointerDown}
            onPointerMove={onPipPointerMove}
            onPointerUp={onPipPointerUp}
            onPointerCancel={onPipPointerUp}
          >
            {localStream ? (
              <video
                ref={mobileLocalVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
              />
            ) : (
              <div className="w-full h-full bg-[#13151c] flex items-center justify-center">
                <VideoOff className="w-6 h-6 text-neutral-500" />
              </div>
            )}
            {isVideoOff && (
              <div className="absolute inset-0 bg-[#13151c] flex items-center justify-center">
                <VideoOff className="w-6 h-6 text-neutral-500" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
              <span className="text-[9px] text-white/80 font-semibold">{nickname || 'You'}</span>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 z-30 pb-8 pt-4 px-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  variant="secondary" size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-11 h-11 rounded-full backdrop-blur-md border-none ${isMuted ? 'bg-red-500/40 text-red-300' : 'bg-black/50 text-white'}`}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button
                  variant="secondary" size="icon"
                  onClick={() => setIsVideoOff(!isVideoOff)}
                  className={`w-11 h-11 rounded-full backdrop-blur-md border-none ${isVideoOff ? 'bg-red-500/40 text-red-300' : 'bg-black/50 text-white'}`}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </Button>
              </div>

              <Button
                onClick={skipPartner}
                className="flex-1 max-w-[130px] bg-white/10 hover:bg-white/20 border border-white/10 h-11 gap-2 text-white rounded-full text-sm font-semibold backdrop-blur-md"
                variant="outline"
              >
                <RotateCcw className="w-4 h-4" />
                Next
              </Button>

              <div className="relative">
                <Button
                  variant="secondary" size="icon"
                  onClick={() => setMobileChatOpen(true)}
                  className="w-11 h-11 rounded-full bg-blue-600/80 hover:bg-blue-500 text-white backdrop-blur-md border-none"
                >
                  <MessageSquare className="w-5 h-5" />
                </Button>
                {msgCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400 rounded-full text-[9px] font-black text-white flex items-center justify-center pointer-events-none">
                    {msgCount > 9 ? '9+' : msgCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Chat slide-up overlay */}
          <div
            className={`absolute inset-x-0 bottom-0 z-50 transition-transform duration-500 cubic-bezier(0.32, 0.72, 0, 1) ${mobileChatOpen ? 'translate-y-0' : 'translate-y-full'}`}
            style={{ height: '75dvh' }}
          >
            <div className="h-full bg-black/80 backdrop-blur-[100px] backdrop-saturate-150 flex flex-col rounded-t-[40px] border-t border-white/20 shadow-[0_-20px_100px_rgba(0,0,0,1)] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              {/* Glossy Header Area */}
              <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0 relative">
                <div className="w-12 h-1.5 bg-white/20 rounded-full absolute left-1/2 -translate-x-1/2 top-3 opacity-50" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">Live Chat</span>
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setMobileChatOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-white/10 text-white/40 mt-1 transition-colors"
                >
                  <ChevronDown className="w-6 h-6" />
                </Button>
              </div>

              <ScrollArea className="flex-1 px-4 py-2">
                <div className="space-y-4 pb-4">
                  <MessageBubbles compact />
                </div>
              </ScrollArea>

              {/* Glossy Input Area */}
              <div className="p-4 bg-white/[0.03] border-t border-white/5 backdrop-blur-md shrink-0 mb-safe">
                <form onSubmit={sendMessage} className="flex gap-2.5">
                  <div className="flex-1 relative group">
                    <Input
                      placeholder={partnerId ? "Message..." : "Connecting..."}
                      value={inputMessage}
                      onChange={handleInputChange}
                      disabled={!partnerId}
                      className="bg-white/5 border-white/10 focus:border-blue-500/50 transition-all rounded-2xl h-12 px-5 text-sm disabled:opacity-50 text-white placeholder:text-white/30"
                      autoFocus={mobileChatOpen}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={!partnerId || !inputMessage.trim()} 
                    size="icon" 
                    className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 shadow-lg shadow-blue-500/20 shrink-0 disabled:opacity-30 transition-all active:scale-95"
                  >
                    <Send className="w-5 h-5 ml-0.5 text-white" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Text mode mobile
        <div className="md:hidden flex-1 bg-black/90 backdrop-blur-[120px] backdrop-saturate-150 flex flex-col overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          <ScrollArea className="flex-1 p-5 relative z-10">
            <div className="space-y-5">
              <MessageBubbles />
            </div>
          </ScrollArea>
          <div className="p-5 bg-white/[0.03] border-t border-white/10 space-y-4 backdrop-blur-3xl">
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                placeholder={partnerId ? "Type a message..." : "Waiting for connection..."}
                value={inputMessage}
                onChange={handleInputChange}
                disabled={!partnerId}
                className="bg-[#1a1d27] border-white/10 focus:border-blue-500/50 transition-all rounded-xl h-11 px-4 text-sm disabled:opacity-50"
              />
              <Button type="submit" disabled={!partnerId || !inputMessage.trim()} size="icon" className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 shrink-0 disabled:opacity-50">
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </form>
            <Button onClick={skipPartner} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 h-11 gap-2 text-neutral-300 hover:text-white rounded-xl" variant="outline">
              <RotateCcw className="w-4 h-4" />
              <span className="font-semibold">Next Stranger</span>
            </Button>
          </div>
        </div>
      )}

      {/* ===== DESKTOP LAYOUT (hidden on mobile) ===== */}
      <div className="hidden md:flex flex-1 flex-row overflow-hidden relative">
        <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none -z-10" />

        {/* Media / Video Section */}
        <div className={`flex-[1.2] bg-black/95 relative flex flex-col items-center justify-center p-6 ${mode === 'text' ? 'hidden md:flex' : 'flex'}`}>
          {mode === 'video' ? (
            <div className="w-full h-full max-w-5xl grid grid-cols-2 gap-6">
              {/* Remote */}
              <Card className="bg-[#13151c] border-white/5 overflow-hidden relative flex items-center justify-center shadow-2xl rounded-2xl group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                {remoteStream ? (
                  <>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className={`w-full h-full object-cover transition-all duration-700 ${isRemoteBlurred ? 'blur-[50px] scale-110' : ''}`}
                    />
                    {isRemoteBlurred && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <Button
                          onClick={() => setIsRemoteBlurred(false)}
                          className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl px-6 py-6 h-auto flex flex-col gap-3 group/reveal shadow-2xl"
                        >
                          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center group-hover/reveal:scale-110 transition-transform">
                            <EyeOff className="w-6 h-6 text-blue-400" />
                          </div>
                          <span className="font-bold text-sm tracking-wide">Privacy Mode Active</span>
                          <span className="text-[10px] text-neutral-400">Click to reveal {partnerNickname}</span>
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-5 text-neutral-500 z-10 px-4 text-center">
                    {isMatching ? (
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse" />
                        <Loader2 className="w-14 h-14 animate-spin text-blue-500 relative z-10" />
                      </div>
                    ) : (
                      <ShieldX className="w-14 h-14 text-neutral-600" />
                    )}
                    <p className="font-medium text-base tracking-wide">{isMatching ? 'Finding someone special...' : 'Waiting for partner video'}</p>
                  </div>
                )}
                <div className="absolute top-4 left-4 z-20">
                  <Badge variant="secondary" className="bg-black/60 backdrop-blur-md border-white/10 px-3 py-1 text-xs text-neutral-300">
                    {partnerNickname} (Stranger)
                  </Badge>
                </div>
              </Card>

              {/* Local */}
              <Card className="bg-[#13151c] border-white/5 overflow-hidden relative flex items-center justify-center shadow-2xl rounded-2xl group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                {localStream ? (
                  <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
                ) : (
                  <div className="text-neutral-500 flex flex-col items-center gap-3 z-10">
                    <VideoOff className="w-12 h-12" />
                    <p className="font-medium text-base tracking-wide">Camera Off</p>
                  </div>
                )}
                <div className="absolute top-4 left-4 z-20">
                  <Badge variant="secondary" className="bg-blue-600/60 backdrop-blur-md border border-blue-500/30 px-3 py-1.5 text-xs text-white">
                    <div className="flex flex-col items-start leading-tight">
                      <span>{nickname || 'You'} (Me)</span>
                      {location && <span className="text-[9px] opacity-70 font-normal">{location}</span>}
                    </div>
                  </Badge>
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                  <Button variant="secondary" size="icon" onClick={() => setIsMuted(!isMuted)} className={`w-12 h-12 rounded-full backdrop-blur-md border-none transition-all ${isMuted ? 'bg-red-500/30 text-red-400' : 'bg-black/50 text-white'}`}>
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                  <Button variant="secondary" size="icon" onClick={() => setIsVideoOff(!isVideoOff)} className={`w-12 h-12 rounded-full backdrop-blur-md border-none transition-all ${isVideoOff ? 'bg-red-500/30 text-red-400' : 'bg-black/50 text-white'}`}>
                    {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </Button>
                </div>
              </Card>
            </div>
          ) : (
            <div className="text-center space-y-6 opacity-40">
              <div className="w-32 h-32 rounded-full bg-white/5 flex items-center justify-center mx-auto shadow-inner">
                <MessageSquare className="w-16 h-16" />
              </div>
              <h3 className="text-2xl font-black italic uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20">Text Mode</h3>
            </div>
          )}
        </div>

        {/* Desktop Chat Panel */}
        <div className="flex-1 border-l border-white/5 bg-[#0f1117]/95 backdrop-blur-3xl flex flex-col min-w-0 md:min-w-[340px] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10 shrink-0 lg:max-w-md">
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-5">
              <MessageBubbles />
            </div>
          </ScrollArea>
          <div className="p-4 sm:p-6 bg-black/40 border-t border-white/5 space-y-4 backdrop-blur-md">
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                placeholder={partnerId ? "Type a message..." : "Waiting for connection..."}
                value={inputMessage}
                onChange={handleInputChange}
                disabled={!partnerId}
                className="bg-[#1a1d27] border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all rounded-xl h-12 px-5 text-[15px] disabled:opacity-50"
              />
              <Button type="submit" disabled={!partnerId || !inputMessage.trim()} size="icon" className="w-12 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 shrink-0 shadow-lg shadow-blue-900/20 disabled:opacity-50">
                <Send className="w-5 h-5 ml-0.5" />
              </Button>
            </form>
            <Button onClick={skipPartner} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 h-12 gap-2 text-neutral-300 hover:text-white rounded-xl" variant="outline">
              <RotateCcw className="w-4 h-4" />
              <span className="font-semibold">Next Stranger</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="bg-[#0f1117] border border-white/10 text-white rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Report This Stranger
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Select a reason for reporting. After reporting, you will be matched with someone else.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => setSelectedReason(reason)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all font-medium ${
                  selectedReason === reason
                    ? 'border-red-500/50 bg-red-500/10 text-red-300'
                    : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowReportModal(false)} className="text-neutral-400 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={submitReport}
              disabled={!selectedReason || isReporting}
              className="bg-red-600 hover:bg-red-500 text-white gap-2 rounded-xl"
            >
              {isReporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
