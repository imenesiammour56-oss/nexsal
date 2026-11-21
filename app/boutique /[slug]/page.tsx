'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

interface StoreVideoItem {
  id: string | number;
  title?: string | null;
  price?: number | string | null;
  category?: string | null;
  url?: string | null;
  user_email?: string | null;
  likes?: number | null;
}

export default function StorePage() {
  const params = useParams<{ slug: string }>();
  const rawSlug = params?.slug || '';
  const cleanSlug = decodeURIComponent(rawSlug).split('@')[0];

  const [storeVideos, setStoreVideos] = useState<StoreVideoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadStore() {
      if (!cleanSlug || !supabase) {
        if (isMounted) {
          setStoreVideos([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .ilike('user_email', `${cleanSlug}%`)
        .order('id', { ascending: false });

      if (!isMounted) return;

      if (error || !data) {
        setStoreVideos([]);
      } else {
        setStoreVideos(data);
      }

      setLoading(false);
    }

    loadStore();

    return () => {
      isMounted = false;
    };
  }, [cleanSlug]);

  const sellerEmail = storeVideos[0]?.user_email || `${cleanSlug}@nexsal.store`;
  const totalLikes = storeVideos.reduce((sum, item) => sum + (item.likes || 0), 0);

  return (
    <div className="bg-[#FAF7F2] text-[#191817] font-sans min-h-screen p-4 md:p-12">
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-10">
        <Link href="/" className="text-xs font-bold text-[#C88A58] hover:underline">
          ← Back to Marketplace
        </Link>
        <Link href="/" className="text-xl font-black tracking-widest">
          NEXSAL<span className="text-[#C88A58]">.</span>
        </Link>
      </header>

      <main className="max-w-5xl mx-auto space-y-10">
        <section className="bg-white p-8 rounded-[32px] border border-[#E1D8C9] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="w-16 h-16 rounded-full bg-[#C88A58] text-white flex items-center justify-center font-black text-xl shadow-md">
              {(cleanSlug || 'NX').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#C88A58]">
                Official Creator Storefront
              </span>
              <h1 className="text-2xl font-black tracking-tight mt-0.5">
                @{cleanSlug || 'Creator'}
              </h1>
              <p className="text-xs text-[#80776E] font-medium">{sellerEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-[#FAF7F2] px-6 py-3 rounded-2xl border border-[#E1D8C9]">
            <div className="text-center">
              <span className="block text-lg font-black">{storeVideos.length}</span>
              <span className="text-[10px] uppercase font-bold text-[#80776E]">Products</span>
            </div>
            <div className="h-8 w-[1px] bg-[#E1D8C9]" />
            <div className="text-center">
              <span className="block text-lg font-black">{totalLikes}</span>
              <span className="text-[10px] uppercase font-bold text-[#80776E]">Total Likes</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-black tracking-wide">Store Catalog</h2>

          {loading ? (
            <p className="text-xs font-bold text-[#80776E] py-10 text-center">
              Loading store products...
            </p>
          ) : storeVideos.length === 0 ? (
            <div className="bg-white p-10 rounded-3xl border border-[#E1D8C9] text-center space-y-3">
              <p className="text-sm font-black">No products listed in this store yet.</p>
              <Link
                href="/"
                className="inline-block px-5 py-2 bg-[#191817] text-white text-xs font-bold rounded-full"
              >
                Explore Marketplace
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {storeVideos.map((video) => (
                <div
                  key={video.id}
                  className="bg-white rounded-3xl border border-[#E1D8C9] overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <Link
                    href={`/produit/${video.id}`}
                    className="block relative aspect-[9/12] bg-black overflow-hidden group"
                  >
                    {video.url ? (
                      <video
                        src={video.url}
                        muted
                        playsInline
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : null}
                    <span className="absolute top-3 left-3 text-[10px] font-black uppercase bg-black/60 text-white px-2.5 py-1 rounded-full">
                      {video.category || 'Product'}
                    </span>
                  </Link>

                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/produit/${video.id}`}>
                        <h3 className="text-sm font-black hover:text-[#C88A58] transition line-clamp-1">
                          {video.title || 'NEXSAL Item'}
                        </h3>
                      </Link>
                      <span className="text-sm font-black text-emerald-600 flex-shrink-0">
                        {video.price ?? '29.99'} €
                      </span>
                    </div>

                    <Link
                      href={`/produit/${video.id}`}
                      className="block w-full py-2.5 text-center bg-[#191817] hover:bg-black text-white text-xs font-bold rounded-xl transition"
                    >
                      View Product
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}