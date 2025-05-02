"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps } from "react-day-picker"
import { ru } from 'date-fns/locale'; // Import Russian locale

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={ru} // Set locale to Russian
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium hidden", // Hide default label if using dropdowns
        caption_dropdowns: "flex justify-center gap-1", // Added for dropdowns
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30", // Adjusted opacity
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        dropdown: "rdp-dropdown bg-card", // Base style for dropdown container
        dropdown_month: "rdp-dropdown_month",
        dropdown_year: "rdp-dropdown_year",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" {...props} />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" {...props} />,
        // Use custom Dropdown component for month/year selection
        Dropdown: (props: DropdownProps) => {
          const { fromDate, fromMonth, fromYear, toDate, toMonth, toYear } =
            useDayPicker();

          const { name, value, onChange } = props;
          const options = props.children as React.ReactElement<
            React.HTMLProps<HTMLOptionElement>
          >[];

          const currentYear = new Date().getFullYear();
          const startYear = fromYear || currentYear - 10; // Use context or default range
          const endYear = toYear || currentYear + 10;

          let selectItems: React.ReactNode;

          if (name === 'months') {
            selectItems = options.map((option) => (
              <SelectItem
                key={`${option.props.value}`}
                value={`${option.props.value}`}
              >
                {ru.localize?.month(Number(option.props.value), { width: 'wide' })}
              </SelectItem>
            ));
          } else if (name === 'years') {
            const years = [];
             for (let i = startYear; i <= endYear; i += 1) {
              years.push(
                <SelectItem key={i} value={`${i}`}>
                  {i}
                </SelectItem>
              );
             }
            selectItems = years;
          }


          return (
             <Select
              onValueChange={(newValue) => {
                if (onChange) {
                    const event = { target: { value: newValue } } as React.ChangeEvent<HTMLSelectElement>;
                    onChange(event);
                }
              }}
              value={value?.toString()}
             >
               <SelectTrigger className="h-7 w-[60px] px-2 py-0.5 text-xs data-[placeholder]:text-muted-foreground sm:w-[70px] sm:px-2 sm:text-sm">
                <SelectValue placeholder={name === 'months' ? 'Месяц' : 'Год'} />
               </SelectTrigger>
               <SelectContent className="max-h-[var(--radix-select-content-available-height)]">
                 <ScrollArea className="h-72"> {/* Adjust height as needed */}
                    {selectItems}
                 </ScrollArea>
               </SelectContent>
             </Select>
          );
        },
      }}
      captionLayout="dropdown-buttons" // Enable dropdowns and nav buttons
      fromYear={props.fromYear || new Date().getFullYear() - 10} // Default range
      toYear={props.toYear || new Date().getFullYear() + 10}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"


// Import useDayPicker hook from react-day-picker
import { useDayPicker } from 'react-day-picker';

export { Calendar }
