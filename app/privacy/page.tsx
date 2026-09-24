import Link from "next/link";
import { PadhleMark } from "@/components/brand/PadhleMark";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-white px-5 py-10 text-slate-900" style={{ colorScheme: "light" }}>
      <article className="mx-auto max-w-2xl space-y-7 text-[15px] leading-7">
        <Link href="/login" className="inline-flex items-center gap-3 font-semibold"><PadhleMark size={36} />Padhle</Link>
        <header><h1 className="text-3xl font-semibold tracking-tight">Privacy at Padhle</h1><p className="mt-2 text-slate-600">Last updated 25 September 2026</p></header>
        <section><h2 className="text-lg font-semibold">Your account</h2><p>We use your email address and sign-in information to create and protect your Padhle account. If you sign in with Google or GitHub, that provider shares the account information needed for sign-in. Supabase provides our authentication service.</p></section>
        <section><h2 className="text-lg font-semibold">Questions and answers</h2><p>Your questions, including images you upload, are sent to our AI and retrieval services to produce an answer. We may cache text answers to improve response speed. Chat messages are held in your current browser session; the app does not currently offer a saved chat history.</p></section>
        <section><h2 className="text-lg font-semibold">Service providers</h2><p>We use Vercel to host Padhle, Supabase for accounts, and external AI and search services to answer questions. These services process the information needed to provide the feature you use.</p></section>
        <section><h2 className="text-lg font-semibold">Your choices</h2><p>You can stop using Padhle and ask us about your account or data at <a className="font-medium underline" href="mailto:naman070609@gmail.com">naman070609@gmail.com</a>. Avoid sending sensitive personal information in study questions.</p></section>
      </article>
    </main>
  );
}
