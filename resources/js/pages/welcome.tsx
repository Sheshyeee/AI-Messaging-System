import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, MessageCircle, Sparkles, Zap } from 'lucide-react';

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title="Welcome">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />
            </Head>

            <div className="min-h-screen bg-white font-['Instrument_Sans',sans-serif] text-zinc-950 antialiased">
                {/* Header */}
                <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/80 backdrop-blur-sm">
                    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                        <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900">
                                <MessageCircle className="h-4 w-4 text-white" strokeWidth={2} />
                            </span>
                            <span className="text-[15px] font-semibold tracking-tight">Nexus</span>
                        </div>

                        <nav className="flex items-center gap-3">
                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={route('login')}
                                        className="hidden h-9 items-center px-3 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950 sm:inline-flex"
                                    >
                                        Sign in
                                    </Link>
                                    <Link
                                        href={route('register')}
                                        className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                                    >
                                        Get started
                                    </Link>
                                </>
                            )}
                        </nav>
                    </div>
                </header>

                {/* Hero */}
                <main className="relative overflow-hidden">
                    {/* subtle background grid + glow, kept quiet on purpose */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,rgba(0,0,0,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.035)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_40%,transparent_100%)]"
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute top-[-120px] left-1/2 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-indigo-200/40 blur-[110px]"
                    />

                    <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-14 text-center sm:pt-28">
                        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-500" strokeWidth={2} />
                            Now with Smart Reply — respond in one tap
                        </div>

                        <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-zinc-950 sm:text-5xl lg:text-[3.4rem]">
                            Real-time chat,
                            <br />
                            with replies that write themselves.
                        </h1>

                        <p className="mt-5 max-w-xl text-balance text-zinc-500 sm:text-lg">
                            Nexus keeps every conversation instant, and lets Smart Reply suggest the perfect response before you even start typing.
                        </p>

                        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                            <Link
                                href={route('register')}
                                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                            >
                                Start for free
                                <ArrowRight className="h-4 w-4" strokeWidth={2} />
                            </Link>
                            <Link
                                href={route('login')}
                                className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                            >
                                Sign in
                            </Link>
                        </div>
                    </section>

                    {/* Product mockup — the signature element: a live chat with a smart-reply row */}
                    <section className="mx-auto max-w-2xl px-6 pb-24 sm:pb-32">
                        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.12)]">
                            {/* window bar */}
                            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/60 px-4 py-2.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Live
                                </div>
                            </div>

                            {/* messages */}
                            <div className="flex flex-col gap-3 px-5 py-6 sm:px-8">
                                <div className="flex justify-start">
                                    <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2.5 text-left text-sm text-zinc-700">
                                        Hey — are we still good for the 3pm review?
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2.5 text-left text-sm text-white">
                                        Yep, see you then 👍
                                    </div>
                                </div>

                                {/* smart reply row */}
                                <div className="mt-2 flex flex-col gap-2 border-t border-dashed border-zinc-200 pt-4">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                                        <Zap className="h-3.5 w-3.5 text-indigo-500" strokeWidth={2} />
                                        Smart Reply
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {['Sounds good 👍', "I'll send the deck first", 'Can we push to 3:30?'].map((chip) => (
                                            <span
                                                key={chip}
                                                className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600"
                                            >
                                                {chip}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>

                {/* Footer */}
                <footer className="border-t border-zinc-100 py-8">
                    <p className="text-center text-xs text-zinc-400">© 2026 Nexus, Inc. — Real-time messaging with Smart Reply.</p>
                </footer>
            </div>
        </>
    );
}
