import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin-console";

export const metadata: Metadata = {
  title: "Admin console",
  robots: { index: false, follow: false },
};

// The console is a client component: it holds the admin token in
// sessionStorage and calls the token-gated API through same-origin rewrites.
// No server-side rendering happens here, so the token never touches the
// server-rendered HTML.
export default function AdminPage() {
  return (
    <div className="section admin">
      <div className="container">
        <AdminConsole />
      </div>
    </div>
  );
}
