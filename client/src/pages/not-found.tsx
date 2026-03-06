import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-solidBackground">
      <Card className="w-full max-w-md mx-4 glass-card border-0">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-primaryBlue" aria-hidden="true" />
            <h1 className="text-2xl font-black text-white uppercase tracking-wider">Page not found</h1>
          </div>

          <p className="mt-4 text-slate-300" style={{ fontSize: '17px', lineHeight: 1.5 }}>
            The page you're looking for doesn't exist. Use the navigation below to get back on track.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
