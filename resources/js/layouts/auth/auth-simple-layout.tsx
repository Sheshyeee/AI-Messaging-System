import { Link } from '@inertiajs/react';
import { MessageCircle } from 'lucide-react';

interface AuthLayoutProps {
    children: React.ReactNode;
    name?: string;
    title?: string;
    description?: string;
}

export default function AuthSimpleLayout({ children, title, description }: AuthLayoutProps) {
    return (
        <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white p-4 sm:p-6 md:p-10">
            {/* subtle background grid + glow, matches the landing page */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,rgba(0,0,0,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.035)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_40%,transparent_100%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute top-[-120px] left-1/2 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-indigo-200/40 blur-[110px]"
            />

            <div className="w-full max-w-sm">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <Link href={route('home')} className="flex flex-col items-center gap-3 font-medium">
                            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-900">
                                <MessageCircle className="h-4 w-4 text-white" strokeWidth={2} />
                            </span>
                            <span className="sr-only">{title}</span>
                        </Link>

                        <div className="space-y-1.5 text-center">
                            <h1 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">{title}</h1>
                            <p className="text-center text-sm text-zinc-500">{description}</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.10)] sm:p-8">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
