
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, addHours } from 'date-fns';
import { ChevronLeft, ChevronRight, BookMarked } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarSlot } from './calendar-slot';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const [selectedClient, setSelectedClient] = useState<string>('');
  const [newClientName, setNewClientName] = useState<string>('');
  const [serviceDetails, setServiceDetails] = useState<string>('Session');
  // HOURLY_RATE and bookingPrice state removed

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
    setSelectedClient('');
    setNewClientName('');
    setServiceDetails('Session');
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
        // If a slot is already booked/buffer, ensure it's not in selectedSlots
        // (though UI should prevent selecting these, this is a safeguard)
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
        // Deselect if already selected
        return prevSelected.filter(s => s.getTime() !== slotTime.getTime()); 
      } else {
        // Add to selection and sort
        const newSelection = [...prevSelected, slotTime];
        newSelection.sort((a, b) => a.getTime() - b.getTime());
        return newSelection;
      }
    });
  };

  const handleConfirmBooking = () => {
    if (selectedSlots.length === 0) {
      toast({
        title: 'No Slots Selected',
        description: 'Please select one or more available slots to book.',
        variant: 'destructive',
      });
      return;
    }
    
    let finalClientName = '';
    if (selectedClient === 'NEW_CLIENT') {
      finalClientName = newClientName.trim();
      if (!finalClientName) {
        toast({ title: "Client Name Missing", description: "Please enter a name for the new client.", variant: "destructive" });
        return;
      }
    } else {
      finalClientName = selectedClient;
      if (!finalClientName) {
        toast({ title: "Client Not Selected", description: "Please select a client or add a new one.", variant: "destructive" });
        return;
      }
    }

    const finalServiceDetails = serviceDetails.trim() || "Session";
    
    const newlyConfirmedBookings: Booking[] = selectedSlots.map(slotTimeToBook => ({
      id: `booking-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      startTime: slotTimeToBook,
      endTime: addHours(slotTimeToBook, 1), 
      clientName: finalClientName,
      service: finalServiceDetails,
      title: `${finalClientName} - ${finalServiceDetails}`,
      // Price is no longer set here; it will be calculated by the tiered system
    }));

    onNewBookingsAdd(newlyConfirmedBookings); 
    
    // Reset selection and form fields
    setSelectedSlots([]); 
    setSelectedClient('');
    setNewClientName('');
    setServiceDetails('Session');

    toast({
      title: 'Booking Confirmed!',
      description: `${newlyConfirmedBookings.length} slot(s) booked for ${finalClientName}.`,
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
        <div className="min-w-[180px]"></div> {/* Spacer */}
      </div>

      {/* Calendar Grid */}
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

      {/* Booking Details Form - appears when slots are selected */}
      {selectedSlots.length > 0 && (
        <div className="mt-8 p-6 bg-secondary/30 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-primary-foreground">Booking Details for {selectedSlots.length} Slot(s)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client-select" className="text-foreground">Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger id="client-select" className="bg-input text-foreground">
                  <SelectValue placeholder="Select or Add Client" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground">
                  {existingClientNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                  <SelectItem value="NEW_CLIENT">Add New Client...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedClient === 'NEW_CLIENT' && (
              <div>
                <Label htmlFor="new-client-name" className="text-foreground">New Client Name</Label>
                <Input 
                  id="new-client-name" 
                  value={newClientName} 
                  onChange={(e) => setNewClientName(e.target.value)} 
                  placeholder="Enter new client's name"
                  className="bg-input text-foreground" 
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="service-details" className="text-foreground">Service Details</Label>
              <Input 
                id="service-details" 
                value={serviceDetails} 
                onChange={(e) => setServiceDetails(e.target.value)} 
                placeholder="e.g., Vocal Recording, Mixing"
                className="bg-input text-foreground" 
              />
            </div>
            
            {/* Price input has been removed */}
          </div>
          <Button 
            onClick={handleConfirmBooking} 
            className="mt-6 w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
            aria-label="Confirm booking for selected slots"
          >
            <BookMarked className="mr-2 h-4 w-4" />
            Confirm Booking ({selectedSlots.length})
          </Button>
        </div>
      )}
    </div>
  );
}
    
