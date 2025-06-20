
import {
  addDays,
  startOfWeek,
  setHours,
  setMinutes,
  setSeconds,
  isWithinInterval,
  addHours,
  subHours,
  eachHourOfInterval,
  isSameHour,
  format,
  isSaturday,
  isSunday,
  nextMonday,
  isMonday,
  startOfMonth,
  endOfMonth,
  isSameMonth
} from 'date-fns';
import type { Booking, TimeSlot, MonthlyRecipe, ClientMonthlyMetrics } from '@/types';

const BUFFER_HOURS = 1;
export const CALENDAR_START_HOUR = 9;
export const CALENDAR_END_HOUR = 19; // Display up to 18:00-19:00 slot

export function getWeekDates(currentDate: Date = new Date()): Date[] {
  let monday = startOfWeek(currentDate, { weekStartsOn: 1 }); // 1 for Monday
  const weekDates: Date[] = [];
  for (let i = 0; i < 6; i++) { // Monday to Saturday
    weekDates.push(addDays(monday, i));
  }
  return weekDates;
}

export function generateTimeSlots(date: Date): Date[] {
  const startOfDay = setHours(setMinutes(setSeconds(date, 0), 0), CALENDAR_START_HOUR);
  const endOfDay = setHours(setMinutes(setSeconds(date, 0), 0), CALENDAR_END_HOUR -1); // up to 18:00 start slot for 18-19
  
  return eachHourOfInterval({
    start: startOfDay,
    end: endOfDay,
  });
}

export function checkSlotAvailability(
  slotTime: Date, 
  bookings: Booking[]
): { isBooked: boolean; isBuffer: boolean; bookingDetails?: Booking } {
  const slotEndTime = addHours(slotTime, 1);

  for (const booking of bookings) {
    const bookingStartTime = booking.startTime;
    const bookingEndTime = booking.endTime;

    // Check if the slot is directly booked
    if (
      (slotTime >= bookingStartTime && slotTime < bookingEndTime) ||
      (slotEndTime > bookingStartTime && slotEndTime <= bookingEndTime) ||
      (bookingStartTime >= slotTime && bookingEndTime <= slotEndTime)
    ) {
      return { isBooked: true, isBuffer: false, bookingDetails: booking };
    }
  }

  // Check if the slot is a buffer for another booking
  for (const booking of bookings) {
    const bookingStartTime = booking.startTime;
    const bookingEndTime = booking.endTime;

    const bufferBeforeStart = subHours(bookingStartTime, BUFFER_HOURS);
    const bufferAfterEnd = addHours(bookingEndTime, BUFFER_HOURS);

    // Is the slot within the buffer period before the booking?
    if (slotTime >= bufferBeforeStart && slotTime < bookingStartTime) {
      return { isBooked: false, isBuffer: true, bookingDetails: booking };
    }
    // Is the slot within the buffer period after the booking?
    if (slotTime >= bookingEndTime && slotTime < bufferAfterEnd) {
      return { isBooked: false, isBuffer: true, bookingDetails: booking };
    }
  }

  return { isBooked: false, isBuffer: false };
}

export function getMockBookings(weekDates: Date[]): Booking[] {
  const bookings: Booking[] = [];
  if (weekDates.length === 0) return bookings;

  const monday = weekDates[0];
  const tuesday = weekDates[1];
  const thursday = weekDates[3];

  bookings.push({
    id: '1',
    startTime: setHours(setMinutes(monday,0), 10), 
    endTime: setHours(setMinutes(monday,0), 11),   
    clientName: 'Alice Wonderland',
    service: 'Vocal Recording',
    title: 'Alice - Vocals',
  });
  bookings.push({
    id: '2',
    startTime: setHours(setMinutes(tuesday,0), 14), 
    endTime: setHours(setMinutes(tuesday,0), 16),   
    clientName: 'Bob The Builder',
    service: 'Mixing Session',
    title: 'Bob - Mix',
  });
   bookings.push({
    id: '3',
    startTime: setHours(setMinutes(thursday,0), 17), 
    endTime: setHours(setMinutes(thursday,0), 18),   
    clientName: 'Charlie Chaplin',
    service: 'Podcast Production',
    title: 'Charlie - Podcast',
  });
   bookings.push({
    id: '4',
    startTime: setHours(setMinutes(thursday,0), 9), 
    endTime: setHours(setMinutes(thursday,0), 11),   
    clientName: 'Diana Prince',
    service: 'Mastering',
    title: 'Diana - Master',
  });
  bookings.push({ 
    id: '5',
    startTime: setHours(setMinutes(tuesday,0), 10), 
    endTime: setHours(setMinutes(tuesday,0), 12),   
    clientName: 'Alice Wonderland',
    service: 'ADR Session',
    title: 'Alice - ADR',
  });


  return bookings;
}

export function calculateBookingDurationInHours(booking: Booking): number {
  if (!booking.startTime || !booking.endTime) return 0;
  const durationMillis = booking.endTime.getTime() - booking.startTime.getTime();
  return durationMillis / (1000 * 60 * 60);
}

function getTieredPricePerHour(totalHours: number): number {
  if (totalHours >= 40) return 160;
  if (totalHours >= 20) return 230; // 20 to 39 hours
  if (totalHours >= 10) return 260; // 10 to 19 hours
  // 0 to 9 hours (covers totalHours < 10)
  return 350; 
}

export function calculateClientMonthlyInvoice(bookingDurations: number[]): ClientMonthlyMetrics {
  const totalHours = bookingDurations.reduce((sum, duration) => sum + duration, 0);
  const pricePerHour = getTieredPricePerHour(totalHours);
  const totalAmount = totalHours * pricePerHour;
  return { totalHours, pricePerHour, totalAmount };
}

export function calculateMonthlyClientMetrics(
  bookings: Booking[],
  targetDateForMonth: Date
): MonthlyRecipe {
  const clientBookingsForMonth: Record<string, number[]> = {};

  // 1. Group booking durations by client for the target month
  bookings.forEach(booking => {
    if (isSameMonth(booking.startTime, targetDateForMonth) && booking.clientName) {
      if (!clientBookingsForMonth[booking.clientName]) {
        clientBookingsForMonth[booking.clientName] = [];
      }
      const duration = calculateBookingDurationInHours(booking);
      clientBookingsForMonth[booking.clientName].push(duration);
    }
  });

  const monthlyRecipe: MonthlyRecipe = {};
  // 2. Calculate invoice for each client
  for (const clientName in clientBookingsForMonth) {
    const durations = clientBookingsForMonth[clientName];
    if (durations && durations.length > 0) {
        monthlyRecipe[clientName] = calculateClientMonthlyInvoice(durations);
    } else {
        // Handle cases where a client might exist but have no hours in the filtered month (should be rare with above logic)
        monthlyRecipe[clientName] = { totalHours: 0, pricePerHour: getTieredPricePerHour(0), totalAmount: 0 };
    }
  }

  return monthlyRecipe;
}
