import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

interface Language {
  id: number;
  name: string;
  iso_639_1: string;
}

interface LanguageFlagProps {
  languages: Language[];
  currentLanguage: string;
  onLanguageChange: (language: string) => void;
}

const FLAG_EMOJIS: Record<string, string> = {
  en: "🇬🇧",
  de: "🇩🇪",
  fr: "🇫🇷",
  it: "🇮🇹",
  es: "🇪🇸",
  pt: "🇵🇹",
  nl: "🇳🇱",
  pl: "🇵🇱",
  cs: "🇨🇿",
  sk: "🇸🇰",
  hu: "🇭🇺",
  ro: "🇷🇴",
  bg: "🇧🇬",
  hr: "🇭🇷",
  sl: "🇸🇮",
  fi: "🇫🇮",
  se: "🇸🇪",
  no: "🇳🇴",
  dk: "🇩🇰",
  is: "🇮🇸",
  lv: "🇱🇻",
  lt: "🇱🇹",
  et: "🇪🇪",
  ru: "🇷🇺",
  ua: "🇺🇦",
  tr: "🇹🇷",
  ar: "🇸🇦",
  ja: "🇯🇵",
  ko: "🇰🇷",
  zh: "🇨🇳",
};

export const LanguageFlag = ({ languages, currentLanguage, onLanguageChange }: LanguageFlagProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const getCurrentFlag = () => FLAG_EMOJIS[currentLanguage] || "🌍";
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-muted/50"
        >
          <span className="text-lg">{getCurrentFlag()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        <div className="grid gap-1">
          {languages.map((lang) => (
            <Button
              key={lang.id}
              variant={currentLanguage === lang.iso_639_1 ? "secondary" : "ghost"}
              size="sm"
              className="justify-start gap-2 h-8"
              onClick={() => {
                onLanguageChange(lang.iso_639_1);
                setIsOpen(false);
              }}
            >
              <span>{FLAG_EMOJIS[lang.iso_639_1] || "🌍"}</span>
              <span className="text-xs">{lang.name}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};