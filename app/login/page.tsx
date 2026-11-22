'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert("Erreur d'inscription : " + error.message);
      else alert("Inscription réussie ! Vérifie tes emails pour confirmer.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert("Erreur de connexion : " + error.message);
      else {
        alert("Connexion réussie !");
        router.push('/');
      }
    }
  };

  return (
    <div className="bg-[#FAF7F2] text-[#191817] font-sans min-h-screen flex flex-col justify-center items-center p-6">
      <div className="max-w-md w-full bg-[#EFE9DE] border border-[#E1D8C9] rounded-3xl p-8 space-y-6 shadow-sm">
        <h1 className="text-2xl font-black text-center tracking-widest">
          NEXSAL<span className="text-[#C88A58]">.</span>
        </h1>
        <h2 className="text-sm font-bold text-center text-[#80776E]">
          {isSignUp ? 'Créer un compte' : 'Connexion à votre espace'}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Adresse email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-[#FAF7F2] border border-[#E1D8C9] rounded-xl text-xs font-bold outline-none"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[#FAF7F2] border border-[#E1D8C9] rounded-xl text-xs font-bold outline-none"
            required
          />
          <button
            type="submit"
            className="w-full py-3 bg-[#191817] text-[#FAF7F2] text-xs font-black rounded-full hover:bg-black transition"
          >
            {isSignUp ? "S'inscrire" : 'Se connecter'}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs font-bold text-[#C88A58] hover:underline"
          >
            {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas encore de compte ? S'inscrire"}
          </button>
        </div>
      </div>
    </div>
  );
}
