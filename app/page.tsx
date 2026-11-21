'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

interface VideoPost {
  id: string | number;
  title?: string | null;
  price?: number | string | null;
  category?: string | null;
  url?: string | null;
  user_email?: string | null;
  views?: number | null;
  likes?: number | null;
  created_at?: string | null;
}

interface CommentRow {
  id: string | number;
  video_id: string | number;
  content?: string | null;
  text?: string | null;
  user_email?: string | null;
  author?: string | null;
}

interface CartItem {
  id: string | number;
  title: string;
  price: number;
  seller: string;
  qty: number;
}

type ActiveTab = 'feed' | 'publish' | 'cart' | 'auth';

function formatCompactCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(num);
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '2d ago';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return '2d ago';
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `${Math.max(1, hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NexsalWebPage() {
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showCategories, setShowCategories] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');

  const [pausedIds, setPausedIds] = useState<Record<string, boolean>>({});
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // Supabase comments
  const [activeCommentVideoId, setActiveCommentVideoId] = useState<string | number | null>(null);
  const [commentsByVideo, setCommentsByVideo] = useState<Record<string, CommentRow[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [commentSubmitting, setCommentSubmitting] = useState<boolean>(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Auth
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Publish
  const [pubTitle, setPubTitle] = useState<string>('');
  const [pubPrice, setPubPrice] = useState<string>('149.00');
  const [pubCategory, setPubCategory] = useState<string>('Tech');
  const [pubUrl, setPubUrl] = useState<string>('');
  const [pubSubmitting, setPubSubmitting] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedCart = window.localStorage.getItem('nexsal_cart');
      if (savedCart) setCart(JSON.parse(savedCart));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('nexsal_cart', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    let isMounted = true;

    async function initData() {
      if (!supabase) {
        if (isMounted) {
          setStatusMessage('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
          setLoading(false);
        }
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (isMounted && sessionData?.session?.user?.email) {
        setUserEmail(sessionData.session.user.email);
      }

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('id', { ascending: false });

      if (!isMounted) return;

      if (error) {
        setStatusMessage(error.message);
        setVideos([]);
      } else {
        const list = data || [];
        setVideos(list);
        const initialLikes: Record<string, number> = {};
        list.forEach((item) => {
          initialLikes[String(item.id)] = Number(item.likes ?? 0);
        });
        setLikeCounts(initialLikes);

        const { data: allComments } = await supabase.from('comments').select('*');
        if (isMounted && Array.isArray(allComments)) {
          const grouped: Record<string, CommentRow[]> = {};
          allComments.forEach((c: CommentRow) => {
            const vKey = String(c.video_id);
            if (!grouped[vKey]) grouped[vKey] = [];
            grouped[vKey].push(c);
          });
          setCommentsByVideo(grouped);
        }
      }

      setLoading(false);
    }

    initData();

    const authListener = supabase?.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
    });

    return () => {
      isMounted = false;
      authListener?.data?.subscription?.unsubscribe();
    };
  }, []);

  const loadCommentsForVideo = async (videoId: string | number) => {
    const key = String(videoId);
    setActiveCommentVideoId(videoId);
    if (!supabase) return;

    setCommentsLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('video_id', videoId)
      .order('id', { ascending: true });

    setCommentsLoading(false);

    if (!error && Array.isArray(data)) {
      setCommentsByVideo((prev) => ({
        ...prev,
        [key]: data,
      }));
    }
  };

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return videos.filter((video) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        (video.category || '').toLowerCase() === selectedCategory.toLowerCase();
      const matchesQuery =
        !q ||
        (video.title || '').toLowerCase().includes(q) ||
        (video.category || '').toLowerCase().includes(q) ||
        (video.user_email || '').toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [videos, searchQuery, selectedCategory]);

  const togglePlayPause = (video: VideoPost, videoEl: HTMLVideoElement | null) => {
    const key = String(video.id);
    const currentlyPaused = Boolean(pausedIds[key]);

    if (videoEl) {
      if (currentlyPaused) {
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
      }
    }

    setPausedIds((prev) => ({
      ...prev,
      [key]: !currentlyPaused,
    }));
  };

  const handleToggleLike = async (video: VideoPost) => {
    const key = String(video.id);
    const alreadyLiked = Boolean(likedIds[key]);
    const currentCount = likeCounts[key] ?? Number(video.likes ?? 0);
    const nextCount = alreadyLiked ? Math.max(0, currentCount - 1) : currentCount + 1;

    setLikedIds((prev) => ({ ...prev, [key]: !alreadyLiked }));
    setLikeCounts((prev) => ({ ...prev, [key]: nextCount }));

    if (supabase) {
      await supabase.from('videos').update({ likes: nextCount }).eq('id', video.id);
    }
  };

  const handleAddComment = async (e: React.FormEvent, videoId: string | number) => {
    e.preventDefault();
    const trimmed = newCommentText.trim();
    if (!trimmed || !supabase) return;

    setCommentSubmitting(true);
    const authorEmail = userEmail || authEmail || 'guest@nexsal.store';
    const key = String(videoId);

    let insertResult = await supabase
      .from('comments')
      .insert([{ video_id: videoId, content: trimmed, user_email: authorEmail }])
      .select()
      .single();

    if (insertResult.error && insertResult.error.message.toLowerCase().includes('content')) {
      insertResult = await supabase
        .from('comments')
        .insert([{ video_id: videoId, text: trimmed, user_email: authorEmail }])
        .select()
        .single();
    }

    setCommentSubmitting(false);

    if (insertResult.error) {
      setStatusMessage(`Comment error: ${insertResult.error.message}`);
      return;
    }

    const createdComment: CommentRow = insertResult.data || {
      id: Date.now(),
      video_id: videoId,
      content: trimmed,
      user_email: authorEmail,
    };

    setCommentsByVideo((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), createdComment],
    }));
    setNewCommentText('');
  };

  const handleAddToCart = (video: VideoPost) => {
    const numericPrice = parseFloat(String(video.price ?? '149.00')) || 149.0;
    const seller = (video.user_email || 'Motion Krafters').split('@')[0];

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => String(item.id) === String(video.id));
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = { ...copy[existingIndex], qty: copy[existingIndex].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          id: video.id,
          title: video.title || 'NEXSAL Item',
          price: numericPrice,
          seller,
          qty: 1,
        },
      ];
    });

    setStatusMessage(`Added "${video.title || 'NEXSAL Item'}" to cart.`);
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const handleShareVideo = async (video: VideoPost) => {
    const shareUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/produit/${video.id}` : '';
    try {
      if (navigator.clipboard && shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        setStatusMessage('Link copied.');
        setTimeout(() => setStatusMessage(null), 2000);
      }
    } catch {
      setStatusMessage(shareUrl || 'Link ready.');
    }
  };

  const handleRemoveFromCart = (id: string | number) => {
    setCart((prev) => prev.filter((item) => String(item.id) !== String(id)));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !pubTitle.trim() || !pubUrl.trim()) return;

    setPubSubmitting(true);
    const payload = {
      title: pubTitle.trim(),
      price: parseFloat(pubPrice) || 149.0,
      category: pubCategory,
      url: pubUrl.trim(),
      user_email: userEmail || authEmail || 'Motion Krafters',
      views: 0,
      likes: 0,
    };

    const { data, error } = await supabase.from('videos').insert([payload]).select().single();
    setPubSubmitting(false);

    if (error) {
      setStatusMessage(`Publish error: ${error.message}`);
      return;
    }

    if (data) {
      setVideos((prev) => [data, ...prev]);
      setLikeCounts((prev) => ({ ...prev, [String(data.id)]: 0 }));
    }

    setPubTitle('');
    setPubUrl('');
    setStatusMessage('Published.');
    setActiveTab('feed');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    setAuthLoading(false);

    if (error) {
      setStatusMessage(`Log in failed: ${error.message}`);
    } else {
      setUserEmail(authEmail.trim());
      setStatusMessage('Logged in.');
      setActiveTab('feed');
    }
  };

  const handleSignUp = async () => {
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
    });
    setAuthLoading(false);

    if (error) {
      setStatusMessage(`Sign up failed: ${error.message}`);
    } else {
      setStatusMessage('Account created. Check your inbox if confirmation is enabled.');
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserEmail(null);
    setStatusMessage('Logged out.');
  };

  const categories = ['All', 'Tech', 'Fashion', 'Beauty', 'Home', 'Lifestyle'];

  return (
    <div
      style={{
        backgroundColor: '#050505',
        color: '#FFFFFF',
        minHeight: '100vh',
        paddingBottom: '88px',
      }}
    >
      {/* TOP BAR : NEXSAL. + Log in / Sign in */}
      <header
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '18px 24px 6px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('feed');
            setSelectedCategory('All');
            setSearchQuery('');
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#FFFFFF',
            fontSize: '28px',
            fontWeight: 900,
            letterSpacing: '0.04em',
            cursor: 'pointer',
          }}
        >
          NEXSAL<span style={{ color: '#C88A58' }}>.</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'auth' ? 'feed' : 'auth')}
          style={{
            padding: '8px 20px',
            borderRadius: '9999px',
            backgroundColor: '#0B0B0C',
            color: '#FFFFFF',
            border: '1px solid #2A2A2E',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Log in / Sign in
        </button>
      </header>

      {/* TAGLINE + SEARCH BAR */}
      <section
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '2px 24px 14px 24px',
        }}
      >
        <p
          style={{
            textAlign: 'center',
            fontSize: '13px',
            color: '#9CA3AF',
            margin: '0 0 14px 0',
          }}
        >
          NXS: Discover, Shop, Sell. Where buyers and sellers meet.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#161618',
            border: '1px solid #252529',
            borderRadius: '18px',
            padding: '12px 16px',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (activeTab !== 'feed') setActiveTab('feed');
            }}
            placeholder="Search products, categories, creators..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              color: '#FFFFFF',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
            }}
          />

          <button
            type="button"
            onClick={() => setShowCategories((prev) => !prev)}
            aria-label="Toggle categories"
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={showCategories || selectedCategory !== 'All' ? '#C88A58' : '#D4D4D8'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
              <circle cx="9" cy="6" r="2" fill="#161618" />
              <circle cx="15" cy="12" r="2" fill="#161618" />
              <circle cx="11" cy="18" r="2" fill="#161618" />
            </svg>
          </button>
        </div>

        {(showCategories || selectedCategory !== 'All') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              paddingTop: '12px',
            }}
          >
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: active ? '#FFFFFF' : '#161618',
                    color: active ? '#050505' : '#D4D4D8',
                    border: '1px solid #252529',
                    cursor: 'pointer',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {statusMessage && (
        <div style={{ maxWidth: '960px', margin: '0 auto 12px auto', padding: '0 24px' }}>
          <div
            style={{
              backgroundColor: '#161618',
              border: '1px solid #C88A58',
              color: '#FFFFFF',
              borderRadius: '14px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            {statusMessage}
          </div>
        </div>
      )}

      {/* TAB 1: WEB VIDEO FEED */}
      {activeTab === 'feed' && (
        <main style={{ maxWidth: '960px', margin: '0 auto', padding: '4px 24px 24px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: '#9CA3AF', fontSize: '13px' }}>
              Loading...
            </div>
          ) : filteredVideos.length === 0 ? (
            <div
              style={{
                backgroundColor: '#111113',
                border: '1px solid #222226',
                borderRadius: '24px',
                padding: '40px 24px',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '14px', color: '#D4D4D8', margin: '0 0 14px 0' }}>
                No videos found.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('publish')}
                style={{
                  padding: '9px 20px',
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  color: '#050505',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Publish video
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {filteredVideos.map((video) => {
                const key = String(video.id);
                const isPaused = Boolean(pausedIds[key]);
                const isLiked = Boolean(likedIds[key]);
                const isSaved = Boolean(savedIds[key]);
                const currentLikes = likeCounts[key] ?? Number(video.likes ?? 0);
                const videoComments = commentsByVideo[key] || [];
                const creatorName = (video.user_email || 'Motion Krafters').split('@')[0];
                const badgeText = creatorName
                  .split(/\s+/)
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'NX';
                const priceLabel =
                  video.price !== null && video.price !== undefined && String(video.price).trim() !== ''
                    ? `${video.price} €`
                    : '$149.00';

                return (
                  <article
                    key={video.id}
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '700px',
                      borderRadius: '24px',
                      overflow: 'hidden',
                      backgroundColor: '#121110',
                      border: '1px solid #222226',
                    }}
                  >
                    {/* Top Creator Bar */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        padding: '16px 20px',
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.68), transparent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Link
                          href={`/boutique/${encodeURIComponent(creatorName)}`}
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '9999px',
                            backgroundColor: '#18181B',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 800,
                            textDecoration: 'none',
                          }}
                        >
                          {badgeText}
                        </Link>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Link
                              href={`/boutique/${encodeURIComponent(creatorName)}`}
                              style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                color: '#FFFFFF',
                                textDecoration: 'none',
                              }}
                            >
                              {creatorName}
                            </Link>
                            <span
                              style={{
                                width: '15px',
                                height: '15px',
                                borderRadius: '9999px',
                                backgroundColor: '#FFFFFF',
                                color: '#050505',
                                fontSize: '10px',
                                fontWeight: 900,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              ✓
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#D4D4D8' }}>
                            {formatRelativeTime(video.created_at)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setIsMuted((prev) => !prev)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#D4D4D8',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {isMuted ? 'Muted' : 'Sound'}
                        </button>
                        <Link
                          href={`/produit/${video.id}`}
                          style={{
                            color: '#FFFFFF',
                            fontSize: '16px',
                            fontWeight: 800,
                            textDecoration: 'none',
                            letterSpacing: '0.12em',
                          }}
                        >
                          •••
                        </Link>
                      </div>
                    </div>

                    {/* Video Player */}
                    <VideoSlidePlayer
                      url={video.url || ''}
                      isPaused={isPaused}
                      isMuted={isMuted}
                      onToggle={(el) => togglePlayPause(video, el)}
                    />

                    {isPaused && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          pointerEvents: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(0,0,0,0.22)',
                          zIndex: 15,
                        }}
                      >
                        <span
                          style={{
                            padding: '8px 16px',
                            borderRadius: '9999px',
                            backgroundColor: 'rgba(0,0,0,0.75)',
                            color: '#FFFFFF',
                            fontSize: '11px',
                            fontWeight: 800,
                            letterSpacing: '0.14em',
                          }}
                        >
                          PAUSED
                        </span>
                      </div>
                    )}

                    {/* Right Vertical Actions */}
                    <div
                      style={{
                        position: 'absolute',
                        right: '20px',
                        bottom: '92px',
                        zIndex: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleLike(video)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'none',
                          border: 'none',
                          color: isLiked ? '#C88A58' : '#FFFFFF',
                          cursor: 'pointer',
                        }}
                      >
                        <svg
                          width="26"
                          height="26"
                          viewBox="0 0 24 24"
                          fill={isLiked ? '#C88A58' : 'none'}
                          stroke={isLiked ? '#C88A58' : '#FFFFFF'}
                          strokeWidth="1.8"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>
                          {formatCompactCount(currentLikes)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (activeCommentVideoId === video.id) {
                            setActiveCommentVideoId(null);
                          } else {
                            loadCommentsForVideo(video.id);
                          }
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'none',
                          border: 'none',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                        }}
                      >
                        <svg
                          width="25"
                          height="25"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#FFFFFF"
                          strokeWidth="1.8"
                        >
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>
                          {formatCompactCount(videoComments.length)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareVideo(video)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'none',
                          border: 'none',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                        }}
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#FFFFFF"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>
                          Share
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSavedIds((prev) => ({ ...prev, [key]: !prev[key] }));
                          handleAddToCart(video);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'none',
                          border: 'none',
                          color: isSaved ? '#C88A58' : '#FFFFFF',
                          cursor: 'pointer',
                        }}
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill={isSaved ? '#C88A58' : 'none'}
                          stroke={isSaved ? '#C88A58' : '#FFFFFF'}
                          strokeWidth="1.8"
                        >
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>
                          Save
                        </span>
                      </button>
                    </div>

                    {/* Bottom Left Product Card */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '20px',
                        bottom: '20px',
                        zIndex: 20,
                        width: '280px',
                        backgroundColor: 'rgba(20, 20, 22, 0.78)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '18px',
                        padding: '16px',
                      }}
                    >
                      <h2
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#FFFFFF',
                          margin: '0 0 4px 0',
                        }}
                      >
                        {video.title || 'NEXSAL Item'}
                      </h2>
                      <p
                        style={{
                          fontSize: '12px',
                          color: '#D4D4D8',
                          margin: '0 0 10px 0',
                        }}
                      >
                        {video.category || 'Timeless design. Modern precision.'}
                      </p>
                      <p
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#FFFFFF',
                          margin: '0 0 14px 0',
                        }}
                      >
                        {priceLabel}
                      </p>

                      <Link
                        href={`/produit/${video.id}`}
                        style={{
                          display: 'inline-block',
                          padding: '9px 22px',
                          borderRadius: '12px',
                          backgroundColor: '#FFFFFF',
                          color: '#050505',
                          fontSize: '13px',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        View product
                      </Link>
                    </div>

                    {/* Bottom Right Disc */}
                    <button
                      type="button"
                      onClick={() => setIsMuted((prev) => !prev)}
                      aria-label="Toggle audio"
                      style={{
                        position: 'absolute',
                        right: '20px',
                        bottom: '20px',
                        zIndex: 20,
                        width: '40px',
                        height: '40px',
                        borderRadius: '9999px',
                        backgroundColor: '#18181B',
                        border: '5px solid #27272A',
                        color: isMuted ? '#9CA3AF' : '#60A5FA',
                        fontSize: '12px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      ♪
                    </button>

                    {/* Supabase Comments Overlay */}
                    {activeCommentVideoId === video.id && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '16px',
                          right: '16px',
                          bottom: '16px',
                          zIndex: 30,
                          backgroundColor: '#141417',
                          color: '#FFFFFF',
                          borderRadius: '20px',
                          border: '1px solid #2A2A30',
                          padding: '16px',
                          maxHeight: '55%',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid #26262B',
                            paddingBottom: '8px',
                          }}
                        >
                          <span style={{ fontSize: '12px', fontWeight: 700 }}>
                            Comments ({videoComments.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveCommentVideoId(null)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#9CA3AF',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Close
                          </button>
                        </div>

                        <div
                          style={{
                            overflowY: 'auto',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          {commentsLoading ? (
                            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
                              Loading...
                            </p>
                          ) : videoComments.length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
                              No comments yet.
                            </p>
                          ) : (
                            videoComments.map((c) => {
                              const authorLabel = (c.user_email || c.author || 'guest').split('@')[0];
                              const bodyText = c.content ?? c.text ?? '';
                              return (
                                <div
                                  key={c.id}
                                  style={{
                                    backgroundColor: '#1C1C21',
                                    borderRadius: '12px',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                  }}
                                >
                                  <strong style={{ color: '#C88A58' }}>@{authorLabel}</strong>
                                  <p style={{ margin: '2px 0 0 0', color: '#F4F4F5' }}>{bodyText}</p>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <form
                          onSubmit={(e) => handleAddComment(e, video.id)}
                          style={{ display: 'flex', gap: '8px' }}
                        >
                          <input
                            type="text"
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Write a comment..."
                            style={{
                              flex: 1,
                              padding: '8px 14px',
                              backgroundColor: '#1C1C21',
                              color: '#FFFFFF',
                              border: '1px solid #2A2A30',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              outline: 'none',
                            }}
                          />
                          <button
                            type="submit"
                            disabled={commentSubmitting}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#FFFFFF',
                              color: '#050505',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: 700,
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            {commentSubmitting ? '...' : 'Post'}
                          </button>
                        </form>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* PUBLISH VIEW */}
      {activeTab === 'publish' && (
        <main style={{ maxWidth: '540px', margin: '0 auto', padding: '24px' }}>
          <form
            onSubmit={handlePublish}
            style={{
              backgroundColor: '#121215',
              border: '1px solid #252529',
              borderRadius: '22px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Publish</h2>

            <input
              type="text"
              required
              value={pubTitle}
              onChange={(e) => setPubTitle(e.target.value)}
              placeholder="Product title"
              style={{
                padding: '11px 14px',
                backgroundColor: '#1A1A1F',
                color: '#FFFFFF',
                border: '1px solid #2A2A30',
                borderRadius: '14px',
                fontSize: '13px',
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input
                type="number"
                step="0.01"
                value={pubPrice}
                onChange={(e) => setPubPrice(e.target.value)}
                placeholder="Price"
                style={{
                  padding: '11px 14px',
                  backgroundColor: '#1A1A1F',
                  color: '#FFFFFF',
                  border: '1px solid #2A2A30',
                  borderRadius: '14px',
                  fontSize: '13px',
                }}
              />
              <select
                value={pubCategory}
                onChange={(e) => setPubCategory(e.target.value)}
                style={{
                  padding: '11px 14px',
                  backgroundColor: '#1A1A1F',
                  color: '#FFFFFF',
                  border: '1px solid #2A2A30',
                  borderRadius: '14px',
                  fontSize: '13px',
                }}
              >
                <option value="Tech">Tech</option>
                <option value="Fashion">Fashion</option>
                <option value="Beauty">Beauty</option>
                <option value="Home">Home</option>
                <option value="Lifestyle">Lifestyle</option>
              </select>
            </div>

            <input
              type="url"
              required
              value={pubUrl}
              onChange={(e) => setPubUrl(e.target.value)}
              placeholder="Video URL (.mp4)"
              style={{
                padding: '11px 14px',
                backgroundColor: '#1A1A1F',
                color: '#FFFFFF',
                border: '1px solid #2A2A30',
                borderRadius: '14px',
                fontSize: '13px',
              }}
            />

            <button
              type="submit"
              disabled={pubSubmitting}
              style={{
                padding: '12px',
                backgroundColor: '#FFFFFF',
                color: '#050505',
                borderRadius: '14px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {pubSubmitting ? 'Publishing...' : 'Publish'}
            </button>
          </form>
        </main>
      )}

      {/* SELL / CART VIEW */}
      {activeTab === 'cart' && (
        <main style={{ maxWidth: '540px', margin: '0 auto', padding: '24px' }}>
          <div
            style={{
              backgroundColor: '#121215',
              border: '1px solid #252529',
              borderRadius: '22px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Cart ({cartCount})</h2>

            {cart.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>
                Your cart is empty.
              </p>
            ) : (
              <>
                {cart.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#1A1A1F',
                      borderRadius: '14px',
                      padding: '12px 14px',
                      fontSize: '13px',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 700, margin: 0 }}>{item.title}</p>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                        @{item.seller} • x{item.qty}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ color: '#34D399' }}>
                        {(item.price * item.qty).toFixed(2)} €
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#F87171',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <div
                  style={{
                    borderTop: '1px solid #252529',
                    paddingTop: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>Total</span>
                  <span style={{ fontSize: '17px', fontWeight: 800, color: '#34D399' }}>
                    {cartTotal.toFixed(2)} €
                  </span>
                </div>
              </>
            )}
          </div>
        </main>
      )}

      {/* LOG IN / SIGN IN VIEW */}
      {activeTab === 'auth' && (
        <main style={{ maxWidth: '460px', margin: '0 auto', padding: '24px' }}>
          <div
            style={{
              backgroundColor: '#121215',
              border: '1px solid #252529',
              borderRadius: '22px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Log in / Sign in</h2>

            {userEmail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: '#D4D4D8', margin: 0 }}>
                  Signed in: <strong>{userEmail}</strong>
                </p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    backgroundColor: '#FFFFFF',
                    color: '#050505',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Log out
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email"
                  style={{
                    padding: '11px 14px',
                    backgroundColor: '#1A1A1F',
                    color: '#FFFFFF',
                    border: '1px solid #2A2A30',
                    borderRadius: '14px',
                    fontSize: '13px',
                  }}
                />
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password"
                  style={{
                    padding: '11px 14px',
                    backgroundColor: '#1A1A1F',
                    color: '#FFFFFF',
                    border: '1px solid #2A2A30',
                    borderRadius: '14px',
                    fontSize: '13px',
                  }}
                />
                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    backgroundColor: '#FFFFFF',
                    color: '#050505',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {authLoading ? 'Logging in...' : 'Log in'}
                </button>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handleSignUp}
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    backgroundColor: '#1A1A1F',
                    color: '#FFFFFF',
                    border: '1px solid #2A2A30',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Sign in / Create account
                </button>
              </form>
            )}
          </div>
        </main>
      )}

      {/* BOTTOM BAR */}
      <nav
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 45,
          backgroundColor: 'rgba(5, 5, 5, 0.96)',
          borderTop: '1px solid #18181B',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            maxWidth: '960px',
            margin: '0 auto',
            padding: '10px 24px 12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'feed' ? '#FFFFFF' : '#71717A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3l9-8z" />
            </svg>
            <span>For You</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('feed');
              setShowCategories((prev) => !prev);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: showCategories ? '#FFFFFF' : '#71717A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>Categories</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('publish')}
            aria-label="Publish"
            style={{
              width: '48px',
              height: '36px',
              borderRadius: '14px',
              backgroundColor: '#FFFFFF',
              color: '#050505',
              border: 'none',
              fontSize: '22px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            +
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cart')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'cart' ? '#FFFFFF' : '#71717A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span>Sell ({cartCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'auth' ? '#FFFFFF' : '#71717A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function VideoSlidePlayer({
  url,
  isPaused,
  isMuted,
  onToggle,
}: {
  url: string;
  isPaused: boolean;
  isMuted: boolean;
  onToggle: (el: HTMLVideoElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPaused) {
      el.pause();
    } else {
      el.play().catch(() => {});
    }
  }, [isPaused, url]);

  if (!url) {
    return (
      <div
        onClick={() => onToggle(null)}
        style={{
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at center, #25201A 0%, #09090B 75%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#A1A1AA',
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        No video source
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={url}
      muted={isMuted}
      loop
      playsInline
      autoPlay
      onClick={() => onToggle(videoRef.current)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        cursor: 'pointer',
      }}
    />
  );
}