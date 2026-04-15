import LoginCard from "@/app/components/LoginCard";

/**
 * Login page — Server Component.
 * Renders centered on a gray background; no authentication is required
 * to reach this route (it is excluded from the middleware guard).
 */
export default function LoginPage() {
  return (
    <div className="h-full bg-gray-50 flex items-center justify-center p-4">
      <LoginCard />
    </div>
  );
}
