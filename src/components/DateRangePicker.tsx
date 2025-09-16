import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { useIsMobile } from "@/hooks/use-mobile";

interface DateRangePickerProps {
  onDateRangeChange: (range: { from: Date; to: Date } | undefined) => void;
  className?: string;
}

export const DateRangePicker = ({ onDateRangeChange, className }: DateRangePickerProps) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [preset, setPreset] = useState<string>("current");
  const isMobile = useIsMobile();


  const handlePresetChange = (value: string) => {
    setPreset(value);
    const now = new Date();

    switch (value) {
      case "current":
        const currentMonth = { from: startOfMonth(now), to: endOfMonth(now) };
        setDateRange(currentMonth);
        onDateRangeChange(currentMonth);
        break;
      case "last":
        const lastMonth = { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
        setDateRange(lastMonth);
        onDateRangeChange(lastMonth);
        break;
      case "last90":
        const last90Days = { from: subMonths(now, 3), to: now };
        setDateRange(last90Days);
        onDateRangeChange(last90Days);
        break;
      case "custom":
        // Keep current selection for custom
        break;
      default:
        setDateRange(undefined);
        onDateRangeChange(undefined);
    }
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      onDateRangeChange(range as { from: Date; to: Date });
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className={isMobile ? "w-24" : "w-32"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="current">This Month</SelectItem>
          <SelectItem value="last">Last Month</SelectItem>
          <SelectItem value="last90">Last 90 Days</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                isMobile ? "flex-1 justify-start text-left font-normal" : "w-64 justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, isMobile ? "MMM dd" : "LLL dd, y")} -{" "}
                    {format(dateRange.to, isMobile ? "MMM dd" : "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, isMobile ? "MMM dd" : "LLL dd, y")
                )
              ) : (
                "Pick a date range"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn(isMobile ? "w-full p-0" : "w-auto p-0", "z-[100]")} align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={isMobile ? 1 : 2}
              className={isMobile ? "p-2" : "p-3"}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
