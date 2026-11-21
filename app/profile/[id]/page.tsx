'use client';

import React, { useState, useEffect, use } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadProduct = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setProduct(data);
      } else {
        setProduct(null);
      }
      setLoading(false);
    };

    loadProduct();
  }, [id]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs font-bold text-[#80776E]">
        Loading product...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center space-y-4 p-6">
        <p className="text-base font-black text-[#191817]">Product not found.</p>
        <Link
          href="/"
          className="px-6 py-2.5 bg-[#191817] text-white text-xs font-bold rounded-full"
        >
          Back to Marketplace
        </Link>
      </div>
    );
  }

  const sellerSlug = (product.user_email || 'creator').split('@')[0];

  return (
    <div className="bg-[#FAF7F2] text-[#191817] font-sans min-h-screen p-4 md:p-10">
      <header className="max-w-3xl mx-auto flex justify-between items-center mb-8">
        <Link href="/" className="text-xs font-bold text-[#C88A58] hover:underline">
          ← Back to Marketplace
        </Link>
        <Link href="/" className="text-xl font-black tracking-widest">
          NEXSAL<span className="text-[#C88A58]">.</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto bg-white rounded-[32px] border border-[#E1D8C9] shadow-sm overflow-hidden">
        <div className="w-full aspect-[16/10] bg-black relative">
          <video
            src={product.url}
            controls
            autoPlay
            loop
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        <div className="p-6 md:p-10 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest bg-[#FAF7F2] border border-[#E1D8C9] px-3 py-1 rounded-full">
              {product.category || 'Product'}
            </span>
            <span className="text-xs font-semibold text-[#80776E]">
              {product.views || 1} views • {product.likes || 0} likes
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-[#191817]">
              {product.title || 'NEXSAL Item'}
            </h1>
            <p className="text-2xl font-black text-emerald-600">
              {product.price || '29.99'} €
            </p>
          </div>

          <div className="bg-[#FAF7F2] border border-[#E1D8C9] rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-full bg-[#C88A58] text-white flex items-center justify-center font-black text-sm">
                {(product.user_email || 'NX').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-[#80776E]">
                  SOLD BY
                </span>
                <Link
                  href={`/boutique/${sellerSlug}`}
                  className="text-sm font-black underline hover:text-[#C88A58] transition"
                >
                  {product.user_email || 'Creator'}
                </Link>
              </div>
            </div>

            <Link
              href={`/boutique/${sellerSlug}`}
              className="px-4 py-2 bg-white border border-[#E1D8C9] hover:border-[#191817] rounded-full text-xs font-bold transition"
            >
              Visit Store →
            </Link>
          </div>

          <p className="text-xs text-[#80776E] leading-relaxed">
            Order directly from the creator on NEXSAL. Fast checkout and verified creator storefront.
          </p>

          <hr className="border-[#E1D8C9]" />

          <div className="space-y-3">
            <button
              onClick={() =>
                alert(
                  `Added "${product.title || 'Product'}" (${product.price || '29.99'} €) to your cart!`
                )
              }
              className="w-full py-4 bg-[#C88A58] hover:bg-[#b57847] text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-sm transition"
            >
              ADD TO CART — {product.price || '29.99'} €
            </button>

            <button
              onClick={handleCopyLink}
              className="w-full py-3.5 bg-[#FAF7F2] hover:bg-[#f0ebe1] border border-[#E1D8C9] text-[#191817] text-xs font-bold rounded-2xl transition"
            >
              {copied ? 'Link Copied!' : 'Copy Product Link'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}