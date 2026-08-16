import { MessageCircle } from "lucide-react";

export default function AppLogo() {
    return (
        <>
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                <MessageCircle className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="mb-0.5 truncate leading-none font-semibold">Nexus Chat</span>
            </div>
        </>
    );
}
