
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, addHours } from 'date-fns';
import { ChevronLeft, ChevronRight, BookMarked } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarSlot } from './calendar-slot';
import {
  getWeekDates,
  generateTimeSlots,
  checkSlotAvailability,
} from '@/lib/calendar-utils';
import type { Booking, TimeSlot as TimeSlotType } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface DisplayTimeSlot extends TimeSlotType {
  isSelected: boolean;
}

interface CalendarViewProps {
  initialDate: Date;
  onDateChange: (date: Date) => void;
  bookings: Booking[];
  onNewBookingsAdd: (newBookings: Booking[]) => void;
  calendarId: string;
}

export function CalendarView({ 
  initialDate, 
  onDateChange, 
  bookings, 
  onNewBookingsAdd,
  calendarId 
}: CalendarViewProps) {
  const [currentDateInternal, setCurrentDateInternal] = useState(initialDate);
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Date[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentDateInternal(initialDate);
  }, [initialDate]);

  useEffect(() => {
    const newWeekDates = getWeekDates(currentDateInternal);
    setWeekDates(newWeekDates);
  }, [currentDateInternal]);
  
  const existingClientNames = useMemo(() => {
    const names = new Set(bookings.map(b => b.clientName).filter(Boolean).map(name => name.trim()));
    return Array.from(names).sort();
  }, [bookings]);

  const calendarData = useMemo((): { date: Date; slots: DisplayTimeSlot[] }[] => {
    return weekDates.map(date => {
      const daySlots: DisplayTimeSlot[] = generateTimeSlots(date).map(slotTime => {
        const availability = checkSlotAvailability(slotTime, bookings);
        const isSelected = selectedSlots.some(s => s.getTime() === slotTime.getTime());
        return {
          time: slotTime,
          isBooked: availability.isBooked,
          isBuffer: availability.isBuffer,
          bookingDetails: availability.bookingDetails,
          isSelected,
        };
      });
      return { date, slots: daySlots };
    });
  }, [weekDates, bookings, selectedSlots]);

  const timeLabels = useMemo(() => {
    if (calendarData.length === 0 || calendarData[0].slots.length === 0) return [];
    return calendarData[0].slots.map(slot => format(slot.time, 'HH:mm'));
  }, [calendarData]);

  const updateDate = (newDate: Date) => {
    setCurrentDateInternal(newDate);
    onDateChange(newDate); 
    setSelectedSlots([]); 
  };

  const handlePrevWeek = () => {
    const newDate = new Date(currentDateInternal);
    newDate.setDate(newDate.getDate() - 7);
    updateDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDateInternal);
    newDate.setDate(newDate.getDate() + 7);
    updateDate(newDate);
  };

  const handleToday = () => {
    updateDate(new Date());
  };

  const handleSlotClick = (slotTime: Date) => {
    const { isBooked, isBuffer } = checkSlotAvailability(slotTime, bookings);
    
    if (isBooked || isBuffer) {
        setSelectedSlots(prevSelected => prevSelected.filter(s => s.getTime() !== slotTime.getTime()));
        toast({
          title: 'Slot Unavailable',
          description: 'This time slot is already booked or is a buffer time.',
          variant: 'destructive',
        });
        return;
    }

    setSelectedSlots(prevSelected => {
      const index = prevSelected.findIndex(s => s.getTime() === slotTime.getTime());
      if (index > -1) {
        return prevSelected.filter(s => s.getTime() !== slotTime.getTime()); 
      } else {
        const newSelection = [...prevSelected, slotTime];
        newSelection.sort((a, b) => a.getTime() - b.getTime());
        return newSelection;
      }
    });
  };

  const handleConfirmBooking = () => {
    if (typeof window === 'undefined') {
      toast({ title: "Error", description: "Window object not available. Cannot create booking.", variant: "destructive" });
      return;
    }

    if (selectedSlots.length === 0) {
      toast({
        title: 'No Slots Selected',
        description: 'Please select one or more available slots to book.',
        variant: 'destructive',
      });
      return;
    }
    
    // Client Name Prompt
    let clientPromptText = "Client Name (Required):";
    if (existingClientNames.length > 0) {
      clientPromptText = `Client Name (Required - e.g., ${existingClientNames.join(", ")}) or type new:`;
    }
    const defaultClientName = existingClientNames.length > 0 ? (existingClientNames[0] || "") : "";
    const clientNameInput = window.prompt(clientPromptText, defaultClientName);

    if (clientNameInput === null) { // User clicked "Cancel"
      toast({ 
        title: "Booking Cancelled", 
        description: "Client name entry was cancelled.", 
        variant: "destructive" 
      });
      return;
    }
    if (clientNameInput.trim() === "") { // User clicked "OK" but left it empty
      toast({ 
        title: "Client Name Missing", 
        description: "Client name must be provided in the pop-up. Please try again.", 
        variant: "destructive" 
      });
      return;
    }
    const finalClientName = clientNameInput.trim();

    // Service Details Prompt
    const serviceDetailsInput = window.prompt("Enter service details (e.g., Vocal Recording, Mixing):", "Session");
    if (serviceDetailsInput === null) { // User clicked "Cancel"
        toast({ title: "Booking Cancelled", description: "Service details entry was cancelled.", variant: "destructive" });
        return;
    }
    let finalServiceDetails = "Session"; // Default if user clicks OK with empty input
    if (serviceDetailsInput.trim() !== "") {
      finalServiceDetails = serviceDetailsInput.trim();
    }

    // Price Prompt
    const priceInput = window.prompt(`Enter total price for the ${selectedSlots.length} selected session(s) (e.g., 50):`, "50");
    if (priceInput === null) { // User clicked "Cancel"
        toast({ title: "Booking Cancelled", description: "Price input was cancelled.", variant: "destructive" });
        return;
    }
    let totalPriceForSession = 0;
    if (priceInput.trim() === "") { // User clicked OK but left it empty
        toast({ title: "Invalid Price", description: "Price cannot be empty. Defaulting to $0 for this booking.", variant: "destructive" });
        totalPriceForSession = 0; 
    } else {
        totalPriceForSession = parseFloat(priceInput);
        if (isNaN(totalPriceForSession) || totalPriceForSession < 0) {
            toast({ title: "Invalid Price", description: "Price must be a valid non-negative number. Defaulting to $0 for this booking.", variant: "destructive" });
            totalPriceForSession = 0; 
        }
    }

    const pricePerSlot = selectedSlots.length > 0 ? totalPriceForSession / selectedSlots.length : 0;

    const newlyConfirmedBookings: Booking[] = selectedSlots.map(slotTimeToBook => ({
      id: `booking-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      startTime: slotTimeToBook,
      endTime: addHours(slotTimeToBook, 1), 
      clientName: finalClientName,
      service: finalServiceDetails,
      title: `${finalClientName} - ${finalServiceDetails}`,
      price: pricePerSlot, 
    }));

    onNewBookingsAdd(newlyConfirmedBookings); 
    setSelectedSlots([]); 
    toast({
      title: 'Booking Confirmed!',
      description: `${newlyConfirmedBookings.length} slot(s) booked for ${finalClientName}. Buffers will now reflect these bookings.`,
    });
  };

  if (calendarData.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">Loading calendar...</div>;
  }

  return (
    <div id={calendarId} className="p-4 md:p-6 bg-card rounded-lg shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrevWeek} aria-label="Previous week">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="outline" onClick={handleNextWeek} aria-label="Next week">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-semibold text-primary-foreground">
            {weekDates.length > 0 ?
             `${format(weekDates[0], 'MMM d')} - ${format(weekDates[weekDates.length - 1], 'MMM d, yyyy')}` :
             'Loading...'}
          </h2>
          <Button variant="link" onClick={handleToday} className="text-sm text-accent p-0 h-auto">Go to Today</Button>
        </div>
        <Button 
          onClick={handleConfirmBooking} 
          disabled={selectedSlots.length === 0}
          className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[180px]"
          aria-label="Confirm booking for selected slots"
        >
          <BookMarked className="mr-2 h-4 w-4" />
          Book Selected ({selectedSlots.length})
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-border/50">
          <thead className="bg-secondary/50">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-secondary/50 p-3 text-xs md:text-sm font-medium text-secondary-foreground border-b border-r border-border/50 w-24">
                Time
              </th>
              {weekDates.map(date => (
                <th scope="col" key={date.toISOString()} className="p-3 text-xs md:text-sm font-medium text-secondary-foreground border-b border-r border-border/50 min-w-[100px] md:min-w-[120px]">
                  <div>{format(date, 'EEE')}</div>
                  <div className="text-xs text-muted-foreground">{format(date, 'dd/MM')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeLabels.map((timeLabel, rowIndex) => (
              <tr key={timeLabel}>
                <td className="sticky left-0 z-10 bg-card p-3 text-xs md:text-sm font-medium text-muted-foreground border-b border-r border-border/50 align-top h-16 w-24">
                  {timeLabel}
                </td>
                {calendarData.map(day => (
                  <td key={`${day.date.toISOString()}-${timeLabel}`} className="p-0 align-top h-16">
                    <CalendarSlot
                      slot={day.slots[rowIndex]}
                      onSlotClick={handleSlotClick}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
    
