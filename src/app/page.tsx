
'use client'; 

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { format } from 'date-fns';
import { AppHeader } from '@/components/layout/header';
import { CalendarView } from '@/components/calendar/calendar-view';
import { Button } from '@/components/ui/button';
import { ShareDialog } from '@/components/share/share-dialog';
import { exportCalendarAsImage, exportCalendarAsPdf } from '@/lib/export';
import { getMockBookings, getWeekDates, calculateMonthlyClientMetrics, calculateBookingDurationInHours, CALENDAR_START_HOUR, CALENDAR_END_HOUR } from '@/lib/calendar-utils';
import type { Booking, MonthlyRecipe } from '@/types';
import { Share2, Image as ImageIcon, FileText, BarChart3, ChevronDown, ChevronUp, CheckCircle, XCircle, MinusCircle, CheckSquare } from 'lucide-react';

export default function HomePage() {
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const calendarExportId = "calendar-table-export-area"; 

  const [displayedDate, setDisplayedDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Initialize with mock bookings relevant to the initial displayed date's week
    setBookings(getMockBookings(getWeekDates(displayedDate)));
  }, [displayedDate]); // Re-fetch mock bookings if displayedDate changes significantly, or handle this more robustly if bookings were from a DB

  const handleNewBookings = (newlyConfirmedBookings: Booking[]) => {
    setBookings(prevBookings => [...prevBookings, ...newlyConfirmedBookings]);
  };

  const monthlyRecipe: MonthlyRecipe = useMemo(() => {
    return calculateMonthlyClientMetrics(bookings, displayedDate);
  }, [bookings, displayedDate]);

  const toggleClientExpansion = (clientName: string) => {
    setExpandedClients(prev => ({ ...prev, [clientName]: !prev[clientName] }));
  };

  return (
    <Suspense fallback={<div>Loading page content...</div>}>
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="flex-grow container mx-auto py-8 px-4 md:px-0">
          <div className="mb-8 p-6 bg-card rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-2 text-primary-foreground font-headline">Weekly Availability</h2>
            <p className="text-muted-foreground mb-1">
              View your studio's schedule for the week (Monday to Saturday, {String(CALENDAR_START_HOUR).padStart(2, '0')}:00 - {String(CALENDAR_END_HOUR).padStart(2, '0')}:00).
            </p>
            <ul className="text-muted-foreground list-none pl-0 mb-6 space-y-1 text-sm">
              <li className="flex items-center"><CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Available slot</li>
              <li className="flex items-center"><XCircle className="mr-2 h-4 w-4 text-destructive" /> Booked slot</li>
              <li className="flex items-center"><MinusCircle className="mr-2 h-4 w-4 text-yellow-500" /> Buffer time (1 hour before/after booking)</li>
              <li className="flex items-center"><CheckSquare className="mr-2 h-4 w-4 text-blue-500" /> Slot selected for booking</li>
            </ul>
            <p className="text-muted-foreground mb-6">Select available slots and fill in the details below to make a reservation.</p>
            <div className="flex flex-wrap gap-4 mb-6">
              <Button 
                onClick={() => exportCalendarAsImage(calendarExportId)} 
                variant="outline"
                className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                aria-label="Export calendar as image"
              >
                <ImageIcon className="mr-2 h-4 w-4" /> Export as Image
              </Button>
              <Button 
                onClick={() => exportCalendarAsPdf(calendarExportId)} 
                variant="outline"
                className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                aria-label="Export calendar as PDF"
              >
                <FileText className="mr-2 h-4 w-4" /> Export as PDF
              </Button>
              <Button 
                onClick={() => setIsShareDialogOpen(true)} 
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                aria-label="Share calendar availability"
              >
                <Share2 className="mr-2 h-4 w-4" /> Share Availability
              </Button>
            </div>
          </div>
          
          <CalendarView 
            initialDate={displayedDate}
            onDateChange={setDisplayedDate} // Pass the setter for date changes
            bookings={bookings} // Pass current bookings
            onNewBookingsAdd={handleNewBookings} // Pass the handler for new bookings
            calendarId={calendarExportId}
          />

          <div className="mt-12 p-6 bg-card rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4 text-primary-foreground flex items-center">
              <BarChart3 className="mr-2 h-6 w-6 text-primary" />
              Monthly Recipe for {format(displayedDate, 'MMMM yyyy')}
            </h3>
            {Object.keys(monthlyRecipe).length > 0 ? (
              <ul className="space-y-3">
                {Object.entries(monthlyRecipe).map(([clientName, data]) => (
                  <li key={clientName} className="p-3 bg-secondary/50 rounded-md shadow">
                    <div className="flex justify-between items-center">
                      <div>
                        <strong className="text-primary-foreground">{clientName}:</strong> 
                        <span className="ml-2 text-foreground">{data.totalHours.toFixed(1)} hours</span>
                        <span className="ml-2 text-muted-foreground">(@ R${data.pricePerHour.toFixed(2)}/hr)</span>
                        <span className="ml-2 font-semibold text-accent">Total: R${data.totalAmount.toFixed(2)}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => toggleClientExpansion(clientName)} className="text-accent hover:text-accent/80">
                        {expandedClients[clientName] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {expandedClients[clientName] ? 'See Less' : 'See More'}
                      </Button>
                    </div>
                    {expandedClients[clientName] && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Bookings:</h4>
                        <ul className="space-y-1 text-xs">
                          {bookings
                            .filter(b => b.clientName === clientName && format(b.startTime, 'yyyy-MM') === format(displayedDate, 'yyyy-MM'))
                            .sort((a,b) => a.startTime.getTime() - b.startTime.getTime())
                            .map(booking => (
                              <li key={booking.id} className="p-2 bg-muted/30 rounded">
                                <span className="font-medium">{format(booking.startTime, 'MMM d, HH:mm')}</span> - {booking.service || 'Session'} 
                                ({calculateBookingDurationInHours(booking).toFixed(1)} hrs)
                              </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No bookings found for this month to generate a recipe.</p>
            )}
          </div>
        </main>

        <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50">
          © {new Date().getFullYear()} SessionSnap. All rights reserved.
        </footer>

        <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} studioName="SessionSnap Studio" calendarLink="https://example.com/sessionsnap/book" />
      </div>
    </Suspense>
  );
}
