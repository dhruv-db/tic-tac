import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code } from "lucide-react";

export const BexioOAuthExample = () => {
  const fullScope = "openid profile email company_profile offline_access accounting contact_show contact_edit project_show project_edit timesheet_show timesheet_edit invoice_show invoice_edit kb_offer_show kb_invoice_show kb_credit_voucher_show kb_bill_show";

  const exampleUrl = `${import.meta.env.VITE_BEXIO_OAUTH_AUTH_URL || 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth'}?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code&scope=${encodeURIComponent(fullScope)}&state={STATE}&code_challenge={CODE_CHALLENGE}&code_challenge_method=S256`;

  const oidcScopes = ["openid", "profile", "email", "company_profile", "offline_access"];
  const apiScopes = ["accounting", "contact_show", "contact_edit", "project_show", "project_edit", "monitoring_show", "monitoring_edit", "invoice_show", "invoice_edit", "kb_offer_show", "kb_invoice_show", "kb_credit_voucher_show", "kb_bill_show"];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-primary" />
          <CardTitle>Bexio OAuth2 Authorization URL with Full API Access</CardTitle>
        </div>
        <CardDescription>
          Complete OAuth2 flow with PKCE (S256) and all available scopes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Required OIDC Scopes</h3>
          <div className="flex flex-wrap gap-2">
            {oidcScopes.map(scope => (
              <Badge key={scope} variant="secondary" className="font-mono text-xs">
                {scope}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-lg">API Access Scopes</h3>
          <div className="flex flex-wrap gap-2">
            {apiScopes.map(scope => (
              <Badge key={scope} variant="outline" className="font-mono text-xs">
                {scope}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Complete Authorization URL</h3>
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm break-all font-mono leading-relaxed">
              {exampleUrl}
            </code>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Parameters</h3>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <strong className="font-mono">client_id</strong>
              <span className="text-muted-foreground col-span-2">Your Bexio app client ID</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <strong className="font-mono">redirect_uri</strong>
              <span className="text-muted-foreground col-span-2">Your callback URL (URL encoded)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <strong className="font-mono">response_type</strong>
              <span className="text-muted-foreground col-span-2">Always "code" for authorization code flow</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <strong className="font-mono">scope</strong>
              <span className="text-muted-foreground col-span-2">Space-separated list of all OIDC and API scopes</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <strong className="font-mono">state</strong>
              <span className="text-muted-foreground col-span-2">Random string for security (prevent CSRF)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <strong className="font-mono">code_challenge</strong>
              <span className="text-muted-foreground col-span-2">Base64URL encoded SHA256 hash of code_verifier</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <strong className="font-mono">code_challenge_method</strong>
              <span className="text-muted-foreground col-span-2">Always "S256" for SHA256 PKCE</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};