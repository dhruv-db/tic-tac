import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

export const DebugOAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testOAuthConfig = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log('Testing OAuth configuration...');
      
      // Test if edge function is accessible
      const { data, error } = await supabase.functions.invoke('bexio-oauth', {
        body: { test: true }
      });
      
      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }
      
      setResult({
        success: true,
        data,
        message: 'OAuth edge function is accessible and configured'
      });
      
    } catch (error) {
      console.error('OAuth test failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'OAuth configuration test failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testDirectLogin = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      // Request JSON authUrl to avoid opaqueredirect/CORS issues
      const loginUrl = 'https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-oauth/login?format=json&return_url=' + encodeURIComponent(window.location.origin);
      const response = await fetch(loginUrl, { method: 'GET' });
      
      if (!response.ok) {
        const text = await response.text();
        setResult({
          success: false,
          error: `Unexpected response: ${response.status} - ${text}`,
          message: 'OAuth login endpoint not working as expected'
        });
        return;
      }

      const { authUrl } = await response.json();
      setResult({
        success: true,
        data: { redirectUrl: authUrl },
        message: 'OAuth login endpoint is working and returned the Bexio authorization URL'
      });
      
    } catch (error) {
      console.error('Direct login test failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Direct login test failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Debug OAuth Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testOAuthConfig}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Testing...' : 'Test OAuth Config'}
          </Button>
          
          <Button 
            onClick={testDirectLogin}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Testing...' : 'Test Direct Login'}
          </Button>
        </div>
        
        {result && (
          <Alert className={result.success ? 'border-green-500' : 'border-red-500'}>
            <AlertDescription>
              <div className="space-y-2">
                <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                  {result.message}
                </p>
                {result.data && (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium">Response Data</summary>
                    <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
                {result.error && (
                  <p className="text-red-600 text-sm font-mono">
                    Error: {result.error}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};