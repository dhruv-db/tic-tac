import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { OAuthCallback } from "./components/OAuthCallback";
import { OAuthProvider, useOAuth } from "./context/OAuthContext";

const queryClient = new QueryClient();

const OAuthCallbackWrapper = () => {
  const { onOAuthConnect } = useOAuth();
  return <OAuthCallback onOAuthConnect={onOAuthConnect || (() => {})} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/oauth/callback" element={<OAuthCallbackWrapper />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </OAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
