import Link from "next/link";
import { PadhleMark } from "@/components/brand/PadhleMark";

export default function AboutPage() {
  return (
    <main className="min-h-dvh bg-[#f5f6f8] px-5 py-10 text-slate-950" style={{ colorScheme: "light" }}>
      <div className="mx-auto max-w-3xl rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm sm:p-12">
        <Link href="/login" className="inline-flex items-center gap-3 text-xl font-semibold"><PadhleMark size={42} />Padhle</Link>
        <p className="mt-12 text-xs font-bold uppercase tracking-[0.17em] text-indigo-700">CBSE Class 10 · Maths &amp; Science</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">Study with answers grounded in your sources.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Padhle helps students ask Maths and Science questions, understand concepts, and plan revision. For academic answers, it checks the active CBSE syllabus and uses reviewed NCERT and CBSE material where available. When verified material is missing, it says so.</p>
        <h2 className="mt-10 text-lg font-semibold">Why sign in?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">An account protects access to Padhle. Google sign-in uses your basic name, profile picture, and email address to identify your account; it does not request access to your Google Drive or Gmail.</p>
        <div className="mt-9 flex flex-wrap items-center gap-5"><Link href="/login" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Open Padhle</Link><Link href="/privacy" className="text-sm font-semibold text-slate-800 underline underline-offset-4">Read our privacy information</Link></div>
      </div>
    </main>
  );
}
