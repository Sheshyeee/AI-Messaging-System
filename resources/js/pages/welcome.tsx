import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, MessageCircle, Zap } from 'lucide-react';

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title="Welcome">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600|jetbrains-mono:400,500" rel="stylesheet" />
            </Head>

            <div className="relative min-h-screen overflow-x-hidden bg-[#0a0a0b] font-['Instrument_Sans',sans-serif] text-[#f5f5f4] antialiased">
                {/* Base gradient wash — near-black, never flat */}
                <div
                    aria-hidden
                    className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,255,255,0.06),transparent),linear-gradient(180deg,#0a0a0b_0%,#101012_50%,#0a0a0b_100%)]"
                />

                {/* Faint structural grid, masked so it fades toward the edges */}
                <div
                    aria-hidden
                    className="pointer-events-none fixed inset-0 -z-10 [background-image:linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_65%_45%_at_50%_10%,#000_35%,transparent_100%)]"
                />

                {/* Grain — keeps the black from reading flat/AI-slick */}
                <div
                    aria-hidden
                    className="pointer-events-none fixed inset-0 -z-10 opacity-[0.05] mix-blend-overlay"
                    style={{
                        backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                    }}
                />

                {/* Header — floating glass pill, not a full-width bar */}
                <header className="sticky top-4 z-20 mx-auto flex max-w-3xl items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 backdrop-blur-xl">
                    <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0a0a0b]">
                            <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </span>
                        <span className="text-[15px] font-semibold tracking-tight">Nexus</span>
                    </div>

                    <nav className="flex items-center gap-1">
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="inline-flex h-8 items-center rounded-full bg-white px-4 text-[13px] font-medium text-[#0a0a0b] transition-colors hover:bg-white/85"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={route('login')}
                                    className="hidden h-8 items-center px-3 text-[13px] font-medium text-white/60 transition-colors hover:text-white sm:inline-flex"
                                >
                                    Sign in
                                </Link>
                                <Link
                                    href={route('register')}
                                    className="inline-flex h-8 items-center rounded-full bg-white px-4 text-[13px] font-medium text-[#0a0a0b] transition-colors hover:bg-white/85"
                                >
                                    Get started
                                </Link>
                            </>
                        )}
                    </nav>
                </header>

                {/* Hero */}
                <main className="relative">
                    <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-24">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-['JetBrains_Mono',monospace] text-[11px] tracking-wide text-white/50 uppercase">
                            <Zap className="h-3 w-3 text-white/70" strokeWidth={2} />
                            Now with Smart Reply
                        </div>

                        <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-[3.4rem]">
                            Real-time chat,
                            <br />
                            with replies that write themselves.
                        </h1>

                        <p className="mt-5 max-w-xl text-balance text-white/50 sm:text-lg">
                            Nexus keeps every conversation instant, and lets Smart Reply suggest the perfect response before you even start typing.
                        </p>

                        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                            <Link
                                href={route('register')}
                                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-medium text-[#0a0a0b] transition-colors hover:bg-white/85"
                            >
                                Start for free
                                <ArrowRight className="h-4 w-4" strokeWidth={2} />
                            </Link>
                            <Link
                                href={route('login')}
                                className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/[0.03] px-5 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.07]"
                            >
                                Sign in
                            </Link>
                        </div>
                    </section>

                    {/* Product showcase — the real app, not a mockup */}
                    <section className="mx-auto max-w-4xl px-6 pb-28 sm:pb-36">
                        <div className="relative">
                            {/* Ambient glow borrowed from the product's own online-status green */}
                            <div
                                aria-hidden
                                className="pointer-events-none absolute -inset-x-10 -top-16 -bottom-16 -z-10 bg-[radial-gradient(ellipse_60%_60%_at_50%_35%,rgba(34,197,94,0.08),transparent_70%)]"
                            />

                            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0f] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_40px_80px_-30px_rgba(0,0,0,0.8)]">
                                <img
                                    src="/cover.png"
                                    alt="Nexus chat interface showing a live group conversation with Smart Reply suggestions"
                                    className="block w-full"
                                />
                            </div>

                            <p className="mt-4 font-['JetBrains_Mono',monospace] text-[11px] tracking-wide text-white/30 uppercase">
                                A real conversation, not a mockup
                            </p>
                        </div>
                    </section>
                </main>

                {/* Footer */}
                <footer className="border-t border-white/[0.06] py-8">
                    <p className="text-center font-['JetBrains_Mono',monospace] text-xs text-white/30">
                        © 2026 Nexus, Inc. — Real-time messaging with Smart Reply.
                    </p>
                </footer>
            </div>
        </>
    );
}
